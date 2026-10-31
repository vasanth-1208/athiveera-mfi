import XLSX from 'xlsx';
import { Customer } from '../models/Customer';
import { Loan } from '../models/Loan';
import { Installment } from '../models/Installment';
import { Payment } from '../models/Payment';
import { CashTransaction } from '../models/CashTransaction';
import { Expense } from '../models/Expense';
import { BranchTransfer } from '../models/BranchTransfer';
import { FollowUp } from '../models/FollowUp';
import { Branch } from '../models/Branch';
import { Group } from '../models/Group';
import { User } from '../models/User';
import { getRouteDateForWeekday } from '../routes/collectionRoutes';
import { getPendingOverdueRegister } from './pendingService';

export interface ReportFilter {
  branchId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  date?: string | Date;
  groupId?: string;
  collectionDay?: string;
  year?: number;
  month?: number;
}

// Helper to breakdown payments into principal, interest, and savings portions
export async function calculatePaymentBreakdown(payments: any[]) {
  if (!payments || payments.length === 0) {
    return { collectedPrincipal: 0, collectedInterest: 0, collectedSavings: 0 };
  }

  const allInstIds: string[] = [];
  const allLoanIds: string[] = [];
  for (const p of payments) {
    if (p.loanId) allLoanIds.push(String(p.loanId));
    if (p.allocations && p.allocations.length > 0) {
      for (const a of p.allocations) {
        if (a.installmentId) allInstIds.push(String(a.installmentId));
      }
    }
  }

  const [installments, loans] = await Promise.all([
    allInstIds.length > 0
      ? Installment.find({ _id: { $in: allInstIds } }).select('_id allocatedPrincipal allocatedInterest allocatedSavings expectedAmount').lean()
      : [],
    allLoanIds.length > 0
      ? Loan.find({ _id: { $in: allLoanIds } }).select('_id principal interestAmount savingsAmount totalPayable').lean()
      : []
  ]);

  const instMap = new Map<string, any>();
  installments.forEach(i => instMap.set(String(i._id), i));

  const loanMap = new Map<string, any>();
  loans.forEach(l => loanMap.set(String(l._id), l));

  let collectedPrincipal = 0;
  let collectedInterest = 0;
  let collectedSavings = 0;

  for (const p of payments) {
    const payAmt = p.amount || 0;
    if (payAmt <= 0) continue;

    if (p.allocations && p.allocations.length > 0) {
      let allocatedP = 0;
      let allocatedI = 0;
      let allocatedS = 0;

      for (const a of p.allocations) {
        const aAmt = a.amount || 0;
        if (aAmt <= 0) continue;

        const portSum = (a.principalPortion || 0) + (a.interestPortion || 0) + (a.savingsPortion || 0);
        if (portSum === aAmt && portSum > 0) {
          allocatedP += a.principalPortion;
          allocatedI += a.interestPortion;
          allocatedS += a.savingsPortion || 0;
          continue;
        } else if (portSum > 0) {
          const pPortion = Math.round(aAmt * ((a.principalPortion || 0) / portSum));
          const sPortion = Math.round(aAmt * ((a.savingsPortion || 0) / portSum));
          const iPortion = aAmt - pPortion - sPortion;
          allocatedP += pPortion;
          allocatedI += iPortion;
          allocatedS += sPortion;
          continue;
        }

        const inst = a.installmentId ? instMap.get(String(a.installmentId)) : null;
        if (inst && inst.expectedAmount > 0) {
          const pPortion = Math.round(aAmt * ((inst.allocatedPrincipal || 0) / inst.expectedAmount));
          const sPortion = Math.round(aAmt * ((inst.allocatedSavings || 0) / inst.expectedAmount));
          const iPortion = aAmt - pPortion - sPortion;
          allocatedP += pPortion;
          allocatedI += iPortion;
          allocatedS += sPortion;
        } else {
          const l = p.loanId ? loanMap.get(String(p.loanId)) : null;
          const totPay = l?.totalPayable || 1;
          const pPortion = Math.round(aAmt * ((l?.principal || 0) / totPay));
          const sPortion = Math.round(aAmt * ((l?.savingsAmount || 0) / totPay));
          const iPortion = aAmt - pPortion - sPortion;
          allocatedP += pPortion;
          allocatedI += iPortion;
          allocatedS += sPortion;
        }
      }

      collectedPrincipal += allocatedP;
      collectedInterest += allocatedI;
      collectedSavings += allocatedS;
    } else {
      const l = p.loanId ? loanMap.get(String(p.loanId)) : null;
      const totPay = l?.totalPayable || 1;
      const pPortion = Math.round(payAmt * ((l?.principal || 0) / totPay));
      const sPortion = Math.round(payAmt * ((l?.savingsAmount || 0) / totPay));
      const iPortion = payAmt - pPortion - sPortion;
      collectedPrincipal += pPortion;
      collectedInterest += iPortion;
      collectedSavings += sPortion;
    }
  }

  return { collectedPrincipal, collectedInterest, collectedSavings };
}

export class ReportService {
  // 1. Daily / Date-Range Report Excel Export
  public static async generateDailyReport(filter: ReportFilter): Promise<Buffer> {
    const startRange = filter.startDate ? new Date(filter.startDate) : (filter.date ? new Date(filter.date) : new Date());
    const endRange = filter.endDate ? new Date(filter.endDate) : (filter.date ? new Date(filter.date) : new Date());
    const startOfDay = new Date(startRange);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(endRange);
    endOfDay.setHours(23, 59, 59, 999);

    const baseQuery: any = {};
    if (filter.branchId) baseQuery.branchId = filter.branchId;

    const payments = await Payment.find({
      ...baseQuery,
      paymentDate: { $gte: startOfDay, $lte: endOfDay }
    })
      .populate('customerId', 'name phone')
      .populate('groupId', 'name collectionDay groupCode')
      .populate('branchId', 'name')
      .populate('collectorId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const disbursements = await Loan.find({
      ...baseQuery,
      disbursedDate: { $gte: startOfDay, $lte: endOfDay }
    })
      .populate('customerId', 'name phone')
      .populate('groupId', 'name groupCode')
      .populate('branchId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const expenses = await Expense.find({
      ...baseQuery,
      expenseDate: { $gte: startOfDay, $lte: endOfDay },
      status: 'APPROVED'
    })
      .populate('branchId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPrincipalDisbursed = disbursements.reduce((sum, d) => sum + (d.principal || 0), 0);
    const totalInterestGiven = disbursements.reduce((sum, d) => sum + (d.interestAmount || 0), 0);
    const totalDocCharges = disbursements.reduce((sum, d) => sum + (d.docCharges || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const { collectedPrincipal, collectedInterest, collectedSavings } = await calculatePaymentBreakdown(payments);

    // Calculate expected due and shortfall using Collections logic
    let expectedDue = 0;
    let shortfall = 0;

    const isDateRange = !!(filter.startDate && filter.endDate && String(filter.startDate) !== String(filter.endDate));

    if (isDateRange) {
      const rangeInstallments = await Installment.find({
        ...baseQuery,
        dueDate: { $gte: startOfDay, $lte: endOfDay }
      }).lean();

      expectedDue = rangeInstallments.reduce((sum, inst) => sum + (inst.expectedAmount || 0), 0);
      shortfall = rangeInstallments.reduce((sum, inst) => sum + Math.max(0, inst.balanceAmount || 0), 0);
    } else {
      const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
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

    const summaryRows = [
      { 'Metric': 'Expected Due', 'Amount / Count': expectedDue },
      { 'Metric': 'Collected Amount (Repayments)', 'Amount / Count': totalCollected },
      { 'Metric': 'Route Shortfall', 'Amount / Count': shortfall },
      { 'Metric': 'Total Loan Given (Principal)', 'Amount / Count': totalPrincipalDisbursed },
      { 'Metric': 'Total Loans Given Count', 'Amount / Count': disbursements.length },
      { 'Metric': 'Interest Given', 'Amount / Count': totalInterestGiven },
      { 'Metric': 'Collected Principal', 'Amount / Count': collectedPrincipal },
      { 'Metric': 'Collected Interest', 'Amount / Count': collectedInterest },
      { 'Metric': 'Collected Savings', 'Amount / Count': collectedSavings },
      { 'Metric': 'Document Charges (Collected Upfront)', 'Amount / Count': totalDocCharges },
      { 'Metric': 'Total Collected Inflows (Repayments + Doc Charges)', 'Amount / Count': totalCollected + totalDocCharges },
      { 'Metric': 'Approved Operational Expenses', 'Amount / Count': totalExpenses },
      { 'Metric': 'Net Cashflow', 'Amount / Count': (totalCollected + totalDocCharges) - totalPrincipalDisbursed - totalExpenses }
    ];

    const paymentRows = payments.map((p: any, idx: number) => ({
      'S.No': idx + 1,
      'Receipt #': p.receiptNumber,
      'Branch': p.branchId?.name || '',
      'Group': p.groupId ? `Group #${p.groupId.groupCode} - ${p.groupId.name}` : '',
      'Day': p.groupId?.collectionDay || '',
      'Borrower': p.customerId?.name || '',
      'Phone': p.customerId?.phone || '',
      'Amount Collected (₹)': p.amount,
      'Payment Mode': p.paymentMethod,
      'Collector': p.collectorId?.name || 'Staff',
      'Remarks': p.remarks || ''
    }));

    const disbRows = disbursements.map((d: any, idx: number) => ({
      'S.No': idx + 1,
      'Loan Account #': d.loanNumber,
      'Branch': d.branchId?.name || '',
      'Borrower': d.customerId?.name || '',
      'Group': d.groupId?.name || '',
      'Principal Disbursed (₹)': d.principal,
      'Interest (₹)': d.interestAmount,
      'Doc Charges (₹)': d.docCharges,
      'Total Payable (₹)': d.totalPayable,
      'Tenure': `${d.tenureWeeks} Weeks`
    }));

    const expRows = expenses.map((e: any, idx: number) => ({
      'S.No': idx + 1,
      'Category': e.category,
      'Branch': e.branchId?.name || '',
      'Amount (₹)': e.amount,
      'Paid Via': e.paymentMethod,
      'Staff': e.staffName || '',
      'Description': e.description || '',
      'Bill Ref': e.billRef || ''
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'KPI Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentRows.length > 0 ? paymentRows : [{ 'Info': 'No collections on this date' }]), 'Collections');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(disbRows.length > 0 ? disbRows : [{ 'Info': 'No disbursements on this date' }]), 'Disbursements');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expRows.length > 0 ? expRows : [{ 'Info': 'No expenses on this date' }]), 'Expenses');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // 2. Weekly Report Excel Export
  public static async generateWeeklyReport(filter: ReportFilter): Promise<Buffer> {
    const baseQuery: any = {};
    if (filter.branchId) baseQuery.branchId = filter.branchId;

    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const summaryRows: any[] = [];
    const groupRows: any[] = [];

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

    let totalExp = 0;
    let totalColl = 0;
    let totalShortfall = 0;

    for (const { day, startOfDay, endOfDay } of dateRanges) {
      const dayStartTs = startOfDay.getTime();
      const dayEndTs = endOfDay.getTime();

      const groups = allGroups.filter(g => g.collectionDay === day);
      let dayExp = 0;
      let dayColl = 0;
      let dayShortfall = 0;
      let dayBorrowers = 0;

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
          if (lDisb > dayEndTs && paidOnDate <= 0) continue;

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

        groupRows.push({
          'Day': day,
          'Group #': grp.groupCode,
          'Group Name': grp.name,
          'Area': grp.area || '',
          'Collector': grp.staffName || '',
          'Borrowers': loans.length,
          'Expected (₹)': grpExp,
          'Collected (₹)': grpColl,
          'Balance (₹)': grpRemaining,
          'Status': grpColl >= grpExp && grpExp > 0 ? 'TARGET ACHIEVED' : (grpColl > 0 ? 'PARTIAL' : 'PENDING')
        });
      }

      totalExp += dayExp;
      totalColl += dayColl;
      totalShortfall += dayShortfall;

      summaryRows.push({
        'Route Day': day,
        'Scheduled Groups': groups.length,
        'Active Borrowers': dayBorrowers,
        'Target Expected (₹)': dayExp,
        'Collected (₹)': dayColl,
        'Shortfall Balance (₹)': dayShortfall,
        'Efficiency %': dayExp > 0 ? `${Math.round((dayColl / dayExp) * 100)}%` : (dayColl > 0 ? '100%' : '0%')
      });
    }

    summaryRows.push({
      'Route Day': 'TOTAL / WEEKLY CONSOLIDATED',
      'Scheduled Groups': summaryRows.reduce((sum, s) => sum + (s['Scheduled Groups'] || 0), 0),
      'Active Borrowers': summaryRows.reduce((sum, s) => sum + (s['Active Borrowers'] || 0), 0),
      'Target Expected (₹)': totalExp,
      'Collected (₹)': totalColl,
      'Shortfall Balance (₹)': totalShortfall,
      'Efficiency %': totalExp > 0 ? `${Math.round((totalColl / totalExp) * 100)}%` : '100%'
    });

    const weeklyDisbursements = await Loan.find({
      ...baseQuery,
      disbursedDate: { $gte: minStartOfDay, $lte: maxEndOfDay }
    }).lean();

    const weeklyLoanGiven = weeklyDisbursements.reduce((sum, d) => sum + (d.principal || 0), 0);
    const weeklyInterestGiven = weeklyDisbursements.reduce((sum, d) => sum + (d.interestAmount || 0), 0);
    const weeklyDocCharges = weeklyDisbursements.reduce((sum, d) => sum + (d.docCharges || 0), 0);

    const { collectedPrincipal, collectedInterest, collectedSavings } = await calculatePaymentBreakdown(allPayments);

    const weeklyKpiRows = [
      { 'Metric': 'Expected Due', 'Amount / Count': totalExp },
      { 'Metric': 'Collected Amount (Repayments)', 'Amount / Count': totalColl },
      { 'Metric': 'Shortfall', 'Amount / Count': totalShortfall },
      { 'Metric': 'Total Loan Given (Principal)', 'Amount / Count': weeklyLoanGiven },
      { 'Metric': 'Total Loans Given Count', 'Amount / Count': weeklyDisbursements.length },
      { 'Metric': 'Interest Given', 'Amount / Count': weeklyInterestGiven },
      { 'Metric': 'Collected Principal', 'Amount / Count': collectedPrincipal },
      { 'Metric': 'Collected Interest', 'Amount / Count': collectedInterest },
      { 'Metric': 'Collected Savings', 'Amount / Count': collectedSavings },
      { 'Metric': 'Document Charges (Collected Upfront)', 'Amount / Count': weeklyDocCharges },
      { 'Metric': 'Total Collected Inflows (Repayments + Doc Charges)', 'Amount / Count': totalColl + weeklyDocCharges },
      { 'Metric': 'Overall Route Recovery Efficiency', 'Amount / Count': `${totalExp > 0 ? Math.round((totalColl / totalExp) * 100) : 100}%` }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(weeklyKpiRows), 'Weekly KPI Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Weekly Route Breakdown');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(groupRows), 'Route Groups Register');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // 3. Monthly Report Excel Export
  public static async generateMonthlyReport(filter: ReportFilter): Promise<Buffer> {
    const year = filter.year || new Date().getFullYear();
    const month = filter.month || (new Date().getMonth() + 1);

    const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    const baseQuery: any = {};
    if (filter.branchId) baseQuery.branchId = filter.branchId;

    const loansDisbursed = await Loan.find({
      ...baseQuery,
      disbursedDate: { $gte: startOfMonth, $lte: endOfMonth }
    }).populate('customerId groupId');

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
    const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const { collectedPrincipal, collectedInterest, collectedSavings } = await calculatePaymentBreakdown(payments);

    const monthlyInstallments = await Installment.find({
      ...baseQuery,
      dueDate: { $gte: startOfMonth, $lte: endOfMonth }
    }).lean();
    const targetToCollect = monthlyInstallments.reduce((sum, inst) => sum + (inst.expectedAmount || 0), 0);
    const shortfall = monthlyInstallments.reduce((sum, inst) => sum + Math.max(0, inst.balanceAmount || 0), 0);

    const summary = [
      { 'Metric': 'Reporting Month', 'Value': `${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}` },
      { 'Metric': 'Expected Due (Target to Collect)', 'Value': targetToCollect },
      { 'Metric': 'Collected Amount (Repayments)', 'Value': totalCollected },
      { 'Metric': 'Monthly Shortfall', 'Value': shortfall },
      { 'Metric': 'Total Loan Given (Principal)', 'Value': totalPrincipalDisbursed },
      { 'Metric': 'Total Loans Given Count', 'Value': loansDisbursed.length },
      { 'Metric': 'Interest Given', 'Value': totalInterestGiven },
      { 'Metric': 'Collected Principal', 'Value': collectedPrincipal },
      { 'Metric': 'Collected Interest', 'Value': collectedInterest },
      { 'Metric': 'Collected Savings', 'Value': collectedSavings },
      { 'Metric': 'Document Charges (Collected Upfront)', 'Value': totalDocCharges },
      { 'Metric': 'Total Collected Inflows (Repayments + Doc Charges)', 'Value': totalCollected + totalDocCharges },
      { 'Metric': 'Total Operational Expenses', 'Value': totalExpenses },
      { 'Metric': 'Net Monthly Operating Surplus', 'Value': (totalCollected + totalDocCharges) - (totalPrincipalDisbursed + totalExpenses) }
    ];

    const disbRows = loansDisbursed.map((l: any, idx: number) => ({
      'S.No': idx + 1,
      'Loan Number': l.loanNumber,
      'Date': new Date(l.disbursedDate).toLocaleDateString('en-IN'),
      'Borrower': l.customerId?.name || '',
      'Group': l.groupId?.name || '',
      'Principal (₹)': l.principal,
      'Interest (₹)': l.interestAmount,
      'Doc Charge (₹)': l.docCharges,
      'Savings (₹)': l.savingsAmount,
      'Status': l.status
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Monthly Financial Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(disbRows.length > 0 ? disbRows : [{ 'Info': 'No loans disbursed in this month' }]), 'Disbursements');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // 4. Pending EMI Report Excel Export (Strict Canonical Alignment with Pending Page)
  public static async generatePendingEmiReport(filter: ReportFilter): Promise<Buffer> {
    const result = await getPendingOverdueRegister({
      branchId: filter.branchId,
      weekday: filter.collectionDay !== 'ALL' ? filter.collectionDay : undefined,
      startDate: filter.startDate,
      endDate: filter.endDate
    });

    const rows = result.followUps.map((f, idx) => ({
      'S.No': idx + 1,
      'Borrower Name': f.customerName,
      'Group Name': f.groupName,
      'Route Day': f.collectionDay,
      'Primary Phone': f.customerPhone,
      'Nominee Phone': f.nomineePhone || '-',
      'Overdue Weeks': f.overdueWeeks || 1,
      'Actual Pending Amount (₹)': f.actualPending,
      'Customer Known Due (₹)': f.customerKnown || f.actualPending,
      'Assigned Staff': f.staffName || 'Staff',
      'Staff Remarks': f.remarks || '',
      'Status': f.status
    }));

    if (rows.length > 0) {
      const totActual = rows.reduce((s, r) => s + (r['Actual Pending Amount (₹)'] || 0), 0);
      const totKnown = rows.reduce((s, r) => s + (r['Customer Known Due (₹)'] || 0), 0);
      rows.push({
        'S.No': '' as any,
        'Borrower Name': `TOTAL (${rows.length} Borrowers)`,
        'Group Name': '',
        'Route Day': '',
        'Primary Phone': '',
        'Nominee Phone': '',
        'Overdue Weeks': '' as any,
        'Actual Pending Amount (₹)': totActual,
        'Customer Known Due (₹)': totKnown,
        'Assigned Staff': '',
        'Staff Remarks': '',
        'Status': ''
      });
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Info': 'No pending EMI records found' }]), 'Pending EMI Follow-Up');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // 5. Profit & Loss Shared Data Compiler & Excel Generators
  public static async compileProfitLossData(filter: ReportFilter) {
    const baseQuery: any = {};
    if (filter.branchId) baseQuery.branchId = filter.branchId;

    let branchName = 'All Branches (Consolidated)';
    if (filter.branchId) {
      const b = await Branch.findById(filter.branchId).select('name code').lean();
      if (b) branchName = b.name;
    }

    let s: Date | null = null;
    let e: Date | null = null;
    let periodLabel = 'ALL-TIME';

    if (filter.startDate && filter.endDate) {
      s = new Date(filter.startDate);
      s.setHours(0, 0, 0, 0);
      e = new Date(filter.endDate);
      e.setHours(23, 59, 59, 999);
      periodLabel = `${filter.startDate} to ${filter.endDate}`;
    }

    const loanQuery: any = { ...baseQuery };
    const paymentQuery: any = { ...baseQuery, isReversed: false };
    const expenseQuery: any = { ...baseQuery, status: 'APPROVED' };

    if (s && e) {
      paymentQuery.paymentDate = { $gte: s, $lte: e };
      expenseQuery.expenseDate = { $gte: s, $lte: e };

      // Query loans with activity in this date range (either disbursed or having collections)
      const paidLoanIds = await Payment.distinct('loanId', paymentQuery);
      loanQuery.$or = [
        { _id: { $in: paidLoanIds } },
        { disbursedDate: { $gte: s, $lte: e } }
      ];
    }

    const [loans, payments, expenses] = await Promise.all([
      Loan.find(loanQuery)
        .populate('customerId', 'name phone area')
        .populate('groupId', 'name collectionDay groupCode headCustomerId headName')
        .sort({ disbursedDate: 1, 'groupId.name': 1 })
        .lean(),
      Payment.find(paymentQuery).sort({ paymentDate: 1, _id: 1 }).lean(),
      Expense.find(expenseQuery).sort({ expenseDate: 1 }).lean()
    ]);

    const loanMap = new Map<string, any>();
    loans.forEach(l => loanMap.set(String(l._id), l));

    // Pre-fetch all installments for these loans to accurately populate weekly principal, interest, and savings
    const loanIds = loans.map(l => l._id);
    const loanInstallments = await Installment.find({ loanId: { $in: loanIds } })
      .select('loanId installmentNumber expectedAmount allocatedPrincipal allocatedInterest allocatedSavings')
      .lean();

    const installmentMap = new Map<string, any>();
    for (const inst of loanInstallments) {
      installmentMap.set(`${inst.loanId}_${inst.installmentNumber}`, inst);
    }

    // Map payments into weekly breakdown per loan
    const paymentBreakdownByLoan = new Map<string, Map<number, { p: number; i: number; s: number; tot: number }>>();

    // Group payments by loanId
    const paymentsByLoan = new Map<string, any[]>();
    for (const p of payments) {
      const lId = String(p.loanId);
      if (!paymentsByLoan.has(lId)) paymentsByLoan.set(lId, []);
      paymentsByLoan.get(lId)!.push(p);
    }

    for (const l of loans) {
      const lId = String(l._id);
      const loanPayments = paymentsByLoan.get(lId) || [];
      if (!paymentBreakdownByLoan.has(lId)) {
        paymentBreakdownByLoan.set(lId, new Map());
      }
      const loanWeeks = paymentBreakdownByLoan.get(lId)!;

      loanPayments.forEach((p, payIdx) => {
        if (p.allocations && p.allocations.length > 0) {
          for (const a of p.allocations) {
            const w = a.installmentNumber || 1;
            if (!loanWeeks.has(w)) {
              loanWeeks.set(w, { p: 0, i: 0, s: 0, tot: 0 });
            }
            const cell = loanWeeks.get(w)!;
            let pPortion = a.principalPortion || 0;
            let iPortion = a.interestPortion || 0;
            let sPortion = a.savingsPortion || 0;
            const tot = a.amount || (pPortion + iPortion + sPortion);

            if (pPortion + iPortion + sPortion === 0 && tot > 0) {
              const inst = installmentMap.get(`${lId}_${w}`);
              if (inst) {
                const exp = inst.expectedAmount || tot;
                const ratio = exp > 0 ? tot / exp : 1;
                pPortion = Math.round((inst.allocatedPrincipal || 0) * ratio);
                sPortion = Math.round((inst.allocatedSavings || 0) * ratio);
                iPortion = tot - pPortion - sPortion;
              } else {
                const totPay = l.totalPayable || 1;
                pPortion = Math.round(tot * ((l.principal || 0) / totPay));
                sPortion = Math.round(tot * ((l.savingsAmount || 0) / totPay));
                iPortion = tot - pPortion - sPortion;
              }
            }

            cell.p += pPortion;
            cell.i += iPortion;
            cell.s += sPortion;
            cell.tot += tot;
          }
        } else {
          let w = payIdx + 1;
          const wMatch = (p.receiptNumber || p.remarks || '').match(/W(\d+)/i);
          if (wMatch) w = parseInt(wMatch[1], 10);

          if (!loanWeeks.has(w)) {
            loanWeeks.set(w, { p: 0, i: 0, s: 0, tot: 0 });
          }
          const cell = loanWeeks.get(w)!;
          const tot = p.amount || 0;
          let pPortion = (p as any).principalAmount || 0;
          let iPortion = (p as any).interestAmount || 0;
          let sPortion = (p as any).savingsAmount || 0;

          if (pPortion + iPortion + sPortion === 0 && tot > 0) {
            const inst = installmentMap.get(`${lId}_${w}`);
            if (inst) {
              const exp = inst.expectedAmount || tot;
              const ratio = exp > 0 ? tot / exp : 1;
              pPortion = Math.round((inst.allocatedPrincipal || 0) * ratio);
              sPortion = Math.round((inst.allocatedSavings || 0) * ratio);
              iPortion = tot - pPortion - sPortion;
            } else {
              const totPay = l.totalPayable || 1;
              pPortion = Math.round(tot * ((l.principal || 0) / totPay));
              sPortion = Math.round(tot * ((l.savingsAmount || 0) / totPay));
              iPortion = tot - pPortion - sPortion;
            }
          }

          cell.p += pPortion;
          cell.i += iPortion;
          cell.s += sPortion;
          cell.tot += tot;
        }
      });
    }

    // Determine max weeks across loans
    let maxWeeks = 32;
    for (const [_, weeks] of paymentBreakdownByLoan) {
      for (const w of weeks.keys()) {
        if (w > maxWeeks) maxWeeks = w;
      }
    }
    // Match the standard 50 weeks format
    const reportWeeks = Math.max(maxWeeks, 50);

    let totalDocCharges = 0;
    let totalPrinDisbursed = 0;
    let totalExpected = 0;
    let grandP = 0, grandI = 0, grandS = 0, grandTot = 0;

    const pnlRows = loans.map((l: any, idx: number) => {
      const lId = String(l._id);
      const weeksMap = paymentBreakdownByLoan.get(lId) || new Map();
      const weeksObj: Record<number, { p: number; i: number; s: number; tot: number }> = {};
      let rowP = 0, rowI = 0, rowS = 0, rowTot = 0;

      for (let w = 1; w <= reportWeeks; w++) {
        const wk = weeksMap.get(w);
        if (wk) {
          weeksObj[w] = wk;
          rowP += wk.p;
          rowI += wk.i;
          rowS += wk.s;
          rowTot += wk.tot;
        }
      }

      // In a date range, only count document charges if disbursed within that date range
      let docChg = 0;
      if (s && e) {
        if (l.disbursedDate && new Date(l.disbursedDate) >= s && new Date(l.disbursedDate) <= e) {
          docChg = l.docCharges || 0;
        }
      } else {
        docChg = l.docCharges || 0;
      }

      totalDocCharges += docChg;
      totalPrinDisbursed += (l.principal || 0);
      totalExpected += (l.totalPayable || 0);
      grandP += rowP;
      grandI += rowI;
      grandS += rowS;
      grandTot += rowTot;

      const d = l.disbursedDate ? new Date(l.disbursedDate) : null;
      const loanDateStr = d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '-';

      const isHead = (l.groupId?.headCustomerId && String(l.customerId?._id) === String(l.groupId.headCustomerId)) ||
                     (l.groupId?.headName && l.customerId?.name?.trim().toLowerCase() === l.groupId.headName.trim().toLowerCase());
      const rawName = l.customerId?.name || 'Borrower';
      const customerDisplayName = isHead && !rawName.includes('HEAD') ? `${rawName} - HEAD` : rawName;

      return {
        sNo: idx + 1,
        loanId: lId,
        loanNo: l.loanNumber || '',
        customerName: customerDisplayName,
        groupName: l.groupId?.name || 'Group',
        groupCode: l.groupId?.groupCode ?? (l as any).groupNo ?? '',
        collectionDay: l.groupId?.collectionDay || 'MONDAY',
        loanDate: loanDateStr,
        principalAmt: l.principal || 0,
        totalCollAmt: l.totalPayable || 0,
        totalPrincipal: rowP,
        totalInterest: rowI,
        totalSavings: rowS,
        totalCollected: rowTot,
        docCharge: docChg,
        weeks: weeksObj
      };
    });

    // Sort pnlRows so within each group, the group head appears first
    pnlRows.sort((a: any, b: any) => {
      const gComp = (a.groupName || '').localeCompare(b.groupName || '');
      if (gComp !== 0) return gComp;
      if (a.customerName.includes('HEAD') && !b.customerName.includes('HEAD')) return -1;
      if (!a.customerName.includes('HEAD') && b.customerName.includes('HEAD')) return 1;
      return a.sNo - b.sNo;
    });
    pnlRows.forEach((r: any, idx: number) => { r.sNo = idx + 1; });

    // Expenses breakdown & rows
    const expenseRows = expenses.map((e: any, idx: number) => {
      const ed = e.expenseDate ? new Date(e.expenseDate) : null;
      const dateStr = ed ? `${String(ed.getDate()).padStart(2, '0')}/${String(ed.getMonth() + 1).padStart(2, '0')}/${ed.getFullYear()}` : '-';
      return {
        sNo: idx + 1,
        id: String(e._id),
        date: dateStr,
        particulars: (e.category || '').toUpperCase(),
        amount: e.amount || 0,
        remarks: e.description || '',
        staffName: e.staffName || '',
        paymentMethod: e.paymentMethod || 'CASH'
      };
    });

    const fuelExpenses = expenses.filter(e => e.category.toLowerCase().includes('fuel') || (e.travelKM && e.travelKM > 0))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const rentExpenses = expenses.filter(e => e.category.toLowerCase().includes('rent'))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const salaryExpenses = expenses.filter(e => e.category.toLowerCase().includes('salary') || e.category.toLowerCase().includes('incentive') || e.category.toLowerCase().includes('wages'))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const generalExpenses = expenses.filter(e => 
      !e.category.toLowerCase().includes('fuel') && 
      !e.category.toLowerCase().includes('rent') && 
      !e.category.toLowerCase().includes('salary') && 
      !e.category.toLowerCase().includes('incentive') &&
      !e.category.toLowerCase().includes('wages') &&
      !(e.travelKM && e.travelKM > 0)
    ).reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalOperatingExpenses = fuelExpenses + rentExpenses + salaryExpenses + generalExpenses;
    const totalOperatingRevenue = totalDocCharges + grandI;
    const netOperatingProfit = totalOperatingRevenue - totalOperatingExpenses;
    const profitMargin = totalOperatingRevenue > 0 ? Math.round((netOperatingProfit / totalOperatingRevenue) * 100) : 0;

    return {
      branchName,
      periodLabel,
      maxWeeks: reportWeeks,
      summary: {
        revenue: {
          docCharges: totalDocCharges,
          interestEarned: grandI,
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
      },
      totals: {
        totalPrinDisbursed,
        totalExpected,
        totalPrincipalCollected: grandP,
        totalInterestCollected: grandI,
        totalSavingsCollected: grandS,
        totalRepaymentsCollected: grandTot,
        totalDocCharges,
        totalLoansCount: pnlRows.length
      },
      pnlRows,
      expenseRows
    };
  }

  // 5a. Profit & Loss Full Workbook Export (.xlsx)
  public static async generateProfitLossReport(filter: ReportFilter): Promise<Buffer> {
    const data = await this.compileProfitLossData(filter);
    const wb = XLSX.utils.book_new();
    const maxWeeks = data.maxWeeks;

    // -------------------------------------------------------------------------
    // SHEET 1: LOAN P&L REGISTER (Matching POLLACHI P&L / 2024-2025 template)
    // -------------------------------------------------------------------------
    const wsData: any[][] = [];

    // Row 1 & Row 2 Headers
    const r1: any[] = ['S.NO', 'NAME', 'GROUP NAME ', 'LOAN DATE', 'COLL DAY'];
    const r2: any[] = ['', '', '', '', ''];

    for (let w = 1; w <= maxWeeks; w++) {
      r1.push(`${w} WEEK`, '', '', '');
      r2.push('PRINCIPAL', 'INTEREST', 'SAVINGS', 'TOTAL');
    }

    r1.push('PRINCIPAL AMT', 'TOTAL COLL AMT', 'TOTAL', '', '', '', 'DOCUMENT CHARGE');
    r2.push('', '', 'PRINCIPAL', 'INTEREST', 'SAVINGS', 'TOTAL', '');

    wsData.push(r1);
    wsData.push(r2);

    const merges: any[] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
      { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },
      { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },
    ];

    for (let w = 1; w <= maxWeeks; w++) {
      const sc = 5 + (w - 1) * 4;
      merges.push({ s: { r: 0, c: sc }, e: { r: 0, c: sc + 3 } });
    }

    const prinAmtCol = 5 + maxWeeks * 4;       // e.g. Col 205 (GX)
    const totCollAmtCol = prinAmtCol + 1;      // e.g. Col 206 (GY)
    const totStartCol = prinAmtCol + 2;        // e.g. Col 207 (GZ)
    const totIntCol = totStartCol + 1;         // e.g. Col 208 (HA)
    const totSavCol = totStartCol + 2;         // e.g. Col 209 (HB)
    const totRowCol = totStartCol + 3;         // e.g. Col 210 (HC)
    const docChgCol = prinAmtCol + 6;          // e.g. Col 211 (HD)
    const countCol = docChgCol + 1;            // e.g. Col 212 (HE)

    merges.push({ s: { r: 0, c: prinAmtCol }, e: { r: 1, c: prinAmtCol } });
    merges.push({ s: { r: 0, c: totCollAmtCol }, e: { r: 1, c: totCollAmtCol } });
    merges.push({ s: { r: 0, c: totStartCol }, e: { r: 0, c: totStartCol + 3 } });
    merges.push({ s: { r: 0, c: docChgCol }, e: { r: 1, c: docChgCol } });

    // Loan Rows
    data.pnlRows.forEach((row, idx) => {
      const r: any[] = [
        idx + 1,
        row.customerName,
        row.groupName,
        row.loanDate,
        row.collectionDay
      ];

      for (let w = 1; w <= maxWeeks; w++) {
        const wk = row.weeks[w];
        if (wk && (wk.p || wk.i || wk.s || wk.tot)) {
          r.push(wk.p || 0, wk.i || 0, wk.s || 0, wk.tot || 0);
        } else {
          r.push(null, null, null, null);
        }
      }

      r.push(
        row.principalAmt,
        row.totalCollAmt,
        row.totalPrincipal,
        row.totalInterest,
        row.totalSavings,
        row.totalCollected,
        row.docCharge
      );

      wsData.push(r);
    });

    const lastLoanRowIdx = wsData.length - 1; // 0-indexed row of last loan
    const lastLoanRowNum = lastLoanRowIdx + 1; // 1-indexed row number in Excel (e.g. 136)
    const totalRowIdx = wsData.length;         // index for Grand Total row
    const totalRowNum = totalRowIdx + 1;       // Excel row number (e.g. 137)

    // Grand Totals Row
    const totalRow: any[] = ['', 'TOTAL', '', '', ''];
    for (let c = 5; c < 5 + maxWeeks * 4 + 7; c++) {
      let colSum = 0;
      let hasVal = false;
      for (let r = 2; r < totalRowIdx; r++) {
        const val = wsData[r][c];
        if (typeof val === 'number') {
          colSum += val;
          hasVal = true;
        }
      }
      totalRow.push(hasVal ? colSum : '');
    }
    // Also add count for HE
    totalRow.push(data.pnlRows.length);
    wsData.push(totalRow);

    // Spacer rows
    wsData.push([]);
    wsData.push([]);

    // Revenue Summary Block (Matching bottom template)
    const docRowIdx = wsData.length;
    const docRowNum = docRowIdx + 1;
    const docR: any[] = [];
    docR[totCollAmtCol] = 'DOCUMENT CHARGE';
    docR[totSavCol] = data.summary.revenue.docCharges;
    wsData.push(docR);

    const intRowIdx = wsData.length;
    const intRowNum = intRowIdx + 1;
    const intR: any[] = [];
    intR[totCollAmtCol] = 'INTEREST';
    intR[totSavCol] = data.summary.revenue.interestEarned;
    wsData.push(intR);

    const netRevRowIdx = wsData.length;
    const netRevRowNum = netRevRowIdx + 1;
    const netRevR: any[] = [];
    netRevR[totCollAmtCol] = 'INT & DOCUMENT CHARGE';
    netRevR[totSavCol] = data.summary.revenue.totalRevenue;
    wsData.push(netRevR);

    const wsPnl = XLSX.utils.aoa_to_sheet(wsData);
    wsPnl['!merges'] = merges;

    // INJECT LIVE EXCEL FORMULAS INTO LOAN ROWS AND TOTALS!
    data.pnlRows.forEach((row, idx) => {
      const rowNum = idx + 3; // 1-indexed Excel row

      const prinCols: string[] = [];
      const intCols: string[] = [];
      const savCols: string[] = [];
      const totCols: string[] = [];

      for (let w = 1; w <= maxWeeks; w++) {
        const sc = 5 + (w - 1) * 4;
        const pCol = XLSX.utils.encode_col(sc);
        const iCol = XLSX.utils.encode_col(sc + 1);
        const sCol = XLSX.utils.encode_col(sc + 2);
        const tCol = XLSX.utils.encode_col(sc + 3);

        prinCols.push(`${pCol}${rowNum}`);
        intCols.push(`${iCol}${rowNum}`);
        savCols.push(`${sCol}${rowNum}`);
        totCols.push(`${tCol}${rowNum}`);

        const wk = row.weeks[w];
        if (wk && (wk.p || wk.i || wk.s || wk.tot)) {
          const totCell = `${tCol}${rowNum}`;
          wsPnl[totCell] = {
            t: 'n',
            v: wk.tot || (wk.p + wk.i + wk.s),
            f: `SUM(${pCol}${rowNum}:${sCol}${rowNum})`
          };
        }
      }

      // Row summary formulas (using SUM ignores empty/blank cells and avoids #VALUE! error):
      const gzCell = `${XLSX.utils.encode_col(totStartCol)}${rowNum}`;
      wsPnl[gzCell] = {
        t: 'n',
        v: row.totalPrincipal,
        f: `SUM(${prinCols.join(',')})`
      };

      const haCell = `${XLSX.utils.encode_col(totIntCol)}${rowNum}`;
      wsPnl[haCell] = {
        t: 'n',
        v: row.totalInterest,
        f: `SUM(${intCols.join(',')})`
      };

      const hbCell = `${XLSX.utils.encode_col(totSavCol)}${rowNum}`;
      wsPnl[hbCell] = {
        t: 'n',
        v: row.totalSavings,
        f: `SUM(${savCols.join(',')})`
      };

      const hcCell = `${XLSX.utils.encode_col(totRowCol)}${rowNum}`;
      wsPnl[hcCell] = {
        t: 'n',
        v: row.totalCollected,
        f: `SUM(${totCols.join(',')})`
      };
    });

    // Grand Total Row Formulas:
    if (data.pnlRows.length > 0) {
      for (let c = 5; c <= docChgCol; c++) {
        const colLetter = XLSX.utils.encode_col(c);
        const cellRef = `${colLetter}${totalRowNum}`;
        const existingVal = wsPnl[cellRef]?.v || 0;
        wsPnl[cellRef] = {
          t: 'n',
          v: typeof existingVal === 'number' ? existingVal : 0,
          f: `SUM(${colLetter}3:${colLetter}${lastLoanRowNum})`
        };
      }

      // HE: Loan count formula
      const countCellRef = `${XLSX.utils.encode_col(countCol)}${totalRowNum}`;
      wsPnl[countCellRef] = {
        t: 'n',
        v: data.pnlRows.length,
        f: `COUNT(${XLSX.utils.encode_col(docChgCol)}3:${XLSX.utils.encode_col(docChgCol)}${lastLoanRowNum})`
      };

      // Revenue Summary Block Formulas:
      const docSumCell = `${XLSX.utils.encode_col(totSavCol)}${docRowNum}`;
      wsPnl[docSumCell] = {
        t: 'n',
        v: data.summary.revenue.docCharges,
        f: `+${XLSX.utils.encode_col(docChgCol)}${totalRowNum}`
      };

      const intSumCell = `${XLSX.utils.encode_col(totSavCol)}${intRowNum}`;
      wsPnl[intSumCell] = {
        t: 'n',
        v: data.summary.revenue.interestEarned,
        f: `+${XLSX.utils.encode_col(totIntCol)}${totalRowNum}`
      };

      const netSumCell = `${XLSX.utils.encode_col(totSavCol)}${netRevRowNum}`;
      wsPnl[netSumCell] = {
        t: 'n',
        v: data.summary.revenue.totalRevenue,
        f: `SUM(${XLSX.utils.encode_col(totSavCol)}${docRowNum}:${XLSX.utils.encode_col(totSavCol)}${intRowNum})`
      };
    }

    // Set Column Widths for Sheet 1
    const pnlColWidths: any[] = [
      { wch: 6 },  // S.NO
      { wch: 24 }, // NAME
      { wch: 22 }, // GROUP NAME
      { wch: 12 }, // LOAN DATE
      { wch: 14 }  // COLL DAY
    ];
    for (let w = 1; w <= maxWeeks; w++) {
      pnlColWidths.push({ wch: 10 }, { wch: 10 }, { wch: 9 }, { wch: 10 });
    }
    pnlColWidths.push(
      { wch: 14 }, // PRINCIPAL AMT
      { wch: 14 }, // TOTAL COLL AMT
      { wch: 12 }, // PRINCIPAL
      { wch: 12 }, // INTEREST
      { wch: 10 }, // SAVINGS
      { wch: 12 }, // TOTAL
      { wch: 16 }, // DOCUMENT CHARGE
      { wch: 8 }   // COUNT
    );
    wsPnl['!cols'] = pnlColWidths;

    const sheetName = `${(data.branchName || 'POLLACHI').slice(0, 20)} P&L`;
    XLSX.utils.book_append_sheet(wb, wsPnl, sheetName);

    // -------------------------------------------------------------------------
    // SHEET 2: EXPENSES REGISTER (Matching EXPENSES - POLLACHI template)
    // -------------------------------------------------------------------------
    const expData: any[][] = [];
    expData.push([`EXPENSES ${data.periodLabel} - ${data.branchName.toUpperCase()}`]);
    expData.push(['S.NO', 'DATE', 'PARTICULARS', 'AMT', 'REMARKS']);

    let totExp = 0;
    data.expenseRows.forEach((e, idx) => {
      expData.push([idx + 1, e.date, e.particulars, e.amount, e.remarks]);
      totExp += e.amount;
    });

    expData.push([]);
    const expTotalRowIdx = expData.length;
    const expTotalRowNum = expTotalRowIdx + 1;
    expData.push(['', '', 'TOTAL', totExp]);

    const wsExp = XLSX.utils.aoa_to_sheet(expData);
    wsExp['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

    if (data.expenseRows.length > 0) {
      const expTotCell = `D${expTotalRowNum}`;
      wsExp[expTotCell] = {
        t: 'n',
        v: totExp,
        f: `SUM(D3:D${data.expenseRows.length + 2})`
      };
    }

    wsExp['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 30 },
      { wch: 14 },
      { wch: 55 }
    ];
    XLSX.utils.book_append_sheet(wb, wsExp, 'Expenses');

    // -------------------------------------------------------------------------
    // SHEET 3: EXECUTIVE P&L FINANCIAL STATEMENT
    // -------------------------------------------------------------------------
    const stmtData = [
      ['ATHIVEERA MFI - PROFIT & LOSS FINANCIAL STATEMENT'],
      ['Branch Scope:', data.branchName, 'Reporting Period:', data.periodLabel],
      [],
      ['OPERATING INFLOWS & REVENUE', 'AMOUNT (₹)'],
      ['Documentation & Processing Fees (Upfront)', data.summary.revenue.docCharges],
      ['Repayment Interest Realized', data.summary.revenue.interestEarned],
      ['TOTAL OPERATING REVENUE', data.summary.revenue.totalRevenue],
      [],
      ['OPERATING OUTFLOWS & EXPENDITURE', 'AMOUNT (₹)'],
      ['Route Travel & Fuel Reimbursements', data.summary.expenses.fuel],
      ['Branch Rent & Electricity Utilities', data.summary.expenses.rent],
      ['Staff Salaries & Field Incentives', data.summary.expenses.salaries],
      ['Printing, Stationery & General Admin', data.summary.expenses.general],
      ['TOTAL OPERATING EXPENDITURES', data.summary.expenses.totalExpenses],
      [],
      ['NET FINANCIAL PERFORMANCE', 'AMOUNT (₹) / %'],
      ['NET OPERATING PROFIT / SURPLUS', data.summary.netProfit],
      ['OPERATING PROFIT MARGIN', `${data.summary.profitMargin}%`]
    ];

    const wsStmt = XLSX.utils.aoa_to_sheet(stmtData);
    wsStmt['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];

    wsStmt['B7'] = { t: 'n', v: data.summary.revenue.totalRevenue, f: 'SUM(B5:B6)' };
    wsStmt['B14'] = { t: 'n', v: data.summary.expenses.totalExpenses, f: 'SUM(B10:B13)' };
    wsStmt['B17'] = { t: 'n', v: data.summary.netProfit, f: 'B7-B14' };
    wsStmt['B18'] = { t: 's', v: `${data.summary.profitMargin}%` };

    wsStmt['!cols'] = [{ wch: 42 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsStmt, 'P&L Statement');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // 5b. Standalone Expenses Excel Export
  public static async generateExpensesReport(filter: ReportFilter): Promise<Buffer> {
    const data = await this.compileProfitLossData(filter);
    const wb = XLSX.utils.book_new();

    const expData: any[][] = [];
    expData.push([`EXPENSES ${data.periodLabel} - ${data.branchName.toUpperCase()}`]);
    expData.push(['S.NO', 'DATE', 'PARTICULARS', 'AMT', 'REMARKS']);

    let totExp = 0;
    data.expenseRows.forEach((e, idx) => {
      expData.push([idx + 1, e.date, e.particulars, e.amount, e.remarks]);
      totExp += e.amount;
    });

    expData.push([]);
    const expTotalRowIdx = expData.length;
    const expTotalRowNum = expTotalRowIdx + 1;
    expData.push(['', '', 'TOTAL', totExp]);

    const wsExp = XLSX.utils.aoa_to_sheet(expData);
    wsExp['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

    if (data.expenseRows.length > 0) {
      const expTotCell = `D${expTotalRowNum}`;
      wsExp[expTotCell] = {
        t: 'n',
        v: totExp,
        f: `SUM(D3:D${data.expenseRows.length + 2})`
      };
    }

    wsExp['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 30 },
      { wch: 14 },
      { wch: 55 }
    ];
    XLSX.utils.book_append_sheet(wb, wsExp, 'Expenses');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // 6. Branch Wise Report Excel Export
  public static async generateBranchWiseReport(): Promise<Buffer> {
    const branches = await Branch.find({ active: true }).sort({ name: 1 });
    const rows: any[] = [];

    let totalActiveBorrowersAll = 0;
    let totalPortfolioDisbursedAll = 0;
    let totalCollectedAll = 0;
    let totalOutstandingAll = 0;
    let totalExpensesAll = 0;

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

      const overdueRate = outstanding > 0 ? `${Math.round((overdueAmt / outstanding) * 100)}%` : '0%';
      const netContribution = collected - (disbursed + totalExp);

      totalActiveBorrowersAll += activeLoans.length;
      totalPortfolioDisbursedAll += disbursed;
      totalCollectedAll += collected;
      totalOutstandingAll += outstanding;
      totalExpensesAll += totalExp;

      rows.push({
        'Branch Code': b.code,
        'Branch Name': b.name,
        'Cash In Hand (₹)': b.cashBalance || 0,
        'Bank Balance (₹)': b.bankBalance || 0,
        'Active Groups': groups.length,
        'Active Borrowers': activeLoans.length,
        'Total Disbursed (₹)': disbursed,
        'Total Collected (₹)': collected,
        'Total Outstanding (₹)': outstanding,
        'Overdue Amount (₹)': overdueAmt,
        'Overdue %': overdueRate,
        'Operating Expenses (₹)': totalExp,
        'Net Operational Balance (₹)': netContribution
      });
    }

    rows.push({
      'Branch Code': 'CONSOLIDATED',
      'Branch Name': 'ALL BRANCHES CONSOLIDATED',
      'Cash In Hand (₹)': branches.reduce((sum, b) => sum + (b.cashBalance || 0), 0),
      'Bank Balance (₹)': branches.reduce((sum, b) => sum + (b.bankBalance || 0), 0),
      'Active Groups': rows.reduce((sum, r) => sum + (r['Active Groups'] || 0), 0),
      'Active Borrowers': totalActiveBorrowersAll,
      'Total Disbursed (₹)': totalPortfolioDisbursedAll,
      'Total Collected (₹)': totalCollectedAll,
      'Total Outstanding (₹)': totalOutstandingAll,
      'Overdue Amount (₹)': rows.reduce((sum, r) => sum + (r['Overdue Amount (₹)'] || 0), 0),
      'Overdue %': totalOutstandingAll > 0 ? `${Math.round((rows.reduce((sum, r) => sum + (r['Overdue Amount (₹)'] || 0), 0) / totalOutstandingAll) * 100)}%` : '0%',
      'Operating Expenses (₹)': totalExpensesAll,
      'Net Operational Balance (₹)': totalCollectedAll - (totalPortfolioDisbursedAll + totalExpensesAll)
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Branch Wise Performance');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // Legacy Excel Export Helpers (Preserved for compatibility)
  public static async generateCollectionReport(filter: ReportFilter): Promise<Buffer> {
    return this.generateDailyReport(filter);
  }

  public static async generateLoanPortfolioReport(filter: ReportFilter): Promise<Buffer> {
    const query: any = {};
    if (filter.branchId) query.branchId = filter.branchId;

    const loans = await Loan.find(query)
      .populate('customerId', 'name phone area')
      .populate('groupId', 'name collectionDay')
      .populate('branchId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const rows = loans.map((l: any, idx: number) => ({
      'S.No': idx + 1,
      'Loan Number': l.loanNumber,
      'Disbursed Date': new Date(l.disbursedDate).toLocaleDateString('en-IN'),
      'Branch': l.branchId?.name || '',
      'Group': l.groupId?.name || '',
      'Collection Day': l.groupId?.collectionDay || '',
      'Customer': l.customerId?.name || '',
      'Area': l.customerId?.area || '',
      'Principal (₹)': l.principal,
      'Interest (₹)': l.interestAmount,
      'Doc Charges (₹)': l.docCharges,
      'Total Payable (₹)': l.totalPayable,
      'Total Paid (₹)': l.totalPaid,
      'Balance (₹)': l.outstandingTotal,
      'Status': l.status
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Loan Portfolio');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  public static async generatePendingReport(filter: ReportFilter): Promise<Buffer> {
    return this.generatePendingEmiReport(filter);
  }

  public static async generateCashbookReport(filter: ReportFilter): Promise<Buffer> {
    const query: any = {};
    if (filter.branchId) query.branchId = filter.branchId;
    if (filter.startDate || filter.endDate) {
      query.transactionDate = {};
      if (filter.startDate) query.transactionDate.$gte = new Date(filter.startDate);
      if (filter.endDate) query.transactionDate.$lte = new Date(filter.endDate);
    }

    const txs = await CashTransaction.find(query)
      .populate('branchId', 'name')
      .sort({ transactionDate: 1 })
      .lean();

    const rows = txs.map((t: any, idx: number) => ({
      'S.No': idx + 1,
      'Date': new Date(t.transactionDate).toLocaleDateString('en-IN'),
      'Branch': t.branchId?.name || '',
      'Account': t.accountType,
      'Particulars / Category': t.category,
      'V.No': t.vNo || '',
      'Credit (₹)': t.type === 'CREDIT' ? t.amount : 0,
      'Debit (₹)': t.type === 'DEBIT' ? t.amount : 0,
      'Running Balance (₹)': t.runningBalance,
      'Description': t.description || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Cashbook Ledger');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
