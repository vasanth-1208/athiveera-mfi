import mongoose, { Schema, Document } from 'mongoose';

export interface ISettings extends Document {
  branchId: mongoose.Types.ObjectId | null; // null for organization-wide default
  fuelPricePerLiter: number; // e.g. 108
  fuelMileageKmPerLiter: number; // e.g. 50
  fuelRatePerKm: number; // 2.16
  earlySettlementTiers: Array<{
    minWeeks: number;
    maxWeeks: number;
    interestDiscountPercent: number; // e.g. 75, 50, 25, 0
    balanceInterestPercent: number; // e.g. 25, 50, 75, 100
  }>;
  docChargesPercent: number; // e.g. 6.0
  companyName: string;
  phone: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema: Schema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    fuelPricePerLiter: { type: Number, default: 108 },
    fuelMileageKmPerLiter: { type: Number, default: 50 },
    fuelRatePerKm: { type: Number, default: 2.16 },
    earlySettlementTiers: [
      {
        minWeeks: { type: Number },
        maxWeeks: { type: Number },
        interestDiscountPercent: { type: Number },
        balanceInterestPercent: { type: Number }
      }
    ],
    docChargesPercent: { type: Number, default: 6.0 },
    companyName: { type: String, default: 'Athiveera Microfinance' },
    phone: { type: String, default: '+91 9500485596' },
    address: { type: String, default: 'Pollachi & Madathukulam, Tamil Nadu' }
  },
  { timestamps: true }
);

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);
