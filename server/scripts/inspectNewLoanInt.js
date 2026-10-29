const XLSX = require('xlsx');
const wb = XLSX.readFile('c:/Projects/Athiveera MFI/NEW LOAN INT.xlsx');
console.log('NEW LOAN INT Sheet Names:', wb.SheetNames);
for (const sn of wb.SheetNames) {
  const ws = wb.Sheets[sn];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log('Sheet:', sn, 'Rows:', data.length);
  for (let r = 0; r < Math.min(12, data.length); r++) {
    const row = (data[r] || []).map((v, c) => v !== null && v !== '' ? `[c${c}]:${v}` : null).filter(Boolean);
    if (row.length > 0) {
      console.log(`Row ${r}: ${row.slice(0, 10).join(' | ')}`);
    }
  }
}
