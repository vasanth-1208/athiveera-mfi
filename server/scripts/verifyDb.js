const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const enqCount = await db.collection('enquiries').countDocuments();
  console.log('Enquiries count (should be 0):', enqCount);

  const groupCount = await db.collection('groups').countDocuments();
  const customerCount = await db.collection('customers').countDocuments();
  const loanCount = await db.collection('loans').countDocuments();
  const instCount = await db.collection('installments').countDocuments();
  const payCount = await db.collection('payments').countDocuments();

  console.log('Groups in DB:', groupCount);
  console.log('Customers in DB:', customerCount);
  console.log('Loans in DB:', loanCount);
  console.log('Installments in DB:', instCount);
  console.log('Payments in DB:', payCount);

  const sampleCust = await db.collection('customers').findOne();
  console.log('Sample customer ID:', sampleCust.customerId, sampleCust.name);

  const sampleLoan = await db.collection('loans').findOne();
  console.log('Sample loan Number:', sampleLoan.loanNumber, sampleLoan.principal, sampleLoan.status);

  // Group members check
  const emptyGroups = await db.collection('groups').find({ totalMembers: 0 }).toArray();
  console.log('Groups with 0 members (should be 0):', emptyGroups.length);

  // Sample group with its members
  const g1 = await db.collection('groups').findOne({ groupCode: 1 });
  const g1Loans = await db.collection('loans').find({ groupId: g1._id }).toArray();
  console.log(`\nGroup #1 (${g1.name}) - Active Borrowers: ${g1.totalMembers}`);
  g1Loans.forEach(l => console.log(` - Loan: ${l.loanNumber} | Cust: ${l.customerName} | Status: ${l.status}`));

  // Check tricky group 90
  const g90 = await db.collection('groups').findOne({ groupCode: 90 });
  const g90Loans = await db.collection('loans').find({ groupId: g90._id }).toArray();
  console.log(`\nGroup #90 (${g90.name}) - Active Borrowers: ${g90.totalMembers}`);
  g90Loans.forEach(l => console.log(` - Loan: ${l.loanNumber} | Cust: ${l.customerName} | Status: ${l.status}`));

  process.exit(0);
}

verify().catch(e => {
  console.error(e);
  process.exit(1);
});

