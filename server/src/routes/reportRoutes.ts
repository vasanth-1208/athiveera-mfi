import { Router, Request, Response } from 'express';
import { ReportService } from '../services/reportService';
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
    const dateStr = req.query.date as string;
    const targetDate = dateStr ? new Date(dateStr) : new Date();

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const baseQuery: any = {};
    if (branchId) baseQuery.branchId = branchId;

    // Parallelize fetch of payments, disbursements, expenses, and route groups
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const weekdayStr = dayNames[targetDate.getDay()];

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
        collectionDay: weekdayStr,
        status: { $ne: 'CLOSED' }
      }).select('_id').lean()
    ]);

    const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalCash = payments.filter(p => p.paymentMethod === 'CASH').reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalDigital = totalCollected - totalCash;
    const totalDisbursed = disbursements.reduce((sum, d) => sum + (d.principal || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Calculate daily route expected due and shortfall for targetDate in a single batch query
    const routeGroupIds = routeGroups.map(g => g._id);
    const activeRouteLoans = await Loan.find({
      groupId: { $in: routeGroupIds },
      status: { $in: ['ACTIVE', 'OVERDUE'] }
    }).select('_id').lean();
    const activeRouteLoanIds = activeRouteLoans.map(l => l._id);

    const targetInstallments = await Installment.find({
      loanId: { $in: activeRouteLoanIds },
      $or: [
        { dueDate: { $gte: startOfDay, $lte: endOfDay } },
        { paidDate: { $gte: startOfDay, $lte: endOfDay } }
      ]
    }).lean();

    const instMap = new Map<string, any[]>();
    for (const inst of targetInstallments) {
      const k = String(inst.loanId);
      let arr = instMap.get(k);
      if (!arr) {
        arr = [];
        instMap.set(k, arr);
      }
      arr.push(inst);
    }

    const dayStartTs = startOfDay.getTime();
    const dayEndTs = endOfDay.getTime();
    let expectedDue = 0;

    for (const lId of activeRouteLoanIds) {
      const loanInsts = instMap.get(String(lId)) || [];
      let targetInst = loanInsts.find(i => {
        if (!i.dueDate) return false;
        const t = new Date(i.dueDate).getTime();
        return t >= dayStartTs && t <= dayEndTs;
      });
      if (!targetInst) {
        targetInst = loanInsts.find(i => {
          if (!i.paidDate) return false;
          const t = new Date(i.paidDate).getTime();
          return t >= dayStartTs && t <= dayEndTs;
        });
      }
      if (targetInst) {
        expectedDue += targetInst.expectedAmount;
      }
    }
    const shortfall = Math.max(0, expectedDue - totalCollected);

    res.json({
      success: true,
      date: targetDate.toISOString().split('T')[0],
      summary: {
        totalCollected,
        totalCash,
        totalDigital,
        expectedDue,
        shortfall,
        totalDisbursed,
        disbursementCount: disbursements.length,
        totalExpenses,
        netCashflow: totalCollected - totalDisbursed - totalExpenses
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
      date: req.query.date as string
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=daily_report_${Date.now()}.xlsx`);
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

    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
    const dateRanges = days.map(d => ({ day: d, ...getRouteDateForWeekday(d) }));
    const minStartOfDay = new Date(Math.min(...dateRanges.map(r => r.startOfDay.getTime())));
    const maxEndOfDay = new Date(Math.max(...dateRanges.map(r => r.endOfDay.getTime())));

    // 1. Fetch ALL groups for the week
    const allGroups = await Group.find({ ...baseQuery, collectionDay: { $in: days } }).sort({ groupCode: 1 }).lean();
    const allGroupIds = allGroups.map(g => g._id);

    // 2. Fetch ALL active/overdue loans for these groups
    const allLoans = await Loan.find({
      groupId: { $in: allGroupIds },
      status: { $in: ['ACTIVE', 'OVERDUE'] }
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
        for (const l of loans) {
          const loanInsts = instsByLoan.get(String(l._id)) || [];
          let targetInst = loanInsts.find(i => {
            if (!i.dueDate) return false;
            const t = new Date(i.dueDate).getTime();
            return t >= dayStartTs && t <= dayEndTs;
          });
          if (!targetInst) {
            targetInst = loanInsts.find(i => {
              if (!i.paidDate) return false;
              const t = new Date(i.paidDate).getTime();
              return t >= dayStartTs && t <= dayEndTs;
            });
          }
          if (!targetInst) {
            const pendingInsts = loanInsts.filter(i => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(i.status));
            pendingInsts.sort((a, b) => a.installmentNumber - b.installmentNumber);
            targetInst = pendingInsts[0];
          }
          grpExp += targetInst ? (targetInst.expectedAmount || 0) : 0;
        }

        dayExp += grpExp;
        dayColl += grpColl;
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
          shortfall: Math.max(0, grpExp - grpColl)
        });
      }

      weeklyExpected += dayExp;
      weeklyCollected += dayColl;
      totalScheduledGroups += groups.length;
      totalActiveBorrowers += dayBorrowers;

      daysBreakdown.push({
        day,
        groupsCount: groups.length,
        borrowersCount: dayBorrowers,
        expected: dayExp,
        collected: dayColl,
        shortfall: Math.max(0, dayExp - dayColl),
        efficiency: dayExp > 0 ? Math.round((dayColl / dayExp) * 100) : (dayColl > 0 ? 100 : 0),
        disbursedAmount: dayDisbAmt,
        disbursedCount: dayDisbCount,
        groups: groupList
      });
    }

    res.json({
      success: true,
      summary: {
        weeklyExpected,
        weeklyCollected,
        weeklyShortfall: Math.max(0, weeklyExpected - weeklyCollected),
        overallEfficiency: weeklyExpected > 0 ? Math.round((weeklyCollected / weeklyExpected) * 100) : 100,
        totalScheduledGroups,
        totalActiveBorrowers,
        weeklyDisbursedAmount,
        weeklyDisbursedCount
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
    const totalSavingsCollected = loansDisbursed.reduce((sum, l) => sum + (l.savingsAmount || 0), 0);
    const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Calculate monthly collection target from scheduled installments
    const monthlyInstallments = await Installment.find({
      ...baseQuery,
      dueDate: { $gte: startOfMonth, $lte: endOfMonth }
    }).lean();
    const targetToCollect = monthlyInstallments.reduce((sum, inst) => sum + (inst.expectedAmount || 0), 0);
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
        disbursementCount: loansDisbursed.length,
        totalPrincipalDisbursed,
        totalDocCharges,
        totalSavingsCollected,
        totalCollected,
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
// ==========================================
router.get('/pending-emi', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const collectionDay = req.query.collectionDay as string;

    const baseQuery: any = {};
    if (branchId) baseQuery.branchId = branchId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Auto-mark any installment whose due date has passed (< today) and has positive balance as OVERDUE
    await Installment.updateMany(
      {
        dueDate: { $lt: todayStart },
        balanceAmount: { $gt: 0 },
        status: { $ne: 'OVERDUE' }
      },
      { $set: { status: 'OVERDUE' } }
    );

    // Strictly dynamic: find loans whose status is 'OVERDUE'
    const overdueLoans = await Loan.find({
      ...baseQuery,
      status: 'OVERDUE'
    })
      .populate('customerId', 'name phone nomineePhone area')
      .populate('groupId', 'name collectionDay staffName groupCode')
      .lean();

    const pendingList: any[] = [];

    for (const l of overdueLoans) {
      const custObj = l.customerId as any;
      const grpObj = l.groupId as any;
      const cDay = grpObj?.collectionDay || l.collectionDay || 'MONDAY';

      if (collectionDay && collectionDay !== 'ALL' && cDay !== collectionDay) {
        continue;
      }

      // Calculate actual overdue from overdue installments
      const overdueInsts = await Installment.find({
        loanId: l._id,
        $or: [
          { status: 'OVERDUE' },
          { dueDate: { $lt: todayStart }, balanceAmount: { $gt: 0 } }
        ]
      }).lean();

      const actualPending = overdueInsts.reduce((sum, i) => sum + (i.balanceAmount || 0), 0) || l.outstandingTotal;
      const overdueWeeks = overdueInsts.length || 1;

      // Optional remarks lookup from follow-ups
      const f = await FollowUp.findOne({
        $or: [
          { loanId: l._id },
          { customerId: l.customerId }
        ]
      }).lean();

      pendingList.push({
        id: l._id,
        loanNumber: l.loanNumber,
        customerName: custObj?.name || l.customerName || 'Borrower',
        groupName: grpObj?.name || l.groupName || '-',
        collectionDay: cDay,
        phone: custObj?.phone || l.customerPhone || '-',
        nomineePhone: custObj?.nomineePhone || l.nomineePhone || '-',
        overdueWeeks,
        actualPending,
        customerKnown: f?.customerKnown || actualPending,
        collector: l.assignedStaffName || grpObj?.staffName || f?.staffName || 'Staff',
        remarks: f?.remarks || 'Overdue installment requiring field recovery',
        status: 'PENDING'
      });
    }

    const totalOverdueAmount = pendingList.reduce((sum, p) => sum + (p.actualPending || 0), 0);
    const highRiskCount = pendingList.filter(p => typeof p.overdueWeeks === 'number' && p.overdueWeeks >= 3).length;

    res.json({
      success: true,
      summary: {
        totalBorrowers: pendingList.length,
        totalOverdueAmount,
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
      collectionDay: req.query.collectionDay as string
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=pending_emi_report_${Date.now()}.xlsx`);
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
    const baseQuery: any = {};
    if (branchId) baseQuery.branchId = branchId;

    const loans = await Loan.find(baseQuery);
    const payments = await Payment.find(baseQuery);
    const expenses = await Expense.find({ ...baseQuery, status: 'APPROVED' });

    const totalDocCharges = loans.reduce((sum, l) => sum + (l.docCharges || 0), 0);
    const totalInterestEarned = payments.reduce((sum, p) => sum + Math.round((p.amount || 0) * 0.16), 0);
    const totalOperatingRevenue = totalDocCharges + totalInterestEarned;

    const fuelExpenses = expenses.filter(e => e.category.toLowerCase().includes('fuel') || e.travelKM > 0)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const rentExpenses = expenses.filter(e => e.category.toLowerCase().includes('rent'))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const salaryExpenses = expenses.filter(e => e.category.toLowerCase().includes('salary') || e.category.toLowerCase().includes('incentive'))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const generalExpenses = expenses.filter(e => 
      !e.category.toLowerCase().includes('fuel') && 
      !e.category.toLowerCase().includes('rent') && 
      !e.category.toLowerCase().includes('salary') && 
      !e.category.toLowerCase().includes('incentive') &&
      e.travelKM <= 0
    ).reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalOperatingExpenses = fuelExpenses + rentExpenses + salaryExpenses + generalExpenses;
    const netOperatingProfit = totalOperatingRevenue - totalOperatingExpenses;
    const profitMargin = totalOperatingRevenue > 0 ? Math.round((netOperatingProfit / totalOperatingRevenue) * 100) : 0;

    res.json({
      success: true,
      revenue: {
        docCharges: totalDocCharges,
        interestEarned: totalInterestEarned,
        totalRevenue: totalOperatingRevenue
      },
      expenses: {
        fuel: fuelExpenses,
        rent: rentExpenses,
        salaries: salaryExpenses,
        general: generalExpenses,
        totalExpenses: totalOperatingExpenses
      },
      netProfit: netOperatingProfit,
      profitMargin
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/profit-loss/export', async (req: Request, res: Response) => {
  try {
    const branchId = resolveBranchId(req, req.query.branchId);
    const buffer = await ReportService.generateProfitLossReport({ branchId });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=profit_loss_${Date.now()}.xlsx`);
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
