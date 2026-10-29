import mongoose, { Schema, Document } from 'mongoose';

export interface IBranchTransfer extends Document {
  transferNumber: string;
  sourceBranchId: mongoose.Types.ObjectId;
  destinationBranchId: mongoose.Types.ObjectId;
  transferDate: Date;
  amount: number;
  accountType: 'CASH' | 'BANK';
  purpose: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  createdById: mongoose.Types.ObjectId | null;
  receivedById: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const BranchTransferSchema: Schema = new Schema(
  {
    transferNumber: { type: String, required: true, unique: true },
    sourceBranchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    destinationBranchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    transferDate: { type: Date, default: Date.now },
    amount: { type: Number, required: true },
    accountType: { type: String, enum: ['CASH', 'BANK'], default: 'CASH' },
    purpose: { type: String, default: '' },
    status: { type: String, enum: ['PENDING', 'COMPLETED', 'CANCELLED'], default: 'COMPLETED' },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    receivedById: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

BranchTransferSchema.index({ sourceBranchId: 1, transferDate: 1 });
BranchTransferSchema.index({ destinationBranchId: 1, transferDate: 1 });

export const BranchTransfer = mongoose.model<IBranchTransfer>('BranchTransfer', BranchTransferSchema);
