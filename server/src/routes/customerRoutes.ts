import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Customer } from '../models/Customer';
import { Branch } from '../models/Branch';
import { Loan } from '../models/Loan';
import { Installment } from '../models/Installment';
import { Payment } from '../models/Payment';
import { FollowUp } from '../models/FollowUp';
import { getNextCustomerId } from '../services/customerService';
import { authenticate } from '../middleware/auth';
import { enforceBranchScope, requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate);
router.use(enforceBranchScope);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, area, branchId, page = 1, limit = 100, sortBy = 'id_asc' } = req.query;
    const query: any = {};

    if (req.user?.role !== 'MAIN_ADMIN') {
      query.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '' && branchId !== 'ALL') {
      query.branchId = branchId;
    }

    if (area && area !== 'ALL' && String(area).trim() !== '') {
      query.area = area;
    }

    if (search) {
      const searchRegex = new RegExp(String(search), 'i');
      query.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { customerId: searchRegex },
        { area: searchRegex }
      ];
    }

    const p = Math.max(1, parseInt(String(page)) || 1);
    let l = limit === 'all' || limit === 'ALL' || limit === '0' ? 1000 : (parseInt(String(limit)) || 100);
    if (l <= 0) l = 100;

    let sortObj: any = { customerId: 1 };
    if (sortBy === 'id_desc') sortObj = { customerId: -1 };
    else if (sortBy === 'name_asc') sortObj = { name: 1 };
    else if (sortBy === 'name_desc') sortObj = { name: -1 };
    else if (sortBy === 'newest') sortObj = { createdAt: -1 };
    else if (sortBy === 'oldest') sortObj = { createdAt: 1 };

    const loanScopeQuery: any = {};
    if (query.branchId) loanScopeQuery.branchId = query.branchId;

    const [total, activeCount, closedCount, activeLoansCount, closedLoansCount] = await Promise.all([
      Customer.countDocuments(query),
      Customer.countDocuments({ ...query, status: 'ACTIVE' }),
      Customer.countDocuments({ ...query, status: { $in: ['CLOSED', 'SETTLED', 'INACTIVE'] } }),
      Loan.countDocuments({ ...loanScopeQuery, status: { $in: ['ACTIVE', 'OVERDUE'] } }),
      Loan.countDocuments({ ...loanScopeQuery, status: 'CLOSED' })
    ]);

    const customers = await Customer.find(query)
      .populate('branchId', 'name code')
      .populate('activeGroupId', 'name collectionDay groupCode')
      .sort(sortObj)
      .skip((p - 1) * l)
      .limit(l)
      .lean();

    const customerIds = customers.map(c => c._id);
    const loans = await Loan.find({ customerId: { $in: customerIds } })
      .select('customerId loanNumber loanAccountNumber status principal totalPayable totalReceivable amountPaid totalPaid outstandingTotal productType productTier')
      .lean();

    const loanMap = new Map();
    for (const loan of loans) {
      const existing = loanMap.get(String(loan.customerId));
      if (!existing || (loan.status === 'ACTIVE' && existing.status !== 'ACTIVE')) {
        loanMap.set(String(loan.customerId), loan);
      }
    }

    const enhancedCustomers = customers.map(c => {
      const doc: any = c.toObject ? c.toObject() : { ...c };
      doc.loan = loanMap.get(String(c._id)) || null;
      return doc;
    });

    res.json({
      success: true,
      customers: enhancedCustomers,
      counts: {
        total,
        active: activeCount,
        closed: closedCount,
        activeLoansCount,
        closedLoansCount
      },
      pagination: {
        page: p,
        limit: l,
        total,
        pages: Math.ceil(total / l)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/customers/check-duplicate - Real-time duplicate entry detector for KYC and contact numbers
router.get('/check-duplicate', async (req: Request, res: Response) => {
  try {
    const {
      aadharNumber,
      voterIdNumber,
      smartCardNumber,
      panNumber,
      phone,
      excludeId
    } = req.query;

    const conditions: any[] = [];
    const fieldMap: Record<string, string> = {};

    if (aadharNumber && String(aadharNumber).trim().length >= 4) {
      const cleanAadhar = String(aadharNumber).trim();
      conditions.push({ aadharNumber: cleanAadhar });
      fieldMap['aadharNumber'] = cleanAadhar;
    }

    if (voterIdNumber && String(voterIdNumber).trim().length >= 3) {
      const cleanVoter = String(voterIdNumber).trim().toUpperCase();
      conditions.push({ voterIdNumber: cleanVoter });
      fieldMap['voterIdNumber'] = cleanVoter;
    }

    if (smartCardNumber && String(smartCardNumber).trim().length >= 3) {
      const cleanSmart = String(smartCardNumber).trim().toUpperCase();
      conditions.push({ smartCardNumber: cleanSmart });
      fieldMap['smartCardNumber'] = cleanSmart;
    }

    if (panNumber && String(panNumber).trim().length >= 5) {
      const cleanPan = String(panNumber).trim().toUpperCase();
      conditions.push({ panNumber: cleanPan });
      fieldMap['panNumber'] = cleanPan;
    }

    if (phone && String(phone).trim().length >= 8) {
      const cleanPhone = String(phone).trim();
      conditions.push({ phone: cleanPhone });
      fieldMap['phone'] = cleanPhone;
    }

    if (conditions.length === 0) {
      res.json({ success: true, exists: false });
      return;
    }

    const query: any = { $or: conditions };
    if (excludeId && mongoose.Types.ObjectId.isValid(String(excludeId))) {
      query._id = { $ne: excludeId };
    }

    const existingCustomer = await Customer.findOne(query).populate('branchId', 'name code').lean();

    if (!existingCustomer) {
      res.json({ success: true, exists: false });
      return;
    }

    // Determine which field matched
    let matchedField = 'KYC Number';
    let matchedValue = '';

    if (fieldMap['aadharNumber'] && existingCustomer.aadharNumber === fieldMap['aadharNumber']) {
      matchedField = 'Aadhaar Card';
      matchedValue = existingCustomer.aadharNumber;
    } else if (fieldMap['voterIdNumber'] && existingCustomer.voterIdNumber?.toUpperCase() === fieldMap['voterIdNumber']) {
      matchedField = 'Voter ID';
      matchedValue = existingCustomer.voterIdNumber;
    } else if (fieldMap['smartCardNumber'] && existingCustomer.smartCardNumber?.toUpperCase() === fieldMap['smartCardNumber']) {
      matchedField = 'Smart Card (Ration Card)';
      matchedValue = existingCustomer.smartCardNumber;
    } else if (fieldMap['panNumber'] && existingCustomer.panNumber?.toUpperCase() === fieldMap['panNumber']) {
      matchedField = 'PAN Card';
      matchedValue = existingCustomer.panNumber;
    } else if (fieldMap['phone'] && existingCustomer.phone === fieldMap['phone']) {
      matchedField = 'Phone Number';
      matchedValue = existingCustomer.phone;
    }

    res.json({
      success: true,
      exists: true,
      matchedField,
      matchedValue,
      customer: {
        _id: existingCustomer._id,
        customerId: existingCustomer.customerId,
        name: existingCustomer.name,
        phone: existingCustomer.phone,
        area: existingCustomer.area,
        branchName: (existingCustomer.branchId as any)?.name || '',
        aadharNumber: existingCustomer.aadharNumber,
        voterIdNumber: existingCustomer.voterIdNumber,
        smartCardNumber: existingCustomer.smartCardNumber,
        panNumber: existingCustomer.panNumber,
        spouseName: existingCustomer.spouseName,
        nomineeName: existingCustomer.nomineeName,
        nomineePhone: existingCustomer.nomineePhone,
        nomineeRelationship: existingCustomer.nomineeRelationship
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('branchId')
      .populate('activeGroupId');

    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }

    // Branch authorization check
    if (req.user?.role !== 'MAIN_ADMIN' && String(customer.branchId._id) !== String(req.user?.branchId)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    // Fetch related loan history
    const loans = await Loan.find({ customerId: customer._id })
      .populate('groupId', 'name collectionDay')
      .sort({ createdAt: -1 });

    // Fetch active loan installments and payments
    const activeLoan = loans.find(l => l.status === 'ACTIVE' || l.status === 'OVERDUE') || loans[0];
    let installments: any[] = [];
    let payments: any[] = [];

    if (activeLoan) {
      installments = await Installment.find({ loanId: activeLoan._id }).sort({ installmentNumber: 1 });
      payments = await Payment.find({ loanId: activeLoan._id, isReversed: false }).sort({ paymentDate: -1 });
    }

    const followUps = await FollowUp.find({ customerId: customer._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      customer,
      loans,
      activeLoan,
      installments,
      payments,
      followUps
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const {
      name,
      phone,
      nomineePhone,
      address,
      area,
      activeGroupId,
      notes,
      smartCardNumber,
      aadharNumber,
      voterIdNumber,
      panNumber,
      spouseName,
      nomineeName,
      nomineeRelationship
    } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'Customer name is required' });
      return;
    }

    // Duplicate check on KYC & Phone
    const dupChecks: any[] = [];
    if (aadharNumber && String(aadharNumber).trim().length >= 4) {
      dupChecks.push({ aadharNumber: String(aadharNumber).trim() });
    }
    if (voterIdNumber && String(voterIdNumber).trim().length >= 3) {
      dupChecks.push({ voterIdNumber: String(voterIdNumber).trim().toUpperCase() });
    }
    if (smartCardNumber && String(smartCardNumber).trim().length >= 3) {
      dupChecks.push({ smartCardNumber: String(smartCardNumber).trim().toUpperCase() });
    }
    if (panNumber && String(panNumber).trim().length >= 5) {
      dupChecks.push({ panNumber: String(panNumber).trim().toUpperCase() });
    }
    if (phone && String(phone).trim().length >= 8) {
      dupChecks.push({ phone: String(phone).trim() });
    }

    if (dupChecks.length > 0) {
      const existing = await Customer.findOne({ $or: dupChecks }).populate('branchId', 'name').lean();
      if (existing) {
        let fieldName = 'KYC details';
        if (aadharNumber && existing.aadharNumber === String(aadharNumber).trim()) fieldName = 'Aadhaar Number';
        else if (voterIdNumber && existing.voterIdNumber?.toUpperCase() === String(voterIdNumber).trim().toUpperCase()) fieldName = 'Voter ID';
        else if (smartCardNumber && existing.smartCardNumber?.toUpperCase() === String(smartCardNumber).trim().toUpperCase()) fieldName = 'Smart Card';
        else if (panNumber && existing.panNumber?.toUpperCase() === String(panNumber).trim().toUpperCase()) fieldName = 'PAN Number';
        else if (phone && existing.phone === String(phone).trim()) fieldName = 'Phone Number';

        res.status(400).json({
          success: false,
          message: `Customer already exists with this ${fieldName}: ${existing.name} (${existing.customerId}) in ${(existing.branchId as any)?.name || existing.area || 'system'}`
        });
        return;
      }
    }

    const branchId = req.user?.role === 'MAIN_ADMIN' ? (req.body.branchId || req.user?.branchId) : req.user?.branchId;
    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID is required' });
      return;
    }

    const branch = await Branch.findById(branchId);
    const customerId = await getNextCustomerId(branch?.code || 'PL');

    const customer = await Customer.create({
      customerId,
      name: name.trim(),
      phone: phone ? String(phone).trim() : '',
      nomineePhone: nomineePhone ? String(nomineePhone).trim() : '',
      address: address ? String(address).trim() : '',
      area: area ? String(area).trim() : '',
      branchId,
      activeGroupId: activeGroupId || null,
      notes: notes || '',
      smartCardNumber: smartCardNumber ? String(smartCardNumber).trim().toUpperCase() : '',
      aadharNumber: aadharNumber ? String(aadharNumber).trim() : '',
      voterIdNumber: voterIdNumber ? String(voterIdNumber).trim().toUpperCase() : '',
      panNumber: panNumber ? String(panNumber).trim().toUpperCase() : '',
      spouseName: spouseName ? String(spouseName).trim() : '',
      nomineeName: nomineeName ? String(nomineeName).trim() : '',
      nomineeRelationship: nomineeRelationship ? String(nomineeRelationship).trim() : '',
      status: 'ACTIVE'
    });

    res.status(201).json({ success: true, customer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }

    if (req.user?.role !== 'MAIN_ADMIN' && String(customer.branchId) !== String(req.user?.branchId)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const { 
      name, 
      phone, 
      spouseName, 
      nomineeName, 
      nomineeRelationship, 
      nomineePhone, 
      address, 
      area, 
      smartCardNumber, 
      aadharNumber, 
      voterIdNumber, 
      panNumber, 
      activeGroupId, 
      status, 
      notes 
    } = req.body;

    // Duplicate check on KYC & Phone excluding current customer
    const dupChecks: any[] = [];
    if (aadharNumber && String(aadharNumber).trim().length >= 4) {
      dupChecks.push({ aadharNumber: String(aadharNumber).trim() });
    }
    if (voterIdNumber && String(voterIdNumber).trim().length >= 3) {
      dupChecks.push({ voterIdNumber: String(voterIdNumber).trim().toUpperCase() });
    }
    if (smartCardNumber && String(smartCardNumber).trim().length >= 3) {
      dupChecks.push({ smartCardNumber: String(smartCardNumber).trim().toUpperCase() });
    }
    if (panNumber && String(panNumber).trim().length >= 5) {
      dupChecks.push({ panNumber: String(panNumber).trim().toUpperCase() });
    }
    if (phone && String(phone).trim().length >= 8) {
      dupChecks.push({ phone: String(phone).trim() });
    }

    if (dupChecks.length > 0) {
      const existing = await Customer.findOne({ _id: { $ne: req.params.id }, $or: dupChecks }).populate('branchId', 'name').lean();
      if (existing) {
        let fieldName = 'KYC details';
        if (aadharNumber && existing.aadharNumber === String(aadharNumber).trim()) fieldName = 'Aadhaar Number';
        else if (voterIdNumber && existing.voterIdNumber?.toUpperCase() === String(voterIdNumber).trim().toUpperCase()) fieldName = 'Voter ID';
        else if (smartCardNumber && existing.smartCardNumber?.toUpperCase() === String(smartCardNumber).trim().toUpperCase()) fieldName = 'Smart Card';
        else if (panNumber && existing.panNumber?.toUpperCase() === String(panNumber).trim().toUpperCase()) fieldName = 'PAN Number';
        else if (phone && existing.phone === String(phone).trim()) fieldName = 'Phone Number';

        res.status(400).json({
          success: false,
          message: `Cannot update: ${fieldName} already belongs to another customer: ${existing.name} (${existing.customerId}) in ${(existing.branchId as any)?.name || existing.area || 'system'}`
        });
        return;
      }
    }

    if (name) customer.name = name;
    if (phone !== undefined) customer.phone = phone;
    if (spouseName !== undefined) customer.spouseName = spouseName;
    if (nomineeName !== undefined) customer.nomineeName = nomineeName;
    if (nomineeRelationship !== undefined) customer.nomineeRelationship = nomineeRelationship;
    if (nomineePhone !== undefined) customer.nomineePhone = nomineePhone;
    if (address !== undefined) customer.address = address;
    if (area !== undefined) customer.area = area;
    if (smartCardNumber !== undefined) customer.smartCardNumber = smartCardNumber;
    if (aadharNumber !== undefined) customer.aadharNumber = aadharNumber;
    if (voterIdNumber !== undefined) customer.voterIdNumber = voterIdNumber;
    if (panNumber !== undefined) customer.panNumber = panNumber;
    if (activeGroupId !== undefined) customer.activeGroupId = activeGroupId;
    if (status) customer.status = status;
    if (notes !== undefined) customer.notes = notes;

    await customer.save();
    res.json({ success: true, customer, message: 'Customer profile updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete customer (MAIN_ADMIN only)
router.delete('/:id', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }

    await Customer.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: `Customer ${customer.name} deleted successfully` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
