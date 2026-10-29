import bcrypt from 'bcryptjs';
import { Settings } from '../models/Settings';
import { User } from '../models/User';

export async function seedInitialData(): Promise<void> {
  try {
    // Ensure default business parameters exist in DB if not set
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
      console.log('Business settings initialized in database.');
    }

    // If ADMIN_USERNAME and ADMIN_PASSWORD are provided in environment, create admin if none exists
    const adminUser = process.env.ADMIN_USERNAME;
    const adminPass = process.env.ADMIN_PASSWORD;
    if (adminUser && adminPass) {
      const adminExists = await User.findOne({ username: adminUser.toLowerCase() });
      if (!adminExists) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(adminPass, salt);
        await User.create({
          username: adminUser.toLowerCase(),
          passwordHash,
          name: 'Main Admin',
          role: 'MAIN_ADMIN',
          branchId: null
        });
        console.log(`Admin user created from environment: ${adminUser}`);
      }
    }
  } catch (error) {
    console.error('Error initializing settings:', error);
  }
}
