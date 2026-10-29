import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { Branch } from '../models/Branch';
import { Customer } from '../models/Customer';
import { Group } from '../models/Group';
import { Loan } from '../models/Loan';
import { Installment } from '../models/Installment';
import { Payment } from '../models/Payment';
import { FollowUp } from '../models/FollowUp';
import { Expense } from '../models/Expense';
import { BranchTransfer } from '../models/BranchTransfer';
import { CashTransaction } from '../models/CashTransaction';
import { AuditLog } from '../models/AuditLog';
import { calculateLoanSchedule } from './loanCalculator';

export interface ImportPreviewResult {
  summary: {
    groupsCount: number;
    customersCount: number;
    loansCount: number;
    pendingCount: number;
    expensesCount: number;
    transfersCount: number;
    flaggedIssuesCount: number;
  };
  sampleGroups: any[];
  sampleCustomers: any[];
  samplePending: any[];
  discrepancies: Array<{
    source: string;
    type: 'WARNING' | 'ERROR' | 'INFO';
    message: string;
    details?: any;
  }>;
}

export interface ImportExecutionResult {
  importedGroups: number;
  importedCustomers: number;
  importedLoans: number;
  importedInstallments: number;
  importedPayments: number;
  importedPending: number;
  importedExpenses: number;
  importedTransfers: number;
  skippedDuplicates: number;
  warnings: string[];
}

export function parseExcelDate(val: any): Date {
  if (!val) return new Date();

  // If already a Date object (e.g. from SheetJS cellDates: true)
  if (val instanceof Date && !isNaN(val.getTime())) {
    const adj = new Date(val.getTime() + 6 * 3600 * 1000);
    return new Date(Date.UTC(adj.getUTCFullYear(), adj.getUTCMonth(), adj.getUTCDate(), 12, 0, 0));
  }

  // If Excel serial number
  if (typeof val === 'number') {
    const p = XLSX.SSF.parse_date_code(val);
    if (p && p.y) {
      return new Date(Date.UTC(p.y, p.m - 1, p.d, 12, 0, 0));
    }
  }

  const str = String(val).trim();
  // Match ISO YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[\.\-\/](\d{1,2})[\.\-\/](\d{1,2})/);
  if (isoMatch) {
    return new Date(Date.UTC(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]), 12, 0, 0));
  }

  // Match DD.MM.YY, DD-MM-YYYY, MM/DD/YY, etc.
  const match = str.match(/^(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{2,4})/);
  if (match) {
    let p1 = parseInt(match[1]);
    let p2 = parseInt(match[2]);
    let p3 = parseInt(match[3]);
    let year = p3 < 100 ? (p3 > 50 ? 1900 + p3 : 2000 + p3) : p3;
    let day = p1;
    let month = p2;
    if (str.includes('/') && p1 <= 12 && p2 > 12) {
      month = p1;
      day = p2;
    }
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const adj = new Date(parsed.getTime() + 6 * 3600 * 1000);
    return new Date(Date.UTC(adj.getUTCFullYear(), adj.getUTCMonth(), adj.getUTCDate(), 12, 0, 0));
  }
  return new Date();
}

export class ImportEngine {
  private sourceDir: string;

  constructor(sourceDir?: string) {
    if (sourceDir && fs.existsSync(path.join(sourceDir, 'OVER ALL.xlsx'))) {
      this.sourceDir = sourceDir;
    } else {
      const candidates = [
        path.join(__dirname, '..', '..', '..', 'data', 'source_files'),
        path.join(process.cwd(), 'data', 'source_files'),
        path.join(process.cwd(), '..', 'data', 'source_files'),
        path.join(process.cwd()),
        path.join(__dirname, '..', '..', '..')
      ];
      this.sourceDir = candidates.find(c => fs.existsSync(path.join(c, 'OVER ALL.xlsx'))) || path.join(process.cwd(), 'data', 'source_files');
    }
  }

  public async preview(): Promise<ImportPreviewResult> {
    const discrepancies: ImportPreviewResult['discrepancies'] = [];
    const sampleGroups: any[] = [];
    const sampleCustomers: any[] = [];
    const samplePending: any[] = [];

    let groupsCount = 0;
    let customersCount = 0;
    let loansCount = 0;
    let pendingCount = 0;
    let expensesCount = 0;
    let transfersCount = 0;

    const weekdayFiles = ['MONDAY.xlsx', 'TUESDAY.xlsx', 'WEDNESDAY.xlsx', 'THURSDAY.xlsx'];

    for (const file of weekdayFiles) {
      const filePath = path.join(this.sourceDir, file);
      if (!fs.existsSync(filePath)) {
        discrepancies.push({
          source: file,
          type: 'ERROR',
          message: `File ${file} does not exist at ${filePath}`
        });
        continue;
      }

      const dayName = file.replace('.xlsx', '');
      const wb = XLSX.readFile(filePath, { cellFormula: true, cellDates: true });
      const summarySheet = wb.Sheets[dayName];

      if (summarySheet) {
        const sdata = XLSX.utils.sheet_to_json(summarySheet, { header: 1, raw: false, defval: '' }) as any[][];
        for (let i = 3; i < sdata.length; i++) {
          const r = sdata[i];
          if (r[1] && String(r[1]).includes('GROUP')) {
            groupsCount++;
            if (sampleGroups.length < 5) {
              sampleGroups.push({
                day: dayName,
                name: r[1],
                head: r[2],
                phone: r[3],
                members: r[5],
                area: r[12],
                staff: r[13]
              });
            }
          }
        }
      }

      // Group sheets
      const groupSheetNames = wb.SheetNames.filter(n => n !== dayName);
      for (const gname of groupSheetNames) {
        const gsheet = wb.Sheets[gname];
        const gdata = XLSX.utils.sheet_to_json(gsheet, { header: 1, raw: false, defval: '' }) as any[][];
        for (let r = 1; r < gdata.length; r++) {
          const row = gdata[r];
          const memberName = row[9] ? String(row[9]).trim() : '';
          const phone = row[10] ? String(row[10]).trim() : '';
          const loanAmt = parseFloat(row[11]) || 0;

          if (memberName && memberName !== 'GROUP MEMBERS' && !memberName.includes('TOTAL')) {
            customersCount++;
            loansCount++;
            if (sampleCustomers.length < 5) {
              sampleCustomers.push({
                group: gname,
                name: memberName,
                phone,
                loanAmt,
                nominee: row[19] || ''
              });
            }
          }
        }
      }
    }

    // Check PENDING.xlsx
    const pendingPath = path.join(this.sourceDir, 'PENDING.xlsx');
    if (fs.existsSync(pendingPath)) {
      const pwb = XLSX.readFile(pendingPath);
      const psheet = pwb.Sheets['PENDING'] || pwb.Sheets[pwb.SheetNames[0]];
      const pdata = XLSX.utils.sheet_to_json(psheet, { header: 1, raw: false, defval: '' }) as any[][];
      for (let i = 0; i < pdata.length; i++) {
        const r = pdata[i];
        if (r[2] && r[3] && !String(r[2]).includes('NAME') && !String(r[2]).includes('TOTAL')) {
          pendingCount++;
          if (samplePending.length < 5) {
            samplePending.push({
              name: r[2],
              group: r[3],
              actualPending: r[7],
              customerKnown: r[8],
              staff: r[9],
              remarks: r[10]
            });
          }
        }
      }
    }

    // Check Z LEDGER NOTE BOOK.xlsx
    const ledgerPath = path.join(this.sourceDir, 'Z LEDGER NOTE BOOK.xlsx');
    if (fs.existsSync(ledgerPath)) {
      const lwb = XLSX.readFile(ledgerPath);
      const expSheet = lwb.Sheets['EXPENSES'];
      if (expSheet) {
        const edata = XLSX.utils.sheet_to_json(expSheet, { header: 1, raw: false, defval: '' }) as any[][];
        expensesCount = Math.max(0, edata.length - 4);
      }
      const transferSheet = lwb.Sheets['CASH TRANFER'];
      if (transferSheet) {
        const tdata = XLSX.utils.sheet_to_json(transferSheet, { header: 1, raw: false, defval: '' }) as any[][];
        transfersCount = Math.max(0, tdata.length - 4);
      }
    }

    return {
      summary: {
        groupsCount,
        customersCount,
        loansCount,
        pendingCount,
        expensesCount,
        transfersCount,
        flaggedIssuesCount: discrepancies.length
      },
      sampleGroups,
      sampleCustomers,
      samplePending,
      discrepancies
    };
  }

  public async execute(adminUserId: string): Promise<ImportExecutionResult> {
    const result: ImportExecutionResult = {
      importedGroups: 0,
      importedCustomers: 0,
      importedLoans: 0,
      importedInstallments: 0,
      importedPayments: 0,
      importedPending: 0,
      importedExpenses: 0,
      importedTransfers: 0,
      skippedDuplicates: 0,
      warnings: []
    };

    // 1. Ensure Branches exist
    let pollachiBranch = await Branch.findOne({ code: 'POLLACHI' });
    if (!pollachiBranch) {
      pollachiBranch = await Branch.create({
        code: 'POLLACHI',
        name: 'Pollachi Branch',
        address: 'Main Road, Pollachi, Tamil Nadu',
        phone: '+91 9500485596',
        cashBalance: 0,
        bankBalance: 0
      });
    }

    let mdkmBranch = await Branch.findOne({ code: 'MDKM' });
    if (!mdkmBranch) {
      mdkmBranch = await Branch.create({
        code: 'MDKM',
        name: 'Madathukulam Branch',
        address: 'Madathukulam, Tamil Nadu',
        phone: '+91 9659117240',
        cashBalance: 0,
        bankBalance: 0
      });
    }

    const branchId = pollachiBranch._id;

    // Cache of groups and customers to prevent duplication
    const groupMap = new Map<string, any>();
    const customerMap = new Map<string, any>();

    const weekdayFiles = ['MONDAY.xlsx', 'TUESDAY.xlsx', 'WEDNESDAY.xlsx', 'THURSDAY.xlsx'];

    for (const file of weekdayFiles) {
      const filePath = path.join(this.sourceDir, file);
      if (!fs.existsSync(filePath)) continue;

      const dayName = file.replace('.xlsx', '');
      const wb = XLSX.readFile(filePath, { cellFormula: true, cellDates: true });
      const summarySheet = wb.Sheets[dayName];

      // Parse summary groups
      if (summarySheet) {
        const sdata = XLSX.utils.sheet_to_json(summarySheet, { header: 1, raw: false, defval: '' }) as any[][];
        for (let i = 3; i < sdata.length; i++) {
          const r = sdata[i];
          const rawGroupName = r[1] ? String(r[1]).trim() : '';
          if (!rawGroupName || !rawGroupName.includes('GROUP')) continue;

          // Match group code number, e.g. "KANDHAN GROUP - 13" -> 13
          const codeMatch = rawGroupName.match(/(\d+)/);
          const groupCode = codeMatch ? parseInt(codeMatch[1]) : i;
          const cycle = rawGroupName.includes(' 2 ') || rawGroupName.includes(' 2 GROUP') ? 2 : 1;

          let group = await Group.findOne({ name: rawGroupName, branchId });
          if (!group) {
            group = await Group.create({
              groupCode,
              name: rawGroupName,
              branchId,
              headName: r[2] ? String(r[2]).trim() : '',
              headPhone: r[3] ? String(r[3]).trim() : '',
              collectionDay: dayName as any,
              area: r[12] ? String(r[12]).trim() : '',
              staffName: r[13] ? String(r[13]).trim() : '',
              cycle,
              status: (r[9] && parseFloat(r[9]) === 0) ? 'CLOSED' : 'LIVE',
              totalMembers: parseInt(r[5]) || 0
            });
            result.importedGroups++;
          }
          groupMap.set(rawGroupName, group);
        }
      }

      // Parse group member sheets
      const groupSheetNames = wb.SheetNames.filter(n => n !== dayName);
      for (const gname of groupSheetNames) {
        let group = groupMap.get(gname);
        if (!group) {
          group = await Group.findOne({ name: gname, branchId });
          if (!group) {
            const codeMatch = gname.match(/(\d+)/);
            const groupCode = codeMatch ? parseInt(codeMatch[1]) : 1;
            group = await Group.create({
              groupCode,
              name: gname,
              branchId,
              collectionDay: dayName as any,
              cycle: gname.includes(' 2 ') ? 2 : 1,
              status: 'LIVE'
            });
            result.importedGroups++;
          }
          groupMap.set(gname, group);
        }

        const gsheet = wb.Sheets[gname];
        const gdata = XLSX.utils.sheet_to_json(gsheet, { header: 1, raw: false, defval: '' }) as any[][];

        // Process members and their loans
        for (let r = 1; r < gdata.length; r++) {
          const row = gdata[r];
          const memberName = row[9] ? String(row[9]).trim() : '';
          const phone = row[10] ? String(row[10]).trim() : '';
          const loanPrincipal = parseFloat(row[11]) || 0;

          if (!memberName || memberName === 'GROUP MEMBERS' || memberName.includes('TOTAL') || loanPrincipal <= 0) {
            continue;
          }

          const customerKey = `${memberName.toLowerCase()}_${phone || 'no_phone'}`;
          let customer = customerMap.get(customerKey);
          if (!customer) {
            customer = await Customer.findOne({ name: memberName, phone });
            if (!customer) {
              const custSeq = (await Customer.countDocuments()) + 1;
              const customerId = `ATH-CUST-${String(custSeq).padStart(4, '0')}`;
              customer = await Customer.create({
                customerId,
                name: memberName,
                phone: phone !== '-------' ? phone : '',
                nomineePhone: row[19] || row[20] || '',
                area: group.area || '',
                branchId,
                activeGroupId: group._id,
                status: 'ACTIVE'
              });
              result.importedCustomers++;
            } else if (group.status === 'LIVE' || group.cycle > 1) {
              customer.activeGroupId = group._id;
              customer.status = 'ACTIVE';
              await customer.save();
            }
            customerMap.set(customerKey, customer);
          }

          // Loan creation
          const loanNumber = `ATH-LN-${group.groupCode}-${customer.customerId}`;
          let loan = await Loan.findOne({ loanNumber });
          if (!loan) {
            const loanCalc = calculateLoanSchedule({
              principal: loanPrincipal,
              startDate: parseExcelDate(row[8]),
              collectionDay: dayName as any
            });

            loan = await Loan.create({
              loanNumber,
              customerId: customer._id,
              groupId: group._id,
              branchId,
              cycle: group.cycle,
              productType: loanCalc.productType,
              principal: loanPrincipal,
              interestRate: loanCalc.interestRate,
              interestAmount: loanCalc.interestAmount,
              docCharges: loanCalc.docCharges,
              savingsAmount: loanCalc.savingsAmount,
              totalPayable: loanCalc.totalPayable,
              tenureWeeks: loanCalc.tenureWeeks,
              repaymentFrequency: 'WEEKLY',
              disbursedDate: parseExcelDate(row[8]),
              status: group.status === 'CLOSED' ? 'CLOSED' : 'ACTIVE',
              outstandingPrincipal: group.status === 'CLOSED' ? 0 : loanPrincipal,
              outstandingInterest: group.status === 'CLOSED' ? 0 : loanCalc.interestAmount,
              outstandingTotal: group.status === 'CLOSED' ? 0 : loanCalc.totalPayable,
              totalPaid: group.status === 'CLOSED' ? loanCalc.totalPayable : 0
            });
            result.importedLoans++;

            // Create installments in batch
            const loanId = loan._id;
            const installmentDocs = loanCalc.schedule.map(item => ({
              loanId,
              customerId: customer._id,
              groupId: group._id,
              branchId,
              installmentNumber: item.installmentNumber,
              dueDate: item.dueDate,
              expectedAmount: item.expectedAmount,
              allocatedPrincipal: item.allocatedPrincipal,
              allocatedInterest: item.allocatedInterest,
              allocatedSavings: item.allocatedSavings,
              paidAmount: group.status === 'CLOSED' ? item.expectedAmount : 0,
              balanceAmount: group.status === 'CLOSED' ? 0 : item.expectedAmount,
              status: group.status === 'CLOSED' ? 'PAID' : 'PENDING'
            }));
            await Installment.insertMany(installmentDocs);
            result.importedInstallments += installmentDocs.length;
          } else {
            result.skippedDuplicates++;
          }
        }
      }
    }

    // 2. Import PENDING.xlsx
    const pendingPath = path.join(this.sourceDir, 'PENDING.xlsx');
    if (fs.existsSync(pendingPath)) {
      const pwb = XLSX.readFile(pendingPath);
      const psheet = pwb.Sheets['PENDING'] || pwb.Sheets[pwb.SheetNames[0]];
      const pdata = XLSX.utils.sheet_to_json(psheet, { header: 1, raw: false, defval: '' }) as any[][];

      let currentDay = '';
      for (let i = 0; i < pdata.length; i++) {
        const r = pdata[i];
        if (r[0] && String(r[0]).includes('MONDAY')) currentDay = 'MONDAY';
        else if (r[0] && String(r[0]).includes('TUESDAY')) currentDay = 'TUESDAY';
        else if (r[0] && String(r[0]).includes('WEDNESDAY')) currentDay = 'WEDNESDAY';
        else if (r[0] && String(r[0]).includes('THURSDAY')) currentDay = 'THURSDAY';

        const custName = r[2] ? String(r[2]).trim() : '';
        const grpName = r[3] ? String(r[3]).trim() : '';
        const actualPending = parseFloat(r[7]) || 0;
        const customerKnown = parseFloat(r[8]) || actualPending;

        if (custName && grpName && !custName.includes('NAME') && !custName.includes('TOTAL') && actualPending > 0) {
          const cust = await Customer.findOne({ name: new RegExp(custName, 'i') });
          const grp = await Group.findOne({ name: new RegExp(grpName, 'i') });

          await FollowUp.create({
            customerId: cust ? cust._id : new mongoose.Types.ObjectId(),
            customerName: custName,
            customerPhone: r[4] ? String(r[4]).trim() : '',
            nomineePhone: r[5] ? String(r[5]).trim() : '',
            groupId: grp ? grp._id : null,
            groupName: grpName,
            branchId,
            collectionDay: currentDay,
            actualPending,
            customerKnown,
            overdueWeeks: parseInt(r[6]) || 1,
            staffName: r[9] ? String(r[9]).trim() : '',
            remarks: r[10] ? String(r[10]).trim() : '',
            status: 'PENDING'
          });
          result.importedPending++;
        }
      }
    }

    // 3. Import Z LEDGER NOTE BOOK.xlsx
    const ledgerPath = path.join(this.sourceDir, 'Z LEDGER NOTE BOOK.xlsx');
    if (fs.existsSync(ledgerPath)) {
      const lwb = XLSX.readFile(ledgerPath, { cellDates: true });

      // Expenses
      const expSheet = lwb.Sheets['EXPENSES'];
      if (expSheet) {
        const edata = XLSX.utils.sheet_to_json(expSheet, { header: 1, raw: false, defval: '' }) as any[][];
        for (let i = 3; i < edata.length; i++) {
          const r = edata[i];
          const cat = r[2] ? String(r[2]).trim() : '';
          const amt = parseFloat(r[3]) || 0;
          if (cat && amt > 0 && !cat.includes('TOTAL')) {
            await Expense.create({
              branchId,
              expenseDate: parseExcelDate(r[1]),
              category: cat,
              amount: amt,
              description: r[5] ? String(r[5]).trim() : '',
              billRef: r[4] ? String(r[4]).trim() : '',
              paymentMethod: 'CASH',
              status: 'APPROVED'
            });
            result.importedExpenses++;
          }
        }
      }

      // Branch Transfers
      const transferSheet = lwb.Sheets['CASH TRANFER'];
      if (transferSheet) {
        const tdata = XLSX.utils.sheet_to_json(transferSheet, { header: 1, raw: false, defval: '' }) as any[][];
        for (let i = 2; i < tdata.length; i++) {
          const r = tdata[i];
          const sNo = parseInt(String(r[0]));
          if (isNaN(sNo) || sNo < 1 || sNo > 84) continue; // Skip non-canonical rows and total sum rows

          const recAmt = parseFloat(String(r[3]).replace(/,/g, '')) || 0;
          const paidAmt = parseFloat(String(r[4]).replace(/,/g, '')) || 0;
          const amt = recAmt || paidAmt;
          if (amt > 0) {
            const isReceived = recAmt > 0;
            const purposeStr = r[5] ? String(r[5]).trim() : (isReceived ? 'Cash received from MDKM Branch' : 'Cash transfer to MDKM Branch');
            await BranchTransfer.create({
              transferNumber: `ATH-TRF-${String(sNo).padStart(5, '0')}`,
              sourceBranchId: isReceived ? mdkmBranch._id : pollachiBranch._id,
              destinationBranchId: isReceived ? pollachiBranch._id : mdkmBranch._id,
              transferDate: parseExcelDate(r[1]),
              amount: amt,
              purpose: purposeStr,
              status: 'COMPLETED'
            });
            result.importedTransfers++;
          }
        }
      }
    }

    // Record audit log
    await AuditLog.create({
      userId: adminUserId && mongoose.Types.ObjectId.isValid(adminUserId) ? new mongoose.Types.ObjectId(adminUserId) : null,
      userName: 'Admin',
      branchId,
      action: 'EXCEL_HISTORICAL_IMPORT',
      entityType: 'MIGRATION',
      details: result
    });

    return result;
  }
}
