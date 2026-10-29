const XLSX = require('xlsx');
const path = require('path');
const sourceDir = path.join(__dirname, '..', 'data', 'source_files');

const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];

const groups = [];
const customers = [];
const phoneSet = new Set();
const nameSet = new Set();
const areas = new Set();
const staff = new Set();

days.forEach(day => {
  const wb = XLSX.readFile(path.join(sourceDir, `${day}.xlsx`));
  const summarySheet = wb.Sheets[day];
  const sdata = XLSX.utils.sheet_to_json(summarySheet, { header: 1, raw: false, defval: '' });
  
  // Header row usually at R3
  for (let i = 3; i < sdata.length; i++) {
    const r = sdata[i];
    if (r[1] && r[1].trim() && r[1].includes('GROUP')) {
      const gname = r[1].trim();
      const headName = r[2] ? r[2].trim() : '';
      const mobile = r[3] ? r[3].trim() : '';
      const issueDate = r[4] ? r[4].trim() : '';
      const members = parseInt(r[5]) || 0;
      const area = r[12] ? r[12].trim() : '';
      const staffName = r[13] ? r[13].trim() : '';
      if (area) areas.add(area);
      if (staffName) staff.add(staffName);

      groups.push({
        day,
        groupName: gname,
        headName,
        mobile,
        issueDate,
        members,
        area,
        staffName
      });
    }
  }

  // Individual group sheets
  wb.SheetNames.filter(n => n !== day).forEach(gSheetName => {
    const gSheet = wb.Sheets[gSheetName];
    const gdata = XLSX.utils.sheet_to_json(gSheet, { header: 1, raw: false, defval: '' });
    // Look for group members table (usually starting around row 2, col I=8: LOAN DATE, col J=9: GROUP MEMBERS, col K=10: PH NO)
    for (let i = 1; i < gdata.length; i++) {
      const r = gdata[i];
      const memberName = r[9] ? r[9].trim() : '';
      const phone = r[10] ? r[10].trim() : '';
      const loanAmt = r[11] ? r[11].trim() : '';
      const nomineePhone = r[19] || r[20] || r[21] || '';
      
      if (memberName && memberName !== 'GROUP MEMBERS' && !memberName.includes('TOTAL')) {
        customers.push({
          groupName: gSheetName,
          day,
          name: memberName,
          phone,
          loanAmt,
          nomineePhone: typeof nomineePhone === 'string' ? nomineePhone.trim() : nomineePhone
        });
        if (phone && phone !== '-------' && phone.length >= 10) phoneSet.add(phone);
        if (memberName) nameSet.add(memberName.toLowerCase());
      }
    }
  });
});

console.log(`Total group entries found in weekday summaries: ${groups.length}`);
console.log(`Total member entries found across all group sheets: ${customers.length}`);
console.log(`Unique customer phones (>= 10 digits): ${phoneSet.size}`);
console.log(`Unique customer names: ${nameSet.size}`);
console.log(`Areas found (${areas.size}):`, Array.from(areas));
console.log(`Staff names found (${staff.size}):`, Array.from(staff));
