const XLSX = require('xlsx');
const wb = XLSX.readFile('c:/Projects/Athiveera MFI/Z LEDGER NOTE BOOK.xlsx');
const ws = wb.Sheets['INTEREST DISCOUNT'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
console.log('INTEREST DISCOUNT Rows:');
for (let r = 0; r < Math.min(15, data.length); r++) {
  console.log(`Row ${r}:`, data[r]);
}
