const mongoose = require('mongoose');
require('dotenv').config({ path: 'server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Group = mongoose.model('Group', new mongoose.Schema({ collectionDay: String }, { strict: false }));
  const Loan = mongoose.model('Loan', new mongoose.Schema({ groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, collectionDay: String }, { strict: false }));

  const loans = await Loan.find({}).populate('groupId');
  let updatedCount = 0;
  for (const l of loans) {
    if (l.groupId && l.groupId.collectionDay && l.collectionDay !== l.groupId.collectionDay) {
      await Loan.updateOne({ _id: l._id }, { $set: { collectionDay: l.groupId.collectionDay } });
      updatedCount++;
    }
  }
  console.log('Successfully synced collectionDay on', updatedCount, 'loans!');
  process.exit(0);
}

run().catch(console.error);

