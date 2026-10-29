import { Router, Request, Response } from 'express';
import { Loan } from '../models/Loan';
import { Customer } from '../models/Customer';
import { Group } from '../models/Group';
import { Branch } from '../models/Branch';
import { Installment } from '../models/Installment';
import { Payment } from '../models/Payment';
import { User } from '../models/User';
import { calculateLoanSchedule, getNextWeekdayDate } from '../services/loanCalculator';
import { calculateEarlySettlement } from '../services/earlySettlementService';
import { recordCashbookEntry } from '../services/cashbookService';
import { getNextReceiptNumber } from '../services/receiptService';
import { authenticate } from '../middleware/auth';
import { enforceBranchScope, requireRole } from '../middleware/roles';
import { LOAN_PRODUCT_PRESETS } from '../constants/loanProducts';
import { Enquiry } from '../models/Enquiry';
import { LoanTier } from '../models/LoanTier';

const router = Router();

router.use(authenticate);
router.use(enforceBranchScope);

// List loans with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { branchId, status, groupId, customerId, cycle, assignedStaffId, collectionDay, search, page = 1, limit = 200 } = req.query;
    const query: any = {};

    if (req.user?.role === 'COLLECTION_STAFF') {
      // Collection staff strictly sees loans assigned to them for verification / servicing
      query.branchId = req.user?.branchId;
      const staffId = req.user?.id || req.user?._id;
      query.$or = [
        { assignedStaffId: staffId },
        { 'verification.verifiedBy': staffId }
      ];
    } else if (req.user?.role !== 'MAIN_ADMIN') {
      query.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      query.branchId = branchId;
    }

    if (status && status !== 'ALL') query.status = status;
    if (groupId) query.groupId = groupId;
    if (customerId) query.customerId = customerId;
    if (cycle) query.cycle = parseInt(String(cycle));
    if (assignedStaffId) query.assignedStaffId = assignedStaffId;

    if (collectionDay && collectionDay !== 'ALL') {
      const matchingDayGroupIds = await Group.find({ collectionDay }).distinct('_id');
      const dayFilter = {
        $or: [
          { collectionDay: collectionDay },
          { groupId: { $in: matchingDayGroupIds } }
        ]
      };
      if (query.$and) {
        query.$and.push(dayFilter);
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, dayFilter];
        delete query.$or;
      } else {
        query.$or = dayFilter.$or;
      }
    }

    if (search && String(search).trim()) {
      const sTerm = String(search).trim();
      const sRegex = new RegExp(sTerm, 'i');
      const matchingCustomerIds = await Customer.find({
        $or: [{ name: sRegex }, { phone: sRegex }, { customerId: sRegex }]
      }).distinct('_id');
      const matchingGroupIds = await Group.find({
        $or: [{ name: sRegex }, { groupCode: !isNaN(Number(sTerm)) ? Number(sTerm) : -1 }]
      }).distinct('_id');

      const searchFilter = {
        $or: [
          { loanNumber: sRegex },
          { customerName: sRegex },
          { customerPhone: sRegex },
          { customerId: { $in: matchingCustomerIds } },
          { groupId: { $in: matchingGroupIds } }
        ]
      };
      if (query.$and) {
        query.$and.push(searchFilter);
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, searchFilter];
        delete query.$or;
      } else {
        query.$or = searchFilter.$or;
      }
    }

    const p = parseInt(String(page));
    const l = parseInt(String(limit));
    const total = await Loan.countDocuments(query);

    const loans = await Loan.find(query)
      .populate('customerId', 'name phone customerId area smartCardNumber aadharNumber voterIdNumber panNumber')
      .populate('groupId', 'name collectionDay groupCode')
      .populate('branchId', 'name code')
      .populate('assignedStaffId', 'name username phone')
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l);

    res.json({
      success: true,
      loans,
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

// GET /api/loans/presets - Fetch standardized microfinance loan templates from dynamic DB or presets
router.get('/presets', async (req: Request, res: Response) => {
  try {
    let tiers = await LoanTier.find({ isActive: true }).sort({ sortOrder: 1, principal: 1 });
    if (!tiers || tiers.length === 0) {
      tiers = LOAN_PRODUCT_PRESETS as any;
    }
    res.json({
      success: true,
      presets: tiers,
      tiers
    });
  } catch (err: any) {
    res.json({
      success: true,
      presets: LOAN_PRODUCT_PRESETS
    });
  }
});

// Single loan details + schedule + payments
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('customerId')
      .populate('groupId')
      .populate('branchId')
      .populate('assignedStaffId', 'name username phone')
      .populate('verification.verifiedBy', 'name username phone')
      .populate('approvedBy', 'name username');

    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }

    if (req.user?.role !== 'MAIN_ADMIN' && String((loan.branchId as any)._id) !== String(req.user?.branchId)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    let installments = await Installment.find({ loanId: loan._id }).sort({ installmentNumber: 1 });
    const payments = await Payment.find({ loanId: loan._id, isReversed: false }).sort({ paymentDate: -1 });

    // Auto-repair installments if loan matches a product preset and has outdated proportional ratio breakdown
    if (loan.tenureWeeks && loan.principal && installments.length > 0) {
      const preset = LOAN_PRODUCT_PRESETS.find(p => p.principal === loan.principal && p.tenureWeeks === loan.tenureWeeks);
      if (preset && preset.schedule.length > 0) {
        const firstPresetP = preset.schedule[0]?.principal;
        if (firstPresetP && installments[0].allocatedPrincipal !== firstPresetP && installments[0].status === 'PENDING') {
          for (const inst of installments) {
            if (inst.status === 'PENDING' && inst.paidAmount === 0) {
              const match = preset.schedule.find(s => s.week === inst.installmentNumber);
              if (match) {
                inst.allocatedPrincipal = match.principal;
                inst.allocatedInterest = match.interest;
                inst.allocatedSavings = match.savings;
                inst.expectedAmount = match.total;
                inst.balanceAmount = match.total;
                await inst.save();
              }
            }
          }
          // Reload refreshed installments
          installments = await Installment.find({ loanId: loan._id }).sort({ installmentNumber: 1 });
        }
      }
    }

    const totalPaid = (loan.status === 'SETTLED' || loan.status === 'CLOSED')
      ? (loan.totalPayable || loan.totalPaid || 0)
      : installments.reduce((acc, inst) => acc + (inst.paidAmount || 0), 0);
    const outstandingTotal = (loan.status === 'SETTLED' || loan.status === 'CLOSED')
      ? 0
      : Math.max(0, (loan.totalPayable || 0) - totalPaid);

    res.json({
      success: true,
      loan: {
        ...loan.toObject(),
        totalPaid,
        outstandingTotal
      },
      installments,
      payments
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Calculate loan terms preview (dry run)
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const { principal, productType, docCharges, savingsAmount, tenureWeeks, startDate, collectionDay } = req.body;
    if (!principal) {
      res.status(400).json({ success: false, message: 'Principal amount is required' });
      return;
    }

    const result = calculateLoanSchedule({
      principal: parseFloat(principal),
      productType,
      docCharges: docCharges ? parseFloat(docCharges) : undefined,
      savingsAmount: savingsAmount ? parseFloat(savingsAmount) : undefined,
      tenureWeeks: tenureWeeks ? parseInt(tenureWeeks) : undefined,
      startDate: startDate ? new Date(startDate) : new Date(),
      collectionDay
    });

    res.json({ success: true, calculation: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Apply for a loan (Status: SUBMITTED or PENDING_VERIFICATION)
router.post('/apply', async (req: Request, res: Response) => {
  try {
    const { customerId, groupId, principal, productType, tenureWeeks, notes, assignedStaffId } = req.body;
    if (!customerId || !groupId || !principal) {
      res.status(400).json({ success: false, message: 'Customer, group, and principal are required' });
      return;
    }

    const customer = await Customer.findById(customerId);
    const group = await Group.findById(groupId);
    if (!customer || !group) {
      res.status(404).json({ success: false, message: 'Customer or Group not found' });
      return;
    }

    const branchId = group.branchId;

    const calc = calculateLoanSchedule({
      principal: parseFloat(principal),
      productType,
      tenureWeeks: tenureWeeks ? parseInt(tenureWeeks) : undefined,
      startDate: new Date(),
      collectionDay: group.collectionDay
    });

    const branch = await Branch.findById(group.branchId);
    const bCode = branch?.code === 'MDKM' ? 'MDKM' : 'PL';
    const loanNumber = `ATH-${bCode}-LN-${group.groupCode}-${customer.customerId}`;

    let staffName = '';
    let initialStatus: any = 'SUBMITTED';
    let assignedDate: Date | null = null;

    if (assignedStaffId) {
      const staffUser = await User.findById(assignedStaffId);
      if (staffUser) {
        staffName = staffUser.name;
        initialStatus = 'PENDING_VERIFICATION';
        assignedDate = new Date();
      }
    }

    const loan = await Loan.create({
      loanNumber,
      customerId: customer._id,
      groupId: group._id,
      branchId,
      cycle: group.cycle,
      productType: calc.productType,
      principal: calc.principal,
      interestRate: calc.interestRate,
      interestAmount: calc.interestAmount,
      docCharges: calc.docCharges,
      savingsAmount: calc.savingsAmount,
      totalPayable: calc.totalPayable,
      tenureWeeks: calc.tenureWeeks,
      repaymentFrequency: 'WEEKLY',
      status: initialStatus,
      assignedStaffId: assignedStaffId || null,
      assignedStaffName: staffName,
      assignedAt: assignedDate,
      verification: {
        smartCardNumber: '',
        aadharNumber: '',
        voterIdNumber: '',
        panNumber: '',
        remarks: '',
        verifiedBy: null,
        verifiedByName: '',
        verifiedAt: null,
        status: 'PENDING'
      },
      outstandingPrincipal: calc.principal,
      outstandingInterest: calc.interestAmount,
      outstandingTotal: calc.totalPayable,
      totalPaid: 0,
      notes: notes || ''
    });

    res.status(201).json({ success: true, loan });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign or Reassign / Transfer Staff (Manager & Admin)
router.put('/:id/assign-staff', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const { staffId, transferType = 'PERMANENT', remarks = '' } = req.body;
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }

    const isTemporary = transferType === 'TEMPORARY';
    loan.transferType = isTemporary ? 'TEMPORARY' : 'PERMANENT';
    loan.isTemporaryTransfer = isTemporary;
    loan.transferRemarks = remarks;

    if (staffId && staffId !== 'MANAGER') {
      const staffUser = await User.findById(staffId);
      if (!staffUser) {
        res.status(404).json({ success: false, message: 'Collection staff member not found' });
        return;
      }
      loan.assignedStaffId = staffUser._id as any;
      loan.assignedStaffName = staffUser.name;
      loan.assignedAt = new Date();

      if (!isTemporary && loan.groupId) {
        await Group.findByIdAndUpdate(loan.groupId, {
          staffId: staffUser._id,
          staffName: staffUser.name
        });
      }
    } else {
      // Reassign to current Manager
      const mgrId = req.user?.id || req.user?._id;
      const mgrName = req.user?.name || req.user?.username || 'Branch Manager';
      loan.assignedStaffId = mgrId as any;
      loan.assignedStaffName = mgrName;
      loan.assignedAt = new Date();

      if (!isTemporary && loan.groupId) {
        await Group.findByIdAndUpdate(loan.groupId, {
          staffId: mgrId as any,
          staffName: mgrName
        });
      }
    }

    await loan.save();
    res.json({
      success: true,
      loan,
      message: `Loan successfully transferred to ${loan.assignedStaffName} (${isTemporary ? 'One-Time Temporary' : 'Until Changed'})`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk Loan Transfer (Manager & Admin)
router.post('/transfer-bulk', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const { loanIds, staffId, transferType = 'PERMANENT', remarks = '' } = req.body;

    if (!Array.isArray(loanIds) || loanIds.length === 0) {
      res.status(400).json({ success: false, message: 'At least one loan must be selected for transfer' });
      return;
    }

    let targetStaffId: any = null;
    let targetStaffName = 'Branch Manager';

    if (staffId && staffId !== 'MANAGER') {
      const staffUser = await User.findById(staffId);
      if (!staffUser) {
        res.status(404).json({ success: false, message: 'Collection staff member not found' });
        return;
      }
      targetStaffId = staffUser._id;
      targetStaffName = staffUser.name;
    } else {
      targetStaffId = req.user?.id || req.user?._id;
      targetStaffName = req.user?.name || req.user?.username || 'Branch Manager';
    }

    const isTemporary = transferType === 'TEMPORARY';

    const result = await Loan.updateMany(
      { _id: { $in: loanIds } },
      {
        $set: {
          assignedStaffId: targetStaffId,
          assignedStaffName: targetStaffName,
          assignedAt: new Date(),
          transferType: isTemporary ? 'TEMPORARY' : 'PERMANENT',
          isTemporaryTransfer: isTemporary,
          transferRemarks: remarks
        }
      }
    );

    // If permanent transfer, also update associated groups
    if (!isTemporary && targetStaffId) {
      const loans = await Loan.find({ _id: { $in: loanIds } }).select('groupId');
      const groupIds = [...new Set(loans.map(l => l.groupId).filter(Boolean))];
      if (groupIds.length > 0) {
        await Group.updateMany(
          { _id: { $in: groupIds } },
          { $set: { staffId: targetStaffId, staffName: targetStaffName } }
        );
      }
    }

    res.json({
      success: true,
      modifiedCount: result.modifiedCount,
      message: `${result.modifiedCount} loan(s) successfully transferred to ${targetStaffName} (${isTemporary ? 'One-Time Temporary' : 'Until Changed'})`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Loan Record (Manager & Admin - all fields)
router.put('/:id', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }

    if (req.user?.role !== 'MAIN_ADMIN' && String(loan.branchId) !== String(req.user?.branchId)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const {
      loanNumber,
      principal,
      interestAmount,
      docCharges,
      savingsAmount,
      totalPayable,
      outstandingTotal,
      totalPaid,
      tenureWeeks,
      status,
      collectionDay,
      assignedStaffId,
      assignedStaffName,
      customerName,
      customerPhone,
      spouseName,
      nomineeName,
      nomineePhone,
      notes,
      repaymentFrequency,
      loanCategory
    } = req.body;

    if (loanNumber) loan.loanNumber = loanNumber;
    if (principal !== undefined) loan.principal = Number(principal);
    if (interestAmount !== undefined) loan.interestAmount = Number(interestAmount);
    if (docCharges !== undefined) loan.docCharges = Number(docCharges);
    if (savingsAmount !== undefined) loan.savingsAmount = Number(savingsAmount);
    if (totalPayable !== undefined) loan.totalPayable = Number(totalPayable);
    if (outstandingTotal !== undefined) loan.outstandingTotal = Number(outstandingTotal);
    if (totalPaid !== undefined) loan.totalPaid = Number(totalPaid);
    if (tenureWeeks !== undefined) loan.tenureWeeks = Number(tenureWeeks);
    if (status) loan.status = status;
    if (collectionDay) loan.collectionDay = collectionDay;
    if (assignedStaffId !== undefined) loan.assignedStaffId = assignedStaffId || null;
    if (assignedStaffName !== undefined) loan.assignedStaffName = assignedStaffName;
    if (customerName !== undefined) loan.customerName = customerName;
    if (customerPhone !== undefined) loan.customerPhone = customerPhone;
    if (spouseName !== undefined) loan.spouseName = spouseName;
    if (nomineeName !== undefined) loan.nomineeName = nomineeName;
    if (nomineePhone !== undefined) loan.nomineePhone = nomineePhone;
    if (notes !== undefined) loan.notes = notes;
    if (repaymentFrequency !== undefined) loan.repaymentFrequency = repaymentFrequency;
    if (loanCategory !== undefined) loan.loanCategory = loanCategory;

    await loan.save();

    if (loan.customerId) {
      const custUpdates: any = {};
      if (customerName) custUpdates.name = customerName;
      if (customerPhone) custUpdates.phone = customerPhone;
      if (spouseName) custUpdates.spouseName = spouseName;
      if (nomineeName) custUpdates.nomineeName = nomineeName;
      if (nomineePhone) custUpdates.nomineePhone = nomineePhone;
      if (Object.keys(custUpdates).length > 0) {
        await Customer.findByIdAndUpdate(loan.customerId, custUpdates);
      }
    }

    res.json({ success: true, loan, message: 'Loan account updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Loan Record (MAIN_ADMIN only)
router.delete('/:id', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }

    await Installment.deleteMany({ loanId: loan._id });
    await Loan.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: `Loan account ${loan.loanNumber} deleted successfully` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Submit Field Verification (Assigned Staff or Manager/Admin)
router.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const { smartCardNumber, aadharNumber, voterIdNumber, panNumber, remarks } = req.body;
    if (!smartCardNumber || !aadharNumber || !voterIdNumber || !panNumber) {
      res.status(400).json({ 
        success: false, 
        message: 'All 4 verification numbers are mandatory: Smart Card No, Aadhaar No, Voter ID No, and PAN No.' 
      });
      return;
    }

    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }

    // Collection staff can only verify loans assigned to them
    const currentUserId = req.user?.id || req.user?._id;
    if (req.user?.role === 'COLLECTION_STAFF') {
      if (loan.assignedStaffId && String(loan.assignedStaffId) !== String(currentUserId)) {
        res.status(403).json({ 
          success: false, 
          message: 'Forbidden: You are not the assigned verification staff for this loan application' 
        });
        return;
      }
    }

    loan.verification = {
      smartCardNumber: String(smartCardNumber).trim(),
      aadharNumber: String(aadharNumber).trim(),
      voterIdNumber: String(voterIdNumber).trim(),
      panNumber: String(panNumber).trim().toUpperCase(),
      remarks: remarks || '',
      verifiedBy: currentUserId as any,
      verifiedByName: req.user?.name || '',
      verifiedAt: new Date(),
      status: 'SUBMITTED'
    };

    loan.status = 'VERIFIED';
    await loan.save();

    // Sync verified KYC numbers to borrower Customer record
    await Customer.findByIdAndUpdate(loan.customerId, {
      smartCardNumber: String(smartCardNumber).trim(),
      aadharNumber: String(aadharNumber).trim(),
      voterIdNumber: String(voterIdNumber).trim(),
      panNumber: String(panNumber).trim().toUpperCase()
    });

    res.json({ 
      success: true, 
      loan, 
      message: 'Field verification submitted successfully. Ready for Manager approval.' 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve Loan (MAIN_ADMIN or BRANCH_MANAGER)
router.post('/:id/approve', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const { remarks } = req.body;
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }

    const approvable = ['SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'DRAFT'];
    if (!approvable.includes(loan.status)) {
      res.status(400).json({ success: false, message: `Cannot approve loan in ${loan.status} status` });
      return;
    }

    loan.status = 'APPROVED';
    loan.approvedBy = req.user?.id as any;
    loan.approvedAt = new Date();
    loan.approvalRemarks = remarks || `Approved by ${req.user?.name} (${req.user?.role.replace('_', ' ')})`;
    if (loan.verification) {
      loan.verification.status = 'APPROVED';
    }
    await loan.save();

    res.json({ success: true, loan, message: 'Loan successfully approved' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reject Loan (MAIN_ADMIN or BRANCH_MANAGER)
router.post('/:id/reject', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const { remarks } = req.body;
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }

    loan.status = 'REJECTED';
    loan.approvedBy = req.user?.id as any;
    loan.approvedAt = new Date();
    loan.approvalRemarks = remarks || `Rejected by ${req.user?.name} (${req.user?.role.replace('_', ' ')})`;
    await loan.save();

    res.json({ success: true, loan, message: 'Loan rejected' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// Disburse Loan (Only once APPROVED)
router.post('/:id/disburse', async (req: Request, res: Response) => {
  try {
    const { disbursementDate = new Date() } = req.body;
    const loan = await Loan.findById(req.params.id).populate('groupId');
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }

    if (loan.status !== 'APPROVED') {
      res.status(400).json({ success: false, message: 'Only APPROVED loans can be disbursed' });
      return;
    }

    const group = loan.groupId as any;
    const calc = calculateLoanSchedule({
      principal: loan.principal,
      productType: loan.productType,
      docCharges: loan.docCharges,
      savingsAmount: loan.savingsAmount,
      tenureWeeks: loan.tenureWeeks,
      startDate: new Date(disbursementDate),
      collectionDay: group.collectionDay
    });

    loan.status = 'ACTIVE';
    loan.disbursedDate = new Date(disbursementDate);
    await loan.save();

    // Generate installments
    await Installment.deleteMany({ loanId: loan._id });
    for (const item of calc.schedule) {
      await Installment.create({
        loanId: loan._id,
        customerId: loan.customerId,
        groupId: loan.groupId,
        branchId: loan.branchId,
        installmentNumber: item.installmentNumber,
        dueDate: item.dueDate,
        expectedAmount: item.expectedAmount,
        allocatedPrincipal: item.allocatedPrincipal,
        allocatedInterest: item.allocatedInterest,
        allocatedSavings: item.allocatedSavings,
        paidAmount: 0,
        balanceAmount: item.expectedAmount,
        status: 'PENDING'
      });
    }

    // Record cashbook transaction for principal disbursed
    await recordCashbookEntry({
      branchId: loan.branchId,
      transactionDate: new Date(disbursementDate),
      type: 'DEBIT',
      category: `${group.name.toUpperCase()} LOAN PAID`,
      amount: loan.principal,
      relatedEntityType: 'LOAN_DISBURSEMENT',
      relatedEntityId: loan._id,
      description: `Loan disbursement of ₹${loan.principal} to customer`,
      createdById: req.user?.id
    });

    // Record document charges received as cash inflow
    if (loan.docCharges > 0) {
      await recordCashbookEntry({
        branchId: loan.branchId,
        transactionDate: new Date(disbursementDate),
        type: 'CREDIT',
        category: `${group.name.toUpperCase()} DOCUMENT CHARGE RECEIVED`,
        amount: loan.docCharges,
        relatedEntityType: 'COLLECTION',
        relatedEntityId: loan._id,
        description: `Doc charge received for loan ${loan.loanNumber}`,
        createdById: req.user?.id
      });
    }

    res.json({ success: true, loan, message: 'Loan successfully disbursed with installment schedule created' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Early settlement discount quote
router.get('/:id/settlement-quote', async (req: Request, res: Response) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }

    const quote = calculateEarlySettlement(loan);
    res.json({ success: true, quote });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Execute early settlement
router.post('/:id/settle', async (req: Request, res: Response) => {
  try {
    const { paymentMethod = 'CASH', referenceNo = '', remarks = '', discountAmount = 0, deductSavings = false, settlementAmount } = req.body;
    const loan = await Loan.findById(req.params.id).populate('groupId');
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }

    if (loan.status !== 'ACTIVE' && loan.status !== 'OVERDUE') {
      res.status(400).json({ success: false, message: 'Loan is not in active or overdue status' });
      return;
    }

    const quote = calculateEarlySettlement(loan);
    const totalRemaining = quote.outstandingTotal;
    const discount = Math.max(0, parseFloat(String(discountAmount)) || 0);
    const isDeductSavings = deductSavings === true || deductSavings === 'true';
    const savingsAmount = Number(loan.savingsAmount) || 0;

    let calculatedPayoff = Math.max(0, totalRemaining - discount);
    if (isDeductSavings) {
      calculatedPayoff = Math.max(0, calculatedPayoff - savingsAmount);
    }

    const settleAmt = settlementAmount !== undefined && !isNaN(parseFloat(String(settlementAmount)))
      ? Math.max(0, parseFloat(String(settlementAmount)))
      : calculatedPayoff;

    const paymentDate = new Date();

    // Mark remaining installments as fully settled & paid with received amount
    const unpaidInstallments = await Installment.find({
      loanId: loan._id,
      status: { $ne: 'PAID' }
    }).sort({ installmentNumber: 1 });

    const allocations: any[] = [];
    for (const inst of unpaidInstallments) {
      const due = inst.balanceAmount > 0 ? inst.balanceAmount : inst.expectedAmount;
      inst.paidAmount = inst.expectedAmount;
      inst.balanceAmount = 0;
      inst.status = 'PAID';
      inst.paidDate = paymentDate;
      inst.remarks = remarks ? `Early Settled: ${remarks}` : 'Early Settled / Account Closed';
      await inst.save();

      allocations.push({
        installmentId: inst._id,
        installmentNumber: inst.installmentNumber,
        amount: due,
        principalPortion: inst.allocatedPrincipal || 0,
        interestPortion: inst.allocatedInterest || 0,
        savingsPortion: inst.allocatedSavings || 0
      });
    }

    // Create payment receipt with unique collision-proof number and full allocations
    const receiptNumber = await getNextReceiptNumber();

    const payment = await Payment.create({
      receiptNumber,
      loanId: loan._id,
      customerId: loan.customerId,
      groupId: loan.groupId,
      branchId: loan.branchId,
      collectorId: req.user?.id,
      paymentDate,
      amount: settleAmt,
      paymentMethod,
      referenceNo,
      remarks: `Early Settlement. Total Due: ₹${totalRemaining}, Discount: ₹${discount}, Savings: ₹${savingsAmount} (${isDeductSavings ? 'Deducted from payoff' : 'Refunded in cash'}). ${remarks}`.trim(),
      allocations
    });

    // Update loan status to SETTLED
    loan.status = 'SETTLED';
    loan.totalPaid = loan.totalPayable;
    loan.outstandingPrincipal = 0;
    loan.outstandingInterest = 0;
    loan.outstandingTotal = 0;
    loan.earlySettlementDiscount = discount;
    loan.closedDate = paymentDate;
    await loan.save();

    // Record cashbook inflow for settlement amount received
    if (settleAmt > 0) {
      await recordCashbookEntry({
        branchId: loan.branchId,
        transactionDate: new Date(),
        type: 'CREDIT',
        category: `EARLY LOAN SETTLEMENT - ${(loan.groupId as any).name}`,
        amount: settleAmt,
        relatedEntityType: 'SETTLEMENT',
        relatedEntityId: payment._id,
        description: `Settlement receipt ${receiptNumber}. Contractual Bal ₹${totalRemaining}, Discount ₹${discount}`,
        createdById: req.user?.id
      });
    }

    // If savings is returned separately in cash (not deducted from settlement payoff), record cashbook outflow
    if (!isDeductSavings && savingsAmount > 0) {
      await recordCashbookEntry({
        branchId: loan.branchId,
        transactionDate: new Date(),
        type: 'DEBIT',
        category: `SAVINGS RETURN REFUND - ${(loan.groupId as any).name}`,
        amount: savingsAmount,
        relatedEntityType: 'SETTLEMENT',
        relatedEntityId: loan._id,
        description: `Savings return refunded to customer upon account closure for loan ${loan.loanNumber}`,
        createdById: req.user?.id
      });
    }

    res.json({
      success: true,
      message: 'Loan settled successfully',
      loan,
      payment,
      quote: {
        ...quote,
        discountAmount: discount,
        settlementAmount: settleAmt,
        isDeductSavings
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/loans/create-manager-loan - Formal Loan Creation by Manager
router.post('/create-manager-loan', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const {
      customerId,
      customCustomerId,
      customerName,
      customerPhone,
      spouseName,
      area,
      nomineeName,
      nomineeRelationship,
      nomineePhone,
      smartCardNumber,
      aadharNumber,
      voterIdNumber,
      panNumber,
      loanNumber,
      loanCategory = 'REGULAR',
      frequency = 'WEEKLY',
      year = new Date().getFullYear(),
      month = '',
      collectionDay = 'MONDAY',
      loanDate = new Date(),
      groupId,
      groupNo,
      groupName,
      loanAmount,
      interest = 0,
      documentCharge = 0,
      savingsAmount = 0,
      noOfWeeks,
      weeksAmountSplit = [],
      status = 'ACTIVE',
      enquiryId
    } = req.body;

    if (!customerName || !area || !loanAmount || !noOfWeeks) {
      res.status(400).json({
        success: false,
        message: 'Customer Name, Area, Loan Amount, and Tenure Weeks are mandatory.'
      });
      return;
    }

    const branchId = req.user?.role === 'MAIN_ADMIN' && req.body.branchId ? req.body.branchId : req.user?.branchId;
    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID is required.' });
      return;
    }

    // 1. Resolve or Create Customer
    let customer: any = null;
    if (customerId) {
      customer = await Customer.findById(customerId);
    }

    if (!customer) {
      // Find by customCustomerId or name + phone in this branch
      if (customCustomerId) {
        customer = await Customer.findOne({ customerId: customCustomerId, branchId });
      }
      if (!customer && customerPhone) {
        customer = await Customer.findOne({ phone: customerPhone, branchId });
      }
    }

    if (customer) {
      // Update with latest nominee, spouse, KYC, and area details
      customer.name = customerName.trim();
      if (customerPhone) customer.phone = customerPhone.trim();
      if (spouseName) customer.spouseName = spouseName.trim();
      if (area) customer.area = area.trim();
      if (nomineeName) customer.nomineeName = nomineeName.trim();
      if (nomineeRelationship) customer.nomineeRelationship = nomineeRelationship.trim();
      if (nomineePhone) customer.nomineePhone = nomineePhone.trim();
      if (smartCardNumber) customer.smartCardNumber = smartCardNumber.trim();
      if (aadharNumber) customer.aadharNumber = aadharNumber.trim();
      if (voterIdNumber) customer.voterIdNumber = voterIdNumber.trim();
      if (panNumber) customer.panNumber = panNumber.trim().toUpperCase();
      await customer.save();
    } else {
      // Create new customer
      const branch = await Branch.findById(branchId);
      const bCode = branch?.code === 'MDKM' ? 'MDKM' : 'PL';
      const custCount = (await Customer.countDocuments()) + 1;
      const newCustId = customCustomerId || `ATH-${bCode}-CUST-${String(custCount).padStart(4, '0')}`;
      customer = await Customer.create({
        customerId: newCustId,
        name: customerName.trim(),
        phone: customerPhone ? customerPhone.trim() : '',
        spouseName: spouseName ? spouseName.trim() : '',
        nomineeName: nomineeName ? nomineeName.trim() : '',
        nomineeRelationship: nomineeRelationship ? nomineeRelationship.trim() : '',
        nomineePhone: nomineePhone ? nomineePhone.trim() : '',
        smartCardNumber: smartCardNumber ? smartCardNumber.trim() : '',
        aadharNumber: aadharNumber ? aadharNumber.trim() : '',
        voterIdNumber: voterIdNumber ? voterIdNumber.trim() : '',
        panNumber: panNumber ? panNumber.trim().toUpperCase() : '',
        area: area.trim(),
        branchId,
        status: 'ACTIVE'
      });
    }

    // 2. Resolve or Create Group
    let group: any = null;
    if (groupId) {
      group = await Group.findById(groupId);
    }

    const gCode = groupNo ? parseInt(String(groupNo).replace(/[^0-9]/g, '')) || 1 : 1;
    const gName = groupName ? groupName.trim() : `GROUP - ${gCode}`;

    if (!group) {
      group = await Group.findOne({ groupCode: gCode, branchId });
    }

    if (!group) {
      group = await Group.create({
        groupCode: gCode,
        name: gName,
        branchId,
        collectionDay: collectionDay || 'MONDAY',
        area: area.trim(),
        totalMembers: 1,
        cycle: 1,
        status: 'LIVE'
      });
    } else {
      if (groupName && group.name !== gName) {
        group.name = gName;
      }
      if (collectionDay && group.collectionDay !== collectionDay) {
        group.collectionDay = collectionDay;
      }
      group.totalMembers = (group.totalMembers || 0) + 1;
      await group.save();
    }

    // 3. Generate Loan Number
    const branch = await Branch.findById(branchId);
    const bCode = branch?.code === 'MDKM' ? 'MDKM' : 'PL';
    const finalLoanNumber = loanNumber && String(loanNumber).trim()
      ? String(loanNumber).trim().toUpperCase()
      : `ATH-${bCode}-LN-${group.groupCode}-${customer.customerId}`;

    // 4. Calculate Total Payable and Weeks Split
    const principalNum = parseFloat(String(loanAmount));
    const interestNum = parseFloat(String(interest));
    const docChargeNum = parseFloat(String(documentCharge));
    const savingsNum = parseFloat(String(savingsAmount));
    const tenureNum = parseInt(String(noOfWeeks));

    let splitSchedule: any[] = weeksAmountSplit;
    if (!splitSchedule || splitSchedule.length === 0) {
      let preset: any = await LoanTier.findOne({ principal: principalNum, tenureWeeks: tenureNum, isActive: true });
      if (!preset) {
        preset = LOAN_PRODUCT_PRESETS.find(p => p.principal === principalNum && p.tenureWeeks === tenureNum);
      }
      if (preset && preset.schedule && preset.schedule.length > 0) {
        splitSchedule = preset.schedule;
      } else {
        const defaultWeekly = Math.round((principalNum + interestNum + savingsNum) / tenureNum);
        splitSchedule = Array.from({ length: tenureNum }, (_, i) => ({
          week: i + 1,
          principal: Math.round(principalNum / tenureNum),
          interest: Math.round(interestNum / tenureNum),
          savings: Math.round(savingsNum / tenureNum),
          total: defaultWeekly
        }));
      }
    }

    const totalPayableNum = splitSchedule.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0) || (principalNum + interestNum + savingsNum);
    const mgrId = req.user?.id || req.user?._id;
    const mgrName = req.user?.name || req.user?.username || 'Branch Manager';

    // Sync group staff if unassigned
    if (!group.staffId) {
      group.staffId = mgrId as any;
      group.staffName = mgrName;
      await group.save();
    }

    // 5. Create Formal Loan Document
    const newLoan = await Loan.create({
      loanNumber: finalLoanNumber,
      customerId: customer._id,
      groupId: group._id,
      branchId,
      cycle: group.cycle || 1,
      productType: 'CUSTOM',
      principal: principalNum,
      interestRate: principalNum > 0 ? Math.round((interestNum / principalNum) * 100 * 10) / 10 : 0,
      interestAmount: interestNum,
      docCharges: docChargeNum,
      savingsAmount: savingsNum,
      totalPayable: totalPayableNum,
      tenureWeeks: tenureNum,
      repaymentFrequency: frequency || 'WEEKLY',
      disbursedDate: new Date(loanDate),
      status: 'ACTIVE', // Automatically ACTIVE & approved by default
      assignedStaffId: mgrId, // Mapped to manager by default
      assignedStaffName: mgrName,
      assignedAt: new Date(),
      loanCategory,
      year: parseInt(String(year)) || new Date(loanDate).getFullYear(),
      month: month || new Date(loanDate).toLocaleString('default', { month: 'long' }),
      collectionDay: collectionDay || group.collectionDay,
      loanDate: new Date(loanDate),
      groupNo: String(group.groupCode),
      area: area.trim(),
      groupName: group.name,
      customerName: customer.name,
      spouseName: customer.spouseName || '',
      nomineeName: customer.nomineeName || '',
      nomineeRelationship: customer.nomineeRelationship || '',
      customerPhone: customer.phone || '',
      nomineePhone: customer.nomineePhone || '',
      weekSplit: splitSchedule,
      outstandingPrincipal: principalNum,
      outstandingInterest: interestNum,
      outstandingTotal: totalPayableNum,
      totalPaid: 0,
      approvedBy: mgrId,
      approvedAt: new Date()
    });

    // 6. Create Installments in Database: strictly calculate next assigned collection day
    const effectiveCollectionDay = collectionDay || group.collectionDay || 'MONDAY';
    const firstDueDate = getNextWeekdayDate(new Date(loanDate), effectiveCollectionDay);

    for (let i = 0; i < splitSchedule.length; i++) {
      const split = splitSchedule[i];
      const wkNum = split.week || (i + 1);
      const dueDate = new Date(firstDueDate);
      dueDate.setUTCDate(firstDueDate.getUTCDate() + (i * 7));

      await Installment.create({
        loanId: newLoan._id,
        customerId: customer._id,
        groupId: group._id,
        branchId,
        installmentNumber: wkNum,
        dueDate,
        expectedAmount: split.total,
        allocatedPrincipal: split.principal || 0,
        allocatedInterest: split.interest || 0,
        allocatedSavings: split.savings || 0,
        paidAmount: 0,
        balanceAmount: split.total,
        status: 'PENDING'
      });
    }

    // 7. Record Cashbook Transactions if disbursed (ACTIVE)
    if (status === 'ACTIVE') {
      await recordCashbookEntry({
        branchId,
        transactionDate: new Date(loanDate),
        type: 'DEBIT',
        category: `${group.name.toUpperCase()} LOAN PAID`,
        amount: principalNum,
        relatedEntityType: 'LOAN_DISBURSEMENT',
        relatedEntityId: newLoan._id,
        description: `Disbursement of ₹${principalNum} to ${customer.name} (${finalLoanNumber})`,
        createdById: req.user?.id || req.user?._id
      });

      if (docChargeNum > 0) {
        await recordCashbookEntry({
          branchId,
          transactionDate: new Date(loanDate),
          type: 'CREDIT',
          category: `${group.name.toUpperCase()} DOCUMENT CHARGE RECEIVED`,
          amount: docChargeNum,
          relatedEntityType: 'COLLECTION',
          relatedEntityId: newLoan._id,
          description: `Document charge of ₹${docChargeNum} for ${finalLoanNumber}`,
          createdById: req.user?.id || req.user?._id
        });
      }
    }

    // 8. Ensure customer is associated with this group and marked ACTIVE
    customer.activeGroupId = group._id;
    customer.status = 'ACTIVE';
    await customer.save();

    // 9. Update group member count
    const uniqueCustomersInGroup = await Loan.find({ groupId: group._id, status: { $in: ['ACTIVE', 'OVERDUE'] } }).distinct('customerId');
    group.totalMembers = uniqueCustomersInGroup.length;
    await group.save();

    // 10. If linked to an Enquiry, mark it as APPROVED & CONVERTED
    if (enquiryId) {
      await Enquiry.findByIdAndUpdate(enquiryId, {
        status: 'APPROVED',
        convertedToLoanId: newLoan._id,
        managerRemarks: `Converted to formal loan ${finalLoanNumber}`
      });
    }

    res.status(201).json({
      success: true,
      loan: newLoan,
      message: `Formal Loan ${finalLoanNumber} created successfully with ${splitSchedule.length} installment schedules.`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
