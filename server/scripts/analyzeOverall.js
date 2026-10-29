const XLSX = require('xlsx');
const wb = XLSX.readFile('c:/Projects/Athiveera MFI/OVER ALL.xlsx');
const ws = wb.Sheets['G.NAME'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
console.log('--- Rows 95 to end of G.NAME ---');
for (let i = 95; i < data.length; i++) {
  const r = data[i];
  if (r && r.some(v => v !== null && v !== '')) {
    console.log(`[${i}]`, r.slice(0, 10));
  }
}
