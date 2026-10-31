import { Router, Request, Response } from 'express';
import { ReportService, calculatePaymentBreakdown } from '../services/reportService';
import { Loan } from '../models/Loan';
import { Payment } from '../models/Payment';
import { Expense } from '../models/Expense';
import { FollowUp } from '../models/FollowUp';
import { Group } from '../models/Group';
import { Branch } from '../models/Branch';
import { Installment } from '../models/Installment';
import { authenticate } from '../middleware/auth';
import { enforceBranchScope, requireRole } from '../middleware/roles';
import { getRouteDateForWeekday } from './collectionRoutes';
import { getPendingOverdueRegister } from '../services/pendingService';

const router = Router();

router.use(authenticate);
router.use(enforceBranchScope);
router.use(requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'));

const resolveBranchId = (req: Request, branchIdQuery?: any) => {
  if (req.user?.role !== 'MAIN_ADMIN') {
    return req.user?.branchId;
  }
  if (branchIdQuery && branchIdQuery !== 'undefined' && branchIdQuery !== 'null' && branchIdQuery !== '') {
    return branchIdQuery;
  }
  return undefined;
};

// ==========================================
// 1. DAILY REPORTS (JSON & EXCEL)
// ==========================================
router.get('/daily', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const { startDate, endDate, date } = req.query as { startDate?: string; endDate?: string; date?: string };

    let startRange: Date;
    let endRange: Date;

    if (startDate && endDate) {
      startRange = new Date(startDate);
      endRange = new Date(endDate);
    } else {
      const target = date ? new Date(date) : new Date();
      startRange = target;
      endRange = target;
    }

    const startOfDay = new Date(startRange);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(endRange);
    endOfDay.setHours(23, 59, 59, 999);

    const baseQuery: any = {};
    if (branchId) baseQuery.branchId = branchId;

    // Identify all weekday names covered in the query range
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const coveredWeekdays = new Set<string>();
    const iter = new Date(startOfDay);
    while (iter.getTime() <= endOfDay.getTime()) {
      coveredWeekdays.add(dayNames[iter.getDay()]);
      iter.setDate(iter.getDate() + 1);
    }

    const [payments, disbursements, expenses, routeGroups] = await Promise.all([
      Payment.find({
        ...baseQuery,
        paymentDate: { $gte: startOfDay, $lte: endOfDay }
      })
        .populate('customerId', 'name phone')
        .populate('groupId', 'name collectionDay groupCode')
        .populate('collectorId', 'name')
        .populate('branchId', 'name')
        .sort({ createdAt: -1 }),
      Loan.find({
        ...baseQuery,
        disbursedDate: { $gte: startOfDay, $lte: endOfDay }
      })
        .populate('customerId', 'name phone')
        .populate('groupId', 'name groupCode')
        .populate('branchId', 'name')
        .sort({ createdAt: -1 }),
      Expense.find({
        ...baseQuery,
        expenseDate: { $gte: startOfDay, $lte: endOfDay },
        status: 'APPROVED'
      }).populate('branchId', 'name'),
      Group.find({
        ...baseQuery,
        collectionDay: { $in: Array.from(coveredWeekdays) },
        status: { $ne: 'CLOSED' }
      }).select('_id collectionDay groupCode name staffName').lean()
    ]);

    const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalCash = payments.filter(p => p.paymentMethod === 'CASH').reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalDigital = totalCollected - totalCash;
    const totalDisbursed = disbursements.reduce((sum, d) => sum + (d.principal || 0), 0);
    const totalInterestGiven = disbursements.reduce((sum, d) => sum + (d.interestAmount || 0), 0);
    const totalDocCharges = disbursements.reduce((sum, d) => sum + (d.docCharges || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const { collectedPrincipal, collectedInterest, collectedSavings } = await calculatePaymentBreakdown(payments);

    // Calculate daily route expected due and shortfall strictly using Collections logic
    const isDateRange = !!(startDate && endDate && String(startDate) !== String(endDate));
    let expectedDue = 0;
    let shortfall = 0;
    let routeCollected = 0;

    if (isDateRange) {
      const rangeInstallments = await Installment.find({
        ...baseQuery,
        dueDate: { $gte: startOfDay, $lte: endOfDay }
      }).lean();

      expectedDue = rangeInstallments.reduce((sum, inst) => sum + (inst.expectedAmount || 0), 0);
      shortfall = rangeInstallments.reduce((sum, inst) => sum + Math.max(0, inst.balanceAmount || 0), 0);
      routeCollected = totalCollected;
    } else {
      const targetWeekday = dayNames[startOfDay.getDay()];
      const singleRouteGroups = await Group.find({
        ...baseQuery,
        collectionDay: targetWeekday,
        status: { $ne: 'CLOSED' }
      }).select('_id').lean();
      const singleRouteGroupIds = singleRouteGroups.map(g => g._id);

      const singleRouteLoans = await Loan.find({
        ...baseQuery,
        groupId: { $in: singleRouteGroupIds },
        $or: [
          { status: { $in: ['ACTIVE', 'OVERDUE', 'BAD_DEBT'] } },
          { _id: { $in: await Payment.distinct('loanId', { ...baseQuery, groupId: { $in: singleRouteGroupIds }, paymentDate: { $gte: startOfDay, $lte: endOfDay }, isReversed: false }) } }
        ]
      }).lean();

      const singleLoanIds = singleRouteLoans.map(l => l._id);
      const singleInsts = await Installment.find({ loanId: { $in: singleLoanIds } }).lean();

      const instByLoan = new Map<string, any[]>();
      singleInsts.forEach(i => {
        const k = String(i.loanId);
        if (!instByLoan.has(k)) instByLoan.set(k, []);
        instByLoan.get(k)!.push(i);
      });

      const routePaymentsList = payments.filter(p => {
        const gid = String((p.groupId as any)?._id || p.groupId);
        return singleRouteGroupIds.some(id => String(id) === gid);
      });
      routeCollected = routePaymentsList.reduce((sum, p) => sum + (p.amount || 0), 0);

      const payByLoan = new Map<string, any[]>();
      routePaymentsList.forEach(p => {
        const k = String((p.loanId as any)?._id || p.loanId);
        if (!payByLoan.has(k)) payByLoan.set(k, []);
        payByLoan.get(k)!.push(p);
      });

      for (const l of singleRouteLoans) {
        const lPays = payByLoan.get(String(l._id)) || [];
        const paidOnDate = lPays.reduce((sum, p) => sum + (p.amount || 0), 0);
        const lInsts = instByLoan.get(String(l._id)) || [];

        const lDisb = l.disbursedDate ? new Date(l.disbursedDate).getTime() : 0;
        if (lDisb > endOfDay.getTime() && paidOnDate <= 0) continue;

        const outTotal = l.outstandingTotal || 0;
        const scheduledThisWeek = lInsts.find(i => {
          const d = new Date(i.dueDate).getTime();
          return d >= startOfDay.getTime() && d <= endOfDay.getTime();
        });
        const regularWeekly = scheduledThisWeek?.expectedAmount || lInsts.find(i => i.balanceAmount > 0)?.expectedAmount || lInsts[0]?.expectedAmount || 0;

        const isClosed = (l.status === 'CLOSED' || l.status === 'SETTLED' || outTotal <= 0);
        if (isClosed) {
          if (paidOnDate > 0) expectedDue += paidOnDate;
        } else {
          expectedDue += (regularWeekly || paidOnDate);
        }

        const unpaidInsts = lInsts.filter(i => i.status !== 'PAID' && i.balanceAmount > 0);
        let remaining = 0;
        if (paidOnDate > 0) {
          const duesRem = unpaidInsts.filter(i => new Date(i.dueDate).getTime() <= endOfDay.getTime());
          if (duesRem.length === 0 || paidOnDate >= regularWeekly || isClosed) {
            remaining = 0;
          } else {
            remaining = Math.max(0, regularWeekly - paidOnDate);
          }
        } else if (isClosed) {
          remaining = 0;
        } else {
          remaining = regularWeekly;
        }
        shortfall += remaining;
      }
    }

    res.json({
      success: true,
      date: startDate && endDate ? `${startDate} to ${endDate}` : (date || startOfDay.toISOString().split('T')[0]),
      isDateRange: !!(startDate && endDate),
      startDate: startOfDay.toISOString().split('T')[0],
      endDate: endOfDay.toISOString().split('T')[0],
      summary: {
        expectedDue,
        collectedAmount: totalCollected, // Repayments collected on date
        routeCollected,
        shortfall,
        totalLoanGiven: totalDisbursed,
        disbursementCount: disbursements.length,
        interestGiven: totalInterestGiven,
        collectedPrincipal,
        collectedInterest,
        collectedSavings,
        docCharges: totalDocCharges,
        totalCollected: totalCollected + totalDocCharges, // Total received = repayments + upfront doc charges
        totalDisbursed,
        totalCash,
        totalDigital,
        totalExpenses,
        netCashflow: (totalCollected + totalDocCharges) - totalDisbursed - totalExpenses
      },
      payments,
      disbursements,
      expenses
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/daily/export', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const buffer = await ReportService.generateDailyReport({
      branchId,
      date: req.query.date as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const filename = req.query.startDate && req.query.endDate
      ? `report_${req.query.startDate}_to_${req.query.endDate}.xlsx`
      : `daily_report_${req.query.date || Date.now()}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 2. WEEKLY REPORTS (JSON & EXCEL)
// ==========================================
router.get('/weekly', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const baseQuery: any = {};
    if (branchId) baseQuery.branchId = branchId;

    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const dateRanges = days.map(d => ({ day: d, ...getRouteDateForWeekday(d) }));
    const minStartOfDay = new Date(Math.min(...dateRanges.map(r => r.startOfDay.getTime())));
    const maxEndOfDay = new Date(Math.max(...dateRanges.map(r => r.endOfDay.getTime())));

    // 1. Fetch ALL groups for the week
    const allGroups = await Group.find({ ...baseQuery, collectionDay: { $in: days } }).sort({ groupCode: 1 }).lean();
    const allGroupIds = allGroups.map(g => g._id);

    // 2. Fetch ALL active/overdue loans for these groups disbursed on or before this week
    const allLoans = await Loan.find({
      groupId: { $in: allGroupIds },
      status: { $in: ['ACTIVE', 'OVERDUE'] },
      $or: [
        { disbursedDate: { $lte: maxEndOfDay } },
        { disbursedDate: null }
      ]
    }).populate('customerId', 'name phone').lean();
    const allLoanIds = allLoans.map(l => l._id);

    // 3. Pre-fetch targeted installments for these loans
    const allInstallments = await Installment.find({
      loanId: { $in: allLoanIds },
      $or: [
        { status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
        { dueDate: { $gte: minStartOfDay, $lte: maxEndOfDay } },
        { paidDate: { $gte: minStartOfDay, $lte: maxEndOfDay } }
      ]
    }).lean();

    const instsByLoan = new Map<string, any[]>();
    for (const inst of allInstallments) {
      const key = String(inst.loanId);
      let arr = instsByLoan.get(key);
      if (!arr) {
        arr = [];
        instsByLoan.set(key, arr);
      }
      arr.push(inst);
    }

    // 4. Pre-fetch all payments for these groups across all weekdays
    const allPayments = await Payment.find({
      groupId: { $in: allGroupIds },
      paymentDate: { $gte: minStartOfDay, $lte: maxEndOfDay },
      isReversed: false
    }).lean();

    // 5. Pre-fetch all disbursements for the week
    const allDisbursements = await Loan.find({
      ...baseQuery,
      disbursedDate: { $gte: minStartOfDay, $lte: maxEndOfDay }
    }).lean();

    const daysBreakdown: any[] = [];
    let weeklyExpected = 0;
    let weeklyCollected = 0;
    let weeklyShortfall = 0;
    let totalScheduledGroups = 0;
    let totalActiveBorrowers = 0;
    let weeklyDisbursedAmount = 0;
    let weeklyDisbursedCount = 0;

    for (const { day, startOfDay, endOfDay } of dateRanges) {
      const dayStartTs = startOfDay.getTime();
      const dayEndTs = endOfDay.getTime();

      const groups = allGroups.filter(g => g.collectionDay === day);

      const dayDisbursements = allDisbursements.filter(l => {
        if (!l.disbursedDate) return false;
        const t = new Date(l.disbursedDate).getTime();
        return t >= dayStartTs && t <= dayEndTs;
      });
      const dayDisbAmt = dayDisbursements.reduce((sum, l) => sum + (l.principal || 0), 0);
      const dayDisbCount = dayDisbursements.length;

      weeklyDisbursedAmount += dayDisbAmt;
      weeklyDisbursedCount += dayDisbCount;

      let dayExp = 0;
      let dayColl = 0;
      let dayShortfall = 0;
      let dayBorrowers = 0;
      const groupList: any[] = [];

      for (const grp of groups) {
        const grpIdStr = String(grp._id);
        const loans = allLoans.filter(l => String(l.groupId) === grpIdStr);

        const payments = allPayments.filter(p => {
          if (String(p.groupId) !== grpIdStr) return false;
          const pDate = new Date(p.paymentDate).getTime();
          return pDate >= dayStartTs && pDate <= dayEndTs;
        });
        const grpColl = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        let grpExp = 0;
        let grpRemaining = 0;

        for (const l of loans) {
          const loanInsts = instsByLoan.get(String(l._id)) || [];
          const lPays = payments.filter(p => String(p.loanId) === String(l._id));
          const paidOnDate = lPays.reduce((sum, p) => sum + (p.amount || 0), 0);

          const lDisb = l.disbursedDate ? new Date(l.disbursedDate).getTime() : 0;
          if (lDisb > dayEndTs && paidOnDate <= 0) {
            continue;
          }

          const outTotal = l.outstandingTotal || 0;
          const scheduledThisWeek = loanInsts.find(i => {
            const d = new Date(i.dueDate).getTime();
            return d >= dayStartTs && d <= dayEndTs;
          });
          const regularWeekly = scheduledThisWeek?.expectedAmount || loanInsts.find(i => i.balanceAmount > 0)?.expectedAmount || loanInsts[0]?.expectedAmount || 0;

          const isClosed = (l.status === 'CLOSED' || l.status === 'SETTLED' || outTotal <= 0);
          if (isClosed) {
            if (paidOnDate > 0) grpExp += paidOnDate;
          } else {
            grpExp += (regularWeekly || paidOnDate);
          }

          const unpaidInsts = loanInsts.filter(i => i.status !== 'PAID' && i.balanceAmount > 0);
          let remaining = 0;
          if (paidOnDate > 0) {
            const duesRem = unpaidInsts.filter(i => new Date(i.dueDate).getTime() <= dayEndTs);
            if (duesRem.length === 0 || paidOnDate >= regularWeekly || isClosed) {
              remaining = 0;
            } else {
              remaining = Math.max(0, regularWeekly - paidOnDate);
            }
          } else if (isClosed) {
            remaining = 0;
          } else {
            remaining = regularWeekly;
          }
          grpRemaining += remaining;
        }

        dayExp += grpExp;
        dayColl += grpColl;
        dayShortfall += grpRemaining;
        dayBorrowers += loans.length;

        groupList.push({
          groupId: grp._id,
          groupCode: grp.groupCode,
          groupName: grp.name,
          area: grp.area,
          collector: grp.staffName,
          borrowersCount: loans.length,
          expected: grpExp,
          collected: grpColl,
          shortfall: grpRemaining
        });
      }

      weeklyExpected += dayExp;
      weeklyCollected += dayColl;
      weeklyShortfall += dayShortfall;
      totalScheduledGroups += groups.length;
      totalActiveBorrowers += dayBorrowers;

      daysBreakdown.push({
        day,
        groupsCount: groups.length,
        borrowersCount: dayBorrowers,
        expected: dayExp,
        collected: dayColl,
        shortfall: dayShortfall,
        efficiency: dayExp > 0 ? Math.round((dayColl / dayExp) * 100) : (dayColl > 0 ? 100 : 0),
        disbursedAmount: dayDisbAmt,
        disbursedCount: dayDisbCount,
        groups: groupList
      });
    }

    const weeklyInterestGiven = allDisbursements.reduce((sum, d) => sum + (d.interestAmount || 0), 0);
    const weeklyDocCharges = allDisbursements.reduce((sum, d) => sum + (d.docCharges || 0), 0);
    const { collectedPrincipal, collectedInterest, collectedSavings } = await calculatePaymentBreakdown(allPayments);

    res.json({
      success: true,
      summary: {
        expectedDue: weeklyExpected,
        collectedAmount: weeklyCollected,
        weeklyExpected,
        weeklyCollected,
        weeklyShortfall,
        shortfall: weeklyShortfall,
        overallEfficiency: weeklyExpected > 0 ? Math.round((weeklyCollected / weeklyExpected) * 100) : 100,
        totalScheduledGroups,
        totalActiveBorrowers,
        totalLoanGiven: weeklyDisbursedAmount,
        weeklyDisbursedAmount,
        weeklyDisbursedCount,
        disbursementCount: weeklyDisbursedCount,
        interestGiven: weeklyInterestGiven,
        collectedPrincipal,
        collectedInterest,
        collectedSavings,
        docCharges: weeklyDocCharges,
        totalCollected: weeklyCollected + weeklyDocCharges
      },
      days: daysBreakdown
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/weekly/export', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const buffer = await ReportService.generateWeeklyReport({ branchId });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=weekly_report_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 3. MONTHLY REPORTS (JSON & EXCEL)
// ==========================================
router.get('/monthly', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);

    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const baseQuery: any = {};
    if (branchId) baseQuery.branchId = branchId;

    const loansDisbursed = await Loan.find({
      ...baseQuery,
      disbursedDate: { $gte: startOfMonth, $lte: endOfMonth }
    }).populate('customerId', 'name phone').populate('groupId', 'name');

    const payments = await Payment.find({
      ...baseQuery,
      paymentDate: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const expenses = await Expense.find({
      ...baseQuery,
      expenseDate: { $gte: startOfMonth, $lte: endOfMonth },
      status: 'APPROVED'
    });

    const totalPrincipalDisbursed = loansDisbursed.reduce((sum, l) => sum + (l.principal || 0), 0);
    const totalDocCharges = loansDisbursed.reduce((sum, l) => sum + (l.docCharges || 0), 0);
    const totalInterestGiven = loansDisbursed.reduce((sum, l) => sum + (l.interestAmount || 0), 0);
    const totalSavingsCollected = loansDisbursed.reduce((sum, l) => sum + (l.savingsAmount || 0), 0);
    const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const { collectedPrincipal, collectedInterest, collectedSavings } = await calculatePaymentBreakdown(payments);

    // Calculate monthly collection target from scheduled installments
    const monthlyInstallments = await Installment.find({
      ...baseQuery,
      dueDate: { $gte: startOfMonth, $lte: endOfMonth }
    }).lean();
    const targetToCollect = monthlyInstallments.reduce((sum, inst) => sum + (inst.expectedAmount || 0), 0);
    const monthlyShortfall = monthlyInstallments.reduce((sum, inst) => sum + Math.max(0, inst.balanceAmount || 0), 0);
    const recoveryPercentage = targetToCollect > 0 ? Math.round((totalCollected / targetToCollect) * 100) : (totalCollected > 0 ? 100 : 0);

    const closedLoansCount = await Loan.countDocuments({
      ...baseQuery,
      closedDate: { $gte: startOfMonth, $lte: endOfMonth },
      status: { $in: ['CLOSED', 'SETTLED'] }
    });

    res.json({
      success: true,
      year,
      month,
      monthName: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
      summary: {
        expectedDue: targetToCollect,
        collectedAmount: totalCollected,
        shortfall: monthlyShortfall,
        totalLoanGiven: totalPrincipalDisbursed,
        disbursementCount: loansDisbursed.length,
        interestGiven: totalInterestGiven,
        collectedPrincipal,
        collectedInterest,
        collectedSavings,
        docCharges: totalDocCharges,
        totalCollected: totalCollected + totalDocCharges,
        totalPrincipalDisbursed,
        totalDocCharges,
        totalSavingsCollected,
        targetToCollect,
        recoveryPercentage,
        totalExpenses,
        closedLoansCount,
        netOperationalSurplus: (totalCollected + totalDocCharges) - (totalPrincipalDisbursed + totalExpenses)
      },
      loansDisbursed,
      expenses
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/monthly/export', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);

    const buffer = await ReportService.generateMonthlyReport({ branchId, year, month });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=monthly_report_${year}_${month}_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 4. PENDING EMI REPORTS (JSON & EXCEL)
// Canonical source: getPendingOverdueRegister
// ==========================================
router.get('/pending-emi', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const collectionDay = req.query.collectionDay as string;
    const search = req.query.search as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const result = await getPendingOverdueRegister({
      branchId,
      weekday: collectionDay !== 'ALL' ? collectionDay : undefined,
      search,
      startDate,
      endDate
    });

    const pendingList = result.followUps.map(f => ({
      id: f.id,
      loanNumber: f.loanNumber,
      customerName: f.customerName,
      groupName: f.groupName,
      collectionDay: f.collectionDay,
      phone: f.customerPhone,
      nomineePhone: f.nomineePhone || '-',
      overdueWeeks: f.overdueWeeks,
      actualPending: f.actualPending,
      customerKnown: f.customerKnown || f.actualPending,
      collector: f.staffName || 'Staff',
      remarks: f.remarks || 'Pending field follow-up',
      status: f.status
    }));

    const totalOverdueAmount = result.summary.totalActualPending;
    const highRiskCount = result.followUps.filter(p => typeof p.overdueWeeks === 'number' && p.overdueWeeks >= 3).length;

    res.json({
      success: true,
      summary: {
        totalBorrowers: pendingList.length,
        totalOverdueAmount,
        totalActualPending: result.summary.totalActualPending,
        totalBalancePending: result.summary.totalBalancePending,
        totalSavings: result.summary.totalSavings,
        highRiskCount
      },
      pendingList
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/pending-emi/export', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const buffer = await ReportService.generatePendingEmiReport({
      branchId,
      collectionDay: req.query.collectionDay as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const filename = req.query.startDate && req.query.endDate
      ? `pending_emi_${req.query.startDate}_to_${req.query.endDate}.xlsx`
      : `pending_emi_report_${Date.now()}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 5. PROFIT AND LOSS (JSON & EXCEL)
// ==========================================
router.get('/profit-loss', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const data = await ReportService.compileProfitLossData({
      branchId,
      startDate,
      endDate
    });

    res.json({
      success: true,
      branchName: data.branchName,
      periodLabel: data.periodLabel,
      maxWeeks: data.maxWeeks,
      revenue: data.summary.revenue,
      expenses: data.summary.expenses,
      netProfit: data.summary.netProfit,
      profitMargin: data.summary.profitMargin,
      summary: data.summary,
      totals: data.totals,
      pnlRows: data.pnlRows,
      expenseRows: data.expenseRows
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/profit-loss/export', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const buffer = await ReportService.generateProfitLossReport({
      branchId,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const filename = req.query.startDate && req.query.endDate
      ? `profit_loss_${req.query.startDate}_to_${req.query.endDate}.xlsx`
      : `profit_loss_${Date.now()}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/expenses/export', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const buffer = await ReportService.generateExpensesReport({
      branchId,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const filename = req.query.startDate && req.query.endDate
      ? `expenses_${req.query.startDate}_to_${req.query.endDate}.xlsx`
      : `expenses_${Date.now()}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 6. BRANCH WISE REPORTS (JSON & EXCEL)
// ==========================================
router.get('/branch-wise', async (_req: Request, res: Response) => {
  try {
    const branches = await Branch.find({ active: true }).sort({ name: 1 });
    const branchStats: any[] = [];

    for (const b of branches) {
      const loans = await Loan.find({ branchId: b._id });
      const payments = await Payment.find({ branchId: b._id });
      const expenses = await Expense.find({ branchId: b._id, status: 'APPROVED' });
      const groups = await Group.find({ branchId: b._id });

      const activeLoans = loans.filter(l => l.status === 'ACTIVE' || l.status === 'OVERDUE');
      const disbursed = loans.reduce((sum, l) => sum + (l.principal || 0), 0);
      const collected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const outstanding = activeLoans.reduce((sum, l) => sum + (l.outstandingTotal || 0), 0);
      const overdueLoans = activeLoans.filter(l => l.status === 'OVERDUE');
      const overdueAmt = overdueLoans.reduce((sum, l) => sum + (l.outstandingTotal || 0), 0);
      const totalExp = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      branchStats.push({
        branchId: b._id,
        code: b.code,
        name: b.name,
        address: b.address,
        phone: b.phone,
        cashBalance: b.cashBalance || 0,
        bankBalance: b.bankBalance || 0,
        groupsCount: groups.length,
        borrowersCount: activeLoans.length,
        disbursedAmount: disbursed,
        collectedAmount: collected,
        outstandingAmount: outstanding,
        overdueAmount: overdueAmt,
        overduePercent: outstanding > 0 ? Math.round((overdueAmt / outstanding) * 100) : 0,
        expensesAmount: totalExp,
        netBalance: collected - (disbursed + totalExp)
      });
    }

    const consolidated = {
      totalBranches: branches.length,
      totalGroups: branchStats.reduce((sum, b) => sum + b.groupsCount, 0),
      totalBorrowers: branchStats.reduce((sum, b) => sum + b.borrowersCount, 0),
      totalDisbursed: branchStats.reduce((sum, b) => sum + b.disbursedAmount, 0),
      totalCollected: branchStats.reduce((sum, b) => sum + b.collectedAmount, 0),
      totalOutstanding: branchStats.reduce((sum, b) => sum + b.outstandingAmount, 0),
      totalOverdue: branchStats.reduce((sum, b) => sum + b.overdueAmount, 0),
      totalExpenses: branchStats.reduce((sum, b) => sum + b.expensesAmount, 0),
      totalCashBalance: branchStats.reduce((sum, b) => sum + b.cashBalance, 0),
      totalBankBalance: branchStats.reduce((sum, b) => sum + b.bankBalance, 0)
    };

    res.json({
      success: true,
      branches: branchStats,
      consolidated
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/branch-wise/export', async (_req: Request, res: Response) => {
  try {
    const buffer = await ReportService.generateBranchWiseReport();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=branch_wise_report_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Legacy Excel Export Endpoints (Preserved for compatibility)
router.get('/collections/export', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const buffer = await ReportService.generateCollectionReport({
      branchId,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      collectionDay: req.query.collectionDay as string
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=collections_report_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/portfolio/export', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const buffer = await ReportService.generateLoanPortfolioReport({ branchId });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=loan_portfolio_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/pending/export', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const buffer = await ReportService.generatePendingReport({
      branchId,
      collectionDay: req.query.collectionDay as string
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=pending_report_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/cashbook/export', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const buffer = await ReportService.generateCashbookReport({
      branchId,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=cashbook_ledger_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
