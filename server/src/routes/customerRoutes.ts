import { Router, Request, Response } from 'express';
import { Customer } from '../models/Customer';
import { Branch } from '../models/Branch';
import { Loan } from '../models/Loan';
import { Installment } from '../models/Installment';
import { Payment } from '../models/Payment';
import { FollowUp } from '../models/FollowUp';
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
    } else if (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      query.branchId = branchId;
    }

    if (area) {
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

    const total = await Customer.countDocuments(query);
    const activeCount = await Customer.countDocuments({ ...query, status: 'ACTIVE' });
    const closedCount = await Customer.countDocuments({ ...query, status: { $in: ['CLOSED', 'SETTLED', 'INACTIVE'] } });

    const loanScopeQuery: any = {};
    if (query.branchId) loanScopeQuery.branchId = query.branchId;

    const activeLoansCount = await Loan.countDocuments({ ...loanScopeQuery, status: { $in: ['ACTIVE', 'OVERDUE'] } });
    const closedLoansCount = await Loan.countDocuments({ ...loanScopeQuery, status: 'CLOSED' });

    const customers = await Customer.find(query)
      .populate('branchId', 'name code')
      .populate('activeGroupId', 'name collectionDay groupCode')
      .sort(sortObj)
      .skip((p - 1) * l)
      .limit(l);

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
      const doc: any = c.toObject();
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
    const { name, phone, nomineePhone, address, area, activeGroupId, notes } = req.body;
    if (!name) {
      res.status(400).json({ success: false, message: 'Customer name is required' });
      return;
    }

    const branchId = req.user?.role === 'MAIN_ADMIN' ? (req.body.branchId || req.user?.branchId) : req.user?.branchId;
    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID is required' });
      return;
    }

    const branch = await Branch.findById(branchId);
    const bCode = branch?.code === 'MDKM' ? 'MDKM' : 'PL';
    const seq = (await Customer.countDocuments()) + 1;
    const customerId = `ATH-${bCode}-CUST-${String(seq).padStart(4, '0')}`;

    const customer = await Customer.create({
      customerId,
      name,
      phone: phone || '',
      nomineePhone: nomineePhone || '',
      address: address || '',
      area: area || '',
      branchId,
      activeGroupId: activeGroupId || null,
      notes: notes || ''
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
