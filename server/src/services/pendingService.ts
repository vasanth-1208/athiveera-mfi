import { Loan } from '../models/Loan';
import { Installment } from '../models/Installment';
import { FollowUp } from '../models/FollowUp';
import '../models/Customer';
import '../models/Group';
import '../models/User';
import '../models/Branch';

export interface PendingOverdueFilter {
  branchId?: any;
  weekday?: string;
  status?: string;
  search?: string;
}

export interface PendingOverdueSummary {
  totalActualPending: number;
  totalSavings: number;
  totalBalancePending: number;
  totalCustomerKnown: number;
  totalRecords: number;
  summaryByDay: Record<string, { actualTotal: number; savingsTotal: number; balanceTotal: number; count: number }>;
}

export interface PendingOverdueResult {
  followUps: any[];
  summary: PendingOverdueSummary;
}

/**
 * Single canonical source of truth for Pending & Overdue Collections.
 * Used identically by both /api/pending and /api/dashboard to guarantee
 * that metrics, cards, and priority follow-ups match across all views.
 */
export async function getPendingOverdueRegister(params: PendingOverdueFilter): Promise<PendingOverdueResult> {
  const { branchId, weekday, status = 'PENDING', search } = params;

  // Auto-mark any installment whose due date has passed (< today) and has positive balance as OVERDUE
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  await Installment.updateMany(
    {
      dueDate: { $lt: todayStart },
      balanceAmount: { $gt: 0 },
      status: { $ne: 'OVERDUE' }
    },
    { $set: { status: 'OVERDUE' } }
  );

  // Build branch-scoped target filter
  const baseBranchFilter: any = {};
  if (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '' && branchId !== 'ALL') {
    baseBranchFilter.branchId = branchId;
  }

  // 1. Loans explicitly marked OVERDUE
  const explicitOverdueLoans = await Loan.find({ status: 'OVERDUE', ...baseBranchFilter }).select('_id').lean();
  const targetLoanIdSet = new Set<string>(explicitOverdueLoans.map(l => l._id.toString()));

  // 2. Loans having installments that are overdue or past due with positive balance
  const overdueInstsAll = await Installment.find({
    balanceAmount: { $gt: 0 },
    $or: [
      { status: 'OVERDUE' },
      { dueDate: { $lt: todayStart } }
    ]
  }).select('loanId').lean();
  overdueInstsAll.forEach(i => {
    if (i.loanId) targetLoanIdSet.add(i.loanId.toString());
  });

  // 3. FollowUps marked PENDING with positive pending balance
  const pendingFollowUps = await FollowUp.find({
    status: 'PENDING',
    actualPending: { $gt: 0 }
  }).select('loanId customerId').lean();
  pendingFollowUps.forEach(f => {
    if (f.loanId) targetLoanIdSet.add(f.loanId.toString());
  });

  const overdueLoans = await Loan.find({
    _id: { $in: Array.from(targetLoanIdSet) },
    ...baseBranchFilter
  })
    .populate('branchId', 'name code')
    .populate('customerId', 'name phone nomineePhone mobileNumber area totalSavings')
    .populate('groupId', 'name collectionDay staffName groupCode')
    .lean();

  const followUps: any[] = [];
  const processedLoanIds = new Set<string>();

  for (const ol of overdueLoans) {
    // Exclude closed or settled loans
    if (ol.status === 'CLOSED' || ol.status === 'SETTLED' || ol.outstandingTotal <= 0) {
      continue;
    }

    processedLoanIds.add(ol._id.toString());
    const c: any = ol.customerId;
    const g: any = ol.groupId;
    const b: any = ol.branchId;
    const cDay = g?.collectionDay || 'TUESDAY';

    if (weekday && weekday !== 'ALL' && cDay !== weekday) continue;

    // Look up any saved remarks / follow-up details from FollowUp collection
    const f = await FollowUp.findOne({ 
      $or: [
        { loanId: ol._id },
        { customerId: c?._id }
      ]
    }).lean();

    // Calculate actual overdue from installments
    const overdueInsts = await Installment.find({
      loanId: ol._id,
      $or: [
        { status: 'OVERDUE' },
        { dueDate: { $lt: todayStart }, balanceAmount: { $gt: 0 } }
      ]
    }).lean();

    let actualPending = overdueInsts.reduce((sum, i) => sum + (i.balanceAmount || 0), 0);
    let overdueWeeks = overdueInsts.length;

    if (actualPending === 0) {
      if (f?.actualPending && f.actualPending > 0) {
        actualPending = f.actualPending;
        overdueWeeks = f.overdueWeeks || 1;
      } else {
        continue;
      }
    }

    const totalSavings = (ol as any).savingsAmount || (ol as any).savingsTotal || c?.totalSavings || 0;
    const balancePending = Math.max(0, actualPending - totalSavings);

    const item = {
      _id: f?._id || ol._id,
      loanId: ol._id,
      loanNumber: ol.loanNumber,
      branchId: b,
      customerId: c,
      customerName: c?.name || f?.customerName || 'Borrower',
      customerPhone: c?.phone || c?.mobileNumber || f?.customerPhone || '',
      nomineePhone: c?.nomineePhone || f?.nomineePhone || '',
      groupId: g?._id || ol.groupId,
      groupName: g?.name || f?.groupName || 'Group',
      collectionDay: cDay,
      actualPending,
      totalSavings,
      balancePending,
      customerKnown: f?.customerKnown || actualPending,
      overdueWeeks: overdueWeeks || f?.overdueWeeks || 1,
      staffName: ol.assignedStaffName || g?.staffName || f?.staffName || 'Staff',
      remarks: f?.remarks || 'Overdue installment requiring field recovery',
      status: f?.status || 'PENDING',
      history: f?.history || [],
      createdAt: f?.createdAt || ol.createdAt,
      updatedAt: f?.updatedAt || ol.updatedAt
    };

    if (status && status !== 'ALL' && item.status !== status) {
      continue;
    }

    if (search) {
      const reg = new RegExp(String(search), 'i');
      const match = reg.test(item.customerName) ||
                    reg.test(item.groupName) ||
                    reg.test(item.customerPhone) ||
                    reg.test(item.staffName);
      if (!match) continue;
    }

    followUps.push(item);
  }

  // Sort by overdueWeeks desc, then actualPending desc
  followUps.sort((a, b) => (b.overdueWeeks - a.overdueWeeks) || (b.actualPending - a.actualPending));

  // Aggregate weekday summary
  const summaryByDay: Record<string, { actualTotal: number; savingsTotal: number; balanceTotal: number; count: number }> = {
    MONDAY: { actualTotal: 0, savingsTotal: 0, balanceTotal: 0, count: 0 },
    TUESDAY: { actualTotal: 0, savingsTotal: 0, balanceTotal: 0, count: 0 },
    WEDNESDAY: { actualTotal: 0, savingsTotal: 0, balanceTotal: 0, count: 0 },
    THURSDAY: { actualTotal: 0, savingsTotal: 0, balanceTotal: 0, count: 0 }
  };

  let totalActualPending = 0;
  let totalSavings = 0;
  let totalBalancePending = 0;
  let totalCustomerKnown = 0;

  followUps.forEach(f => {
    const day = (f.collectionDay || '').toUpperCase();
    if (summaryByDay[day]) {
      summaryByDay[day].actualTotal += f.actualPending;
      summaryByDay[day].savingsTotal += f.totalSavings;
      summaryByDay[day].balanceTotal += f.balancePending;
      summaryByDay[day].count += 1;
    }
    totalActualPending += f.actualPending;
    totalSavings += f.totalSavings;
    totalBalancePending += f.balancePending;
    totalCustomerKnown += f.customerKnown;
  });

  return {
    followUps,
    summary: {
      totalActualPending,
      totalSavings,
      totalBalancePending,
      totalCustomerKnown,
      totalRecords: followUps.length,
      summaryByDay
    }
  };
}
