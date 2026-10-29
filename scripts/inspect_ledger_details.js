const XLSX = require('xlsx');
const path = require('path');
const sourceDir = path.join(__dirname, '..', 'data', 'source_files');

const wb = XLSX.readFile(path.join(sourceDir, 'Z LEDGER NOTE BOOK.xlsx'), { cellFormula: true, cellStyles: true, cellDates: true });

// Check EXPENSES sheet
const expSheet = wb.Sheets['EXPENSES'];
const expData = XLSX.utils.sheet_to_json(expSheet, { header: 1, raw: false, defval: '' });
const categories = new Set();
let expTotal = 0;
for (let i = 3; i < expData.length; i++) {
  const r = expData[i];
  const cat = r[2] ? r[2].trim() : '';
  const amt = parseFloat(r[3]) || 0;
  if (cat && !cat.includes('TOTAL')) {
    categories.add(cat);
    expTotal += amt;
  }
}

console.log(`EXPENSES:`);
console.log(`Unique Expense Categories (${categories.size}):`, Array.from(categories));
console.log(`Sum of expense rows: ${expTotal}`);

// Check LEDGER sheet
const ledgerSheet = wb.Sheets['LEDGER'];
const ledgerData = XLSX.utils.sheet_to_json(ledgerSheet, { header: 1, raw: false, defval: '' });
let crTotal = 0;
let drTotal = 0;
const ledgerParticulars = new Set();
for (let i = 1; i < ledgerData.length; i++) {
  const r = ledgerData[i];
  const particular = r[1] ? r[1].trim() : '';
  const cr = parseFloat(r[2]) || 0;
  const dr = parseFloat(r[3]) || 0;
  if (particular && !particular.includes('TOTAL') && !particular.includes('SUM')) {
    ledgerParticulars.add(particular);
    crTotal += cr;
    drTotal += dr;
  }
}

console.log(`\nLEDGER:`);
console.log(`Distinct particulars sample (${ledgerParticulars.size}):`, Array.from(ledgerParticulars).slice(0, 25));
console.log(`CR sum: ${crTotal}, DR sum: ${drTotal}`);
