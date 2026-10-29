const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'data', 'source_files');

function dumpSheet(filename, sheetName, maxRows = 60) {
  const filePath = path.join(sourceDir, filename);
  const wb = XLSX.readFile(filePath, { cellFormula: true, cellStyles: true, cellDates: true });
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    console.log(`Sheet ${sheetName} not found in ${filename}`);
    return;
  }
  console.log(`\n=======================================================`);
  console.log(`FILE: ${filename} | SHEET: ${sheetName} | RANGE: ${sheet['!ref']}`);
  console.log(`=======================================================`);

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  for (let r = 0; r < Math.min(data.length, maxRows); r++) {
    const row = data[r];
    // filter trailing empty strings
    let lastIdx = row.length - 1;
    while (lastIdx >= 0 && (row[lastIdx] === '' || row[lastIdx] === null || row[lastIdx] === undefined)) {
      lastIdx--;
    }
    if (lastIdx >= 0) {
      console.log(`R${r + 1}:`, JSON.stringify(row.slice(0, lastIdx + 1)));
    }
  }

  // Check all formulas in sheet
  const formulas = [];
  Object.keys(sheet).forEach(cell => {
    if (cell.startsWith('!')) return;
    if (sheet[cell] && sheet[cell].f) {
      formulas.push({ cell, f: sheet[cell].f, v: sheet[cell].v });
    }
  });
  console.log(`Total formulas in sheet: ${formulas.length}`);
  if (formulas.length > 0) {
    console.log(`Sample formulas:`, formulas.slice(0, 15));
  }
}

function listAllSheets(filename) {
  const filePath = path.join(sourceDir, filename);
  const wb = XLSX.readFile(filePath, { bookSheets: true });
  console.log(`\n>>> ${filename} sheets (${wb.SheetNames.length}):`, wb.SheetNames);
}

// 1. List sheets in all files
['OVER ALL.xlsx', 'PENDING.xlsx', 'Z LEDGER NOTE BOOK.xlsx', 'MONDAY.xlsx', 'TUESDAY.xlsx', 'WEDNESDAY.xlsx', 'THURSDAY.xlsx'].forEach(listAllSheets);

// 2. Dump OVER ALL.xlsx sheets
const overAllWb = XLSX.readFile(path.join(sourceDir, 'OVER ALL.xlsx'));
overAllWb.SheetNames.forEach(s => dumpSheet('OVER ALL.xlsx', s, 50));

// 3. Dump PENDING.xlsx sheets
const pendingWb = XLSX.readFile(path.join(sourceDir, 'PENDING.xlsx'));
pendingWb.SheetNames.forEach(s => dumpSheet('PENDING.xlsx', s, 50));

// 4. Dump Z LEDGER NOTE BOOK.xlsx sheets
const ledgerWb = XLSX.readFile(path.join(sourceDir, 'Z LEDGER NOTE BOOK.xlsx'));
ledgerWb.SheetNames.forEach(s => dumpSheet('Z LEDGER NOTE BOOK.xlsx', s, 50));
