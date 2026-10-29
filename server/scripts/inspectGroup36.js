const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function inspect() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Loan = mongoose.model('Loan', new mongoose.Schema({}, { strict: false }));
  const Installment = mongoose.model('Installment', new mongoose.Schema({}, { strict: false }));
  
  const loans = await Loan.find({ loanNumber: /LN-36-/ });
  console.log(`Found ${loans.length} loans for Group 36:`);
  for (const l of loans) {
    console.log(`- ${l.loanNumber}: ${l.customerName} | Status: ${l.status} | Disbursed: ${l.principal} | TotalPaid: ${l.totalPaid} | Outstanding: ${l.outstandingTotal}`);
    const insts = await Installment.find({ loanId: l._id }).sort({ installmentNumber: 1 });
    console.log(`  Installments count: ${insts.length}`);
    insts.slice(24, 30).forEach(ins => {
      console.log(`    W${ins.installmentNumber} (${ins.dueDate ? ins.dueDate.toISOString().split('T')[0] : 'no date'}): Exp: ${ins.expectedAmount} Paid: ${ins.paidAmount} Bal: ${ins.balanceAmount} Status: ${ins.status}`);
    });
  }
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});

