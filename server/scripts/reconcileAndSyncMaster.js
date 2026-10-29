const mongoose = require('mongoose');
const path = require('path');
const XLSX = require('xlsx');
require('dotenv').config({ path: 'server/.env' });

function parseDateCell(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const adj = new Date(val.getTime() + 6 * 3600 * 1000);
    let y = adj.getUTCFullYear();
    if (y > 2050) y -= 100;
    if (y < 2020) y = 2026;
    return new Date(Date.UTC(y, adj.getUTCMonth(), adj.getUTCDate(), 12, 0, 0));
  }
  if (typeof val === 'number') {
    const p = XLSX.SSF.parse_date_code(val);
    if (p && p.y) {
      let y = p.y;
      if (y > 2050) y -= 100;
      if (y < 2020) y = 2026;
      return new Date(Date.UTC(y, p.m - 1, p.d, 12, 0, 0));
    }
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[\.\-\/](\d{1,2})[\.\-\/](\d{2,4})/);
  if (m) {
    let day = parseInt(m[1], 10);
    let month = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year = 2000 + year;
    if (year > 2050) year -= 100;
    if (year < 2020) year = 2026;
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }
  return null;
}

function extractSheetDatesRobust(ws) {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const sheetDates = new Map();
  let sheetLoanDate = null;

  for (let r = 0; r < Math.min(3, data.length); r++) {
    const row = data[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (typeof row[c] === 'number' && row[c] >= 40000 && row[c] <= 50000) {
        const d = parseDateCell(row[c]);
        if (d && !sheetLoanDate) sheetLoanDate = d;
      }
    }
  }

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;

    for (let c = 0; c < Math.min(6, row.length); c++) {
      const cellVal = row[c];
      let weekNum = null;

      if (typeof cellVal === 'number' && cellVal >= 1 && cellVal <= 65) {
        weekNum = cellVal;
      } else if (typeof cellVal === 'string') {
        const m = cellVal.trim().match(/^(\d+)(?:st|nd|rd|th)?\s+installment/i);
        if (m) weekNum = parseInt(m[1], 10);
      }

      if (weekNum !== null && !sheetDates.has(weekNum)) {
        const candidates = [row[c - 1], row[c + 1], row[c + 2]];
        for (const cand of candidates) {
          const d = parseDateCell(cand);
          if (d) {
            sheetDates.set(weekNum, d);
            break;
          }
        }
      }
    }
  }

  return { sheetDates, sheetLoanDate };
}

async function reconcileAndSync() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('Connected to database.');

  const baseDir = path.join(process.cwd(), 'data', 'source_files');
  const weekdayWbs = {
    MONDAY: XLSX.readFile(path.join(baseDir, 'MONDAY.xlsx')),
    TUESDAY: XLSX.readFile(path.join(baseDir, 'TUESDAY.xlsx')),
    WEDNESDAY: XLSX.readFile(path.join(baseDir, 'WEDNESDAY.xlsx')),
    THURSDAY: XLSX.readFile(path.join(baseDir, 'THURSDAY.xlsx'))
  };

  const groups = await db.collection('groups').find({}).sort({ groupCode: 1 }).toArray();
  const allLoans = await db.collection('loans').find({}).toArray();
  const allInsts = await db.collection('installments').find({}).sort({ installmentNumber: 1 }).toArray();

  console.log(`Auditing and synchronizing ${groups.length} groups, ${allLoans.length} loans, ${allInsts.length} installments...`);

  // Index installments by loanId
  const loanInstMap = new Map();
  for (const ins of allInsts) {
    const lId = String(ins.loanId);
    if (!loanInstMap.has(lId)) loanInstMap.set(lId, []);
    loanInstMap.get(lId).push(ins);
  }

  const instOps = [];
  const payOps = [];
  const loanOps = [];

  for (const grp of groups) {
    const gCode = grp.groupCode;
    const gName = grp.name;
    const rDay = grp.collectionDay;
    const wb = weekdayWbs[rDay];

    if (!wb) continue;

    const cleanG = gName.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    let sheetMatch = wb.SheetNames.find(n => n.replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanG)
      || wb.SheetNames.find(n => {
        const m = n.match(/\b\d+\b/);
        return m && parseInt(m[0], 10) === gCode;
      });

    if (!sheetMatch && gCode === 55) {
      sheetMatch = wb.SheetNames.find(n => n.includes('54') && n.includes('SOUNDAMMAN'));
    }

    let sheetDates = new Map();
    let sheetLoanDate = null;

    if (sheetMatch) {
      const res = extractSheetDatesRobust(wb.Sheets[sheetMatch]);
      sheetDates = res.sheetDates;
      sheetLoanDate = res.sheetLoanDate;
    }

    // Anchor Wednesday live groups to exact 28.10.2026 for today's collection
    const wednesdayAnchors = {
      48: 21, 51: 20, 54: 18, 55: 18, 56: 17, 57: 17,
      61: 16, 67: 13, 68: 13, 74: 10, 79: 9, 85: 6, 93: 3
    };

    if (rDay === 'WEDNESDAY' && wednesdayAnchors[gCode]) {
      const targetW = wednesdayAnchors[gCode];
      const todayDate = new Date('2026-10-28T12:00:00.000Z');
      sheetDates.set(targetW, todayDate);
    }

    // Anchor Tuesday live groups to exact 27.10.2026 for Tuesday's collection
    const tuesdayAnchors = {
      38: 26, 39: 26, 41: 25, 45: 23, 50: 20, 53: 19,
      58: 17, 78: 9, 84: 6, 86: 5, 87: 5, 90: 4, 91: 3, 95: 1, 96: 1
    };

    if (rDay === 'TUESDAY' && tuesdayAnchors[gCode]) {
      const targetW = tuesdayAnchors[gCode];
      const tueDate = new Date('2026-10-27T12:00:00.000Z');
      sheetDates.set(targetW, tueDate);
    }

    // Anchor Monday live groups to exact 26.10.2026 for Monday's collection
    const mondayAnchors = {
      36: 26, 40: 25, 46: 22, 49: 20, 62: 16, 64: 15,
      65: 14, 66: 14, 70: 12, 72: 11, 76: 9, 77: 9,
      81: 7, 89: 4, 94: 2, 97: 1
    };

    if (rDay === 'MONDAY' && mondayAnchors[gCode]) {
      const targetW = mondayAnchors[gCode];
      const monDate = new Date('2026-10-26T12:00:00.000Z');
      sheetDates.set(targetW, monDate);
    }

    // Process loans for this group
    const loans = allLoans.filter(l => String(l.groupId) === String(grp._id));

    for (const loan of loans) {
      const insts = loanInstMap.get(String(loan._id)) || [];
      if (insts.length === 0) continue;

      let anchorDate = sheetDates.get(1);
      let anchorWeek = 1;
      if (!anchorDate) {
        for (let w = 1; w <= insts.length; w++) {
          if (sheetDates.has(w)) {
            anchorDate = sheetDates.get(w);
            anchorWeek = w;
            break;
          }
        }
      }

      if (!anchorDate) {
        anchorDate = insts[0].dueDate ? new Date(insts[0].dueDate) : new Date('2026-05-01T12:00:00.000Z');
        anchorWeek = 1;
      }

      let prevDate = null;
      let totalPaidCalc = 0;
      let outstandingTotalCalc = 0;
      let outstandingPrincipalCalc = 0;
      let outstandingInterestCalc = 0;

      for (const ins of insts) {
        const w = ins.installmentNumber;
        let finalDueDate = sheetDates.get(w);

        if (!finalDueDate) {
          if (prevDate) {
            finalDueDate = new Date(prevDate.getTime() + 7 * 86400 * 1000);
          } else {
            finalDueDate = new Date(anchorDate.getTime() + (w - anchorWeek) * 7 * 86400 * 1000);
          }
        }
        prevDate = finalDueDate;

        finalDueDate = new Date(Date.UTC(
          finalDueDate.getUTCFullYear(),
          finalDueDate.getUTCMonth(),
          finalDueDate.getUTCDate(),
          12, 0, 0
        ));

        let updateFields = {
          dueDate: finalDueDate,
          updatedAt: new Date()
        };

        if (ins.status === 'PAID') {
          updateFields.paidDate = finalDueDate;
          totalPaidCalc += (ins.paidAmount || ins.expectedAmount);
        } else {
          outstandingTotalCalc += (ins.balanceAmount || ins.expectedAmount);
          if (ins.paidAmount > 0 && ins.expectedAmount > 0) {
            const ratio = (ins.balanceAmount || 0) / ins.expectedAmount;
            outstandingPrincipalCalc += Math.round((ins.allocatedPrincipal || 0) * ratio);
            outstandingInterestCalc += Math.round((ins.allocatedInterest || 0) * ratio);
          } else {
            outstandingPrincipalCalc += (ins.allocatedPrincipal || 0);
            outstandingInterestCalc += (ins.allocatedInterest || 0);
          }
        }

        instOps.push({
          updateOne: {
            filter: { _id: ins._id },
            update: { $set: updateFields }
          }
        });

        if (ins.status === 'PAID' || ins.paidAmount > 0) {
          const rcpt = `RCP-${loan.loanNumber}-W${w}`;
          const amt = ins.paidAmount || ins.expectedAmount;
          payOps.push({
            updateOne: {
              filter: { receiptNumber: rcpt },
              update: {
                $set: {
                  receiptNumber: rcpt,
                  loanId: loan._id,
                  customerId: loan.customerId,
                  groupId: grp._id,
                  branchId: loan.branchId,
                  installmentId: ins._id,
                  paymentDate: finalDueDate,
                  amount: amt,
                  paymentMethod: 'CASH',
                  isReversed: false,
                  allocations: [
                    {
                      installmentId: ins._id,
                      installmentNumber: w,
                      amount: amt,
                      principalPortion: ins.allocatedPrincipal || 0,
                      interestPortion: ins.allocatedInterest || 0,
                      savingsPortion: ins.allocatedSavings || 0
                    }
                  ],
                  updatedAt: new Date()
                },
                $setOnInsert: {
                  createdAt: finalDueDate,
                  remarks: `Master Ledger Installment #${w}`
                }
              },
              upsert: true
            }
          });
        }
      }

      const isClosed = outstandingTotalCalc === 0 || loan.status === 'CLOSED';
      loanOps.push({
        updateOne: {
          filter: { _id: loan._id },
          update: {
            $set: {
              totalPaid: totalPaidCalc,
              outstandingTotal: isClosed ? 0 : outstandingTotalCalc,
              outstandingPrincipal: isClosed ? 0 : outstandingPrincipalCalc,
              outstandingInterest: isClosed ? 0 : outstandingInterestCalc,
              status: isClosed ? 'CLOSED' : 'ACTIVE',
              updatedAt: new Date()
            }
          }
        }
      });
    }
  }

  console.log(`Executing bulkWrite: ${instOps.length} installments, ${payOps.length} payments, ${loanOps.length} loans...`);

  // Bulk write in chunks of 2,000 for maximum throughput
  const chunkSize = 2000;
  for (let i = 0; i < instOps.length; i += chunkSize) {
    await db.collection('installments').bulkWrite(instOps.slice(i, i + chunkSize), { ordered: false });
  }
  for (let i = 0; i < payOps.length; i += chunkSize) {
    await db.collection('payments').bulkWrite(payOps.slice(i, i + chunkSize), { ordered: false });
  }
  for (let i = 0; i < loanOps.length; i += chunkSize) {
    await db.collection('loans').bulkWrite(loanOps.slice(i, i + chunkSize), { ordered: false });
  }

  console.log('Bulk write completed successfully.');

  // Expenses & Negative adjustments
  console.log('Reconciling expenses...');
  const pollachiBranch = await db.collection('branches').findOne({ code: 'POLLACHI' });
  const branchId = pollachiBranch._id;

  const negativeEntries = [
    {
      category: 'ELECTRICAL MAINTENANCE',
      amount: -500,
      description: 'FAN REGULATER RETURN - KUMARAN KARP INDIA PRIVATE LIMITED (Purchase Return)',
      expenseDate: new Date('2025-11-20T12:00:00.000Z'),
      billRef: 'RET-001'
    },
    {
      category: 'FORM CANCELLATION CHARGE',
      amount: -40,
      description: 'THAMARAI GROUP KALIYAMMAL FORM CANCELLATION CHARGE RECD (Recovery Credit)',
      expenseDate: new Date('2025-11-23T12:00:00.000Z'),
      billRef: 'REC-001'
    },
    {
      category: 'OFFICE RENT',
      amount: -18000,
      description: 'SIVAKUMAR - OFFICE RENT NOT DEBITED IN CURRENT ACCOUNT SO RE-ENTRY PURPOSE (Debit Reversal)',
      expenseDate: new Date('2026-04-29T12:00:00.000Z'),
      billRef: 'REV-001'
    },
    {
      category: 'FORM CANCELLATION CHARGE',
      amount: -40,
      description: 'SOUNDAMMAN GROUP TAMILARASI FORM CANCELLATION CHARGE RECD (Recovery Credit)',
      expenseDate: new Date('2026-06-08T12:00:00.000Z'),
      billRef: 'REC-002'
    }
  ];

  for (const neg of negativeEntries) {
    await db.collection('expenses').updateOne(
      { description: neg.description },
      {
        $set: {
          branchId,
          expenseDate: neg.expenseDate,
          category: neg.category,
          amount: neg.amount,
          description: neg.description,
          billRef: neg.billRef,
          travelKM: 0,
          fuelRate: 2.16,
          staffName: '',
          paymentMethod: 'CASH',
          status: 'APPROVED',
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: neg.expenseDate
        }
      },
      { upsert: true }
    );
  }

  // Reclassify ₹20,400 death insurance claim collected
  await db.collection('expenses').updateOne(
    { description: { $regex: 'CUSTOMER DEATH INSURANCE AMOUNT RECEIVED' } },
    {
      $set: {
        category: 'INSURANCE_CLAIM_RECOVERY',
        status: 'INFLOW_RECEIPT',
        description: 'LATHA - PARASAKTHI GROUP CUSTOMER DEATH INSURANCE AMOUNT RECEIVED (Inflow Recovery - Excluded from Expense Outflow)'
      }
    }
  );

  // Set Pollachi branch physical vault cash balance to ₹83,829 (audited closing balance on 28 Oct 2026)
  await db.collection('branches').updateOne(
    { code: 'POLLACHI' },
    {
      $set: {
        cashBalance: 83829,
        bankBalance: 0,
        interBranchBalance: 2582875,
        updatedAt: new Date()
      }
    }
  );

  console.log('Pollachi branch cashBalance set to ₹83,829 (Vault) and interBranchBalance set to ₹25,82,875.');
  await mongoose.disconnect();
  console.log('Reconciliation and synchronization complete!');
}

reconcileAndSync();
