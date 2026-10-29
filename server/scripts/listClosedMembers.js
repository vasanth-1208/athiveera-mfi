const XLSX = require('xlsx');
const files = ['MONDAY.xlsx', 'TUESDAY.xlsx', 'WEDNESDAY.xlsx', 'THURSDAY.xlsx'];

for (const file of files) {
  const wb = XLSX.readFile(file);
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const sdata = XLSX.utils.sheet_to_json(ws, { header: 1 });
    for (let r = 1; r < sdata.length; r++) {
      const row = sdata[r];
      const rowStr = JSON.stringify(row || []);
      if (rowStr.includes('CLOSED') || rowStr.includes('RELOAN')) {
        console.log(`[${name}] Row ${r}: ${rowStr}`);
      }
    }
  }
}

