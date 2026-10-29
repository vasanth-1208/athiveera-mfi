import mongoose, { Schema, Document } from 'mongoose';

export interface IExpense extends Document {
  branchId: mongoose.Types.ObjectId;
  expenseDate: Date;
  category: string;
  amount: number;
  billRef: string;
  description: string;
  travelKM: number;
  fuelRate: number; // default 2.16
  staffId: mongoose.Types.ObjectId | null;
  staffName: string;
  paymentMethod: 'CASH' | 'BANK';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedById: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema: Schema = new Schema(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    expenseDate: { type: Date, default: Date.now },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    billRef: { type: String, default: '' },
    description: { type: String, default: '' },
    travelKM: { type: Number, default: 0 },
    fuelRate: { type: Number, default: 2.16 },
    staffId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    staffName: { type: String, default: '' },
    paymentMethod: { type: String, enum: ['CASH', 'BANK'], default: 'CASH' },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' },
    approvedById: { type: Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

ExpenseSchema.index({ branchId: 1, expenseDate: 1 });
ExpenseSchema.index({ category: 1 });

export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema);
