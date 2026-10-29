const path = require('path');
const XLSX = require('xlsx');

const files = ['MONDAY.xlsx', 'TUESDAY.xlsx', 'WEDNESDAY.xlsx', 'THURSDAY.xlsx'];

for (const file of files) {
  const wb = XLSX.readFile(file);
  for (const name of wb.SheetNames) {
    const s = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json(s, { header: 1 });
    data.forEach((r, idx) => {
      const rowStr = JSON.stringify(r);
      if (
        rowStr.includes('CLOSED') ||
        rowStr.includes('RELOAN') ||
        rowStr.includes('SETTLED') ||
        rowStr.includes('DISCOUNT')
      ) {
        console.log(`[${file} -> ${name}] row ${idx}: ${rowStr}`);
      }
    });
  }
}

