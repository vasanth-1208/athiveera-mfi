const XLSX = require('xlsx');
const wb = XLSX.readFile('c:/Projects/Athiveera MFI/MONDAY.xlsx');
const ws = wb.Sheets['PALAYATHU AMMAN GROUP - 94'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
for (let r = 0; r < Math.min(10, data.length); r++) {
  console.log(`Row ${r}:`, data[r].slice(6, 17));
}
