const XLSX = require('xlsx');
const path = require('path');
const sourceDir = path.join(__dirname, '..', 'data', 'source_files');

const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];

for (const day of days) {
  const wb = XLSX.readFile(path.join(sourceDir, `${day}.xlsx`), { cellFormula: true, cellStyles: true, cellDates: true });
  console.log(`\n=======================================================`);
  console.log(`WEEKDAY FILE: ${day}.xlsx | TOTAL SHEETS: ${wb.SheetNames.length}`);
  console.log(`=======================================================`);

  // Inspect the summary sheet
  const summarySheet = wb.Sheets[day];
  if (summarySheet) {
    console.log(`--- Summary Sheet: ${day} (Range: ${summarySheet['!ref']}) ---`);
    const sdata = XLSX.utils.sheet_to_json(summarySheet, { header: 1, raw: false, defval: '' });
    for (let i = 0; i < Math.min(25, sdata.length); i++) {
      let r = sdata[i];
      let lastIdx = r.length - 1;
      while (lastIdx >= 0 && (r[lastIdx] === '' || r[lastIdx] === null || r[lastIdx] === undefined)) lastIdx--;
      if (lastIdx >= 0) {
        console.log(`R${i + 1}:`, JSON.stringify(r.slice(0, Math.min(lastIdx + 1, 15))));
      }
    }
  }

  // Inspect 1 or 2 group sheets
  const groupSheetNames = wb.SheetNames.filter(n => n !== day);
  console.log(`Sample group sheet: ${groupSheetNames[0]}`);
  const gSheet = wb.Sheets[groupSheetNames[0]];
  if (gSheet) {
    console.log(`Range: ${gSheet['!ref']}`);
    const gdata = XLSX.utils.sheet_to_json(gSheet, { header: 1, raw: false, defval: '' });
    for (let i = 0; i < Math.min(20, gdata.length); i++) {
      let r = gdata[i];
      let lastIdx = r.length - 1;
      while (lastIdx >= 0 && (r[lastIdx] === '' || r[lastIdx] === null || r[lastIdx] === undefined)) lastIdx--;
      if (lastIdx >= 0) {
        console.log(`R${i + 1}:`, JSON.stringify(r.slice(0, Math.min(lastIdx + 1, 20))));
      }
    }
  }
}
