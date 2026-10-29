import mongoose, { Schema, Document } from 'mongoose';

export interface IBranch extends Document {
  code: string;
  name: string;
  address: string;
  phone: string;
  cashBalance: number;
  bankBalance: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema: Schema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    cashBalance: { type: Number, default: 0 },
    bankBalance: { type: Number, default: 0 },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Branch = mongoose.model<IBranch>('Branch', BranchSchema);
