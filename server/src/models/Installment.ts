import mongoose, { Schema, Document } from 'mongoose';

export type InstallmentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';

export interface IInstallment extends Document {
  loanId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  installmentNumber: number;
  dueDate: Date;
  expectedAmount: number;
  allocatedPrincipal: number;
  allocatedInterest: number;
  allocatedSavings: number;
  paidAmount: number;
  balanceAmount: number;
  status: InstallmentStatus;
  paidDate: Date | null;
  overdueDays: number;
  overdueWeeks: number;
  remarks: string;
  createdAt: Date;
  updatedAt: Date;
}

const InstallmentSchema: Schema = new Schema(
  {
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    installmentNumber: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    expectedAmount: { type: Number, required: true },
    allocatedPrincipal: { type: Number, default: 0 },
    allocatedInterest: { type: Number, default: 0 },
    allocatedSavings: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    balanceAmount: { type: Number, required: true },
    status: { 
      type: String, 
      enum: ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'WAIVED'], 
      default: 'PENDING' 
    },
    paidDate: { type: Date, default: null },
    overdueDays: { type: Number, default: 0 },
    overdueWeeks: { type: Number, default: 0 },
    remarks: { type: String, default: '' }
  },
  { timestamps: true }
);

InstallmentSchema.index({ loanId: 1, installmentNumber: 1 }, { unique: true });
InstallmentSchema.index({ branchId: 1, dueDate: 1, status: 1 });
InstallmentSchema.index({ customerId: 1, status: 1 });
InstallmentSchema.index({ groupId: 1, dueDate: 1 });

export const Installment = mongoose.model<IInstallment>('Installment', InstallmentSchema);
