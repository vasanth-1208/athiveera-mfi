import { Router, Request, Response } from 'express';
import { Customer } from '../models/Customer';
import { Group } from '../models/Group';
import { Loan } from '../models/Loan';
import { Installment } from '../models/Installment';
import { Payment } from '../models/Payment';
import { FollowUp } from '../models/FollowUp';
import { Branch } from '../models/Branch';
import { BranchTransfer } from '../models/BranchTransfer';
import { CashTransaction } from '../models/CashTransaction';
import { Expense } from '../models/Expense';
import { getRouteDateForWeekday } from './collectionRoutes';
import { getPendingOverdueRegister } from '../services/pendingService';
import { authenticate } from '../middleware/auth';
import { enforceBranchScope, requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate);
router.use(enforceBranchScope);
router.use(requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'));

router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const { branchId } = req.query;
    const query: any = {};

    if (req.user?.role !== 'MAIN_ADMIN') {
      query.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      query.branchId = branchId;
    }

    let selectedBranch: any = null;
    if (query.branchId) {
      selectedBranch = await Branch.findById(query.branchId);
    }

    // 1. Total unique customers
    const totalCustomers = await Customer.countDocuments(query);

    // 2. Active groups
    const activeGroups = await Group.countDocuments({ ...query, status: 'LIVE' });

    // 3. Active loans
    const activeLoans = await Loan.countDocuments({ ...query, status: { $in: ['ACTIVE', 'OVERDUE'] } });

    // 4. Loan totals: Disbursed, Collected, and Outstanding matching branch scope
    const allDisbursedLoans = await Loan.find({
      ...query,
      status: { $in: ['ACTIVE', 'OVERDUE', 'CLOSED', 'SETTLED'] }
    });

    let totalLoanAmountGiven = 0;
    let totalPrincipalOutstanding = 0;
    let totalCollectedWithSavings = 0;
    let totalRepaymentWithSavings = 0;
    let savingsCollected = 0;
    let savingsOutstanding = 0;

    allDisbursedLoans.forEach(l => {
      totalLoanAmountGiven += (l.principal || 0);
      totalCollectedWithSavings += (l.totalPaid || 0);
      const savings = l.savingsAmount || 0;

      if (l.status === 'ACTIVE' || l.status === 'OVERDUE') {
        totalPrincipalOutstanding += (l.outstandingPrincipal || 0);
        totalRepaymentWithSavings += (l.outstandingTotal || 0);

        const totalPayable = l.totalPayable || ((l.principal || 0) + (l.interestAmount || 0) + savings);
        const paidRatio = totalPayable > 0 ? Math.min(1, (l.totalPaid || 0) / totalPayable) : 0;
        const paidSav = Math.round(savings * paidRatio);
        savingsCollected += paidSav;
        savingsOutstanding += Math.max(0, savings - paidSav);
      } else {
        savingsCollected += savings;
      }
    });

    // Core Loan + Interest Contract metrics (excluding borrower savings deposit liabilities)
    const totalCollectedAmount = Math.max(0, totalCollectedWithSavings - savingsCollected);
    const totalRepaymentOutstanding = Math.max(0, totalRepaymentWithSavings - savingsOutstanding);

    // 5. Today's collections and shortfall matching the active daily route register
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentWeekday = dayNames[new Date().getDay()];
    const { targetDate, startOfDay: todayRouteStart, endOfDay: todayRouteEnd } = getRouteDateForWeekday(currentWeekday);

    const routeGroups = await Group.find({
      ...query,
      collectionDay: currentWeekday,
      status: { $ne: 'CLOSED' }
    }).select('_id');
    const routeGroupIds = routeGroups.map(g => g._id);

    const activeRouteLoans = await Loan.find({
      groupId: { $in: routeGroupIds },
      status: { $in: ['ACTIVE', 'OVERDUE'] }
    }).select('_id');

    let todayExpected = 0;
    for (const l of activeRouteLoans) {
      let targetInst = await Installment.findOne({
        loanId: l._id,
        dueDate: { $gte: todayRouteStart, $lte: todayRouteEnd }
      });
      if (!targetInst) {
        targetInst = await Installment.findOne({
          loanId: l._id,
          paidDate: { $gte: todayRouteStart, $lte: todayRouteEnd }
        });
      }
      if (targetInst) {
        todayExpected += targetInst.expectedAmount;
      } else {
        const nextPendingInst = await Installment.findOne({
          loanId: l._id,
          status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] }
        }).sort({ installmentNumber: 1 });
        if (nextPendingInst) {
          todayExpected += nextPendingInst.balanceAmount;
        }
      }
    }

    // Collections strictly received on today's route
    const todayRoutePayments = await Payment.find({
      groupId: { $in: routeGroupIds },
      paymentDate: { $gte: todayRouteStart, $lte: todayRouteEnd },
      isReversed: false
    });
    let todayActual = 0;
    todayRoutePayments.forEach(p => {
      todayActual += p.amount;
    });

    const todayShortfall = Math.max(0, todayExpected - todayActual);

    // 6. Dynamic Overdue calculation from shared pendingService (matching Pending & Overdue tab to the exact rupee)
    const pollachiBranch = await Branch.findOne({ code: 'POLLACHI' });
    const targetBranchId = query.branchId ? query.branchId : pollachiBranch?._id;

    const pendingData = await getPendingOverdueRegister({
      branchId: targetBranchId && targetBranchId !== 'ALL' ? targetBranchId : undefined
    });
    const totalOverdue = pendingData.summary.totalActualPending;
    const totalBalancePending = pendingData.summary.totalBalancePending;

    // 7. Pending approvals
    const pendingApprovals = await Loan.countDocuments({ ...query, status: 'SUBMITTED' });

    // 8. Dynamic Inter-branch liquidity transfer calculation
    let interBranchBalance = 0;

    if (targetBranchId) {
      const trfIn = await BranchTransfer.aggregate([
        { $match: { destinationBranchId: targetBranchId } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const trfOut = await BranchTransfer.aggregate([
        { $match: { sourceBranchId: targetBranchId } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const inAmt = trfIn[0]?.total || 0;
      const outAmt = trfOut[0]?.total || 0;
      interBranchBalance = Math.abs(inAmt - outAmt);
    }

    // 9. Branch cash & bank balances from verified vault records
    let totalCashBalance = 0;
    let totalBankBalance = 0;

    if (selectedBranch) {
      totalCashBalance = Math.max(0, selectedBranch.cashBalance || 0);
      totalBankBalance = Math.max(0, selectedBranch.bankBalance || 0);
    } else {
      const branches = await Branch.find();
      branches.forEach(b => {
        totalCashBalance += Math.max(0, b.cashBalance || 0);
        totalBankBalance += Math.max(0, b.bankBalance || 0);
      });
    }

    res.json({
      success: true,
      metrics: {
        totalCustomers,
        activeGroups,
        activeLoans,
        totalLoanAmountGiven,
        totalCollectedAmount,
        totalPrincipalOutstanding,
        totalRepaymentOutstanding,
        totalCollectedWithSavings,
        totalRepaymentWithSavings,
        savingsCollected,
        savingsOutstanding,
        todayExpected,
        todayActual,
        todayShortfall,
        totalOverdue,
        totalBalancePending,
        pendingApprovals,
        totalCashBalance,
        totalBankBalance,
        interBranchBalance
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/charts', async (req: Request, res: Response) => {
  try {
    const { branchId } = req.query;
    const query: any = {};

    if (req.user?.role !== 'MAIN_ADMIN') {
      query.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      query.branchId = branchId;
    }

    // 1. Weekday distribution of groups & loans
    const weekdayDistribution = await Group.aggregate([
      { $match: { ...query, status: 'LIVE' } },
      { $group: { _id: '$collectionDay', count: { $sum: 1 }, totalMembers: { $sum: '$totalMembers' } } }
    ]);

    // 2. Overdue ageing buckets and priority follow-ups derived from shared pendingService
    const pollachiBranch = await Branch.findOne({ code: 'POLLACHI' });
    const targetBranchId = query.branchId ? query.branchId : pollachiBranch?._id;
    const pendingData = await getPendingOverdueRegister({
      branchId: targetBranchId && targetBranchId !== 'ALL' ? targetBranchId : undefined
    });

    const ageing = {
      '1 Week': 0,
      '2 Weeks': 0,
      '3 Weeks': 0,
      '4+ Weeks': 0
    };
    pendingData.followUps.forEach(f => {
      if (f.overdueWeeks <= 1) ageing['1 Week'] += f.actualPending;
      else if (f.overdueWeeks === 2) ageing['2 Weeks'] += f.actualPending;
      else if (f.overdueWeeks === 3) ageing['3 Weeks'] += f.actualPending;
      else ageing['4+ Weeks'] += f.actualPending;
    });

    const ageingBuckets = Object.entries(ageing).map(([bucket, amount]) => ({ bucket, amount }));

    // 3. Loan status breakdown
    const loanStatuses = await Loan.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 }, totalPrincipal: { $sum: '$principal' } } }
    ]);

    // 4. Recent payment transactions (excluding early settlements, showing only route collections)
    const now = new Date();
    const todayEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));

    const recentPayments = await Payment.find({
      ...query,
      isReversed: false,
      paymentDate: { $lte: todayEnd },
      remarks: { $not: /Early Settlement/i }
    })
      .populate('customerId', 'name phone')
      .populate('groupId', 'name')
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(8);

    // 5. Priority overdue follow-ups matching Pending & Overdue tab
    const priorityFollowups = pendingData.followUps.slice(0, 6);

    // 6. Branch performance comparison (for Admin)
    const branchComparison: any[] = [];
    if (req.user?.role === 'MAIN_ADMIN') {
      const branches = await Branch.find();
      for (const b of branches) {
        const bLoans = await Loan.countDocuments({ branchId: b._id, status: { $in: ['ACTIVE', 'OVERDUE'] } });
        const bCust = await Customer.countDocuments({ branchId: b._id });
        branchComparison.push({
          branchName: b.name,
          cashBalance: b.cashBalance,
          bankBalance: b.bankBalance,
          activeLoans: bLoans,
          customers: bCust
        });
      }
    }

    res.json({
      success: true,
      charts: {
        weekdayDistribution,
        ageingBuckets,
        loanStatuses,
        recentPayments,
        priorityFollowups,
        branchComparison
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
