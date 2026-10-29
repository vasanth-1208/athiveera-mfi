const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const baseDir = 'c:/Projects/Athiveera MFI';
const masterFile = path.join(baseDir, 'ATHIVEERA_MFI_MASTER_MERGED.xlsx');

const weekdayFiles = ['MONDAY.xlsx', 'TUESDAY.xlsx', 'WEDNESDAY.xlsx', 'THURSDAY.xlsx'];

const WEEKDAY_INDEX = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4
};

function formatDateString(d) {
  if (!d || isNaN(d.getTime())) return '2026-01-01';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateCell(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const adj = new Date(val.getTime() + 6 * 3600 * 1000);
    return new Date(Date.UTC(adj.getUTCFullYear(), adj.getUTCMonth(), adj.getUTCDate(), 12, 0, 0));
  }
  if (typeof val === 'number') {
    const p = XLSX.SSF.parse_date_code(val);
    if (p && p.y) return new Date(Date.UTC(p.y, p.m - 1, p.d, 12, 0, 0));
  }
  const str = String(val).trim();
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
  const d = new Date(str);
  return !isNaN(d.getTime()) ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0)) : null;
}

function getProductSchedule(loanAmount, totalWeeks) {
  const schedule = [];
  if (loanAmount === 20000) {
    // 32 weeks
    for (let w = 1; w <= 32; w++) {
      if (w <= 10) schedule.push({ week: w, total: 850, principal: 625, interest: 185, savings: 40 });
      else if (w <= 20) schedule.push({ week: w, total: 800, principal: 635, interest: 125, savings: 40 });
      else if (w <= 30) schedule.push({ week: w, total: 750, principal: 640, interest: 70, savings: 40 });
      else schedule.push({ week: w, total: 500, principal: 500, interest: 0, savings: 0 });
    }
  } else if (loanAmount === 25000 || (loanAmount > 20000 && loanAmount < 26000)) {
    // 42 weeks
    for (let w = 1; w <= 42; w++) {
      if (w <= 10) schedule.push({ week: w, total: 850, principal: 580, interest: 240, savings: 30 });
      else if (w <= 20) schedule.push({ week: w, total: 800, principal: 585, interest: 185, savings: 30 });
      else if (w <= 30) schedule.push({ week: w, total: 750, principal: 600, interest: 130, savings: 20 });
      else if (w <= 40) schedule.push({ week: w, total: 700, principal: 605, interest: 75, savings: 20 });
      else schedule.push({ week: w, total: 650, principal: 650, interest: 0, savings: 0 });
    }
  } else if (loanAmount === 30000 && totalWeeks === 40) {
    // 40 weeks Business Loan from NEW LOAN INT.xlsx
    for (let w = 1; w <= 40; w++) {
      if (w <= 10) schedule.push({ week: w, total: 1000, principal: 645, interest: 295, savings: 60 });
      else if (w <= 20) schedule.push({ week: w, total: 1000, principal: 710, interest: 230, savings: 60 });
      else if (w <= 30) schedule.push({ week: w, total: 1000, principal: 785, interest: 155, savings: 60 });
      else schedule.push({ week: w, total: 1000, principal: 860, interest: 80, savings: 60 });
    }
  } else if (loanAmount === 30000) {
    // 52 weeks
    for (let w = 1; w <= 52; w++) {
      if (w <= 10) schedule.push({ week: w, total: 900, principal: 565, interest: 295, savings: 40 });
      else if (w <= 20) schedule.push({ week: w, total: 850, principal: 575, interest: 235, savings: 40 });
      else if (w <= 30) schedule.push({ week: w, total: 800, principal: 580, interest: 180, savings: 40 });
      else if (w <= 40) schedule.push({ week: w, total: 750, principal: 585, interest: 125, savings: 40 });
      else if (w <= 50) schedule.push({ week: w, total: 700, principal: 595, interest: 65, savings: 40 });
      else schedule.push({ week: w, total: 500, principal: 500, interest: 0, savings: 0 });
    }
  } else {
    // Proportional fallback for any non-standard amount
    const weeks = totalWeeks || 32;
    const weeklyDue = Math.round((loanAmount * 1.19) / weeks);
    for (let w = 1; w <= weeks; w++) {
      const pPortion = Math.round(weeklyDue * (1 / 1.19));
      schedule.push({
        week: w,
        total: weeklyDue,
        principal: pPortion,
        interest: weeklyDue - pPortion,
        savings: 0
      });
    }
  }
  return schedule;
}

function extractInstallmentWeek(cellValue, fallbackNum) {
  if (!cellValue) return fallbackNum;
  const s = String(cellValue).trim();
  const m = s.match(/^(\d+)(?:st|nd|rd|th)?\s+installment/i);
  if (m) return parseInt(m[1], 10);
  if (
    s.includes('CLOSED') ||
    s.includes('RELOAN') ||
    s.includes('RETURN') ||
    s.includes('DISCOUNT') ||
    s.includes('SETTLED')
  ) {
    return null;
  }
  return fallbackNum;
}

const INDIVIDUAL_MEMBER_CLOSURES = {
  36: ['DHANALAKSHMI', 'KALAMANI', 'SANTHI', 'VEERATHAL'],
  30: ['MASILAMANI'],
  35: ['RAJASAKTHI'],
  37: ['MEENA'],
  46: ['ARUNTHATHI'],
  47: ['SELVI'],
  64: ['SURYABEGAM']
};

async function runImport() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to database.');

  const db = mongoose.connection.db;

  // 1. Ensure Branches
  let pollachiBranch = await db.collection('branches').findOne({ code: 'POLLACHI' });
  if (!pollachiBranch) {
    const res = await db.collection('branches').insertOne({
      code: 'POLLACHI',
      name: 'Pollachi Branch',
      address: 'Main Road, Pollachi, Tamil Nadu',
      phone: '+91 9500485596',
      cashBalance: 0,
      bankBalance: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    pollachiBranch = { _id: res.insertedId, code: 'POLLACHI', name: 'Pollachi Branch' };
  }
  const branchId = pollachiBranch._id;

  // 2. Ensure Users
  const defaultPasswordHash = await bcrypt.hash('Athiveera@123', 10);
  const staffConfig = [
    { username: 'sekar', name: 'Chandra Sekar', role: 'COLLECTION_STAFF', phone: '9443000001' },
    { username: 'vignesh', name: 'Vignesh', role: 'COLLECTION_STAFF', phone: '9443000002' },
    { username: 'raseeth', name: 'Raseeth', role: 'COLLECTION_STAFF', phone: '9443000003' },
    { username: 'manager', name: 'Branch Manager', role: 'BRANCH_MANAGER', phone: '9500485596' }
  ];

  const staffUserMap = new Map();
  for (const s of staffConfig) {
    let u = await db.collection('users').findOne({ username: s.username });
    if (!u) {
      const res = await db.collection('users').insertOne({
        username: s.username,
        passwordHash: defaultPasswordHash,
        name: s.name,
        role: s.role,
        branchId: branchId,
        phone: s.phone,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      u = { _id: res.insertedId, ...s };
    }
    staffUserMap.set(s.name, u);
  }
  const adminUser = await db.collection('users').findOne({ role: 'MAIN_ADMIN' });

  // 3. Clear database collections
  console.log('Clearing database tables for clean master import...');
  await db.collection('installments').deleteMany({});
  await db.collection('payments').deleteMany({});
  await db.collection('followups').deleteMany({});
  await db.collection('loans').deleteMany({});
  await db.collection('customers').deleteMany({});
  await db.collection('groups').deleteMany({});
  await db.collection('enquiries').deleteMany({});
  await db.collection('cashtransactions').deleteMany({
    $or: [{ loanId: { $exists: true } }, { category: 'LOAN_COLLECTION' }, { category: 'LOAN_DISBURSEMENT' }]
  });
  console.log('Database tables cleared.');

  // 4. Preload all weekday Excel workbooks to extract sheet-level dates
  console.log('Pre-loading weekday workbooks...');
  const weekdayWbs = {};
  for (const file of weekdayFiles) {
    const filePath = path.join(baseDir, file);
    if (fs.existsSync(filePath)) {
      weekdayWbs[file.replace('.xlsx', '')] = XLSX.readFile(filePath, { cellDates: true });
    }
  }

  // Pre-load OVER ALL.xlsx
  console.log('Reading OVER ALL.xlsx master ledger...');
  const overallWb = XLSX.readFile(path.join(baseDir, 'OVER ALL.xlsx'), { cellDates: true });
  const gnameData = XLSX.utils.sheet_to_json(overallWb.Sheets['G.NAME'], { header: 1, defval: null });

  // Map of group code -> OVER ALL master metadata
  const masterOverAllMap = new Map();
  for (let i = 1; i <= 99; i++) {
    const r = gnameData[i];
    if (r && r[1]) {
      const recInst = parseInt(r[4], 10) || 0;
      const balWeeks = parseInt(r[8], 10) || 0;
      masterOverAllMap.set(i, {
        groupCode: i,
        groupName: String(r[1]).trim(),
        rawDate: r[2],
        expectedMembers: parseInt(r[3], 10) || 0,
        receivedInst: recInst,
        balanceWeeks: balWeeks,
        totalWeeks: (recInst + balWeeks) > 0 ? (recInst + balWeeks) : 32,
        receivedCollAmt: parseFloat(r[5]) || 0,
        balanceCollAmt: parseFloat(r[6]) || 0,
        collectionDay: r[7] ? String(r[7]).trim().toUpperCase() : 'MONDAY',
        loanPerMember: parseFloat(r[9]) || 20000
      });
    }
  }

  // Read ATHIVEERA_MFI_MASTER_MERGED.xlsx
  console.log(`Reading master merged workbook: ${masterFile}...`);
  const masterWb = XLSX.readFile(masterFile, { cellDates: true });
  const groupsData = XLSX.utils.sheet_to_json(masterWb.Sheets['MASTER_GROUPS']);
  const loansData = XLSX.utils.sheet_to_json(masterWb.Sheets['MASTER_LOANS']);

  console.log(`Loaded ${groupsData.length} groups and ${loansData.length} loans from master register.`);

  // 5. Build Group Records
  const groupCodeMap = new Map();
  const groupsToInsert = [];

  for (const g of groupsData) {
    const code = Number(g['Group Code']);
    const staffName = g['Assigned Staff'] || 'Chandra Sekar';
    const staffObj = staffUserMap.get(staffName) || staffUserMap.get('Chandra Sekar');
    const groupId = new mongoose.Types.ObjectId();

    const groupDoc = {
      _id: groupId,
      groupCode: code,
      name: g['Group Name'],
      branchId,
      headName: g['Head Name'] || '',
      headPhone: g['Head Phone'] ? String(g['Head Phone']) : '',
      headCustomerId: null,
      collectionDay: g['Route Day'],
      area: g['Operational Area'] || 'Pollachi Rural',
      staffName: staffName,
      staffId: staffObj ? staffObj._id : null,
      cycle: Number(g['Cycle']) || 1,
      status: g['Status'] === 'CLOSED' ? 'CLOSED' : 'LIVE',
      totalMembers: Number(g['Active Borrowers']) || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    groupsToInsert.push(groupDoc);
    groupCodeMap.set(code, groupDoc);
  }

  await db.collection('groups').insertMany(groupsToInsert);
  console.log(`Successfully bulk-inserted ${groupsToInsert.length} groups.`);

  // 6. Build Customers, Loans, and exact Installments
  const customerMap = new Map();
  const loansToInsert = [];
  const installmentsToInsert = [];
  const paymentsToInsert = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // Cache sheet-level date tables for each group
  const groupDatesCache = new Map();

  for (const l of loansData) {
    const gCode = Number(l['Group Code']);
    const groupDoc = groupCodeMap.get(gCode);
    const overAllMeta = masterOverAllMap.get(gCode);

    if (!groupDoc || !overAllMeta) {
      console.warn(`Missing metadata for group code: ${gCode}`);
      continue;
    }

    const staffName = l['Assigned Staff'] || groupDoc.staffName;
    const staffObj = staffUserMap.get(staffName) || staffUserMap.get('Chandra Sekar');

    // Customer
    const custId = l['Customer ID'];
    let customerDoc = customerMap.get(custId);
    if (!customerDoc) {
      const phone = (l['Phone Number'] && l['Phone Number'] !== '-') ? String(l['Phone Number']).trim() : '';
      const nomineePhone = (l['Nominee Phone'] && l['Nominee Phone'] !== '-') ? String(l['Nominee Phone']).trim() : '';
      const customerObjId = new mongoose.Types.ObjectId();

      customerDoc = {
        _id: customerObjId,
        customerId: custId,
        name: String(l['Borrower Name']).trim(),
        phone,
        nomineePhone,
        spouseName: '',
        nomineeName: '',
        address: groupDoc.area,
        area: groupDoc.area,
        smartCardNumber: '',
        aadharNumber: '',
        voterIdNumber: '',
        panNumber: '',
        branchId,
        activeGroupId: groupDoc._id,
        status: 'ACTIVE',
        notes: `Imported from Master Register - ${groupDoc.name}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      customerMap.set(custId, customerDoc);
    }

    // Load sheet-level dates and issue date for this group
    let sheetDates = groupDatesCache.get(gCode);
    let sheetLoanDate = null;

    if (!sheetDates) {
      sheetDates = new Map();
      const wbDay = weekdayWbs[groupDoc.collectionDay];
      if (wbDay) {
        // Find sheet matching group name
        const cleanG = groupDoc.name.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const sheetMatch = wbDay.SheetNames.find(n => n.replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanG);
        if (sheetMatch) {
          const ws = wbDay.Sheets[sheetMatch];
          const sdata = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

          // Check member loan date in row 1
          if (sdata[1]) {
            for (let c = 6; c < Math.min(sdata[1].length, 12); c++) {
              const dVal = parseDateCell(sdata[1][c]);
              if (dVal) {
                sheetLoanDate = dVal;
                break;
              }
            }
          }

          // Parse installment rows
          for (let r = 1; r < sdata.length; r++) {
            const row = sdata[r];
            if (row && typeof row[0] === 'number' && row[0] >= 1 && row[0] <= 65) {
              const instWk = extractInstallmentWeek(row[2], row[0]);
              if (instWk !== null) {
                const d = parseDateCell(row[1]);
                if (d) {
                  sheetDates.set(instWk, d);
                }
              }
            }
          }
        }
      }
      groupDatesCache.set(gCode, { sheetDates, sheetLoanDate });
    } else {
      sheetLoanDate = sheetDates.sheetLoanDate;
      sheetDates = sheetDates.sheetDates;
    }

    // Determine issueDate
    let issueDate = sheetLoanDate;
    if (!issueDate) {
      issueDate = parseDateCell(overAllMeta.rawDate);
    }
    if (!issueDate && sheetDates.has(1)) {
      issueDate = new Date(sheetDates.get(1).getTime() - 7 * 86400 * 1000);
    }
    if (!issueDate) {
      issueDate = new Date('2026-01-01');
    }

    // Determine tenure and product schedule
    const principal = Number(l['Principal Amount (₹)']) || 20000;
    const totalWeeks = overAllMeta.totalWeeks;
    const prodSchedule = getProductSchedule(principal, totalWeeks);
    const tenureWeeks = prodSchedule.length;

    // Total contractual sums from exact schedule
    const totalPayable = prodSchedule.reduce((s, item) => s + item.total, 0);
    const totalInterest = prodSchedule.reduce((s, item) => s + item.interest, 0);
    const totalSavings = prodSchedule.reduce((s, item) => s + item.savings, 0);
    const interestRate = principal > 0 ? Math.round((totalInterest / principal) * 100 * 10) / 10 : 19.0;

    const custCleanName = String(l['Borrower / Member Name'] || '').toUpperCase();
    const isMemberClosed = (INDIVIDUAL_MEMBER_CLOSURES[gCode] || []).some(n => custCleanName.includes(n));
    const isClosed = l['Status'] === 'CLOSED' || overAllMeta.balanceCollAmt === 0 || isMemberClosed;
    const receivedWeeks = isClosed ? tenureWeeks : Math.min(tenureWeeks, overAllMeta.receivedInst);

    // Build installment list
    let prevDueDate = null;
    let loanTotalPaid = 0;
    let loanOutstanding = 0;
    const loanId = new mongoose.Types.ObjectId();

    for (const item of prodSchedule) {
      const w = item.week;
      let dueDate = sheetDates.get(w);

      if (!dueDate) {
        if (prevDueDate) {
          dueDate = new Date(prevDueDate.getTime() + 7 * 86400 * 1000);
        } else {
          dueDate = new Date(issueDate.getTime() + w * 7 * 86400 * 1000);
        }
      }
      prevDueDate = dueDate;

      let instStatus = 'PENDING';
      let instPaid = 0;
      let instBal = item.total;
      let paidDate = null;
      let overdueDays = 0;
      let overdueWeeks = 0;

      if (w <= receivedWeeks) {
        instStatus = 'PAID';
        instPaid = item.total;
        instBal = 0;
        paidDate = dueDate;
        loanTotalPaid += instPaid;
      } else {
        loanOutstanding += item.total;
        if (dueDate.getTime() < today.getTime()) {
          instStatus = 'OVERDUE';
          const diffMs = today.getTime() - dueDate.getTime();
          overdueDays = Math.max(1, Math.floor(diffMs / (1000 * 86400)));
          overdueWeeks = Math.max(1, Math.floor(diffMs / (1000 * 86400 * 7)));
        } else {
          instStatus = 'PENDING';
        }
      }

      const installmentId = new mongoose.Types.ObjectId();
      const instDoc = {
        _id: installmentId,
        loanId: loanId,
        customerId: customerDoc._id,
        groupId: groupDoc._id,
        branchId,
        installmentNumber: w,
        dueDate,
        expectedAmount: item.total,
        allocatedPrincipal: item.principal,
        allocatedInterest: item.interest,
        allocatedSavings: item.savings,
        paidAmount: instPaid,
        balanceAmount: instBal,
        status: instStatus,
        paidDate,
        overdueDays,
        overdueWeeks,
        remarks: instStatus === 'PAID' ? 'Collected as per schedule' : '',
        createdAt: issueDate,
        updatedAt: new Date()
      };

      installmentsToInsert.push(instDoc);

      // Payment record
      if (instPaid > 0) {
        paymentsToInsert.push({
          loanId: loanId,
          customerId: customerDoc._id,
          groupId: groupDoc._id,
          branchId,
          installmentId: installmentId,
          amount: instPaid,
          allocatedPrincipal: item.principal,
          allocatedInterest: item.interest,
          allocatedSavings: item.savings,
          paymentDate: paidDate || dueDate,
          paymentMethod: 'CASH',
          collectorId: staffObj ? staffObj._id : (adminUser ? adminUser._id : null),
          receiptNumber: `RCP-${l['Loan Account #']}-W${w}`,
          isReversed: false,
          remarks: `Master Ledger Installment #${w}`,
          createdAt: paidDate || dueDate,
          updatedAt: new Date()
        });
      }
    }

    let productTier = 'CUSTOM';
    if (principal === 20000) productTier = 'TIER_A_20K';
    else if (principal === 25000) productTier = 'TIER_B_25K';
    else if (principal === 30000) productTier = 'TIER_C_30K';

    const loanDoc = {
      _id: loanId,
      loanNumber: l['Loan Account #'],
      customerId: customerDoc._id,
      groupId: groupDoc._id,
      branchId,
      cycle: Number(l['Cycle']) || groupDoc.cycle || 1,
      productType: productTier,
      principal,
      interestRate,
      interestAmount: totalInterest,
      docCharges: Math.round(principal * 0.06),
      savingsAmount: totalSavings,
      totalPayable,
      totalPaid: loanTotalPaid,
      outstandingTotal: loanOutstanding,
      tenureWeeks,
      repaymentFrequency: 'WEEKLY',
      disbursedDate: issueDate,
      status: isClosed ? 'CLOSED' : 'ACTIVE',
      assignedStaffId: staffObj ? staffObj._id : null,
      assignedStaffName: staffName,
      assignedAt: issueDate,
      verification: {
        smartCardNumber: '',
        aadharNumber: '',
        voterIdNumber: '',
        panNumber: '',
        remarks: 'Verified & authorized from Master Register',
        verifiedBy: staffObj ? staffObj._id : (adminUser ? adminUser._id : null),
        verifiedByName: staffName,
        verifiedAt: issueDate,
        status: 'APPROVED'
      },
      approvedBy: adminUser ? adminUser._id : null,
      approvedAt: issueDate,
      approvalRemarks: 'System initial approval from Master Ledger',
      collectionDay: groupDoc.collectionDay,
      area: groupDoc.area,
      groupName: groupDoc.name,
      customerName: customerDoc.name,
      customerPhone: customerDoc.phone,
      createdAt: issueDate,
      updatedAt: new Date()
    };

    loansToInsert.push(loanDoc);

    // Link customer as head
    if (groupDoc.headName && customerDoc.name.toUpperCase().includes(groupDoc.headName.toUpperCase().replace(/\..*$/, ''))) {
      groupDoc.headCustomerId = customerDoc._id;
    }
  }

  // 7. Bulk Insert Everything
  const customersArray = Array.from(customerMap.values());
  console.log(`Bulk inserting ${customersArray.length} customers...`);
  await db.collection('customers').insertMany(customersArray);

  console.log(`Bulk inserting ${loansToInsert.length} loans...`);
  await db.collection('loans').insertMany(loansToInsert);

  console.log(`Bulk inserting ${installmentsToInsert.length} installments...`);
  await db.collection('installments').insertMany(installmentsToInsert);

  console.log(`Bulk inserting ${paymentsToInsert.length} payments...`);
  if (paymentsToInsert.length > 0) {
    await db.collection('payments').insertMany(paymentsToInsert);
  }

  // 8. Sync Group Total Members and Head Customer ID
  console.log('Syncing group member counts and group heads...');
  for (const groupDoc of groupCodeMap.values()) {
    const memCount = loansToInsert.filter(l => String(l.groupId) === String(groupDoc._id)).length;
    await db.collection('groups').updateOne(
      { _id: groupDoc._id },
      { $set: { totalMembers: memCount, headCustomerId: groupDoc.headCustomerId } }
    );
  }

  // 9. Import all 84 Canonical Branch Transfers
  console.log('Importing 84 canonical branch transfers from Z LEDGER NOTE BOOK.xlsx...');
  const ledgerPath = path.join(baseDir, 'Z LEDGER NOTE BOOK.xlsx');
  const wbLedger = XLSX.readFile(ledgerPath);
  const wsTrf = wbLedger.Sheets['CASH TRANFER'];
  const trfRows = XLSX.utils.sheet_to_json(wsTrf, { header: 1 });

  let mdkmBranch = await db.collection('branches').findOne({ code: 'MDKM' });
  if (!mdkmBranch) {
    const res = await db.collection('branches').insertOne({
      code: 'MDKM',
      name: 'Madathukulam Branch',
      address: 'Madathukulam Main Rd, Udumalpet, Tamil Nadu',
      phone: '+91 9842285596',
      cashBalance: 0,
      bankBalance: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    mdkmBranch = { _id: res.insertedId, code: 'MDKM', name: 'Madathukulam Branch' };
  }

  let trfCount = 0;
  for (let r = 2; r < trfRows.length; r++) {
    const row = trfRows[r];
    const sNo = row[0];
    if (typeof sNo === 'number' && sNo >= 1 && sNo <= 84) {
      const exactDate = parseDateCell(row[1]);
      const received = typeof row[3] === 'number' ? row[3] : (parseFloat(row[3]) || 0);
      const paid = typeof row[4] === 'number' ? row[4] : (parseFloat(row[4]) || 0);
      const purpose = row[5] ? String(row[5]).trim() : '';

      const isReceived = received > 0;
      const amt = isReceived ? received : paid;
      if (amt <= 0) continue;

      const sourceBranchId = isReceived ? mdkmBranch._id : branchId;
      const destinationBranchId = isReceived ? branchId : mdkmBranch._id;
      const transferNumber = `ATH-TRF-${String(sNo).padStart(5, '0')}`;
      const defaultPurpose = isReceived ? 'Cash received from MDKM Branch' : 'Cash transfer to MDKM Branch';
      const fullPurpose = purpose || defaultPurpose;

      const btRes = await db.collection('branchtransfers').insertOne({
        transferNumber,
        sourceBranchId,
        destinationBranchId,
        transferDate: exactDate,
        amount: amt,
        accountType: 'CASH',
        purpose: fullPurpose,
        status: 'COMPLETED',
        createdById: adminUser ? adminUser._id : null,
        receivedById: adminUser ? adminUser._id : null,
        createdAt: exactDate,
        updatedAt: exactDate
      });
      const btId = btRes.insertedId;
      trfCount++;

      // Create linked double-entry cash transactions
      if (isReceived) {
        await db.collection('cashtransactions').insertOne({
          branchId: branchId,
          transactionDate: exactDate,
          type: 'CREDIT',
          category: 'BRANCH_TRANSFER',
          amount: amt,
          accountType: 'CASH',
          description: `Transfer from Madathukulam Branch. Purpose: ${fullPurpose}`,
          relatedEntityType: 'BRANCH_TRANSFER',
          relatedEntityId: btId,
          performedById: adminUser ? adminUser._id : null,
          createdAt: exactDate,
          updatedAt: exactDate
        });
        await db.collection('cashtransactions').insertOne({
          branchId: mdkmBranch._id,
          transactionDate: exactDate,
          type: 'DEBIT',
          category: 'BRANCH_TRANSFER',
          amount: amt,
          accountType: 'CASH',
          description: `Transfer to Pollachi Branch. Purpose: ${fullPurpose}`,
          relatedEntityType: 'BRANCH_TRANSFER',
          relatedEntityId: btId,
          performedById: adminUser ? adminUser._id : null,
          createdAt: exactDate,
          updatedAt: exactDate
        });
      } else {
        await db.collection('cashtransactions').insertOne({
          branchId: branchId,
          transactionDate: exactDate,
          type: 'DEBIT',
          category: 'BRANCH_TRANSFER',
          amount: amt,
          accountType: 'CASH',
          description: `Transfer to Madathukulam Branch. Purpose: ${fullPurpose}`,
          relatedEntityType: 'BRANCH_TRANSFER',
          relatedEntityId: btId,
          performedById: adminUser ? adminUser._id : null,
          createdAt: exactDate,
          updatedAt: exactDate
        });
        await db.collection('cashtransactions').insertOne({
          branchId: mdkmBranch._id,
          transactionDate: exactDate,
          type: 'CREDIT',
          category: 'BRANCH_TRANSFER',
          amount: amt,
          accountType: 'CASH',
          description: `Transfer from Pollachi Branch. Purpose: ${fullPurpose}`,
          relatedEntityType: 'BRANCH_TRANSFER',
          relatedEntityId: btId,
          performedById: adminUser ? adminUser._id : null,
          createdAt: exactDate,
          updatedAt: exactDate
        });
      }
    }
  }
  console.log(`Imported ${trfCount} branch transfers and 168 cash transactions.`);

  // 10. Import Expenses & Petrol Trips
  console.log('Importing expenses from Z LEDGER NOTE BOOK.xlsx...');
  const wsExp = wbLedger.Sheets['EXPENSES'];
  const expRows = XLSX.utils.sheet_to_json(wsExp, { header: 1 });
  let expCount = 0;
  for (let i = 3; i < expRows.length; i++) {
    const r = expRows[i];
    const cat = r[2] ? String(r[2]).trim() : '';
    const amt = parseFloat(r[3]) || 0;
    if (cat && amt > 0 && !cat.includes('TOTAL')) {
      const exactDate = parseDateCell(r[1]);
      await db.collection('expenses').insertOne({
        branchId: branchId,
        expenseDate: exactDate,
        category: cat,
        amount: amt,
        description: r[5] ? String(r[5]).trim() : '',
        billRef: r[4] ? String(r[4]).trim() : '',
        travelKM: 0,
        fuelRate: 2.16,
        staffName: '',
        paymentMethod: 'CASH',
        status: 'APPROVED',
        approvedById: adminUser ? adminUser._id : null,
        createdAt: exactDate,
        updatedAt: exactDate
      });
      expCount++;
    }
  }
  console.log(`Imported ${expCount} general expenses.`);

  // Petrol Trips
  const wsPetrol = wbLedger.Sheets['PETROL EXP'];
  const petrolRows = XLSX.utils.sheet_to_json(wsPetrol, { header: 1 });
  let petrolCount = 0;
  for (let r = 2; r <= 10; r++) {
    const row = petrolRows[r];
    if (row && row[1] && row[3]) {
      const pDate = parseDateCell(row[1]);
      const place = String(row[2]).trim();
      const km = parseFloat(row[3]) || 0;
      const amt = Math.round(km * 2.16);
      if (km > 0) {
        await db.collection('expenses').insertOne({
          branchId: branchId,
          expenseDate: pDate,
          category: 'FUEL EXPENSES',
          amount: amt,
          description: `Vignesh Bike Petrol: ${place} (${km} KM @ ₹2.16)`,
          travelKM: km,
          fuelRate: 2.16,
          staffName: 'Vignesh',
          paymentMethod: 'CASH',
          status: 'APPROVED',
          approvedById: adminUser ? adminUser._id : null,
          createdAt: pDate,
          updatedAt: pDate
        });
        petrolCount++;
      }
    }
  }
  for (let r = 2; r <= 8; r++) {
    const row = petrolRows[r];
    if (row && row[6] && row[8]) {
      const pDate = parseDateCell(row[6]);
      const place = String(row[7]).trim();
      const km = parseFloat(row[8]) || 0;
      const amt = Math.round(km * 2.16);
      if (km > 0) {
        await db.collection('expenses').insertOne({
          branchId: branchId,
          expenseDate: pDate,
          category: 'FUEL EXPENSES',
          amount: amt,
          description: `Chandra Sekar Bike Petrol: ${place} (${km} KM @ ₹2.16)`,
          travelKM: km,
          fuelRate: 2.16,
          staffName: 'Chandra Sekar',
          paymentMethod: 'CASH',
          status: 'APPROVED',
          approvedById: adminUser ? adminUser._id : null,
          createdAt: pDate,
          updatedAt: pDate
        });
        petrolCount++;
      }
    }
  }
  console.log(`Imported ${petrolCount} petrol trips.`);

  // 11. Customer Consolidation (Merge duplicate customer profiles across cycles)
  console.log('Running automatic customer consolidation across cycles...');
  const allCusts = await db.collection('customers').find({}).sort({ customerId: 1 }).toArray();
  const custGroupMap = new Map();

  for (const c of allCusts) {
    const rawPhone = (c.phone || '').trim().replace(/[^0-9]/g, '');
    let key = '';
    if (rawPhone.length >= 10) {
      key = 'PHONE:' + rawPhone.slice(-10);
    } else {
      const cleanName = (c.name || '').trim().toUpperCase().replace(/\s*-\s*HEAD/, '').replace(/[^A-Z]/g, '');
      const cleanArea = (c.area || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
      if (cleanName && cleanArea) key = `NAME_AREA:${cleanName}_${cleanArea}`;
      else key = `ID:${c._id}`;
    }
    if (!custGroupMap.has(key)) custGroupMap.set(key, []);
    custGroupMap.get(key).push(c);
  }

  let mergedCustCount = 0;
  for (const [k, list] of custGroupMap.entries()) {
    if (list.length > 1) {
      const primary = list[0];
      const secondaries = list.slice(1);
      const secIds = secondaries.map(s => s._id);

      // Merge fields
      const updFields = {};
      for (const sec of secondaries) {
        if (!primary.phone && sec.phone) updFields.phone = sec.phone;
        if (!primary.nomineePhone && sec.nomineePhone) updFields.nomineePhone = sec.nomineePhone;
        if (!primary.area && sec.area) updFields.area = sec.area;
      }
      if (Object.keys(updFields).length > 0) {
        await db.collection('customers').updateOne({ _id: primary._id }, { $set: updFields });
      }

      // Remap loans to primary
      await db.collection('loans').updateMany({ customerId: { $in: secIds } }, { $set: { customerId: primary._id } });
      await db.collection('installments').updateMany({ customerId: { $in: secIds } }, { $set: { customerId: primary._id } });
      await db.collection('payments').updateMany({ customerId: { $in: secIds } }, { $set: { customerId: primary._id } });

      // Delete secondary customer records
      await db.collection('customers').deleteMany({ _id: { $in: secIds } });
      mergedCustCount += secondaries.length;
    }
  }
  console.log(`Consolidated ${mergedCustCount} duplicate customer profiles into canonical unique borrowers.`);

  // Sync Cycle numbers on loans
  const uniqueCusts = await db.collection('customers').find({}).toArray();
  for (const c of uniqueCusts) {
    const cLoans = await db.collection('loans').find({ customerId: c._id }).sort({ disbursedDate: 1 }).toArray();
    for (let idx = 0; idx < cLoans.length; idx++) {
      const cyc = idx + 1;
      await db.collection('loans').updateOne({ _id: cLoans[idx]._id }, { $set: { cycle: cyc, cycleNumber: cyc } });
    }
    // Set activeGroupId to active loan's groupId
    const activeLn = cLoans.find(l => l.status === 'ACTIVE') || cLoans[cLoans.length - 1];
    if (activeLn) {
      await db.collection('customers').updateOne({ _id: c._id }, { $set: { activeGroupId: activeLn.groupId, status: 'ACTIVE' } });
    }
  }

  // 12. Update Safe Cash Balance
  const allTxs = await db.collection('cashtransactions').find({ branchId }).toArray();
  let safeBal = 0;
  for (const t of allTxs) {
    if (t.type === 'CREDIT') safeBal += t.amount;
    else safeBal -= t.amount;
  }
  await db.collection('branches').updateOne({ _id: branchId }, { $set: { cashBalance: safeBal } });

  console.log('\n================ MASTER V2 IMPORT SUCCESS ================');
  console.log(`Groups imported:       ${groupCodeMap.size}`);
  console.log(`Customers registered:  ${customersArray.length}`);
  console.log(`Loans active/closed:   ${loansToInsert.length}`);
  console.log(`Installments inserted: ${installmentsToInsert.length}`);
  console.log(`Payments recorded:     ${paymentsToInsert.length}`);
  console.log('==========================================================\n');

  process.exit(0);
}

runImport().catch(err => {
  console.error('Import V2 failed with error:', err);
  process.exit(1);
});
