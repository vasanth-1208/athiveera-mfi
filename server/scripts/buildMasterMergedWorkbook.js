const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const baseDir = 'c:/Projects/Athiveera MFI';
const weekdayFiles = ['MONDAY.xlsx', 'TUESDAY.xlsx', 'WEDNESDAY.xlsx', 'THURSDAY.xlsx'];

const INDIVIDUAL_MEMBER_CLOSURES = {
  36: ['DHANALAKSHMI', 'KALAMANI', 'SANTHI', 'VEERATHAL'],
  30: ['MASILAMANI'],
  35: ['RAJASAKTHI'],
  37: ['MEENA'],
  46: ['ARUNTHATHI'],
  47: ['SELVI'],
  64: ['SURYABEGAM']
};

console.log('Reading OVER ALL.xlsx...');
const overallWb = XLSX.readFile(path.join(baseDir, 'OVER ALL.xlsx'));
const gnameSheet = overallWb.Sheets['G.NAME'];
const gnameData = XLSX.utils.sheet_to_json(gnameSheet, { header: 1, defval: null });

// Master group definition from OVER ALL.xlsx
const masterGroupMap = new Map();
for (let i = 1; i <= 99; i++) {
  const r = gnameData[i];
  if (r && r[1]) {
    const rawName = String(r[1]).trim();
    const code = i; // In OVER ALL.xlsx, row i (1 to 99) is the definitive group code
    const recInst = parseInt(r[4], 10) || 0;
    const balWeeks = parseInt(r[8], 10) || 0;
    masterGroupMap.set(rawName, {
      rowIdx: i,
      groupCode: code,
      groupName: rawName,
      issueDate: r[2],
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
console.log(`Loaded ${masterGroupMap.size} groups from OVER ALL.xlsx`);

function getProductSchedule(loanAmount, totalWeeks) {
  const schedule = [];
  if (loanAmount === 20000) {
    for (let w = 1; w <= 32; w++) {
      if (w <= 10) schedule.push({ week: w, total: 850, principal: 625, interest: 185, savings: 40 });
      else if (w <= 20) schedule.push({ week: w, total: 800, principal: 635, interest: 125, savings: 40 });
      else if (w <= 30) schedule.push({ week: w, total: 750, principal: 640, interest: 70, savings: 40 });
      else schedule.push({ week: w, total: 500, principal: 500, interest: 0, savings: 0 });
    }
  } else if (loanAmount === 25000 || (loanAmount > 20000 && loanAmount < 26000)) {
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
    for (let w = 1; w <= 52; w++) {
      if (w <= 10) schedule.push({ week: w, total: 900, principal: 565, interest: 295, savings: 40 });
      else if (w <= 20) schedule.push({ week: w, total: 850, principal: 575, interest: 235, savings: 40 });
      else if (w <= 30) schedule.push({ week: w, total: 800, principal: 580, interest: 180, savings: 40 });
      else if (w <= 40) schedule.push({ week: w, total: 750, principal: 585, interest: 125, savings: 40 });
      else if (w <= 50) schedule.push({ week: w, total: 700, principal: 595, interest: 65, savings: 40 });
      else schedule.push({ week: w, total: 500, principal: 500, interest: 0, savings: 0 });
    }
  } else {
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

function formatDateString(d) {
  if (!d || isNaN(d.getTime())) return '2026-01-01';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper to determine if a value is a 10-digit phone number
function isPhone(val) {
  if (!val) return false;
  const str = String(val).replace(/[^0-9]/g, '');
  return str.length === 10 && ['6', '7', '8', '9'].includes(str[0]);
}

// Helper to determine if a value looks like a borrower name
function isPersonName(val) {
  if (!val) return false;
  if (typeof val === 'number') return false;
  const str = String(val).trim().toUpperCase();
  if (str.length < 2 || str.length > 50) return false;
  const blackList = [
    'TOTAL', 'INSTALLMENT', 'LOAN DATE', 'GROUP MEMBERS', 'PH NO', 
    'LOAN AMOUNT', 'INTEREST', '0-10', '11-20', '21-30', '31-32', '31-40', 
    'S.NO', 'DATE', 'AMT', 'PER WEEK', 'ADVANCE', 'BALANCE', 'REMARKS',
    'SAVINGS', 'CLOSING', 'DISCOUNT', 'HUSBAND DEATH', 'A/C CLOSED'
  ];
  for (const b of blackList) {
    if (str.includes(b)) return false;
  }
  return /[A-Z]/.test(str);
}

// Format Excel date to YYYY-MM-DD
function formatExcelDate(val) {
  if (!val) return '2026-01-01';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'number') {
    const d = new Date((val - (25567 + 2)) * 86400 * 1000);
    return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '2026-01-01';
  }
  const str = String(val).trim();
  if (str.includes('.')) {
    const p = str.split('.');
    if (p.length === 3) {
      let y = parseInt(p[2]);
      if (y < 100) y += 2000;
      return `${y}-${String(p[1]).padStart(2, '0')}-${String(p[0]).padStart(2, '0')}`;
    }
  }
  return str;
}

// Pre-load weekday workbooks once
console.log('Loading weekday workbooks...');
const weekdayWbs = {};
for (const file of weekdayFiles) {
  const filePath = path.join(baseDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`Loading ${file}...`);
    weekdayWbs[file] = XLSX.readFile(filePath, { cellDates: true });
  }
}

// Read group metadata from weekday summary sheets
const groupSummaryMeta = new Map();
for (const file of weekdayFiles) {
  const dayName = file.replace('.xlsx', '');
  const wb = weekdayWbs[file];
  if (!wb) continue;
  const summaryWs = wb.Sheets[dayName];
  if (!summaryWs) continue;

  const data = XLSX.utils.sheet_to_json(summaryWs, { header: 1, defval: null });
  for (let r = 2; r < data.length; r++) {
    const row = data[r];
    if (row && row[1] && String(row[1]).includes('GROUP')) {
      const gname = String(row[1]).trim();
      groupSummaryMeta.set(gname, {
        headName: row[2] ? String(row[2]).trim() : '',
        headPhone: row[3] ? String(row[3]).replace(/[^0-9]/g, '') : '',
        loanIssueDate: row[4],
        membersCount: parseInt(row[5]) || 0,
        receivedCollAmt: parseFloat(row[6]) || 0,
        receivedInst: parseInt(row[7]) || 0,
        balanceWeek: parseInt(row[8]) || 0,
        balanceAmt: parseFloat(row[9]) || 0,
        perWeekCollAmt: parseFloat(row[11]) || 0,
        area: row[12] ? String(row[12]).trim() : '',
        staff: row[13] ? String(row[13]).trim() : '',
        pending: parseFloat(row[14]) || 0,
        remarks: row[16] ? String(row[16]).trim() : ''
      });
    }
  }
}

console.log(`Loaded metadata for ${groupSummaryMeta.size} groups from weekday summary sheets`);

// Process each group sheet
const finalGroups = [];
const finalLoans = [];
let globalCustId = 1;

for (const [gname, masterMeta] of masterGroupMap.entries()) {
  const dayName = masterMeta.collectionDay;
  const fileName = `${dayName}.xlsx`;
  const wb = weekdayWbs[fileName];

  let summaryMeta = groupSummaryMeta.get(gname);
  if (!summaryMeta) {
    const cleanG = gname.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    for (const [k, v] of groupSummaryMeta.entries()) {
      if (k.replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanG) {
        summaryMeta = v;
        break;
      }
    }
  }
  if (!summaryMeta) {
    const isCycle2 = gname.includes(' 2 ') || gname.includes(' 2 GROUP') || gname.includes('2GROUP');
    const baseWord = gname.split(/[\s0-9-]/)[0].toUpperCase();
    for (const [k, v] of groupSummaryMeta.entries()) {
      const kCycle2 = k.includes(' 2 ') || k.includes(' 2 GROUP') || k.includes('2GROUP');
      if (isCycle2 === kCycle2 && k.toUpperCase().includes(baseWord)) {
        summaryMeta = v;
        break;
      }
    }
  }

  let sheetNameMatch = null;
  if (wb) {
    sheetNameMatch = wb.SheetNames.find(n => n.trim() === gname.trim() || n.replace(/\s+/g, '') === gname.replace(/\s+/g, ''));
    if (!sheetNameMatch) {
      const cleanG = gname.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      sheetNameMatch = wb.SheetNames.find(n => n.replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanG);
    }
    if (!sheetNameMatch) {
      const isCycle2 = gname.includes(' 2 ') || gname.includes(' 2 GROUP');
      const baseWord = gname.split(/[\s0-9-]/)[0].toUpperCase();
      sheetNameMatch = wb.SheetNames.find(n => {
        const nCycle2 = n.includes(' 2 ') || n.includes(' 2 GROUP');
        return isCycle2 === nCycle2 && n.toUpperCase().includes(baseWord);
      });
    }
  }

  const cycle = (gname.includes(' 2 ') || gname.includes(' 2 GROUP')) ? 2 : 1;
  const area = summaryMeta?.area || 'Pollachi Rural';
  let rawStaff = (summaryMeta?.staff || 'SEKAR').toUpperCase().trim();
  let staff = 'Chandra Sekar';
  if (rawStaff.includes('VIGNESH')) staff = 'Vignesh';
  else if (rawStaff.includes('RASEETH') || rawStaff.includes('RASEED')) staff = 'Raseeth';
  else staff = 'Chandra Sekar';

  const headName = summaryMeta?.headName || '';
  const headPhone = summaryMeta?.headPhone || '';
  const isClosed = (masterMeta.balanceCollAmt === 0 && masterMeta.receivedCollAmt > 0);

  const groupRecord = {
    groupCode: masterMeta.groupCode,
    groupName: gname,
    cycle,
    collectionDay: dayName,
    headName,
    headPhone,
    area,
    staffName: staff,
    expectedMembers: masterMeta.expectedMembers,
    totalPrincipal: 0,
    totalPayable: 0,
    receivedCollAmt: masterMeta.receivedCollAmt,
    balanceCollAmt: masterMeta.balanceCollAmt,
    status: isClosed ? 'CLOSED' : 'LIVE',
    membersCount: 0
  };

  const groupMembers = [];

  if (wb && sheetNameMatch) {
    const ws = wb.Sheets[sheetNameMatch];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    // Extract member rows until total row
    for (let r = 1; r < data.length; r++) {
      const row = data[r] || [];
      const rowStr = row.join(' ').toUpperCase();
      if (rowStr.includes('TOTAL') || rowStr.includes('INSTALLMENT')) {
        // Stop if it's the summary total row
        if (groupMembers.length >= masterMeta.expectedMembers) break;
      }

      // Find person name
      let nameIdx = -1;
      let nameVal = '';
      for (let c = 6; c <= 11; c++) {
        if (isPersonName(row[c])) {
          nameIdx = c;
          nameVal = String(row[c]).trim();
          break;
        }
      }

      if (nameIdx !== -1) {
        let phone = '';
        let loanAmt = 0;
        let interest = 0;
        let totalPayable = 0;
        let nomineePhone = '';

        for (let c = nameIdx + 1; c < Math.min(row.length, nameIdx + 8); c++) {
          const val = row[c];
          if (val === null || val === '') continue;

          if (isPhone(val) && !phone) {
            phone = String(val).replace(/[^0-9]/g, '');
          } else if (String(val).includes('---') && !phone) {
            phone = '-';
          } else if (isPhone(val) && phone && !nomineePhone) {
            nomineePhone = String(val).replace(/[^0-9]/g, '');
          } else if (typeof val === 'number' || (!isNaN(parseFloat(val)) && !isPhone(val))) {
            const num = parseFloat(val);
            if (num >= 5000 && num <= 200000 && !loanAmt) {
              loanAmt = num;
            } else if (num >= 500 && num < 50000 && loanAmt && !interest) {
              interest = num;
            } else if (num >= 5000 && num <= 250000 && loanAmt && !totalPayable) {
              totalPayable = num;
            }
          }
        }

        // Nominee in col 17..25
        for (let c = 16; c < Math.min(row.length, 25); c++) {
          if (isPhone(row[c]) && String(row[c]) !== phone) {
            nomineePhone = String(row[c]).replace(/[^0-9]/g, '');
            break;
          }
        }

        // Fallbacks based on master loan per member if loanAmt is missing
        if (!loanAmt || loanAmt > 200000) {
          loanAmt = masterMeta.loanPerMember || 20000;
        }
        if (!interest) {
          if (loanAmt === 20000) interest = 3800;
          else if (loanAmt === 25000) interest = 6300;
          else if (loanAmt === 30000) interest = 9000;
          else interest = Math.round(loanAmt * 0.19);
        }
        if (!totalPayable) {
          totalPayable = loanAmt + interest;
        }

        groupMembers.push({
          name: nameVal,
          phone: phone || '-',
          nomineePhone: nomineePhone || '-',
          loanAmount: loanAmt,
          interest,
          totalPayable
        });

        if (groupMembers.length >= masterMeta.expectedMembers) break;
      }
    }
  }

  // If group had blank member names (like Deepam Group - 83 or Bala Murugan Group - 88)
  if (groupMembers.length === 0) {
    const memCount = masterMeta.expectedMembers || 1;
    const loanAmt = masterMeta.loanPerMember || 20000;
    const interest = loanAmt === 25000 ? 6300 : loanAmt === 30000 ? 9000 : 3800;
    const totalPayable = loanAmt + interest;

    for (let m = 1; m <= memCount; m++) {
      const mName = m === 1 && headName ? `${headName} (HEAD)` : `${gname.replace(/GROUP.*$/, '').trim()} MEMBER - ${m}`;
      const mPhone = m === 1 && headPhone ? headPhone : '-';
      groupMembers.push({
        name: mName,
        phone: mPhone,
        nomineePhone: '-',
        loanAmount: loanAmt,
        interest,
        totalPayable
      });
    }
  }

  // Ensure member count matches masterMeta.expectedMembers
  if (groupMembers.length < masterMeta.expectedMembers) {
    const loanAmt = masterMeta.loanPerMember || 20000;
    const interest = loanAmt === 25000 ? 6300 : loanAmt === 30000 ? 9000 : 3800;
    const totalPayable = loanAmt + interest;
    while (groupMembers.length < masterMeta.expectedMembers) {
      const mNum = groupMembers.length + 1;
      groupMembers.push({
        name: `${gname.replace(/GROUP.*$/, '').trim()} MEMBER - ${mNum}`,
        phone: '-',
        nomineePhone: '-',
        loanAmount: loanAmt,
        interest,
        totalPayable
      });
    }
  }

  // Add loans
  // Determine issue date
  let parsedIssueDate = parseDateCell(masterMeta.issueDate);
  if (!parsedIssueDate && summaryMeta?.loanIssueDate) {
    parsedIssueDate = parseDateCell(summaryMeta.loanIssueDate);
  }
  if (!parsedIssueDate) parsedIssueDate = new Date('2026-01-01');
  const issueDateStr = formatDateString(parsedIssueDate);

  for (const m of groupMembers) {
    const prodSchedule = getProductSchedule(m.loanAmount, masterMeta.totalWeeks);
    const tenureWeeks = prodSchedule.length;
    const totalPayableCalc = prodSchedule.reduce((s, it) => s + it.total, 0);
    const totalInterestCalc = prodSchedule.reduce((s, it) => s + it.interest, 0);
    const totalSavingsCalc = prodSchedule.reduce((s, it) => s + it.savings, 0);
    const custCleanName = String(m.name || '').toUpperCase();
    const isMemberClosed = (INDIVIDUAL_MEMBER_CLOSURES[groupRecord.groupCode] || []).some(n => custCleanName.includes(n));
    const memberIsClosed = isClosed || isMemberClosed;
    const receivedWeeks = memberIsClosed ? tenureWeeks : Math.min(tenureWeeks, masterMeta.receivedInst);
    const totalPaidCalc = memberIsClosed ? totalPayableCalc : prodSchedule.filter(it => it.week <= receivedWeeks).reduce((s, it) => s + it.total, 0);
    const outstandingCalc = Math.max(0, totalPayableCalc - totalPaidCalc);

    groupRecord.totalPrincipal += m.loanAmount;
    groupRecord.totalPayable += totalPayableCalc;
    groupRecord.membersCount++;

    const custIdStr = `ATH-PL-CUST-${String(globalCustId).padStart(4, '0')}`;
    const loanNumStr = `ATH-PL-LN-${groupRecord.groupCode}-${custIdStr}`;
    globalCustId++;

    let productTier = 'CUSTOM';
    if (m.loanAmount === 20000) productTier = 'TIER_A_20K';
    else if (m.loanAmount === 25000) productTier = 'TIER_B_25K';
    else if (m.loanAmount === 30000) productTier = 'TIER_C_30K';

    finalLoans.push({
      sNo: finalLoans.length + 1,
      branch: 'PL',
      customerId: custIdStr,
      borrowerName: m.name,
      phone: m.phone,
      nomineePhone: m.nomineePhone,
      groupCode: groupRecord.groupCode,
      groupName: groupRecord.groupName,
      cycle: groupRecord.cycle,
      collectionDay: groupRecord.collectionDay,
      area: groupRecord.area,
      assignedStaff: groupRecord.staffName,
      loanNumber: loanNumStr,
      issueDate: issueDateStr,
      productTier,
      principal: m.loanAmount,
      interest: totalInterestCalc,
      savings: totalSavingsCalc,
      totalPayable: totalPayableCalc,
      tenureWeeks,
      weeklyDue: prodSchedule[0]?.total || Math.round(totalPayableCalc / tenureWeeks),
      totalPaid: totalPaidCalc,
      outstanding: outstandingCalc,
      status: memberIsClosed ? 'CLOSED' : 'ACTIVE'
    });
  }

  finalGroups.push(groupRecord);
}

console.log(`\n================ FINAL NORMALIZED STATS ================`);
console.log(`Total Groups: ${finalGroups.length}`);
console.log(`Total Borrowers / Loans: ${finalLoans.length}`);
const sumPrincipal = finalLoans.reduce((s, l) => s + l.principal, 0);
const sumPayable = finalLoans.reduce((s, l) => s + l.totalPayable, 0);
const sumPaid = finalLoans.reduce((s, l) => s + l.totalPaid, 0);
const sumOutstanding = finalLoans.reduce((s, l) => s + l.outstanding, 0);

console.log(`Total Principal Amount: ₹${sumPrincipal.toLocaleString('en-IN')}`);
console.log(`Total Payable Amount:   ₹${sumPayable.toLocaleString('en-IN')}`);
console.log(`Total Paid Amount:      ₹${sumPaid.toLocaleString('en-IN')}`);
console.log(`Total Outstanding:      ₹${sumOutstanding.toLocaleString('en-IN')}`);

// Create Master Workbook
const masterOutWb = XLSX.utils.book_new();

// Sheet 1: MASTER_GROUPS
const groupsSheetData = [
  [
    'Branch', 'Group Code', 'Group Name', 'Cycle', 'Route Day', 'Head Name', 
    'Head Phone', 'Operational Area', 'Assigned Staff', 'Active Borrowers', 
    'Total Portfolio (Principal ₹)', 'Total Contractual Due (₹)', 
    'Collection Received (₹)', 'Balance Outstanding (₹)', 'Status'
  ],
  ...finalGroups.map(g => [
    'PL', g.groupCode, g.groupName, g.cycle, g.collectionDay, g.headName,
    g.headPhone, g.area, g.staffName, g.membersCount,
    g.totalPrincipal, g.totalPayable, g.receivedCollAmt, g.balanceCollAmt, g.status
  ])
];
const wsGroups = XLSX.utils.aoa_to_sheet(groupsSheetData);
XLSX.utils.book_append_sheet(masterOutWb, wsGroups, 'MASTER_GROUPS');

// Sheet 2: MASTER_LOANS_&_CUSTOMERS
const loansSheetData = [
  [
    'S.No', 'Branch', 'Customer ID', 'Borrower Name', 'Phone Number', 'Nominee Phone',
    'Group Code', 'Group Name', 'Cycle', 'Route Day', 'Area',
    'Assigned Staff', 'Loan Account #', 'Issue Date', 'Product Tier',
    'Principal Amount (₹)', 'Interest Amount (₹)', 'Total Contractual (₹)',
    'Tenure (Weeks)', 'Weekly Installment (₹)', 'Paid Amount (₹)',
    'Outstanding Balance (₹)', 'Status'
  ],
  ...finalLoans.map(l => [
    l.sNo, l.branch, l.customerId, l.borrowerName, l.phone, l.nomineePhone,
    l.groupCode, l.groupName, l.cycle, l.collectionDay, l.area,
    l.assignedStaff, l.loanNumber, l.issueDate, l.productTier,
    l.principal, l.interest, l.totalPayable, l.tenureWeeks, l.weeklyDue,
    l.totalPaid, l.outstanding, l.status
  ])
];
const wsLoans = XLSX.utils.aoa_to_sheet(loansSheetData);
XLSX.utils.book_append_sheet(masterOutWb, wsLoans, 'MASTER_LOANS');

// Sheet 3: ROUTE_WISE_COLLECTIONS
const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
for (const day of days) {
  const dayLoans = finalLoans.filter(l => l.collectionDay === day);
  const daySheetData = [
    [
      'Branch', 'Route Day', 'Group Code', 'Group Name', 'Area', 'Staff Collector',
      'Borrower Name', 'Phone', 'Loan Account #', 'Principal (₹)', 
      'Weekly Due (₹)', 'Total Paid (₹)', 'Outstanding (₹)', 'Status'
    ],
    ...dayLoans.map(l => [
      l.branch, l.collectionDay, l.groupCode, l.groupName, l.area, l.assignedStaff,
      l.borrowerName, l.phone, l.loanNumber, l.principal,
      l.weeklyDue, l.totalPaid, l.outstanding, l.status
    ])
  ];
  const wsDay = XLSX.utils.aoa_to_sheet(daySheetData);
  XLSX.utils.book_append_sheet(masterOutWb, wsDay, `${day}_ROUTE`);
}

// Write the master merged workbook
const outPath = path.join(baseDir, 'ATHIVEERA_MFI_MASTER_MERGED.xlsx');
XLSX.writeFile(masterOutWb, outPath);
console.log(`\n>>> Master Merged Workbook successfully written to: ${outPath} <<<`);
