import { Router, Request, Response } from 'express';
import { Payment } from '../models/Payment';
import { Installment } from '../models/Installment';
import { Loan } from '../models/Loan';
import { Group } from '../models/Group';
import { Customer } from '../models/Customer';
import { FollowUp } from '../models/FollowUp';
import { User } from '../models/User';
import { recordCashbookEntry } from '../services/cashbookService';
import { getNextReceiptNumber } from '../services/receiptService';
import { authenticate } from '../middleware/auth';
import { enforceBranchScope, requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate);
router.use(enforceBranchScope);

/**
 * Calculates the exact target date for a given collection weekday in the current operational week.
 * Assumes Monday-to-Sunday operational week cycle.
 */
export function getRouteDateForWeekday(weekday: string, refDate: Date = new Date()): { targetDate: Date; startOfDay: Date; endOfDay: Date } {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(refDate.getTime() + istOffsetMs);

  const dayOfWeek = istDate.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const mondayYear = istDate.getUTCFullYear();
  const mondayMonth = istDate.getUTCMonth();
  const mondayDay = istDate.getUTCDate() + diffToMonday;

  const dayOffsets: Record<string, number> = {
    MONDAY: 0,
    TUESDAY: 1,
    WEDNESDAY: 2,
    THURSDAY: 3,
    FRIDAY: 4,
    SATURDAY: 5,
    SUNDAY: 6
  };

  const offset = dayOffsets[weekday.toUpperCase()] ?? 0;

  const targetDate = new Date(Date.UTC(mondayYear, mondayMonth, mondayDay + offset, 12, 0, 0));
  const startOfDay = new Date(Date.UTC(mondayYear, mondayMonth, mondayDay + offset, 0, 0, 0, 0));
  const endOfDay = new Date(Date.UTC(mondayYear, mondayMonth, mondayDay + offset, 23, 59, 59, 999));

  return { targetDate, startOfDay, endOfDay };
}

function buildRouteMemberRows(
  loans: any[],
  routePayments: any[],
  installmentsByLoan: Map<string, any[]>,
  startOfDay: Date,
  endOfDay: Date,
  todayMidnight: Date,
  collectionDay?: string
) {
  let groupExpected = 0;
  let groupOutstanding = 0;
  let groupRemaining = 0;
  const memberRows: any[] = [];

  for (const l of loans) {
    const loanPayments = routePayments.filter(p => String(p.loanId) === String(l._id));
    const paidOnRouteDate = loanPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Rule: If viewing date is strictly before the loan disbursement date and no payments occurred on this date, this loan did not exist yet!
    const loanDisbursedTime = l.disbursedDate ? new Date(l.disbursedDate).getTime() : 0;
    if (loanDisbursedTime > endOfDay.getTime() && paidOnRouteDate <= 0) {
      continue;
    }

    const outTotal = l.outstandingTotal || 0;
    groupOutstanding += outTotal;

    const loanInsts = (installmentsByLoan.get(String(l._id)) || []).slice().sort((a, b) => a.installmentNumber - b.installmentNumber);

    // 1. Regular contractual weekly installment amount for this route week
    const scheduledThisWeek = loanInsts.find(i => {
      const d = new Date(i.dueDate).getTime();
      return d >= startOfDay.getTime() && d <= endOfDay.getTime();
    });
    const regularWeeklyAmount = scheduledThisWeek?.expectedAmount || loanInsts.find(i => i.balanceAmount > 0)?.expectedAmount || loanInsts[0]?.expectedAmount || 0;

    const isBadDebt = l.status === 'BAD_DEBT' || loanInsts.some(i => i.status === 'BAD_DEBT');
    const isLoanClosedOrSettled = (l.status === 'CLOSED' || l.status === 'SETTLED' || outTotal <= 0);

    // Route Expected Due represents this week's scheduled amount to be collected
    if (isLoanClosedOrSettled) {
      if (paidOnRouteDate > 0) {
        groupExpected += paidOnRouteDate;
      }
    } else {
      groupExpected += (regularWeeklyAmount || paidOnRouteDate);
    }

    // 2. Unpaid installments in strict chronological FIFO order
    const unpaidInsts = loanInsts.filter(i => i.status !== 'PAID' && (i.balanceAmount > 0));
    const nextUnpaidInst = unpaidInsts[0];

    let instToDisplay = nextUnpaidInst;
    let isPaidToday = false;
    let expAmt = 0;
    let remainingThisWeek = 0;
    let instStatus: string = 'PENDING';
    let overdueWeeks = 0;
    let totalDueUpToToday = 0;

    if (paidOnRouteDate > 0) {
      // Payments were recorded on this route date
      const duesUpToThisWeekRemaining = unpaidInsts.filter(i => new Date(i.dueDate).getTime() <= endOfDay.getTime());
      if (duesUpToThisWeekRemaining.length === 0 || paidOnRouteDate >= regularWeeklyAmount || isLoanClosedOrSettled) {
        isPaidToday = true;
        instStatus = 'PAID';
        const paidTodayInst = loanInsts.filter(i => i.paidDate && new Date(i.paidDate).getTime() >= startOfDay.getTime() && new Date(i.paidDate).getTime() <= endOfDay.getTime()).pop();
        instToDisplay = paidTodayInst || scheduledThisWeek || nextUnpaidInst || loanInsts[loanInsts.length - 1];
        expAmt = 0;
        remainingThisWeek = 0;
        overdueWeeks = 0;
      } else {
        isPaidToday = false;
        instStatus = 'PARTIAL';
        instToDisplay = nextUnpaidInst;
        remainingThisWeek = Math.max(0, regularWeeklyAmount - paidOnRouteDate);
        expAmt = remainingThisWeek;
      }
    } else if (isLoanClosedOrSettled) {
      const lastPaidInst = loanInsts.length > 0 ? loanInsts[loanInsts.length - 1] : null;
      instToDisplay = lastPaidInst;
      instStatus = 'PAID';
      isPaidToday = false;
      expAmt = 0;
      remainingThisWeek = 0;
      overdueWeeks = 0;
    } else if (isBadDebt) {
      instToDisplay = nextUnpaidInst || loanInsts[loanInsts.length - 1];
      instStatus = 'BAD_DEBT';
      if (paidOnRouteDate > 0) {
        isPaidToday = paidOnRouteDate >= regularWeeklyAmount;
        remainingThisWeek = Math.max(0, regularWeeklyAmount - paidOnRouteDate);
        expAmt = remainingThisWeek;
      } else {
        isPaidToday = false;
        expAmt = regularWeeklyAmount;
        remainingThisWeek = regularWeeklyAmount;
      }
      overdueWeeks = 0;
    } else {
      if (!nextUnpaidInst) {
        // All installments cleared up to date
        instStatus = 'PAID';
        instToDisplay = loanInsts[loanInsts.length - 1];
        expAmt = 0;
        remainingThisWeek = 0;
        overdueWeeks = 0;
      } else {
        instToDisplay = nextUnpaidInst;
        // This week's expected amount to be collected
        expAmt = regularWeeklyAmount;
        remainingThisWeek = regularWeeklyAmount;

        // Total dues up to this week (FIFO cumulative dues for presets/balance)
        const duesUpToThisWeek = unpaidInsts.filter(i => new Date(i.dueDate).getTime() <= endOfDay.getTime());
        totalDueUpToToday = duesUpToThisWeek.reduce((sum, i) => sum + i.balanceAmount, 0);
        if (totalDueUpToToday === 0) {
          totalDueUpToToday = nextUnpaidInst.balanceAmount;
        }

        // Count overdue weeks (due before todayMidnight)
        const pastDueInsts = unpaidInsts.filter(i => new Date(i.dueDate).getTime() < todayMidnight.getTime() || i.status === 'OVERDUE');
        overdueWeeks = pastDueInsts.length;

        if (overdueWeeks > 0 || l.status === 'OVERDUE') {
          instStatus = 'OVERDUE';
        } else if (nextUnpaidInst.status === 'PARTIAL') {
          instStatus = 'PARTIAL';
        } else {
          instStatus = 'PENDING';
        }
      }
    }

    groupRemaining += remainingThisWeek;

    memberRows.push({
      loanId: l._id,
      loanNumber: l.loanNumber,
      customer: l.customerId,
      installmentNumber: instToDisplay?.installmentNumber || null,
      installmentId: instToDisplay?._id || null,
      installmentStatus: instStatus,
      isBadDebt,
      overdueWeeks,
      collectionDay: collectionDay || l.collectionDay,
      isPaidToday,
      installmentExpected: regularWeeklyAmount,
      installmentPaid: instToDisplay?.paidAmount || (isPaidToday ? regularWeeklyAmount : 0),
      expectedAmount: expAmt,
      totalOverdueDue: Math.min(outTotal, totalDueUpToToday || expAmt),
      todayPaid: paidOnRouteDate > 0 ? paidOnRouteDate : (isPaidToday ? regularWeeklyAmount : 0),
      outstandingTotal: outTotal,
      tenureWeeks: l.tenureWeeks
    });
  }

  // Ensure Bad Debts are shown at the very last place of each group's member list
  memberRows.sort((a, b) => {
    const aBad = (a.installmentStatus === 'BAD_DEBT' || a.isBadDebt) ? 1 : 0;
    const bBad = (b.installmentStatus === 'BAD_DEBT' || b.isBadDebt) ? 1 : 0;
    if (aBad !== bBad) return aBad - bBad;
    return 0;
  });

  return {
    groupExpected,
    groupOutstanding,
    groupRemaining,
    memberRows
  };
}

// Active Collection Staff list for route filtering
router.get('/staff-list', async (req: Request, res: Response) => {
  try {
    const branchFilter: any = {};
    if (req.user?.role !== 'MAIN_ADMIN') {
      branchFilter.branchId = req.user?.branchId;
    } else if (req.query.branchId && req.query.branchId !== 'undefined' && req.query.branchId !== 'null' && req.query.branchId !== 'ALL') {
      branchFilter.branchId = req.query.branchId;
    }

    const staff = await User.find({ ...branchFilter, role: 'COLLECTION_STAFF', active: true })
      .select('_id name username role branchId phone')
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, staff });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Daily route collection sheet
router.get('/daily-sheet', async (req: Request, res: Response) => {
  try {
    const { weekday = 'MONDAY', branchId, staffId: queryStaffId, date: customDateStr } = req.query;
    const weekdayStr = String(weekday).toUpperCase();
    const query: any = { collectionDay: weekdayStr };

    let refDate = new Date();
    if (customDateStr && typeof customDateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(customDateStr)) {
      const parts = customDateStr.split('-');
      refDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0));
    }

    const { targetDate, startOfDay, endOfDay } = getRouteDateForWeekday(weekdayStr, refDate);

    const effectiveStaffId = req.user?.role === 'COLLECTION_STAFF'
      ? (req.user?.id || req.user?._id)
      : (queryStaffId && queryStaffId !== 'ALL' && queryStaffId !== 'undefined' && queryStaffId !== 'null' ? String(queryStaffId) : null);

    let staffNameRegexes: RegExp[] = [];

    if (req.user?.role !== 'MAIN_ADMIN') {
      query.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      query.branchId = branchId;
    }

    if (effectiveStaffId) {
      const staffUser = (req.user?.role === 'COLLECTION_STAFF' && (String(req.user?.id) === String(effectiveStaffId) || String(req.user?._id) === String(effectiveStaffId)))
        ? req.user
        : await User.findById(effectiveStaffId).lean();

      if (staffUser) {
        const staffUsername = staffUser.username || '';
        const staffName = staffUser.name || '';
        const nameParts = staffName.split(' ').filter(Boolean);
        staffNameRegexes = [
          new RegExp(`^${staffUsername}$`, 'i'),
          new RegExp(`^${staffName}$`, 'i'),
          ...nameParts.map(p => new RegExp(`^${p}$`, 'i'))
        ];

        const assignedLoanGroupIds = await Loan.find({
          $or: [
            { assignedStaffId: staffUser.id || staffUser._id },
            { assignedStaffName: { $in: staffNameRegexes } }
          ],
          status: { $in: ['ACTIVE', 'OVERDUE', 'BAD_DEBT'] }
        }).distinct('groupId');

        query.$or = [
          { staffId: staffUser.id || staffUser._id },
          { staffName: { $in: staffNameRegexes } },
          { _id: { $in: assignedLoanGroupIds } }
        ];
      }
    }

    const groups = await Group.find(query).sort({ groupCode: 1 }).lean();
    if (groups.length === 0) {
      res.json({
        success: true,
        weekday: weekdayStr,
        targetDate: targetDate.toISOString().split('T')[0],
        groups: []
      });
      return;
    }

    const groupIds = groups.map(g => g._id);

    // BATCH 1: Fetch all route payments for these groups on target date in a single query
    const allRoutePayments = await Payment.find({
      groupId: { $in: groupIds },
      paymentDate: { $gte: startOfDay, $lte: endOfDay },
      isReversed: false
    }).lean();

    const paidLoanIds = allRoutePayments.map(p => p.loanId).filter(Boolean);

    // BATCH 2: Fetch all loans for these groups (active/overdue or collected on date, disbursed on or before this viewing date)
    const loanFilter: any = {
      $and: [
        {
          $or: [
            { disbursedDate: { $lte: endOfDay } },
            { disbursedDate: null },
            { _id: { $in: paidLoanIds } }
          ]
        },
        {
          $or: [
            { status: { $in: ['ACTIVE', 'OVERDUE', 'BAD_DEBT'] } },
            { _id: { $in: paidLoanIds } }
          ]
        }
      ]
    };
    if (effectiveStaffId) {
      loanFilter.$and = [
        {
          $or: [
            { assignedStaffId: effectiveStaffId },
            { assignedStaffName: { $in: staffNameRegexes } },
            { assignedStaffId: null },
            { _id: { $in: paidLoanIds } }
          ]
        }
      ];
    }
    const loanQuery: any = { groupId: { $in: groupIds }, ...loanFilter };

    const allLoans = await Loan.find(loanQuery)
      .populate('customerId', 'name phone customerId')
      .lean();

    // BATCH 3: Fetch all installments for all retrieved loans in a single query
    const allLoanIds = allLoans.map(l => l._id);
    const allInstallments = await Installment.find({
      loanId: { $in: allLoanIds }
    }).sort({ installmentNumber: 1 }).lean();

    // Index in memory for instant O(1) lookups
    const loansByGroup = new Map<string, any[]>();
    allLoans.forEach(l => {
      const gid = String(l.groupId);
      if (!loansByGroup.has(gid)) loansByGroup.set(gid, []);
      loansByGroup.get(gid)!.push(l);
    });

    const paymentsByGroup = new Map<string, any[]>();
    allRoutePayments.forEach(p => {
      const gid = String(p.groupId);
      if (!paymentsByGroup.has(gid)) paymentsByGroup.set(gid, []);
      paymentsByGroup.get(gid)!.push(p);
    });

    const installmentsByLoan = new Map<string, any[]>();
    allInstallments.forEach(i => {
      const lid = String(i.loanId);
      if (!installmentsByLoan.has(lid)) installmentsByLoan.set(lid, []);
      installmentsByLoan.get(lid)!.push(i);
    });

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const groupSummaries = [];

    for (const grp of groups) {
      const grpLoans = loansByGroup.get(String(grp._id)) || [];
      if (req.user?.role === 'COLLECTION_STAFF' && grpLoans.length === 0) {
        continue;
      }

      const grpPayments = paymentsByGroup.get(String(grp._id)) || [];
      const groupCollected = grpPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      const { groupExpected, groupOutstanding, groupRemaining, memberRows } = buildRouteMemberRows(
        grpLoans,
        grpPayments,
        installmentsByLoan,
        startOfDay,
        endOfDay,
        todayMidnight,
        grp.collectionDay
      );

      // If group has no members active on or before this viewing date and no collections on this date, skip it!
      if (memberRows.length === 0 && groupCollected === 0) {
        continue;
      }

      groupSummaries.push({
        group: grp,
        expectedTotal: groupExpected,
        collectedToday: groupCollected,
        remainingDue: groupRemaining,
        outstandingTotal: groupOutstanding,
        members: memberRows
      });
    }

    res.json({
      success: true,
      weekday: weekdayStr,
      targetDate: targetDate.toISOString().split('T')[0],
      groups: groupSummaries
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Weekly consolidated route collection sheet (Manager & Admin)
router.get('/weekly-sheet', async (req: Request, res: Response) => {
  try {
    const { branchId, staffId: queryStaffId, date: customDateStr } = req.query;
    const baseQuery: any = {};

    let refDate = new Date();
    if (customDateStr && typeof customDateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(customDateStr)) {
      const parts = customDateStr.split('-');
      refDate = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0));
    }

    const effectiveStaffId = req.user?.role === 'COLLECTION_STAFF'
      ? (req.user?.id || req.user?._id)
      : (queryStaffId && queryStaffId !== 'ALL' && queryStaffId !== 'undefined' && queryStaffId !== 'null' ? String(queryStaffId) : null);

    let staffNameRegexes: RegExp[] = [];

    if (req.user?.role !== 'MAIN_ADMIN') {
      baseQuery.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      baseQuery.branchId = branchId;
    }

    if (effectiveStaffId) {
      const staffUser = (req.user?.role === 'COLLECTION_STAFF' && (String(req.user?.id) === String(effectiveStaffId) || String(req.user?._id) === String(effectiveStaffId)))
        ? req.user
        : await User.findById(effectiveStaffId).lean();

      if (staffUser) {
        const staffUsername = staffUser.username || '';
        const staffName = staffUser.name || '';
        const nameParts = staffName.split(' ').filter(Boolean);
        staffNameRegexes = [
          new RegExp(`^${staffUsername}$`, 'i'),
          new RegExp(`^${staffName}$`, 'i'),
          ...nameParts.map(p => new RegExp(`^${p}$`, 'i'))
        ];

        const assignedLoanGroupIds = await Loan.find({
          $or: [
            { assignedStaffId: staffUser.id || staffUser._id },
            { assignedStaffName: { $in: staffNameRegexes } }
          ],
          status: { $in: ['ACTIVE', 'OVERDUE', 'BAD_DEBT'] }
        }).distinct('groupId');

        baseQuery.$or = [
          { staffId: staffUser.id || staffUser._id },
          { staffName: { $in: staffNameRegexes } },
          { _id: { $in: assignedLoanGroupIds } }
        ];
      }
    }

    const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const groups = await Group.find({ ...baseQuery, collectionDay: { $in: weekdays } }).sort({ groupCode: 1 }).lean();
    const groupIds = groups.map(g => g._id);

    // Determine week boundaries (Monday startOfDay to Sunday endOfDay)
    const { startOfDay: weekStart } = getRouteDateForWeekday('MONDAY', refDate);
    const { endOfDay: weekEnd } = getRouteDateForWeekday('SUNDAY', refDate);

    const allPayments = await Payment.find({
      groupId: { $in: groupIds },
      paymentDate: { $gte: weekStart, $lte: weekEnd },
      isReversed: false
    }).lean();

    const paidLoanIds = allPayments.map(p => p.loanId).filter(Boolean);

    // Batch loans for all weekly groups in a single query (disbursed on or before this viewing week)
    const loanFilter: any = {
      $and: [
        {
          $or: [
            { disbursedDate: { $lte: weekEnd } },
            { disbursedDate: null },
            { _id: { $in: paidLoanIds } }
          ]
        },
        {
          $or: [
            { status: { $in: ['ACTIVE', 'OVERDUE', 'BAD_DEBT'] } },
            { _id: { $in: paidLoanIds } }
          ]
        }
      ]
    };
    if (effectiveStaffId) {
      loanFilter.$and = [
        {
          $or: [
            { assignedStaffId: effectiveStaffId },
            { assignedStaffName: { $in: staffNameRegexes } },
            { assignedStaffId: null },
            { _id: { $in: paidLoanIds } }
          ]
        }
      ];
    }
    const loanQuery: any = { groupId: { $in: groupIds }, ...loanFilter };

    const allLoans = await Loan.find(loanQuery).populate('customerId', 'name phone customerId').lean();
    const allLoanIds = allLoans.map(l => l._id);

    const allInstallments = await Installment.find({
      loanId: { $in: allLoanIds }
    }).sort({ installmentNumber: 1 }).lean();

    // Index by group / loan
    const loansByGroup = new Map<string, any[]>();
    allLoans.forEach(l => {
      const gid = String(l.groupId);
      if (!loansByGroup.has(gid)) loansByGroup.set(gid, []);
      loansByGroup.get(gid)!.push(l);
    });

    const paymentsByGroup = new Map<string, any[]>();
    allPayments.forEach(p => {
      const gid = String(p.groupId);
      if (!paymentsByGroup.has(gid)) paymentsByGroup.set(gid, []);
      paymentsByGroup.get(gid)!.push(p);
    });

    const installmentsByLoan = new Map<string, any[]>();
    allInstallments.forEach(i => {
      const lid = String(i.loanId);
      if (!installmentsByLoan.has(lid)) installmentsByLoan.set(lid, []);
      installmentsByLoan.get(lid)!.push(i);
    });

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const daysData: Record<string, any> = {};
    const allGroupsList: any[] = [];
    let weeklyExpected = 0;
    let weeklyCollected = 0;
    let weeklyRemaining = 0;
    let weeklyOutstanding = 0;
    let totalMembers = 0;

    for (const day of weekdays) {
      const { startOfDay, endOfDay } = getRouteDateForWeekday(day, refDate);
      const dayGroups = groups.filter(g => g.collectionDay === day);
      const dayGroupSummaries: any[] = [];
      let dayExpected = 0;
      let dayCollected = 0;
      let dayRemaining = 0;
      let dayMembers = 0;

      for (const grp of dayGroups) {
        const grpLoans = loansByGroup.get(String(grp._id)) || [];
        if (req.user?.role === 'COLLECTION_STAFF' && grpLoans.length === 0) {
          continue;
        }

        const grpAllPayments = paymentsByGroup.get(String(grp._id)) || [];
        const dayPayments = grpAllPayments.filter(p => {
          const t = new Date(p.paymentDate).getTime();
          return t >= startOfDay.getTime() && t <= endOfDay.getTime();
        });
        const grpColl = dayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        const { groupExpected, groupOutstanding, groupRemaining, memberRows } = buildRouteMemberRows(
          grpLoans,
          dayPayments,
          installmentsByLoan,
          startOfDay,
          endOfDay,
          todayMidnight,
          day
        );

        // If group has no members active on or before this viewing week and no collections in this week, skip it!
        if (memberRows.length === 0 && grpColl === 0) {
          continue;
        }

        const summaryItem = {
          group: grp,
          collectionDay: day,
          expectedTotal: groupExpected,
          collectedToday: grpColl,
          remainingDue: groupRemaining,
          outstandingTotal: groupOutstanding,
          members: memberRows
        };

        dayGroupSummaries.push(summaryItem);
        allGroupsList.push(summaryItem);

        dayExpected += groupExpected;
        dayCollected += grpColl;
        dayRemaining += groupRemaining;
        dayMembers += memberRows.length;
        weeklyOutstanding += groupOutstanding;
      }

      weeklyExpected += dayExpected;
      weeklyCollected += dayCollected;
      weeklyRemaining += dayRemaining;
      totalMembers += dayMembers;

      daysData[day] = {
        expected: dayExpected,
        collected: dayCollected,
        remaining: dayRemaining,
        groupsCount: dayGroups.length,
        membersCount: dayMembers,
        groups: dayGroupSummaries
      };
    }

    res.json({
      success: true,
      weeklySummary: {
        weeklyExpected,
        weeklyCollected,
        weeklyRemaining,
        weeklyOutstanding,
        totalGroups: allGroupsList.length,
        totalMembers
      },
      days: daysData,
      groups: allGroupsList
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Staff-wise Collections breakdown (Manager & Admin)
router.get('/staff-summary', async (req: Request, res: Response) => {
  try {
    const { branchId, weekday } = req.query;
    const branchFilter: any = {};

    if (req.user?.role !== 'MAIN_ADMIN') {
      branchFilter.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      branchFilter.branchId = branchId;
    }

    const staffList = await User.find({ ...branchFilter, active: true }).select('-passwordHash').sort({ role: 1, name: 1 });

    const targetDay = (weekday && weekday !== 'WEEKLY' && weekday !== 'ALL') ? String(weekday).toUpperCase() : 'WEDNESDAY';
    const { startOfDay, endOfDay } = getRouteDateForWeekday(targetDay);

    const groupDayFilter: any = {};
    if (weekday && weekday !== 'WEEKLY' && weekday !== 'ALL') {
      groupDayFilter.collectionDay = weekday;
    }

    // BATCH: Fetch all candidate groups, loans, payments, and installments upfront in 4 single queries
    const allBranchGroups = await Group.find({
      ...branchFilter,
      ...groupDayFilter
    }).sort({ collectionDay: 1, groupCode: 1 }).lean();

    const allBranchGroupIds = allBranchGroups.map(g => g._id);

    const allBranchLoans = await Loan.find({
      groupId: { $in: allBranchGroupIds },
      status: { $in: ['ACTIVE', 'OVERDUE', 'BAD_DEBT'] }
    }).lean();

    const allBranchLoanIds = allBranchLoans.map(l => l._id);

    const allTodayPayments = await Payment.find({
      groupId: { $in: allBranchGroupIds },
      paymentDate: { $gte: startOfDay, $lte: endOfDay }
    }).lean();

    const allActiveInsts = await Installment.find({
      loanId: { $in: allBranchLoanIds },
      status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE', 'BAD_DEBT'] }
    }).sort({ installmentNumber: 1 }).lean();

    // Map in memory
    const loansByGroupId = new Map<string, any[]>();
    allBranchLoans.forEach(l => {
      const gid = String(l.groupId);
      if (!loansByGroupId.has(gid)) loansByGroupId.set(gid, []);
      loansByGroupId.get(gid)!.push(l);
    });

    const paymentsByGroupId = new Map<string, any[]>();
    allTodayPayments.forEach(p => {
      const gid = String(p.groupId);
      if (!paymentsByGroupId.has(gid)) paymentsByGroupId.set(gid, []);
      paymentsByGroupId.get(gid)!.push(p);
    });

    const nextInstByLoanId = new Map<string, any>();
    allActiveInsts.forEach(i => {
      const lid = String(i.loanId);
      if (!nextInstByLoanId.has(lid)) {
        nextInstByLoanId.set(lid, i);
      }
    });

    const staffSummaries = [];

    for (const staff of staffList) {
      const staffIdStr = String(staff._id);
      const staffUsername = (staff.username || '').toLowerCase();
      const staffName = (staff.name || '').toLowerCase();
      const nameParts = staffName.split(' ').filter(Boolean);

      const matchesStaff = (nameToCheck: string) => {
        if (!nameToCheck) return false;
        const low = nameToCheck.toLowerCase().trim();
        return low === staffUsername || low === staffName || nameParts.some(p => low.includes(p));
      };

      // Filter groups assigned to this staff
      const staffGroups = allBranchGroups.filter(grp => {
        if (grp.staffId && String(grp.staffId) === staffIdStr) return true;
        if (grp.staffName && matchesStaff(grp.staffName)) return true;
        const grpLoans = loansByGroupId.get(String(grp._id)) || [];
        return grpLoans.some(l => (l.assignedStaffId && String(l.assignedStaffId) === staffIdStr) || (l.assignedStaffName && matchesStaff(l.assignedStaffName)));
      });

      let staffExpected = 0;
      let staffCollected = 0;
      let staffTotalBorrowers = 0;
      let staffTotalOutstanding = 0;
      const groupBreakdowns = [];

      for (const grp of staffGroups) {
        const loans = loansByGroupId.get(String(grp._id)) || [];
        const todayGrpPayments = paymentsByGroupId.get(String(grp._id)) || [];
        const grpColl = todayGrpPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        let grpExp = 0;
        let grpOut = 0;

        for (const l of loans) {
          const nextInst = nextInstByLoanId.get(String(l._id));
          grpExp += nextInst ? nextInst.balanceAmount : 0;
          grpOut += (l.outstandingTotal || 0);
        }

        staffExpected += grpExp;
        staffCollected += grpColl;
        staffTotalBorrowers += loans.length;
        staffTotalOutstanding += grpOut;

        groupBreakdowns.push({
          groupId: grp._id,
          groupCode: grp.groupCode,
          groupName: grp.name,
          collectionDay: grp.collectionDay,
          area: grp.area,
          borrowersCount: loans.length,
          expectedAmount: grpExp,
          collectedToday: grpColl,
          remainingDue: Math.max(0, grpExp - grpColl)
        });
      }

      staffSummaries.push({
        staffId: staff._id,
        name: staff.name,
        username: staff.username,
        role: staff.role,
        phone: staff.phone || '',
        totalGroups: staffGroups.length,
        totalBorrowers: staffTotalBorrowers,
        expectedAmount: staffExpected,
        collectedToday: staffCollected,
        shortfall: Math.max(0, staffExpected - staffCollected),
        outstandingTotal: staffTotalOutstanding,
        efficiencyPercent: staffExpected > 0 ? Math.round((staffCollected / staffExpected) * 100) : (staffCollected > 0 ? 100 : 0),
        groups: groupBreakdowns
      });
    }

    const totalExpected = staffSummaries.reduce((sum, s) => sum + s.expectedAmount, 0);
    const totalCollected = staffSummaries.reduce((sum, s) => sum + s.collectedToday, 0);

    res.json({
      success: true,
      staffSummaries,
      totals: {
        totalExpected,
        totalCollected,
        totalShortfall: Math.max(0, totalExpected - totalCollected),
        efficiencyPercent: totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Record payment collection
router.post('/record', async (req: Request, res: Response) => {
  try {
    const { loanId, amount, paymentMethod = 'CASH', referenceNo = '', remarks = '', weekday, collectionDate, installmentId } = req.body;
    const payAmt = parseFloat(amount);

    if (!loanId || isNaN(payAmt) || payAmt <= 0) {
      res.status(400).json({ success: false, message: 'Valid loanId and amount are required' });
      return;
    }

    const loan = await Loan.findById(loanId).populate('groupId');
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }

    if (loan.status === 'CLOSED' || loan.status === 'SETTLED') {
      res.status(400).json({ success: false, message: 'Cannot record collection on closed loan' });
      return;
    }

    // Physical cash collections recorded in real-time are credited to today's cashbook
    const paymentDate = collectionDate ? new Date(collectionDate) : new Date();

    // Allocate payment across pending installments in sequence
    let pendingInstallments = await Installment.find({
      loanId: loan._id,
      status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] }
    }).sort({ installmentNumber: 1 });

    if (installmentId) {
      const targetIdx = pendingInstallments.findIndex(i => String(i._id) === String(installmentId));
      if (targetIdx > 0) {
        const target = pendingInstallments.splice(targetIdx, 1)[0];
        pendingInstallments.unshift(target);
      }
    }

    let remainingToAllocate = payAmt;
    const allocations: any[] = [];

    for (const inst of pendingInstallments) {
      if (remainingToAllocate <= 0) break;

      const dueOnInst = inst.balanceAmount;
      const allocateAmt = Math.min(remainingToAllocate, dueOnInst);

      inst.paidAmount += allocateAmt;
      inst.balanceAmount -= allocateAmt;
      remainingToAllocate -= allocateAmt;

      if (inst.balanceAmount <= 0) {
        inst.status = 'PAID';
        inst.paidDate = paymentDate;
      } else {
        inst.status = 'PARTIAL';
      }
      await inst.save();

      const ratio = inst.expectedAmount > 0 ? allocateAmt / inst.expectedAmount : 1;
      const principalPortion = Math.round((inst.allocatedPrincipal || 0) * ratio);
      const savingsPortion = Math.round((inst.allocatedSavings || 0) * ratio);
      const interestPortion = allocateAmt - principalPortion - savingsPortion;

      allocations.push({
        installmentId: inst._id,
        installmentNumber: inst.installmentNumber,
        amount: allocateAmt,
        principalPortion,
        interestPortion,
        savingsPortion
      });
    }

    // Generate unique collision-proof receipt number
    const receiptNumber = await getNextReceiptNumber();

    const payment = await Payment.create({
      receiptNumber,
      loanId: loan._id,
      customerId: loan.customerId,
      groupId: loan.groupId,
      branchId: loan.branchId,
      collectorId: req.user?.id,
      paymentDate: paymentDate,
      amount: payAmt,
      paymentMethod,
      referenceNo,
      remarks,
      allocations
    });

    // Update loan outstanding
    loan.totalPaid += payAmt;
    loan.outstandingTotal = Math.max(0, loan.outstandingTotal - payAmt);

    // Proportionally reduce principal and interest
    const interestPortion = Math.round((payAmt * loan.interestAmount) / loan.totalPayable);
    const principalPortion = payAmt - interestPortion;
    loan.outstandingInterest = Math.max(0, loan.outstandingInterest - interestPortion);
    loan.outstandingPrincipal = Math.max(0, loan.outstandingPrincipal - principalPortion);

    if (loan.outstandingTotal <= 0) {
      loan.status = 'CLOSED';
      loan.closedDate = paymentDate;
    } else if (loan.status === 'OVERDUE') {
      // If loan was OVERDUE and now has no remaining overdue installments, restore status to ACTIVE
      const remainingOverdue = await Installment.countDocuments({
        loanId: loan._id,
        status: 'OVERDUE'
      });
      if (remainingOverdue === 0) {
        loan.status = 'ACTIVE';
      }
    }
    await loan.save();

    // Record cashbook inflow
    await recordCashbookEntry({
      branchId: loan.branchId,
      transactionDate: paymentDate,
      type: 'CREDIT',
      accountType: paymentMethod === 'CASH' ? 'CASH' : 'BANK',
      category: `${(loan.groupId as any)?.name || 'LOAN'} COLLECTION RECEIVED`,
      amount: payAmt,
      relatedEntityType: 'COLLECTION',
      relatedEntityId: payment._id,
      description: `Collection receipt ${receiptNumber} (${paymentMethod}). Remarks: ${remarks}`,
      createdById: req.user?.id
    });

    // Resolve or reduce any pending follow-up for this customer
    await FollowUp.updateMany(
      { customerId: loan.customerId, status: 'PENDING' },
      { $inc: { actualPending: -payAmt } }
    );
    await FollowUp.updateMany(
      { customerId: loan.customerId, actualPending: { $lte: 0 } },
      { $set: { status: 'RESOLVED' } }
    );

    res.status(201).json({
      success: true,
      message: 'Collection recorded successfully',
      payment,
      updatedLoan: {
        outstandingTotal: loan.outstandingTotal,
        totalPaid: loan.totalPaid,
        status: loan.status
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fast 1-click Collect Entire Group
router.post('/record-group', async (req: Request, res: Response) => {
  try {
    const { groupId, weekday, paymentMethod = 'CASH', remarks = 'Full group collection' } = req.body;
    if (!groupId) {
      res.status(400).json({ success: false, message: 'Valid groupId is required' });
      return;
    }

    const grp = await Group.findById(groupId);
    if (!grp) {
      res.status(404).json({ success: false, message: 'Group not found' });
      return;
    }

    const targetWeekday = weekday || grp.collectionDay || 'MONDAY';
    const routeInfo = getRouteDateForWeekday(targetWeekday);
    const { startOfDay, endOfDay } = routeInfo;
    // Target installment is matched against the route schedule, but physical cash is received today
    const paymentDate = new Date();

    const loans = await Loan.find({
      groupId: grp._id,
      status: { $in: ['ACTIVE', 'OVERDUE'] }
    });

    const recordedPayments: any[] = [];
    let groupTotalCollected = 0;

    for (const loan of loans) {
      // Find all unpaid installments in strict FIFO sequence
      const unpaidInsts = await Installment.find({
        loanId: loan._id,
        status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] }
      }).sort({ installmentNumber: 1 });

      if (unpaidInsts.length === 0) {
        continue;
      }

      // Collect dues up to this route date (or at least the first unpaid)
      const duesUpToTarget = unpaidInsts.filter(i => new Date(i.dueDate).getTime() <= endOfDay.getTime());
      const instsToPay = duesUpToTarget.length > 0 ? duesUpToTarget : [unpaidInsts[0]];
      const payAmt = Math.min(loan.outstandingTotal, instsToPay.reduce((sum, i) => sum + i.balanceAmount, 0));

      if (payAmt <= 0) continue;

      let remainingToAlloc = payAmt;
      const allocations: any[] = [];

      for (const inst of instsToPay) {
        if (remainingToAlloc <= 0) break;
        const alloc = Math.min(remainingToAlloc, inst.balanceAmount);
        inst.paidAmount += alloc;
        inst.balanceAmount -= alloc;
        remainingToAlloc -= alloc;
        if (inst.balanceAmount <= 0) {
          inst.status = 'PAID';
          inst.paidDate = paymentDate;
        } else {
          inst.status = 'PARTIAL';
        }
        await inst.save();

        const ratio = inst.expectedAmount > 0 ? alloc / inst.expectedAmount : 1;
        const principalPortion = Math.round((inst.allocatedPrincipal || 0) * ratio);
        const savingsPortion = Math.round((inst.allocatedSavings || 0) * ratio);
        const interestPortion = alloc - principalPortion - savingsPortion;

        allocations.push({
          installmentId: inst._id,
          installmentNumber: inst.installmentNumber,
          amount: alloc,
          principalPortion,
          interestPortion,
          savingsPortion
        });
      }

      const receiptNumber = await getNextReceiptNumber();

      const payment = await Payment.create({
        receiptNumber,
        loanId: loan._id,
        customerId: loan.customerId,
        groupId: loan.groupId,
        branchId: loan.branchId,
        collectorId: req.user?.id,
        paymentDate,
        amount: payAmt,
        paymentMethod,
        remarks: `${remarks} - W${instsToPay[0].installmentNumber}`,
        allocations
      });

      loan.totalPaid += payAmt;
      loan.outstandingTotal = Math.max(0, loan.outstandingTotal - payAmt);
      const interestPortion = Math.round((payAmt * loan.interestAmount) / loan.totalPayable);
      const principalPortion = payAmt - interestPortion;
      loan.outstandingInterest = Math.max(0, loan.outstandingInterest - interestPortion);
      loan.outstandingPrincipal = Math.max(0, loan.outstandingPrincipal - principalPortion);

      if (loan.outstandingTotal <= 0) {
        loan.status = 'CLOSED';
        loan.closedDate = paymentDate;
      } else if (loan.status === 'OVERDUE') {
        const remainingOverdue = await Installment.countDocuments({
          loanId: loan._id,
          status: 'OVERDUE'
        });
        if (remainingOverdue === 0) {
          loan.status = 'ACTIVE';
        }
      }
      await loan.save();

      await recordCashbookEntry({
        branchId: loan.branchId,
        transactionDate: paymentDate,
        type: 'CREDIT',
        accountType: paymentMethod === 'CASH' ? 'CASH' : 'BANK',
        category: `${grp.name} COLLECTION RECEIVED`,
        amount: payAmt,
        relatedEntityType: 'COLLECTION',
        relatedEntityId: payment._id,
        description: `Group collection receipt ${receiptNumber} (${paymentMethod})`,
        createdById: req.user?.id
      });

      recordedPayments.push(payment);
      groupTotalCollected += payAmt;
    }

    res.status(201).json({
      success: true,
      message: `Group collection completed. Collected ₹${groupTotalCollected} across ${recordedPayments.length} borrowers`,
      count: recordedPayments.length,
      totalAmount: groupTotalCollected,
      payments: recordedPayments
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Printable receipt
router.get('/receipt/:receiptNumber', async (req: Request, res: Response) => {
  try {
    const payment = await Payment.findOne({ receiptNumber: req.params.receiptNumber })
      .populate('customerId', 'name phone customerId area')
      .populate('groupId', 'name collectionDay')
      .populate('branchId', 'name address phone')
      .populate('collectorId', 'name');

    if (!payment) {
      res.status(404).json({ success: false, message: 'Receipt not found' });
      return;
    }

    res.json({ success: true, receipt: payment });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Controlled Payment Reversal (STRICTLY MAIN_ADMIN ONLY)
router.post('/reverse/:id', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, message: 'Reversal reason is mandatory' });
      return;
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }

    if (payment.isReversed) {
      res.status(400).json({ success: false, message: 'Payment has already been reversed' });
      return;
    }

    const loan = await Loan.findById(payment.loanId);
    if (loan) {
      loan.totalPaid = Math.max(0, loan.totalPaid - payment.amount);
      loan.outstandingTotal += payment.amount;
      if (loan.status === 'CLOSED') {
        loan.status = 'ACTIVE';
        loan.closedDate = null;
      }
      await loan.save();

      // Reverse installment allocations
      for (const alloc of payment.allocations) {
        const inst = await Installment.findById(alloc.installmentId);
        if (inst) {
          inst.paidAmount = Math.max(0, inst.paidAmount - alloc.amount);
          inst.balanceAmount += alloc.amount;
          inst.status = inst.balanceAmount >= inst.expectedAmount ? 'PENDING' : 'PARTIAL';
          await inst.save();
        }
      }
    }

    payment.isReversed = true;
    payment.reversedBy = req.user?.id as any;
    payment.reversalReason = reason;
    payment.reversedAt = new Date();
    await payment.save();

    // Cashbook debit adjustment for reversed receipt
    await recordCashbookEntry({
      branchId: payment.branchId,
      type: 'DEBIT',
      accountType: payment.paymentMethod === 'CASH' ? 'CASH' : 'BANK',
      category: `REVERSAL OF RECEIPT ${payment.receiptNumber}`,
      amount: payment.amount,
      relatedEntityType: 'ADJUSTMENT',
      relatedEntityId: payment._id,
      description: `Reversal authorized by Admin. Reason: ${reason}`,
      createdById: req.user?.id
    });

    res.json({ success: true, message: 'Payment reversed successfully', payment });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
