const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const files = ['MONDAY.xlsx', 'TUESDAY.xlsx', 'WEDNESDAY.xlsx', 'THURSDAY.xlsx', 'OVER ALL.xlsx', 'NEW LOAN INT.xlsx', 'PENDING.xlsx', 'Z LEDGER NOTE BOOK.xlsx'];

const baseDir = 'c:/Projects/Athiveera MFI';

for (const file of files) {
  const filePath = path.join(baseDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`FILE NOT FOUND: ${file}`);
    continue;
  }
  const wb = XLSX.readFile(filePath, { cellFormula: false, cellDates: true });
  console.log(`\n======================================================`);
  console.log(`FILE: ${file} (Sheet count: ${wb.SheetNames.length})`);
  console.log(`Sheet Names: ${wb.SheetNames.join(', ')}`);

  // Let's inspect first few sheets or summary sheet
  for (const sheetName of wb.SheetNames.slice(0, 3)) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    console.log(`\n--- Sheet: [${sheetName}] (Rows: ${data.length}) ---`);
    for (let i = 0; i < Math.min(6, data.length); i++) {
      const nonNulls = (data[i] || []).map((v, idx) => v !== null && v !== '' ? `[c${idx}]:${v}` : null).filter(Boolean);
      console.log(` Row ${i}: ${nonNulls.slice(0, 10).join(' | ')}`);
    }
  }
}
