import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'DISCOUNT' | 'SETTLEMENT';

export interface IPaymentAllocation {
  installmentId: mongoose.Types.ObjectId;
  installmentNumber: number;
  amount: number;
  principalPortion: number;
  interestPortion: number;
  savingsPortion: number;
}

export interface IPayment extends Document {
  receiptNumber: string;
  loanId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  collectorId: mongoose.Types.ObjectId | null;
  paymentDate: Date;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNo: string;
  remarks: string;
  allocations: IPaymentAllocation[];
  isReversed: boolean;
  reversedBy: mongoose.Types.ObjectId | null;
  reversalReason: string;
  reversedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema: Schema = new Schema(
  {
    receiptNumber: { type: String, required: true, unique: true, uppercase: true },
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    collectorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    paymentDate: { type: Date, default: Date.now },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'DISCOUNT', 'SETTLEMENT'], default: 'CASH' },
    referenceNo: { type: String, default: '' },
    remarks: { type: String, default: '' },
    allocations: [
      {
        installmentId: { type: Schema.Types.ObjectId, ref: 'Installment' },
        installmentNumber: { type: Number },
        amount: { type: Number },
        principalPortion: { type: Number, default: 0 },
        interestPortion: { type: Number, default: 0 },
        savingsPortion: { type: Number, default: 0 }
      }
    ],
    isReversed: { type: Boolean, default: false },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reversalReason: { type: String, default: '' },
    reversedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

PaymentSchema.index({ branchId: 1, paymentDate: 1 });
PaymentSchema.index({ loanId: 1, paymentDate: 1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
