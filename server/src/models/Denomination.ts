import mongoose, { Schema, Document } from 'mongoose';

export interface IStaffDenomination {
  staffName: string;
  notes500: number;
  notes200: number;
  notes100: number;
  notes50: number;
  notes20: number;
  notes10: number;
  coins: number;
  sbAcc: number;
  caAcc: number;
  total: number;
}

export interface IDenomination extends Document {
  branchId: mongoose.Types.ObjectId;
  date: Date;
  notes500: number;
  notes200: number;
  notes100: number;
  notes50: number;
  notes20: number;
  notes10: number;
  coins: number;
  sbAcc: number;
  caAcc: number;
  staffDenominations: IStaffDenomination[];
  totalPhysicalCash: number;
  totalCounted: number;
  systemBalance: number;
  variance: number;
  isTallied: boolean;
  notes?: string;
  createdById?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StaffDenominationSchema = new Schema<IStaffDenomination>({
  staffName: { type: String, required: true },
  notes500: { type: Number, default: 0 },
  notes200: { type: Number, default: 0 },
  notes100: { type: Number, default: 0 },
  notes50: { type: Number, default: 0 },
  notes20: { type: Number, default: 0 },
  notes10: { type: Number, default: 0 },
  coins: { type: Number, default: 0 },
  sbAcc: { type: Number, default: 0 },
  caAcc: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
}, { _id: false });

const DenominationSchema = new Schema<IDenomination>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    date: { type: Date, required: true, index: true },
    notes500: { type: Number, default: 0 },
    notes200: { type: Number, default: 0 },
    notes100: { type: Number, default: 0 },
    notes50: { type: Number, default: 0 },
    notes20: { type: Number, default: 0 },
    notes10: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
    sbAcc: { type: Number, default: 0 },
    caAcc: { type: Number, default: 0 },
    staffDenominations: { type: [StaffDenominationSchema], default: [] },
    totalPhysicalCash: { type: Number, default: 0 },
    totalCounted: { type: Number, default: 0 },
    systemBalance: { type: Number, default: 0 },
    variance: { type: Number, default: 0 },
    isTallied: { type: Boolean, default: true },
    notes: { type: String },
    createdById: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

DenominationSchema.index({ branchId: 1, date: 1 }, { unique: true });

export const Denomination = mongoose.model<IDenomination>('Denomination', DenominationSchema);

