const XLSX = require('xlsx');
const path = require('path');
const baseDir = 'c:/Projects/Athiveera MFI';

const targetSheets = [
  { file: 'TUESDAY.xlsx', sheet: 'VIRUPATCHI GROUP - 30' },
  { file: 'TUESDAY.xlsx', sheet: 'NARASIMMAN GROUP - 33' },
  { file: 'TUESDAY.xlsx', sheet: 'NAGAMMAN GROUP-38' },
  { file: 'WEDNESDAY.xlsx', sheet: 'MALLIGAI GROUP - 10' },
  { file: 'THURSDAY.xlsx', sheet: 'GANGAI GROUP - 47' },
  { file: 'MONDAY.xlsx', sheet: 'PALAYATHU AMMAN GROUP - 94' },
  { file: 'TUESDAY.xlsx', sheet: 'SARAVANA BAVAN GROUP - 32' },
  { file: 'TUESDAY.xlsx', sheet: 'SARAVANA BAVAN 2 GROUP - 90' },
  { file: 'WEDNESDAY.xlsx', sheet: 'SURIYA GANDHI 2 GROUP - 79' },
  { file: 'THURSDAY.xlsx', sheet: 'DEEPAM GROUP - 83' },
  { file: 'THURSDAY.xlsx', sheet: 'BALA MURUGAN GROUP - 88' }
];

for (const t of targetSheets) {
  const wb = XLSX.readFile(path.join(baseDir, t.file));
  const ws = wb.Sheets[t.sheet];
  if (!ws) {
    console.log(`Sheet not found: ${t.sheet} in ${t.file}`);
    continue;
  }
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log(`\n=================== ${t.sheet} (${t.file}) Rows: ${data.length} ===================`);
  for (let r = 0; r < Math.min(15, data.length); r++) {
    const row = data[r];
    const nonNulls = (row || []).map((v, c) => v !== null && v !== '' ? `[c${c}]:${v}` : null).filter(Boolean);
    if (nonNulls.length > 0) {
      console.log(`Row ${r}: ${nonNulls.join(' | ')}`);
    }
  }
}
