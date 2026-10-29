const XLSX = require('xlsx');
const path = require('path');
const sourceDir = path.join(__dirname, '..', 'data', 'source_files');

function inspectGroup(filename, sheetName) {
  const wb = XLSX.readFile(path.join(sourceDir, filename), { cellFormula: true, cellStyles: true, cellDates: true });
  const sheet = wb.Sheets[sheetName];
  console.log(`\n=======================================================`);
  console.log(`GROUP: ${sheetName} in ${filename}`);
  console.log(`=======================================================`);
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  for (let i = 0; i < Math.min(45, data.length); i++) {
    let r = data[i];
    let lastIdx = r.length - 1;
    while (lastIdx >= 0 && (r[lastIdx] === '' || r[lastIdx] === null || r[lastIdx] === undefined)) lastIdx--;
    if (lastIdx >= 0) {
      console.log(`R${i + 1}:`, JSON.stringify(r.slice(0, Math.min(lastIdx + 1, 22))));
    }
  }
}

inspectGroup('THURSDAY.xlsx', 'MASANIAMMAN 2 GROUP - 82');
inspectGroup('WEDNESDAY.xlsx', 'VEERAMATHIAMMAN 2 GROUP - 48');
inspectGroup('TUESDAY.xlsx', 'SARGURU 2 GROUP - 84');
