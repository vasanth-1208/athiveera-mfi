const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('=== CHECKING GROUP 30 (THANGAMANI.S) ===');
  const loan30 = await db.collection('loans').findOne({ loanNumber: { $regex: 'LN-30-' } });
  console.log('Loan 30 Summary:', {
    loanNumber: loan30.loanNumber,
    customerName: loan30.customerName,
    principal: loan30.principal,
    interest: loan30.interestAmount,
    savings: loan30.savingsAmount,
    totalPayable: loan30.totalPayable,
    totalPaid: loan30.totalPaid,
    outstandingTotal: loan30.outstandingTotal,
    tenureWeeks: loan30.tenureWeeks,
    disbursedDate: loan30.disbursedDate.toISOString().split('T')[0]
  });

  const insts30 = await db.collection('installments').find({ loanId: loan30._id }).sort({ installmentNumber: 1 }).toArray();
  console.log('Installments count for Loan 30:', insts30.length);
  [0, 9, 10, 19, 20, 28, 29, 30, 31].forEach(idx => {
    if (insts30[idx]) {
      const i = insts30[idx];
      console.log(' W' + i.installmentNumber, 'Due:', i.dueDate.toISOString().split('T')[0], 'Exp:', i.expectedAmount, 'P:', i.allocatedPrincipal, 'Int:', i.allocatedInterest, 'Sav:', i.allocatedSavings, 'Paid:', i.paidAmount, 'Bal:', i.balanceAmount, 'Status:', i.status);
    }
  });

  console.log('\n=== CHECKING GROUP 71 (SUGANTHERI.G) ===');
  const loan71 = await db.collection('loans').findOne({ loanNumber: { $regex: 'LN-71-' } });
  console.log('Loan 71 Summary:', {
    loanNumber: loan71.loanNumber,
    customerName: loan71.customerName,
    principal: loan71.principal,
    interest: loan71.interestAmount,
    savings: loan71.savingsAmount,
    totalPayable: loan71.totalPayable,
    totalPaid: loan71.totalPaid,
    outstandingTotal: loan71.outstandingTotal,
    tenureWeeks: loan71.tenureWeeks,
    disbursedDate: loan71.disbursedDate.toISOString().split('T')[0]
  });

  const insts71 = await db.collection('installments').find({ loanId: loan71._id }).sort({ installmentNumber: 1 }).toArray();
  console.log('Installments count for Loan 71:', insts71.length);
  [0, 1, 9, 10, 11, 12, 39].forEach(idx => {
    if (insts71[idx]) {
      const i = insts71[idx];
      console.log(' W' + i.installmentNumber, 'Due:', i.dueDate.toISOString().split('T')[0], 'Exp:', i.expectedAmount, 'P:', i.allocatedPrincipal, 'Int:', i.allocatedInterest, 'Sav:', i.allocatedSavings, 'Paid:', i.paidAmount, 'Bal:', i.balanceAmount, 'Status:', i.status);
    }
  });

  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
