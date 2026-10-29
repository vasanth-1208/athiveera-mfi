import mongoose, { Schema, Document } from 'mongoose';

export type TransactionType = 'CREDIT' | 'DEBIT';
export type AccountType = 'CASH' | 'BANK';

export interface ICashTransaction extends Document {
  branchId: mongoose.Types.ObjectId;
  transactionDate: Date;
  type: TransactionType;
  accountType: AccountType;
  category: string;
  amount: number;
  vNo: string;
  relatedEntityType: 
    | 'LOAN_DISBURSEMENT' 
    | 'COLLECTION' 
    | 'EXPENSE' 
    | 'BRANCH_TRANSFER' 
    | 'ADJUSTMENT' 
    | 'SETTLEMENT';
  relatedEntityId: mongoose.Types.ObjectId | null;
  description: string;
  runningBalance: number;
  createdById: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const CashTransactionSchema: Schema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    transactionDate: { type: Date, default: Date.now },
    type: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
    accountType: { type: String, enum: ['CASH', 'BANK'], default: 'CASH' },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    vNo: { type: String, default: '' },
    relatedEntityType: {
      type: String,
      enum: ['LOAN_DISBURSEMENT', 'COLLECTION', 'EXPENSE', 'BRANCH_TRANSFER', 'ADJUSTMENT', 'SETTLEMENT'],
      default: 'ADJUSTMENT'
    },
    relatedEntityId: { type: Schema.Types.ObjectId, default: null },
    description: { type: String, default: '' },
    runningBalance: { type: Number, required: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

CashTransactionSchema.index({ branchId: 1, transactionDate: 1 });
CashTransactionSchema.index({ branchId: 1, accountType: 1 });

export const CashTransaction = mongoose.model<ICashTransaction>('CashTransaction', CashTransactionSchema);
