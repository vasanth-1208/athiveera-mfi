const XLSX = require('xlsx');
const files = ['MONDAY.xlsx', 'TUESDAY.xlsx', 'WEDNESDAY.xlsx', 'THURSDAY.xlsx'];

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

for (const file of files) {
  const wb = XLSX.readFile(file);
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const sdata = XLSX.utils.sheet_to_json(ws, { header: 1 });
    for (let r = 1; r < sdata.length; r++) {
      const row = sdata[r];
      if (row && typeof row[0] === 'number') {
        const instWk = extractInstallmentWeek(row[2], row[0]);
        if (instWk === null) {
          console.log(`[${file} -> ${name}] Skipped row ${r}: S.NO ${row[0]}, Date ${row[1]}, Text: ${row[2]}`);
        } else if (instWk !== row[0]) {
          console.log(`[${file} -> ${name}] Row ${r}: S.NO ${row[0]} shifted to Week ${instWk}, Date: ${row[1]}`);
        }
      }
    }
  }
}

