import mongoose, { Schema, Document } from 'mongoose';

export type FollowUpStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED' | 'PARTIAL' | 'OVERDUE';

export interface IFollowUp extends Document {
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  nomineePhone: string;
  loanId: mongoose.Types.ObjectId | null;
  groupId: mongoose.Types.ObjectId | null;
  groupName: string;
  branchId: mongoose.Types.ObjectId;
  collectionDay: string;
  installmentId: mongoose.Types.ObjectId | null;
  dueDate: Date | null;
  actualPending: number;
  customerKnown: number;
  overdueWeeks: number;
  staffName: string;
  staffId: mongoose.Types.ObjectId | null;
  remarks: string;
  nextFollowUpDate: Date | null;
  status: FollowUpStatus;
  history: Array<{
    date: Date;
    remarks: string;
    staffName: string;
    actionTaken: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const FollowUpSchema: Schema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, default: '' },
    nomineePhone: { type: String, default: '' },
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', default: null },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
    groupName: { type: String, default: '' },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    collectionDay: { type: String, default: '' },
    installmentId: { type: Schema.Types.ObjectId, ref: 'Installment', default: null },
    dueDate: { type: Date, default: null },
    actualPending: { type: Number, required: true },
    customerKnown: { type: Number, required: true },
    overdueWeeks: { type: Number, default: 1 },
    staffName: { type: String, default: '' },
    staffId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    remarks: { type: String, default: '' },
    nextFollowUpDate: { type: Date, default: null },
    status: { 
      type: String, 
      enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'PARTIAL', 'OVERDUE'], 
      default: 'PENDING' 
    },
    history: [
      {
        date: { type: Date, default: Date.now },
        remarks: { type: String },
        staffName: { type: String },
        actionTaken: { type: String }
      }
    ]
  },
  { timestamps: true }
);

FollowUpSchema.index({ branchId: 1, collectionDay: 1, status: 1 });
FollowUpSchema.index({ customerId: 1 });

export const FollowUp = mongoose.model<IFollowUp>('FollowUp', FollowUpSchema);
