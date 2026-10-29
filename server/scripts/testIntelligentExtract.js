const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const baseDir = 'c:/Projects/Athiveera MFI';
const weekdayFiles = ['MONDAY.xlsx', 'TUESDAY.xlsx', 'WEDNESDAY.xlsx', 'THURSDAY.xlsx'];

// 1. Read OVER ALL.xlsx G.NAME sheet to get master group list
const overallWb = XLSX.readFile(path.join(baseDir, 'OVER ALL.xlsx'));
const gnameSheet = overallWb.Sheets['G.NAME'];
const gnameData = XLSX.utils.sheet_to_json(gnameSheet, { header: 1, defval: null });

const masterGroups = new Map();
for (let i = 1; i <= 98; i++) {
  const r = gnameData[i];
  if (r && r[1]) {
    const rawName = String(r[1]).trim();
    masterGroups.set(rawName, {
      groupCode: r[0],
      groupName: rawName,
      issueDate: r[2],
      expectedMembers: r[3],
      receivedInst: r[4],
      receivedCollAmt: r[5],
      balanceCollAmt: r[6],
      collectionDay: r[7],
      loanPerMember: r[9]
    });
  }
}
console.log(`Loaded ${masterGroups.size} master groups from OVER ALL.xlsx`);

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
  // Ignore header or summary words
  const blackList = ['TOTAL', 'INSTALLMENT', 'LOAN DATE', 'GROUP MEMBERS', 'PH NO', 'LOAN AMOUNT', 'INTEREST', '0-10', '11-20', '21-30', '31-32', '31-40', 'S.NO', 'DATE', 'AMT', 'PER WEEK', 'ADVANCE', 'BALANCE', 'REMARKS'];
  for (const b of blackList) {
    if (str === b || str.startsWith(b)) return false;
  }
  // Must contain letters
  return /[A-Z]/.test(str);
}

const extractedAllGroups = [];

for (const file of weekdayFiles) {
  const filePath = path.join(baseDir, file);
  const dayName = file.replace('.xlsx', '');
  const wb = XLSX.readFile(filePath, { cellDates: true });
  
  // Also read summary sheet to get group metadata (area, staff, head, etc.)
  const summaryWs = wb.Sheets[dayName];
  const summaryData = summaryWs ? XLSX.utils.sheet_to_json(summaryWs, { header: 1, defval: null }) : [];
  const groupMetaFromSummary = new Map();
  for (let r = 3; r < summaryData.length; r++) {
    const row = summaryData[r];
    if (row && row[1] && String(row[1]).includes('GROUP')) {
      const gname = String(row[1]).trim();
      groupMetaFromSummary.set(gname, {
        headName: row[2] ? String(row[2]).trim() : '',
        headPhone: row[3] ? String(row[3]).trim() : '',
        membersCount: parseInt(row[5]) || 0,
        area: row[12] ? String(row[12]).trim() : '',
        staff: row[13] ? String(row[13]).trim() : '',
        pending: parseFloat(row[14]) || 0,
        received: parseFloat(row[15]) || 0,
        remarks: row[16] ? String(row[16]).trim() : ''
      });
    }
  }

  const groupSheetNames = wb.SheetNames.filter(n => n !== dayName);

  for (const gname of groupSheetNames) {
    const ws = wb.Sheets[gname];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const cleanGName = gname.trim();

    // Summary meta
    const summaryMeta = groupMetaFromSummary.get(cleanGName) || {};

    // Analyze sheet row by row to find member loan entries
    const members = [];
    for (let r = 1; r < data.length; r++) {
      const row = data[r] || [];
      // Look for a borrower name in cols 7 to 11
      let nameIdx = -1;
      let nameVal = '';
      for (let c = 7; c <= 11; c++) {
        if (isPersonName(row[c])) {
          nameIdx = c;
          nameVal = String(row[c]).trim();
          break;
        }
      }

      if (nameIdx !== -1) {
        // We found a member row!
        // Now find phone, loan, interest, total in this row
        let phone = '';
        let loanAmt = 0;
        let interest = 0;
        let totalPayable = 0;
        let nomineePhone = '';

        // Check cells around nameIdx
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

        // If totalPayable is not explicitly found, calculate from loanAmt + interest
        if (!totalPayable && loanAmt && interest) {
          totalPayable = loanAmt + interest;
        } else if (!interest && loanAmt && totalPayable && totalPayable > loanAmt) {
          interest = totalPayable - loanAmt;
        }

        // Check nominee phone in later columns (cols 18..25)
        for (let c = 17; c < Math.min(row.length, 25); c++) {
          if (isPhone(row[c]) && String(row[c]) !== phone) {
            nomineePhone = String(row[c]).replace(/[^0-9]/g, '');
            break;
          }
        }

        members.push({
          rowIdx: r,
          name: nameVal,
          phone: phone || '-',
          nomineePhone: nomineePhone || '-',
          loanAmount: loanAmt,
          interest,
          totalPayable
        });
      }
    }

    extractedAllGroups.push({
      file,
      day: dayName,
      sheetName: gname,
      headName: summaryMeta.headName || '',
      headPhone: summaryMeta.headPhone || '',
      area: summaryMeta.area || '',
      staff: summaryMeta.staff || '',
      memberCount: members.length,
      members
    });
  }
}

console.log(`\n================ EXTRACTED SUMMARY ================`);
console.log(`Total group sheets processed: ${extractedAllGroups.length}`);

let totalExtractedMembers = 0;
let totalExtractedPrincipal = 0;
let totalExtractedPayable = 0;
let issues = [];

for (const g of extractedAllGroups) {
  totalExtractedMembers += g.memberCount;
  for (const m of g.members) {
    totalExtractedPrincipal += m.loanAmount;
    totalExtractedPayable += m.totalPayable;
    if (m.loanAmount <= 0) {
      issues.push(`Zero principal in ${g.sheetName}: ${m.name}`);
    }
    if (m.loanAmount > 200000) {
      issues.push(`Suspect high principal (${m.loanAmount}) in ${g.sheetName}: ${m.name}`);
    }
  }
}

console.log(`Total Extracted Borrowers: ${totalExtractedMembers}`);
console.log(`Total Extracted Principal: ₹${totalExtractedPrincipal.toLocaleString('en-IN')}`);
console.log(`Total Extracted Total Payable: ₹${totalExtractedPayable.toLocaleString('en-IN')}`);
console.log(`Issues count: ${issues.length}`);
if (issues.length > 0) {
  console.log('Sample issues:', issues.slice(0, 10));
}
