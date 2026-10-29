const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const files = [
  'OVER ALL.xlsx',
  'PENDING.xlsx',
  'Z LEDGER NOTE BOOK.xlsx',
  'MONDAY.xlsx',
  'TUESDAY.xlsx',
  'WEDNESDAY.xlsx',
  'THURSDAY.xlsx'
];

const sourceDir = path.join(__dirname, '..', 'data', 'source_files');

function inspectWorkbook(filename) {
  const filePath = path.join(sourceDir, filename);
  console.log(`\n==================================================`);
  console.log(`INSPECTING: ${filename} (Size: ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB)`);
  console.log(`==================================================`);

  const workbook = XLSX.readFile(filePath, { cellFormula: true, cellStyles: true, cellDates: true, sheetRows: 50 });
  
  console.log(`Sheets in ${filename}:`, workbook.SheetNames);

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const ref = sheet['!ref'] || 'Empty';
    console.log(`\n--- Sheet: "${sheetName}" (Range: ${ref}) ---`);

    // Merged cells
    if (sheet['!merges'] && sheet['!merges'].length > 0) {
      console.log(`Merged cell ranges count: ${sheet['!merges'].length}`);
      console.log(`First 5 merges:`, sheet['!merges'].slice(0, 5));
    }

    // Convert to JSON (rows)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
    console.log(`Total sample rows loaded (up to 50): ${rows.length}`);
    
    // Print first 10 rows
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const nonEmpties = rows[i].filter(cell => cell !== '');
      if (nonEmpties.length > 0) {
        console.log(`Row ${i + 1}:`, JSON.stringify(rows[i].slice(0, 15)));
      }
    }

    // Check for formula cells
    const formulaCells = [];
    Object.keys(sheet).forEach(cellKey => {
      if (cellKey.startsWith('!')) return;
      const cell = sheet[cellKey];
      if (cell && cell.f) {
        formulaCells.push({ cell: cellKey, formula: cell.f, val: cell.v });
      }
    });
    if (formulaCells.length > 0) {
      console.log(`Found ${formulaCells.length} formula cells in first 50 rows. First 5 formulas:`, formulaCells.slice(0, 5));
    } else {
      console.log(`No formula cells found in first 50 rows.`);
    }
  });
}

for (const file of files) {
  try {
    inspectWorkbook(file);
  } catch (err) {
    console.error(`Error inspecting ${file}:`, err.message);
  }
}
