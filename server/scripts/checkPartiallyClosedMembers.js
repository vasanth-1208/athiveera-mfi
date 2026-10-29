const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Loan = mongoose.model('Loan', new mongoose.Schema({}, { strict: false }));
  const checkGroups = [36, 30, 35, 37, 46, 47, 64];
  for (const g of checkGroups) {
    const loans = await Loan.find({ loanNumber: new RegExp('LN-' + g + '-') });
    console.log(`Group ${g} has ${loans.length} loans:`);
    loans.forEach(l => console.log('  ', l.loanNumber, l.customerName, 'Status:', l.status));
  }
  process.exit(0);
}
check();

