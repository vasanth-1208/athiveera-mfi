import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { Settings } from '../models/Settings';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

async function createAdmin() {
  let uri = process.env.MONGODB_URI || '';
  if (uri.endsWith('/')) {
    uri = `${uri}athiveera_mfi?retryWrites=true&w=majority`;
  }

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(uri);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Athiveera@MFI', salt);

  const user = await User.findOneAndUpdate(
    { username: 'admin' },
    {
      username: 'admin',
      passwordHash,
      name: 'Main Admin',
      role: 'MAIN_ADMIN',
      branchId: null,
      phone: '+91 9500485596',
      active: true
    },
    { upsert: true, new: true }
  );

  console.log(`Admin user saved in database successfully:`);
  console.log(`Username: admin (or Admin)`);
  console.log(`Role: ${user.role}`);
  console.log(`Active: ${user.active}`);

  // Also ensure settings exist
  const settingsExists = await Settings.findOne();
  if (!settingsExists) {
    await Settings.create({
      fuelPricePerLiter: 108,
      fuelMileageKmPerLiter: 50,
      fuelRatePerKm: 2.16,
      docChargesPercent: 6.0,
      earlySettlementTiers: [
        { minWeeks: 0, maxWeeks: 10, interestDiscountPercent: 75, balanceInterestPercent: 25 },
        { minWeeks: 11, maxWeeks: 20, interestDiscountPercent: 50, balanceInterestPercent: 50 },
        { minWeeks: 21, maxWeeks: 30, interestDiscountPercent: 25, balanceInterestPercent: 75 },
        { minWeeks: 31, maxWeeks: 52, interestDiscountPercent: 0, balanceInterestPercent: 100 }
      ]
    });
    console.log('Default business settings ensured.');
  }

  await mongoose.disconnect();
  console.log('MongoDB connection closed.');
}

createAdmin().catch(err => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
