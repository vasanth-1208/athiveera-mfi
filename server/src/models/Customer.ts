import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  customerId: string;
  name: string;
  phone: string;
  spouseName?: string;
  nomineeName?: string;
  nomineeRelationship?: string;
  nomineePhone: string;
  address: string;
  area: string;
  branchId: mongoose.Types.ObjectId;
  activeGroupId: mongoose.Types.ObjectId | null;
  smartCardNumber?: string;
  aadharNumber?: string;
  voterIdNumber?: string;
  panNumber?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema: Schema = new Schema(
  {
    customerId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    spouseName: { type: String, default: '', trim: true },
    nomineeName: { type: String, default: '', trim: true },
    nomineeRelationship: { type: String, default: '', trim: true },
    nomineePhone: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    area: { type: String, default: '', trim: true },
    smartCardNumber: { type: String, default: '', trim: true },
    aadharNumber: { type: String, default: '', trim: true },
    voterIdNumber: { type: String, default: '', trim: true },
    panNumber: { type: String, default: '', trim: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    activeGroupId: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'], default: 'ACTIVE' },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

CustomerSchema.index({ branchId: 1, name: 1 });
CustomerSchema.index({ phone: 1 });
CustomerSchema.index({ area: 1 });

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
