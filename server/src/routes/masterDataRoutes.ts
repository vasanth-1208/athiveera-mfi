import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Customer } from '../models/Customer';
import { Loan } from '../models/Loan';
import { Installment } from '../models/Installment';
import { Group } from '../models/Group';
import { Payment } from '../models/Payment';
import { FollowUp } from '../models/FollowUp';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';
import { parseExcelDate } from '../services/importService';

const router = Router();

router.use(authenticate);

// Overall Database Stats
router.get('/stats', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const { branchId } = req.query;
    const query: any = {};
    if (req.user?.role !== 'MAIN_ADMIN') {
      query.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'ALL' && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      query.branchId = branchId;
    }

    const totalCustomers = await Customer.countDocuments(query);
    const activeCustomers = await Customer.countDocuments({ ...query, status: 'ACTIVE' });

    const totalLoans = await Loan.countDocuments(query);
    const activeLoans = await Loan.countDocuments({ ...query, status: { $in: ['ACTIVE', 'OVERDUE'] } });
    const closedLoans = await Loan.countDocuments({ ...query, status: 'CLOSED' });
    const settledLoans = await Loan.countDocuments({ ...query, status: 'SETTLED' });

    const totalGroups = await Group.countDocuments(query);
    const totalInstallments = await Installment.countDocuments(query.branchId ? { branchId: query.branchId } : {});
    const totalPayments = await Payment.countDocuments(query.branchId ? { branchId: query.branchId } : {});

    // Financial totals across all loans
    const matchStage = query.branchId ? [{ $match: { branchId: new mongoose.Types.ObjectId(String(query.branchId)) } }] : [];
    const loanAgg = await Loan.aggregate([
      ...matchStage,
      {
        $group: {
          _id: null,
          totalPrincipal: { $sum: '$principal' },
          totalContractual: { $sum: '$totalPayable' },
          totalPaid: { $sum: '$totalPaid' },
          totalOutstanding: { $sum: '$outstandingTotal' }
        }
      }
    ]);

    const financials = loanAgg[0] || {
      totalPrincipal: 0,
      totalContractual: 0,
      totalPaid: 0,
      totalOutstanding: 0
    };

    res.json({
      success: true,
      stats: {
        customers: { total: totalCustomers, active: activeCustomers },
        loans: {
          total: totalLoans,
          active: activeLoans,
          closed: closedLoans,
          settled: settledLoans,
          ...financials
        },
        groups: totalGroups,
        installments: totalInstallments,
        payments: totalPayments
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================= CUSTOMERS MASTER =================

router.get('/customers', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const { search, area, status, branchId, page = 1, limit = 50, sortBy = 'id_asc' } = req.query;
    const query: any = {};

    if (req.user?.role !== 'MAIN_ADMIN') {
      query.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'ALL' && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      query.branchId = branchId;
    }

    if (area && area !== 'ALL') query.area = area;
    if (status) query.status = status;

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
    let l = limit === 'all' || limit === 'ALL' || limit === '0' ? 1000 : (parseInt(String(limit)) || 50);

    let sortObj: any = { customerId: 1 };
    if (sortBy === 'id_desc') sortObj = { customerId: -1 };
    else if (sortBy === 'name_asc') sortObj = { name: 1 };
    else if (sortBy === 'name_desc') sortObj = { name: -1 };
    else if (sortBy === 'newest') sortObj = { createdAt: -1 };

    const total = await Customer.countDocuments(query);
    const customers = await Customer.find(query)
      .populate('branchId', 'name code')
      .populate('activeGroupId', 'name collectionDay groupCode')
      .sort(sortObj)
      .skip((p - 1) * l)
      .limit(l)
      .lean();

    // Attach loans summary for each customer
    const custIds = customers.map(c => c._id);
    const allLoans = await Loan.find({ customerId: { $in: custIds } })
      .select('customerId loanNumber principal totalPayable totalPaid outstandingTotal status cycle')
      .lean();

    const loanMap = new Map();
    for (const ln of allLoans) {
      const cId = String(ln.customerId);
      if (!loanMap.has(cId)) loanMap.set(cId, []);
      loanMap.get(cId).push(ln);
    }

    const enhanced = customers.map(c => ({
      ...c,
      loans: loanMap.get(String(c._id)) || []
    }));

    res.json({
      success: true,
      customers: enhanced,
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

router.put('/customers/:id', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }

    const updatableFields = [
      'name', 'phone', 'spouseName', 'nomineeName', 'nomineeRelationship',
      'nomineePhone', 'address', 'area', 'smartCardNumber', 'aadharNumber',
      'voterIdNumber', 'panNumber', 'status', 'activeGroupId', 'notes'
    ];

    for (const f of updatableFields) {
      if (req.body[f] !== undefined) {
        (customer as any)[f] = req.body[f];
      }
    }

    await customer.save();
    res.json({ success: true, customer, message: 'Customer profile updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Merge 2 specific customer profiles
router.post('/customers/merge', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const { sourceCustomerId, targetCustomerId } = req.body;
    if (!sourceCustomerId || !targetCustomerId) {
      res.status(400).json({ success: false, message: 'Source and Target Customer IDs are required' });
      return;
    }

    if (String(sourceCustomerId) === String(targetCustomerId)) {
      res.status(400).json({ success: false, message: 'Source and target customers cannot be the same' });
      return;
    }

    const source = await Customer.findById(sourceCustomerId);
    const target = await Customer.findById(targetCustomerId);

    if (!source || !target) {
      res.status(404).json({ success: false, message: 'Source or Target customer not found' });
      return;
    }

    // Merge missing details into target
    const mergeFields = ['phone', 'nomineePhone', 'address', 'area', 'aadharNumber', 'smartCardNumber', 'voterIdNumber', 'panNumber'];
    for (const f of mergeFields) {
      if (!(target as any)[f] && (source as any)[f]) {
        (target as any)[f] = (source as any)[f];
      }
    }

    // Re-point all loans from source to target
    await Loan.updateMany({ customerId: source._id }, { $set: { customerId: target._id } });

    // Re-sequence cycle numbers on target
    const allTargetLoans = await Loan.find({ customerId: target._id }).sort({ createdAt: 1, issueDate: 1 });
    let activeGrp = target.activeGroupId;
    for (let i = 0; i < allTargetLoans.length; i++) {
      allTargetLoans[i].cycle = i + 1;
      (allTargetLoans[i] as any).cycleNumber = i + 1;
      await allTargetLoans[i].save();
      if (allTargetLoans[i].status === 'ACTIVE' || allTargetLoans[i].status === 'OVERDUE') {
        activeGrp = allTargetLoans[i].groupId;
      }
    }

    if (activeGrp) target.activeGroupId = activeGrp;
    await target.save();

    // Delete source customer
    await Customer.findByIdAndDelete(source._id);

    res.json({
      success: true,
      message: `Successfully merged customer ${source.name} (${source.customerId}) into ${target.name} (${target.customerId}). All loans consolidated.`,
      targetCustomer: target
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Auto-deduplicate all customers
router.post('/customers/auto-deduplicate', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const allCusts = await Customer.find({}).sort({ customerId: 1 }).lean();
    const groupsMap = new Map<string, any[]>();

    for (const c of allCusts) {
      const rawPhone = (c.phone || '').trim().replace(/[^0-9]/g, '');
      let key = '';
      if (rawPhone.length >= 10) {
        key = 'PHONE:' + rawPhone.slice(-10);
      } else {
        const cleanName = (c.name || '').trim().toUpperCase().replace(/\s*-\s*HEAD/, '').replace(/[^A-Z]/g, '');
        const cleanArea = (c.area || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
        if (cleanName && cleanArea) {
          key = `NAME_AREA:${cleanName}_${cleanArea}`;
        } else {
          key = `ID:${c._id}`;
        }
      }

      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)!.push(c);
    }

    let mergedCount = 0;
    let remappedLoans = 0;

    for (const [key, list] of groupsMap.entries()) {
      if (list.length > 1) {
        const primary = list[0];
        const secondaries = list.slice(1);
        const secIds = secondaries.map(s => s._id);

        const updateFields: any = {};
        for (const sec of secondaries) {
          if (!primary.phone && sec.phone) updateFields.phone = sec.phone;
          if (!primary.nomineePhone && sec.nomineePhone) updateFields.nomineePhone = sec.nomineePhone;
          if (!primary.address && sec.address) updateFields.address = sec.address;
          if (!primary.area && sec.area) updateFields.area = sec.area;
          if (!primary.aadharNumber && sec.aadharNumber) updateFields.aadharNumber = sec.aadharNumber;
          if (!primary.smartCardNumber && sec.smartCardNumber) updateFields.smartCardNumber = sec.smartCardNumber;
        }

        const loans = await Loan.find({ customerId: { $in: secIds } });
        for (const ln of loans) {
          ln.customerId = primary._id;
          await ln.save();
          remappedLoans++;
        }

        const targetLoans = await Loan.find({ customerId: primary._id }).sort({ createdAt: 1, issueDate: 1 });
        let activeGrp = primary.activeGroupId;
        for (let i = 0; i < targetLoans.length; i++) {
          targetLoans[i].cycle = i + 1;
          (targetLoans[i] as any).cycleNumber = i + 1;
          await targetLoans[i].save();
          if (targetLoans[i].status === 'ACTIVE' || targetLoans[i].status === 'OVERDUE') {
            activeGrp = targetLoans[i].groupId;
          }
        }

        if (activeGrp) updateFields.activeGroupId = activeGrp;
        if (Object.keys(updateFields).length > 0) {
          await Customer.findByIdAndUpdate(primary._id, updateFields);
        }

        await Customer.deleteMany({ _id: { $in: secIds } });
        mergedCount += secondaries.length;
      }
    }

    const remainingTotal = await Customer.countDocuments();
    res.json({
      success: true,
      message: `Deduplication complete. Consolidated ${mergedCount} duplicate profiles. Remapped ${remappedLoans} loans. Total unique borrowers: ${remainingTotal}.`,
      mergedCount,
      remappedLoans,
      remainingTotal
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================= LOANS MASTER =================

router.get('/loans', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const { search, groupId, routeDay, status, branchId, page = 1, limit = 50 } = req.query;
    const query: any = {};

    if (req.user?.role !== 'MAIN_ADMIN') {
      query.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'ALL' && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      query.branchId = branchId;
    }

    if (groupId) query.groupId = groupId;
    if (status && status !== 'ALL') query.status = status;
    if (routeDay && routeDay !== 'ALL') query.collectionDay = routeDay;

    if (search) {
      const searchRegex = new RegExp(String(search), 'i');
      query.$or = [
        { loanNumber: searchRegex },
        { customerName: searchRegex },
        { customerPhone: searchRegex },
        { area: searchRegex }
      ];
    }

    const p = Math.max(1, parseInt(String(page)) || 1);
    let l = limit === 'all' || limit === 'ALL' || limit === '0' ? 1000 : (parseInt(String(limit)) || 50);

    const total = await Loan.countDocuments(query);
    const loans = await Loan.find(query)
      .populate('customerId', 'customerId name phone area')
      .populate('groupId', 'name groupCode collectionDay area')
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean();

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

router.put('/loans/:id', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }

    const fields = [
      'loanNumber', 'principal', 'interestAmount', 'docCharges', 'savingsAmount',
      'totalPayable', 'outstandingTotal', 'totalPaid', 'tenureWeeks', 'status',
      'cycle', 'collectionDay', 'assignedStaffName', 'notes'
    ];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        (loan as any)[f] = req.body[f];
      }
    }

    await loan.save();
    res.json({ success: true, loan, message: 'Loan account updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================= INSTALLMENTS & SCHEDULE EDITOR =================

router.get('/loans/:id/installments', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('customerId', 'customerId name phone')
      .populate('groupId', 'name groupCode collectionDay');

    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }

    const installments = await Installment.find({ loanId: loan._id })
      .sort({ installmentNumber: 1 })
      .lean();

    res.json({
      success: true,
      loan,
      installments
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/installments/:id', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const inst = await Installment.findById(req.params.id);
    if (!inst) {
      res.status(404).json({ success: false, message: 'Installment not found' });
      return;
    }

    const {
      dueDate,
      expectedAmount,
      allocatedPrincipal,
      allocatedInterest,
      allocatedSavings,
      paidAmount,
      balanceAmount,
      status,
      remarks
    } = req.body;

    if (dueDate) inst.dueDate = parseExcelDate(dueDate);
    if (expectedAmount !== undefined) inst.expectedAmount = Number(expectedAmount);
    if (allocatedPrincipal !== undefined) inst.allocatedPrincipal = Number(allocatedPrincipal);
    if (allocatedInterest !== undefined) inst.allocatedInterest = Number(allocatedInterest);
    if (allocatedSavings !== undefined) inst.allocatedSavings = Number(allocatedSavings);
    if (paidAmount !== undefined) {
      inst.paidAmount = Number(paidAmount);
      if (balanceAmount === undefined) {
        inst.balanceAmount = Math.max(0, (inst.expectedAmount || 0) - inst.paidAmount);
      }
    }
    if (balanceAmount !== undefined) inst.balanceAmount = Number(balanceAmount);
    
    if (status) {
      inst.status = status;
    } else if (paidAmount !== undefined) {
      if (inst.paidAmount >= inst.expectedAmount && inst.expectedAmount > 0) {
        inst.status = 'PAID';
      } else if (inst.paidAmount > 0) {
        inst.status = 'PARTIAL';
      } else {
        inst.status = 'PENDING';
      }
    }

    if (remarks !== undefined) inst.remarks = remarks;

    await inst.save();

    // Recalculate loan totalPaid and outstandingTotal
    const allInsts = await Installment.find({ loanId: inst.loanId });
    const totalPaid = allInsts.reduce((sum, item) => sum + (item.paidAmount || 0), 0);
    const loan = await Loan.findById(inst.loanId);
    if (loan) {
      loan.totalPaid = totalPaid;
      loan.outstandingTotal = Math.max(0, (loan.totalPayable || 0) - totalPaid);
      if (loan.outstandingTotal === 0 && loan.status === 'ACTIVE') {
        loan.status = 'CLOSED';
      } else if (loan.outstandingTotal > 0 && loan.status === 'CLOSED') {
        loan.status = 'ACTIVE';
      }
      await loan.save();

      // Keep Payment record in sync with installment payment & date
      const rcpt = `RCP-${loan.loanNumber}-W${inst.installmentNumber}`;
      if (inst.paidAmount > 0) {
        await Payment.findOneAndUpdate(
          {
            $or: [
              { receiptNumber: rcpt },
              { 'allocations.installmentId': inst._id }
            ]
          },
          {
            $set: {
              receiptNumber: rcpt,
              loanId: loan._id,
              customerId: loan.customerId,
              groupId: loan.groupId,
              branchId: loan.branchId,
              paymentDate: inst.dueDate,
              amount: inst.paidAmount,
              paymentMethod: 'CASH',
              allocations: [
                {
                  installmentId: inst._id,
                  installmentNumber: inst.installmentNumber,
                  amount: inst.paidAmount,
                  principalPortion: inst.allocatedPrincipal || 0,
                  interestPortion: inst.allocatedInterest || 0,
                  savingsPortion: inst.allocatedSavings || 0
                }
              ]
            }
          },
          { upsert: true, new: true }
        );
      } else if (inst.paidAmount === 0) {
        await Payment.deleteOne({
          $or: [
            { receiptNumber: rcpt },
            { 'allocations.installmentId': inst._id }
          ]
        });
      }

      // Sync FollowUp status and balance for this loan
      const overdueInsts = await Installment.find({
        loanId: loan._id,
        $or: [
          { status: 'OVERDUE' },
          { balanceAmount: { $gt: 0 }, dueDate: { $lt: new Date() } }
        ]
      });
      const curOverdue = overdueInsts.reduce((sum, item) => sum + (item.balanceAmount || 0), 0);
      if (curOverdue > 0) {
        await FollowUp.findOneAndUpdate(
          { loanId: loan._id },
          {
            $set: {
              actualPending: curOverdue,
              overdueWeeks: overdueInsts.length,
              status: 'PENDING'
            }
          }
        );
      } else {
        await FollowUp.findOneAndUpdate(
          { loanId: loan._id },
          {
            $set: {
              actualPending: 0,
              status: 'RESOLVED'
            }
          }
        );
      }
    }

    res.json({ success: true, installment: inst, message: 'Installment updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Re-align all schedule dates for a loan based on route day
router.post('/loans/:id/realign-schedule-dates', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const loan = await Loan.findById(req.params.id).populate('groupId');
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }

    const installments = await Installment.find({ loanId: loan._id }).sort({ installmentNumber: 1 });
    if (installments.length === 0) {
      res.status(400).json({ success: false, message: 'No installments found for this loan' });
      return;
    }

    // Anchor from the first installment date
    const firstDate = new Date(installments[0].dueDate);
    for (let i = 0; i < installments.length; i++) {
      const newDate = new Date(firstDate.getTime() + i * 7 * 86400 * 1000);
      installments[i].dueDate = newDate;
      await installments[i].save();
    }

    res.json({
      success: true,
      message: `Re-aligned all ${installments.length} installment dates on a strict 7-day weekly schedule starting from ${firstDate.toLocaleDateString('en-GB')}`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================= GROUPS MASTER =================

router.get('/groups', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const { search, collectionDay, branchId } = req.query;
    const query: any = {};

    if (req.user?.role !== 'MAIN_ADMIN') {
      query.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'ALL' && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      query.branchId = branchId;
    }

    if (collectionDay && collectionDay !== 'ALL') query.collectionDay = collectionDay;

    if (search) {
      const searchRegex = new RegExp(String(search), 'i');
      query.$or = [
        { name: searchRegex },
        { area: searchRegex }
      ];
      if (!isNaN(parseInt(String(search)))) {
        query.$or.push({ groupCode: parseInt(String(search)) });
      }
    }

    const groups = await Group.find(query).sort({ groupCode: 1 }).lean();

    // Attach active loans and members count
    const groupIds = groups.map(g => g._id);
    const loanCounts = await Loan.aggregate([
      { $match: { groupId: { $in: groupIds } } },
      {
        $group: {
          _id: '$groupId',
          totalLoans: { $sum: 1 },
          activeLoans: {
            $sum: { $cond: [{ $in: ['$status', ['ACTIVE', 'OVERDUE']] }, 1, 0] }
          },
          totalOutstanding: {
            $sum: { $cond: [{ $in: ['$status', ['ACTIVE', 'OVERDUE']] }, '$outstandingTotal', 0] }
          }
        }
      }
    ]);

    const countMap = new Map();
    for (const c of loanCounts) {
      countMap.set(String(c._id), c);
    }

    const enhanced = groups.map(g => {
      const c = countMap.get(String(g._id)) || { totalLoans: 0, activeLoans: 0, totalOutstanding: 0 };
      return {
        ...g,
        totalLoans: c.totalLoans,
        activeLoans: c.activeLoans,
        totalOutstanding: c.totalOutstanding
      };
    });

    res.json({ success: true, groups: enhanced });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/groups/:id', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404).json({ success: false, message: 'Group not found' });
      return;
    }

    const { name, groupCode, collectionDay, area, staffName, collectorName, assignedStaffName, headName, headPhone, status, notes } = req.body;
    if (name) group.name = name;
    if (groupCode !== undefined) group.groupCode = Number(groupCode);
    if (collectionDay) group.collectionDay = collectionDay;
    if (area !== undefined) group.area = area;
    if (staffName !== undefined) group.staffName = staffName;
    if (collectorName !== undefined) {
      group.staffName = collectorName;
      (group as any).collectorName = collectorName;
    }
    if (assignedStaffName !== undefined) {
      group.staffName = assignedStaffName;
      (group as any).assignedStaffName = assignedStaffName;
    }
    if (headName !== undefined) group.headName = headName;
    if (headPhone !== undefined) group.headPhone = headPhone;
    if (status) (group as any).status = status;
    if (notes !== undefined) (group as any).notes = notes;

    await group.save();

    // If collectionDay was updated, update all loans under this group too
    if (collectionDay) {
      await Loan.updateMany({ groupId: group._id }, { $set: { collectionDay } });
    }

    res.json({ success: true, group, message: 'Group updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
