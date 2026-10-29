const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function verifyAll() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const totalGroups = await db.collection('groups').countDocuments();
  const totalCustomers = await db.collection('customers').countDocuments();
  const totalLoans = await db.collection('loans').countDocuments();
  const activeLoans = await db.collection('loans').countDocuments({ status: 'ACTIVE' });
  const closedLoans = await db.collection('loans').countDocuments({ status: { $in: ['CLOSED', 'SETTLED'] } });
  const overdueLoans = await db.collection('loans').countDocuments({ status: 'OVERDUE' });
  const totalInstallments = await db.collection('installments').countDocuments();
  const paidInstallments = await db.collection('installments').countDocuments({ status: 'PAID' });
  const pendingInstallments = await db.collection('installments').countDocuments({ status: 'PENDING' });
  const overdueInstallments = await db.collection('installments').countDocuments({ status: 'OVERDUE' });
  const totalPayments = await db.collection('payments').countDocuments();

  const loans = await db.collection('loans').find({}).toArray();
  const totalPrincipal = loans.reduce((s, l) => s + (l.principal || 0), 0);
  const totalPayable = loans.reduce((s, l) => s + (l.totalPayable || 0), 0);
  const totalPaid = loans.reduce((s, l) => s + (l.totalPaid || 0), 0);
  const totalOutstanding = loans.reduce((s, l) => s + (l.outstandingTotal || 0), 0);

  console.log('================ SYSTEM-WIDE DATA RECONCILIATION ================');
  console.log('Total Groups:           ', totalGroups, '(Expected: 98 from OVER ALL.xlsx)');
  console.log('Total Customer Records: ', totalCustomers, '(Expected: 349 from OVER ALL.xlsx)');
  console.log('Total Loans:            ', totalLoans, '(Expected: 349 from OVER ALL.xlsx)');
  console.log(' - Active Loans:        ', activeLoans);
  console.log(' - Closed/Settled Loans:', closedLoans);
  console.log(' - Overdue Loans:       ', overdueLoans);
  console.log('Total Installments:     ', totalInstallments);
  console.log(' - Paid Installments:   ', paidInstallments);
  console.log(' - Pending Installments:', pendingInstallments);
  console.log(' - Overdue Installments:', overdueInstallments);
  console.log('Total Payments Recorded:', totalPayments);
  console.log('------------------------------------------------------------------');
  console.log('Total Principal:        ₹' + totalPrincipal.toLocaleString('en-IN'), '(Expected: ~₹76,70,000)');
  console.log('Total Contractual:      ₹' + totalPayable.toLocaleString('en-IN'));
  console.log('Total Repaid:           ₹' + totalPaid.toLocaleString('en-IN'), '(Expected: ~₹56,61,750)');
  console.log('Total Outstanding:      ₹' + totalOutstanding.toLocaleString('en-IN'), '(Expected: ~₹36,66,650)');
  console.log('==================================================================');

  process.exit(0);
}

verifyAll().catch(err => {
  console.error(err);
  process.exit(1);
});

