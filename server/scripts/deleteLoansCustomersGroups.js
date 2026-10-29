const mongoose = require('mongoose');
require('dotenv').config({ path: 'server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas...');

  const db = mongoose.connection.db;

  // Document counts before
  const customersBefore = await db.collection('customers').countDocuments();
  const loansBefore = await db.collection('loans').countDocuments();
  const groupsBefore = await db.collection('groups').countDocuments();
  const installmentsBefore = await db.collection('installments').countDocuments();
  const paymentsBefore = await db.collection('payments').countDocuments();
  const followupsBefore = await db.collection('followups').countDocuments();
  const cashTxBefore = await db.collection('cashtransactions').countDocuments({
    relatedEntityType: { $in: ['COLLECTION', 'LOAN_DISBURSEMENT'] }
  });

  console.log('--- DELETING RECORDS ---');
  console.log(`Deleting ${customersBefore} customers...`);
  await db.collection('customers').deleteMany({});

  console.log(`Deleting ${loansBefore} loans...`);
  await db.collection('loans').deleteMany({});

  console.log(`Deleting ${groupsBefore} groups...`);
  await db.collection('groups').deleteMany({});

  console.log(`Deleting ${installmentsBefore} installments...`);
  await db.collection('installments').deleteMany({});

  console.log(`Deleting ${paymentsBefore} payments...`);
  await db.collection('payments').deleteMany({});

  console.log(`Deleting ${followupsBefore} followups...`);
  await db.collection('followups').deleteMany({});

  console.log(`Deleting ${cashTxBefore} loan-related cash transactions...`);
  await db.collection('cashtransactions').deleteMany({
    relatedEntityType: { $in: ['COLLECTION', 'LOAN_DISBURSEMENT'] }
  });

  console.log('--- VERIFICATION AFTER DELETION ---');
  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`${c.name}: ${count}`);
  }

  console.log('Done! Ready for clean step-by-step import.');
  process.exit(0);
}

run().catch(console.error);

