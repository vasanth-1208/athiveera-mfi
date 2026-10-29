import XLSX from 'xlsx';
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

export class ReportService {
  // 1. Daily Report Excel Export
  public static async generateDailyReport(filter: ReportFilter): Promise<Buffer> {
    const targetDate = filter.date ? new Date(filter.date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentRows.length > 0 ? paymentRows : [{ 'Info': 'No collections on this date' }]), 'Collections');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(disbRows.length > 0 ? disbRows : [{ 'Info': 'No disbursements on this date' }]), 'Disbursements');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expRows.length > 0 ? expRows : [{ 'Info': 'No expenses on this date' }]), 'Expenses');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // 2. Weekly Report Excel Export
  public static async generateWeeklyReport(filter: ReportFilter): Promise<Buffer> {
    const baseQuery: any = {};
    if (filter.branchId) baseQuery.branchId = filter.branchId;

    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
    const summaryRows: any[] = [];
    const groupRows: any[] = [];

    let totalExp = 0;
    let totalColl = 0;

    for (const day of days) {
      const { startOfDay, endOfDay } = getRouteDateForWeekday(day);
      const groups = await Group.find({ ...baseQuery, collectionDay: day }).sort({ groupCode: 1 });
      let dayExp = 0;
      let dayColl = 0;
      let dayBorrowers = 0;

      for (const grp of groups) {
        const loans = await Loan.find({ groupId: grp._id, status: { $in: ['ACTIVE', 'OVERDUE'] } })
          .populate('customerId', 'name phone');

        const payments = await Payment.find({
          groupId: grp._id,
          paymentDate: { $gte: startOfDay, $lte: endOfDay },
          isReversed: false
        });
        const grpColl = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

        let grpExp = 0;
        for (const l of loans) {
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
          if (!targetInst) {
            targetInst = await Installment.findOne({
              loanId: l._id,
              status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] }
            }).sort({ installmentNumber: 1 });
          }
          grpExp += targetInst ? targetInst.expectedAmount : 0;
        }

        dayExp += grpExp;
        dayColl += grpColl;
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
          'Balance (₹)': Math.max(0, grpExp - grpColl),
          'Status': grpColl >= grpExp && grpExp > 0 ? 'TARGET ACHIEVED' : (grpColl > 0 ? 'PARTIAL' : 'PENDING')
        });
      }

      totalExp += dayExp;
      totalColl += dayColl;

      summaryRows.push({
        'Route Day': day,
        'Scheduled Groups': groups.length,
        'Active Borrowers': dayBorrowers,
        'Target Expected (₹)': dayExp,
        'Collected (₹)': dayColl,
        'Shortfall Balance (₹)': Math.max(0, dayExp - dayColl),
        'Efficiency %': dayExp > 0 ? `${Math.round((dayColl / dayExp) * 100)}%` : (dayColl > 0 ? '100%' : '0%')
      });
    }

    summaryRows.push({
      'Route Day': 'TOTAL / WEEKLY CONSOLIDATED',
      'Scheduled Groups': summaryRows.reduce((sum, s) => sum + (s['Scheduled Groups'] || 0), 0),
      'Active Borrowers': summaryRows.reduce((sum, s) => sum + (s['Active Borrowers'] || 0), 0),
      'Target Expected (₹)': totalExp,
      'Collected (₹)': totalColl,
      'Shortfall Balance (₹)': Math.max(0, totalExp - totalColl),
      'Efficiency %': totalExp > 0 ? `${Math.round((totalColl / totalExp) * 100)}%` : '100%'
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Weekly Summary');
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
    const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const summary = [
      { 'Metric': 'Reporting Month', 'Value': `${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}` },
      { 'Metric': 'Total Loans Disbursed Count', 'Value': loansDisbursed.length },
      { 'Metric': 'Total Principal Disbursed (₹)', 'Value': totalPrincipalDisbursed },
      { 'Metric': 'Documentation & Processing Fees Collected (₹)', 'Value': totalDocCharges },
      { 'Metric': 'Total Repayments Collected (₹)', 'Value': totalCollected },
      { 'Metric': 'Total Operational Expenses (₹)', 'Value': totalExpenses },
      { 'Metric': 'Net Monthly Operating Surplus (₹)', 'Value': (totalCollected + totalDocCharges) - (totalPrincipalDisbursed + totalExpenses) }
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

  // 4. Pending EMI Report Excel Export
  public static async generatePendingEmiReport(filter: ReportFilter): Promise<Buffer> {
    const baseQuery: any = {};
    if (filter.branchId) baseQuery.branchId = filter.branchId;
    if (filter.collectionDay && filter.collectionDay !== 'ALL') {
      baseQuery.collectionDay = filter.collectionDay;
    }

    // Delinquent borrowers from FollowUp & active overdue loans
    const followUps = await FollowUp.find(baseQuery)
      .populate('branchId', 'name')
      .sort({ overdueWeeks: -1 })
      .lean();

    const overdueLoans = await Loan.find({
      ...baseQuery,
      status: { $in: ['ACTIVE', 'OVERDUE'] }
    })
      .populate('customerId', 'name phone nomineePhone area')
      .populate('groupId', 'name collectionDay')
      .populate('branchId', 'name')
      .lean();

    const rows: any[] = [];
    let sNo = 1;

    for (const f of followUps) {
      rows.push({
        'S.No': sNo++,
        'Customer Name': f.customerName,
        'Group Name': f.groupName,
        'Route Day': f.collectionDay,
        'Primary Phone': f.customerPhone,
        'Nominee Phone': f.nomineePhone || '-',
        'Overdue Weeks': f.overdueWeeks || 1,
        'Actual Pending Amount (₹)': f.actualPending,
        'Customer Known Due (₹)': f.customerKnown,
        'Assigned Collector': f.staffName,
        'Staff Notes / Remarks': f.remarks,
        'Status': f.status
      });
    }

    // Add any overdue loans not covered in followUps
    const seenNames = new Set(followUps.map(f => f.customerName?.toLowerCase()));
    for (const l of overdueLoans) {
      const custObj = l.customerId as any;
      const grpObj = l.groupId as any;
      const custName = custObj?.name || l.customerName || '';
      if (!seenNames.has(custName.toLowerCase()) && l.outstandingTotal > 0) {
        rows.push({
          'S.No': sNo++,
          'Customer Name': custName,
          'Group Name': grpObj?.name || l.groupName || '',
          'Route Day': grpObj?.collectionDay || l.collectionDay || 'MONDAY',
          'Primary Phone': custObj?.phone || l.customerPhone || '-',
          'Nominee Phone': l.nomineePhone || '-',
          'Overdue Weeks': 'Overdue Balance',
          'Actual Pending Amount (₹)': l.outstandingTotal,
          'Customer Known Due (₹)': l.outstandingTotal,
          'Assigned Collector': l.assignedStaffName || 'Staff',
          'Staff Notes / Remarks': l.notes || 'Field collection pending',
          'Status': l.status
        });
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Info': 'No pending EMI records found' }]), 'Pending EMI Follow-Up');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // 5. Profit & Loss Report Excel Export
  public static async generateProfitLossReport(filter: ReportFilter): Promise<Buffer> {
    const baseQuery: any = {};
    if (filter.branchId) baseQuery.branchId = filter.branchId;

    const loans = await Loan.find(baseQuery);
    const payments = await Payment.find(baseQuery);
    const expenses = await Expense.find({ ...baseQuery, status: 'APPROVED' });

    // Revenue calculations
    const totalDocCharges = loans.reduce((sum, l) => sum + (l.docCharges || 0), 0);
    // Calculated interest earned from collections:
    const totalInterestCollected = payments.reduce((sum, p) => {
      // Allocate roughly 19% or pro-rated interest
      return sum + Math.round((p.amount || 0) * 0.16);
    }, 0);
    const totalOperatingRevenue = totalDocCharges + totalInterestCollected;

    // Expense breakdowns
    const fuelExpenses = expenses.filter(e => e.category.toLowerCase().includes('fuel') || e.travelKM > 0)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const rentExpenses = expenses.filter(e => e.category.toLowerCase().includes('rent'))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const salaryExpenses = expenses.filter(e => e.category.toLowerCase().includes('salary') || e.category.toLowerCase().includes('incentive'))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const otherExpenses = expenses.filter(e => 
      !e.category.toLowerCase().includes('fuel') && 
      !e.category.toLowerCase().includes('rent') && 
      !e.category.toLowerCase().includes('salary') && 
      !e.category.toLowerCase().includes('incentive') &&
      e.travelKM <= 0
    ).reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalOperatingExpenses = fuelExpenses + rentExpenses + salaryExpenses + otherExpenses;
    const netProfit = totalOperatingRevenue - totalOperatingExpenses;
    const netMarginPercent = totalOperatingRevenue > 0 ? Math.round((netProfit / totalOperatingRevenue) * 100) : 0;

    const plRows = [
      { 'Category': 'OPERATING REVENUE (INCOME)', 'Subcategory': 'Documentation & Processing Fees', 'Amount (₹)': totalDocCharges },
      { 'Category': 'OPERATING REVENUE (INCOME)', 'Subcategory': 'Repayment Interest Earned', 'Amount (₹)': totalInterestCollected },
      { 'Category': 'OPERATING REVENUE (INCOME)', 'Subcategory': 'TOTAL OPERATING REVENUE', 'Amount (₹)': totalOperatingRevenue },
      { 'Category': '---', 'Subcategory': '---', 'Amount (₹)': 0 },
      { 'Category': 'OPERATING EXPENSES (OUTFLOW)', 'Subcategory': 'Route Travel & Fuel Reimbursements', 'Amount (₹)': fuelExpenses },
      { 'Category': 'OPERATING EXPENSES (OUTFLOW)', 'Subcategory': 'Branch Rent & Utilities', 'Amount (₹)': rentExpenses },
      { 'Category': 'OPERATING EXPENSES (OUTFLOW)', 'Subcategory': 'Staff Salaries & Incentives', 'Amount (₹)': salaryExpenses },
      { 'Category': 'OPERATING EXPENSES (OUTFLOW)', 'Subcategory': 'Stationery, Printing & General Overheads', 'Amount (₹)': otherExpenses },
      { 'Category': 'OPERATING EXPENSES (OUTFLOW)', 'Subcategory': 'TOTAL OPERATING EXPENSES', 'Amount (₹)': totalOperatingExpenses },
      { 'Category': '---', 'Subcategory': '---', 'Amount (₹)': 0 },
      { 'Category': 'NET OPERATING PROFIT / SURPLUS', 'Subcategory': `Operating Margin: ${netMarginPercent}%`, 'Amount (₹)': netProfit }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(plRows), 'Profit & Loss Statement');
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
