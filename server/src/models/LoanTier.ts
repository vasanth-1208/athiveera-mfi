import mongoose, { Schema, Document } from 'mongoose';

export interface IAmortizationSlab {
  fromWeek: number;
  toWeek: number;
  principal: number;
  interest: number;
  savings: number;
  total: number;
}

export interface IWeekAmortization {
  week: number;
  principal: number;
  interest: number;
  savings: number;
  total: number;
}

export interface ILoanTier extends Document {
  code: string;
  name: string;
  category: 'REGULAR' | 'SPECIAL';
  frequency: 'WEEKLY' | 'MONTHLY';
  principal: number;
  interestAmount: number;
  docCharges: number;
  savingsAmount: number;
  totalPayable: number;
  tenureWeeks: number;
  slabs: IAmortizationSlab[];
  schedule: IWeekAmortization[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export function expandSlabsToSchedule(slabs: IAmortizationSlab[]): IWeekAmortization[] {
  const schedule: IWeekAmortization[] = [];
  for (const slab of slabs) {
    for (let w = slab.fromWeek; w <= slab.toWeek; w++) {
      schedule.push({
        week: w,
        principal: slab.principal,
        interest: slab.interest,
        savings: slab.savings,
        total: slab.total
      });
    }
  }
  return schedule;
}

const SlabSchema = new Schema({
  fromWeek: { type: Number, required: true },
  toWeek: { type: Number, required: true },
  principal: { type: Number, required: true },
  interest: { type: Number, required: true },
  savings: { type: Number, required: true, default: 0 },
  total: { type: Number, required: true }
}, { _id: false });

const WeekScheduleSchema = new Schema({
  week: { type: Number, required: true },
  principal: { type: Number, required: true },
  interest: { type: Number, required: true },
  savings: { type: Number, required: true, default: 0 },
  total: { type: Number, required: true }
}, { _id: false });

const LoanTierSchema = new Schema<ILoanTier>({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, enum: ['REGULAR', 'SPECIAL'], default: 'REGULAR' },
  frequency: { type: String, enum: ['WEEKLY', 'MONTHLY'], default: 'WEEKLY' },
  principal: { type: Number, required: true },
  interestAmount: { type: Number, required: true },
  docCharges: { type: Number, required: true, default: 0 },
  savingsAmount: { type: Number, required: true, default: 0 },
  totalPayable: { type: Number, required: true },
  tenureWeeks: { type: Number, required: true },
  slabs: [SlabSchema],
  schedule: [WeekScheduleSchema],
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, {
  timestamps: true
});

export const LoanTier = mongoose.model<ILoanTier>('LoanTier', LoanTierSchema);

