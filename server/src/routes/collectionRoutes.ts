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

// Daily route collection sheet
router.get('/daily-sheet', async (req: Request, res: Response) => {
  try {
    const { weekday = 'MONDAY', branchId } = req.query;
    const weekdayStr = String(weekday).toUpperCase();
    const query: any = { collectionDay: weekdayStr };

    const { targetDate, startOfDay, endOfDay } = getRouteDateForWeekday(weekdayStr);

    if (req.user?.role === 'COLLECTION_STAFF') {
      query.branchId = req.user?.branchId;
      const staffId = req.user?.id || req.user?._id;
      const staffUsername = req.user?.username || '';
      const staffName = req.user?.name || '';
      const nameParts = staffName.split(' ').filter(Boolean);
      const nameRegexes = [
        new RegExp(`^${staffUsername}$`, 'i'),
        new RegExp(`^${staffName}$`, 'i'),
        ...nameParts.map(p => new RegExp(`^${p}$`, 'i'))
      ];

      const assignedLoanGroupIds = await Loan.find({
        $or: [
          { assignedStaffId: staffId },
          { assignedStaffName: { $in: nameRegexes } }
        ],
        status: { $in: ['ACTIVE', 'OVERDUE'] }
      }).distinct('groupId');

      query.$or = [
        { staffId: staffId },
        { staffName: { $in: nameRegexes } },
        { _id: { $in: assignedLoanGroupIds } }
      ];
    } else if (req.user?.role !== 'MAIN_ADMIN') {
      query.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      query.branchId = branchId;
    }

    const groups = await Group.find(query).sort({ groupCode: 1 });
    const groupSummaries = [];

    for (const grp of groups) {
      const loanQuery: any = { groupId: grp._id, status: { $in: ['ACTIVE', 'OVERDUE'] } };
      if (req.user?.role === 'COLLECTION_STAFF') {
        const staffId = req.user?.id || req.user?._id;
        const staffUsername = req.user?.username || '';
        const staffName = req.user?.name || '';
        const nameParts = staffName.split(' ').filter(Boolean);
        const nameRegexes = [
          new RegExp(`^${staffUsername}$`, 'i'),
          new RegExp(`^${staffName}$`, 'i'),
          ...nameParts.map(p => new RegExp(`^${p}$`, 'i'))
        ];

        loanQuery.$or = [
          { assignedStaffId: staffId },
          { assignedStaffName: { $in: nameRegexes } },
          { assignedStaffId: null }
        ];
      }

      const loans = await Loan.find(loanQuery)
        .populate('customerId', 'name phone customerId');

      if (req.user?.role === 'COLLECTION_STAFF' && loans.length === 0) {
        continue;
      }

      let groupExpected = 0;
      let groupCollected = 0;
      let groupOutstanding = 0;

      // Calculate collections received on this route date for this group
      const routePayments = await Payment.find({
        groupId: grp._id,
        paymentDate: { $gte: startOfDay, $lte: endOfDay }
      });
      groupCollected = routePayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      const memberRows = [];

      for (const l of loans) {
        groupOutstanding += l.outstandingTotal;

        const loanPayments = routePayments.filter(p => String(p.loanId) === String(l._id));
        const paidOnRouteDate = loanPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        // Find the installment scheduled or paid for this route date
        let targetInst = await Installment.findOne({
          loanId: l._id,
          dueDate: { $gte: startOfDay, $lte: endOfDay }
        });

        if (!targetInst) {
          targetInst = await Installment.findOne({
            loanId: l._id,
            paidDate: { $gte: startOfDay, $lte: endOfDay }
          });
        }

        let instToDisplay = targetInst;
        let isPaidToday = false;
        let expAmt = 0;
        let instStatus: string = 'PENDING';
        let instExpected = 0;

        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);

        if (targetInst) {
          instExpected = targetInst.expectedAmount;
          groupExpected += targetInst.expectedAmount;

          const targetDueMidnight = new Date(targetInst.dueDate);
          targetDueMidnight.setHours(0, 0, 0, 0);

          if (targetInst.status === 'PAID') {
            isPaidToday = true;
            instStatus = 'PAID';
            expAmt = 0;
          } else if (targetInst.status === 'PARTIAL') {
            isPaidToday = false;
            instStatus = targetDueMidnight < todayMidnight ? 'OVERDUE' : 'PARTIAL';
            expAmt = targetInst.balanceAmount;
          } else {
            isPaidToday = false;
            instStatus = targetDueMidnight < todayMidnight ? 'OVERDUE' : 'PENDING';
            expAmt = targetInst.balanceAmount;
          }
        } else {
          // If no installment was specifically scheduled for this date (e.g. loan closed early or advance)
          if (l.status === 'CLOSED' || l.outstandingTotal <= 0) {
            const lastPaidInst = await Installment.findOne({ loanId: l._id }).sort({ installmentNumber: -1 });
            instToDisplay = lastPaidInst;
            instStatus = 'PAID';
            isPaidToday = false;
            expAmt = 0;
            instExpected = 0;
          } else {
            const nextPendingInst = await Installment.findOne({
              loanId: l._id,
              status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] }
            }).sort({ installmentNumber: 1 });

            instToDisplay = nextPendingInst;
            if (nextPendingInst) {
              const nextDueMidnight = new Date(nextPendingInst.dueDate);
              nextDueMidnight.setHours(0, 0, 0, 0);
              instStatus = nextPendingInst.status === 'PAID' ? 'PAID' : (nextDueMidnight < todayMidnight ? 'OVERDUE' : nextPendingInst.status);
            } else {
              instStatus = l.status === 'OVERDUE' ? 'OVERDUE' : 'PENDING';
            }
            expAmt = nextPendingInst ? nextPendingInst.balanceAmount : 0;
            instExpected = nextPendingInst ? nextPendingInst.expectedAmount : 0;
            groupExpected += expAmt;
          }
        }

        memberRows.push({
          loanId: l._id,
          loanNumber: l.loanNumber,
          customer: l.customerId,
          installmentNumber: instToDisplay?.installmentNumber || null,
          installmentId: instToDisplay?._id || null,
          installmentStatus: instStatus,
          collectionDay: grp.collectionDay,
          isPaidToday,
          installmentExpected: instExpected,
          installmentPaid: instToDisplay?.paidAmount || (isPaidToday ? instExpected : 0),
          expectedAmount: expAmt,
          todayPaid: paidOnRouteDate > 0 ? paidOnRouteDate : (isPaidToday ? instExpected : 0),
          outstandingTotal: l.outstandingTotal,
          tenureWeeks: l.tenureWeeks
        });
      }

      groupSummaries.push({
        group: grp,
        expectedTotal: groupExpected,
        collectedToday: groupCollected,
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
    const { branchId } = req.query;
    const baseQuery: any = {};

    if (req.user?.role === 'COLLECTION_STAFF') {
      baseQuery.branchId = req.user?.branchId;
      const staffId = req.user?.id || req.user?._id;
      const staffUsername = req.user?.username || '';
      const staffName = req.user?.name || '';
      const nameParts = staffName.split(' ').filter(Boolean);
      const nameRegexes = [
        new RegExp(`^${staffUsername}$`, 'i'),
        new RegExp(`^${staffName}$`, 'i'),
        ...nameParts.map(p => new RegExp(`^${p}$`, 'i'))
      ];

      const assignedLoanGroupIds = await Loan.find({
        $or: [
          { assignedStaffId: staffId },
          { assignedStaffName: { $in: nameRegexes } }
        ],
        status: { $in: ['ACTIVE', 'OVERDUE'] }
      }).distinct('groupId');

      baseQuery.$or = [
        { staffId: staffId },
        { staffName: { $in: nameRegexes } },
        { _id: { $in: assignedLoanGroupIds } }
      ];
    } else if (req.user?.role !== 'MAIN_ADMIN') {
      baseQuery.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      baseQuery.branchId = branchId;
    }

    const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
    const daysData: Record<string, any> = {};
    const allGroupsList: any[] = [];
    let weeklyExpected = 0;
    let weeklyCollected = 0;
    let weeklyOutstanding = 0;
    let totalMembers = 0;

    for (const day of weekdays) {
      const { startOfDay, endOfDay } = getRouteDateForWeekday(day);
      const dayQuery = { ...baseQuery, collectionDay: day };
      const groups = await Group.find(dayQuery).sort({ groupCode: 1 });
      const dayGroupSummaries: any[] = [];
      let dayExpected = 0;
      let dayCollected = 0;
      let dayMembers = 0;

      for (const grp of groups) {
        const loanQuery: any = { groupId: grp._id, status: { $in: ['ACTIVE', 'OVERDUE'] } };
        const loans = await Loan.find(loanQuery).populate('customerId', 'name phone customerId');

        let grpExpected = 0;
        let grpOutstanding = 0;

        const dayPayments = await Payment.find({
          groupId: grp._id,
          paymentDate: { $gte: startOfDay, $lte: endOfDay }
        });
        const grpColl = dayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        const memberRows = [];
        for (const l of loans) {
          grpOutstanding += l.outstandingTotal;

          const loanPayments = dayPayments.filter(p => String(p.loanId) === String(l._id));
          const paidOnDay = loanPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

          let targetInst = await Installment.findOne({
            loanId: l._id,
            dueDate: { $gte: startOfDay, $lte: endOfDay }
          });
          if (!targetInst) {
            targetInst = await Installment.findOne({
              loanId: l._id,
              paidDate: { $gte: startOfDay, $lte: endOfDay }
            });
          }

          let instToDisplay = targetInst;
          let isPaidToday = false;
          let expAmt = 0;
          let instStatus: string = 'PENDING';
          let instExpected = 0;

          const todayMidnight = new Date();
          todayMidnight.setHours(0, 0, 0, 0);

          if (targetInst) {
            instExpected = targetInst.expectedAmount;
            grpExpected += targetInst.expectedAmount;

            const targetDueMidnight = new Date(targetInst.dueDate);
            targetDueMidnight.setHours(0, 0, 0, 0);

            if (targetInst.status === 'PAID') {
              isPaidToday = true;
              instStatus = 'PAID';
              expAmt = 0;
            } else if (targetInst.status === 'PARTIAL') {
              isPaidToday = false;
              instStatus = targetDueMidnight < todayMidnight ? 'OVERDUE' : 'PARTIAL';
              expAmt = targetInst.balanceAmount;
            } else {
              isPaidToday = false;
              instStatus = targetDueMidnight < todayMidnight ? 'OVERDUE' : 'PENDING';
              expAmt = targetInst.balanceAmount;
            }
          } else {
            if (l.status === 'CLOSED' || l.outstandingTotal <= 0) {
              const lastPaid = await Installment.findOne({ loanId: l._id }).sort({ installmentNumber: -1 });
              instToDisplay = lastPaid;
              instStatus = 'PAID';
              isPaidToday = false;
              expAmt = 0;
              instExpected = 0;
            } else {
              const nextPending = await Installment.findOne({
                loanId: l._id,
                status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] }
              }).sort({ installmentNumber: 1 });
              instToDisplay = nextPending;
              if (nextPending) {
                const nextDueMidnight = new Date(nextPending.dueDate);
                nextDueMidnight.setHours(0, 0, 0, 0);
                instStatus = nextPending.status === 'PAID' ? 'PAID' : (nextDueMidnight < todayMidnight ? 'OVERDUE' : nextPending.status);
              } else {
                instStatus = l.status === 'OVERDUE' ? 'OVERDUE' : 'PENDING';
              }
              expAmt = nextPending ? nextPending.balanceAmount : 0;
              instExpected = nextPending ? nextPending.expectedAmount : 0;
              grpExpected += expAmt;
            }
          }

          memberRows.push({
            loanId: l._id,
            loanNumber: l.loanNumber,
            customer: l.customerId,
            installmentNumber: instToDisplay?.installmentNumber || null,
            installmentId: instToDisplay?._id || null,
            installmentStatus: instStatus,
            isPaidToday,
            installmentExpected: instExpected,
            installmentPaid: instToDisplay?.paidAmount || (isPaidToday ? instExpected : 0),
            expectedAmount: expAmt,
            todayPaid: paidOnDay > 0 ? paidOnDay : (isPaidToday ? instExpected : 0),
            outstandingTotal: l.outstandingTotal,
            tenureWeeks: l.tenureWeeks
          });
        }

        const summaryItem = {
          group: grp,
          collectionDay: day,
          expectedTotal: grpExpected,
          collectedToday: grpColl,
          outstandingTotal: grpOutstanding,
          members: memberRows
        };

        dayGroupSummaries.push(summaryItem);
        allGroupsList.push(summaryItem);

        dayExpected += grpExpected;
        dayCollected += grpColl;
        dayMembers += memberRows.length;
        weeklyOutstanding += grpOutstanding;
      }

      weeklyExpected += dayExpected;
      weeklyCollected += dayCollected;
      totalMembers += dayMembers;

      daysData[day] = {
        expected: dayExpected,
        collected: dayCollected,
        remaining: Math.max(0, dayExpected - dayCollected),
        groupsCount: groups.length,
        membersCount: dayMembers,
        groups: dayGroupSummaries
      };
    }

    res.json({
      success: true,
      weeklySummary: {
        weeklyExpected,
        weeklyCollected,
        weeklyRemaining: Math.max(0, weeklyExpected - weeklyCollected),
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

    const staffSummaries = [];

    for (const staff of staffList) {
      const staffId = staff._id;
      const staffName = staff.name;
      const nameParts = staffName.split(' ').filter(Boolean);
      const nameRegexes = [
        new RegExp(`^${staff.username}$`, 'i'),
        new RegExp(`^${staffName}$`, 'i'),
        ...nameParts.map(p => new RegExp(`^${p}$`, 'i'))
      ];

      const groupDayFilter: any = {};
      if (weekday && weekday !== 'WEEKLY' && weekday !== 'ALL') {
        groupDayFilter.collectionDay = weekday;
      }

      const assignedLoanGroupIds = await Loan.find({
        $or: [
          { assignedStaffId: staffId },
          { assignedStaffName: { $in: nameRegexes } }
        ],
        status: { $in: ['ACTIVE', 'OVERDUE'] }
      }).distinct('groupId');

      const groups = await Group.find({
        ...branchFilter,
        ...groupDayFilter,
        $or: [
          { staffId: staffId },
          { staffName: { $in: nameRegexes } },
          { _id: { $in: assignedLoanGroupIds } }
        ]
      }).sort({ collectionDay: 1, groupCode: 1 });

      let staffExpected = 0;
      let staffCollected = 0;
      let staffTotalBorrowers = 0;
      let staffTotalOutstanding = 0;
      const groupBreakdowns = [];

      for (const grp of groups) {
        const loans = await Loan.find({
          groupId: grp._id,
          status: { $in: ['ACTIVE', 'OVERDUE'] }
        }).populate('customerId', 'name phone');

        let grpExp = 0;
        let grpOut = 0;

        const todayGrpPayments = await Payment.find({
          groupId: grp._id,
          paymentDate: { $gte: startOfDay, $lte: endOfDay }
        });
        const grpColl = todayGrpPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        for (const l of loans) {
          const nextInst = await Installment.findOne({ loanId: l._id, status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] } })
            .sort({ installmentNumber: 1 });
          grpExp += nextInst ? nextInst.balanceAmount : 0;
          grpOut += l.outstandingTotal;
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
        totalGroups: groups.length,
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

      allocations.push({
        installmentId: inst._id,
        installmentNumber: inst.installmentNumber,
        amount: allocateAmt
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

    const targetWeekday = weekday || grp.collectionDay || 'THURSDAY';
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
      let targetInst = await Installment.findOne({
        loanId: loan._id,
        dueDate: { $gte: startOfDay, $lte: endOfDay },
        balanceAmount: { $gt: 0 }
      });

      if (!targetInst) {
        targetInst = await Installment.findOne({
          loanId: loan._id,
          status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] }
        }).sort({ installmentNumber: 1 });
      }

      if (!targetInst || targetInst.balanceAmount <= 0) {
        continue;
      }

      const payAmt = targetInst.balanceAmount;

      targetInst.paidAmount += payAmt;
      targetInst.balanceAmount = 0;
      targetInst.status = 'PAID';
      targetInst.paidDate = paymentDate;
      await targetInst.save();

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
        remarks: `${remarks} - W${targetInst.installmentNumber}`,
        allocations: [{
          installmentId: targetInst._id,
          installmentNumber: targetInst.installmentNumber,
          amount: payAmt
        }]
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
