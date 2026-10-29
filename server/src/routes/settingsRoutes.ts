import { Router, Request, Response } from 'express';
import { Settings } from '../models/Settings';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
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
    }
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const { fuelPricePerLiter, fuelMileageKmPerLiter, docChargesPercent, companyName, phone, address } = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    if (fuelPricePerLiter) settings.fuelPricePerLiter = parseFloat(fuelPricePerLiter);
    if (fuelMileageKmPerLiter) settings.fuelMileageKmPerLiter = parseFloat(fuelMileageKmPerLiter);

    if (settings.fuelPricePerLiter && settings.fuelMileageKmPerLiter) {
      settings.fuelRatePerKm = parseFloat((settings.fuelPricePerLiter / settings.fuelMileageKmPerLiter).toFixed(2));
    }

    if (docChargesPercent) settings.docChargesPercent = parseFloat(docChargesPercent);
    if (companyName) settings.companyName = companyName;
    if (phone) settings.phone = phone;
    if (address) settings.address = address;

    await settings.save();
    res.json({ success: true, settings, message: 'Settings updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
