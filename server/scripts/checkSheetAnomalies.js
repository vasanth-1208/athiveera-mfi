const XLSX = require('xlsx');
const path = require('path');
const baseDir = 'c:/Projects/Athiveera MFI';

const weekdayFiles = ['MONDAY.xlsx', 'TUESDAY.xlsx', 'WEDNESDAY.xlsx', 'THURSDAY.xlsx'];

for (const file of weekdayFiles) {
  const wb = XLSX.readFile(path.join(baseDir, file));
  const dayName = file.replace('.xlsx', '');
  const groupSheets = wb.SheetNames.filter(n => n !== dayName);
  console.log(`\n================ ${file} (${groupSheets.length} groups) ================`);

  for (const gname of groupSheets) {
    const ws = wb.Sheets[gname];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    const r0 = data[0] || [];
    let nameCol = -1;
    let phoneCol = -1;
    let loanCol = -1;
    let intCol = -1;
    let totCol = -1;

    for (let c = 0; c < r0.length; c++) {
      const v = String(r0[c] || '').toUpperCase().trim();
      if (v.includes('MEMBER')) nameCol = c;
      if (v.includes('PH') || v.includes('MOBILE') || v.includes('PHONE')) phoneCol = c;
      if (v.includes('LOAN AMOUNT') || v.includes('PRICIPAL') || v.includes('PRINCIPAL')) loanCol = c;
      if (v.includes('INTEREST') || v.includes('INT')) intCol = c;
      if (v.includes('TOTAL') || v.includes('TOT')) totCol = c;
    }

    // Inspect rows 1 to 10 for actual values
    const rows = [];
    for (let r = 1; r < Math.min(12, data.length); r++) {
      const row = data[r] || [];
      // check any non-empty cell in cols 8..15
      const slice = row.slice(8, 16);
      if (slice.some(v => v !== null && v !== '')) {
        rows.push({
          r,
          c8: row[8],
          c9: row[9],
          c10: row[10],
          c11: row[11],
          c12: row[12],
          c13: row[13],
          c14: row[14]
        });
      }
    }

    // Check if headers match standard r0 [c9: MEMBER, c10: PH, c11: LOAN AMOUNT, c12: INTEREST, c13: TOTAL]
    if (nameCol !== 9 || phoneCol !== 10 || loanCol !== 11) {
      console.log(`[HEADER SHIFT] Sheet: "${gname}" -> nameCol:${nameCol}, phoneCol:${phoneCol}, loanCol:${loanCol}, intCol:${intCol}, totCol:${totCol}`);
      console.log(`   r0:`, r0.slice(7, 16));
      console.log(`   rows sample:`, rows.slice(0, 3));
    }
  }
}
