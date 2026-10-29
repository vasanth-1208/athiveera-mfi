import mongoose, { Schema, Document } from 'mongoose';

export type Weekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY';

export interface IGroup extends Document {
  groupCode: number;
  name: string;
  branchId: mongoose.Types.ObjectId;
  headName: string;
  headPhone: string;
  headCustomerId: mongoose.Types.ObjectId | null;
  collectionDay: Weekday;
  area: string;
  staffName: string;
  staffId: mongoose.Types.ObjectId | null;
  cycle: number;
  status: 'LIVE' | 'CLOSED';
  totalMembers: number;
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema: Schema = new Schema(
  {
    groupCode: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    headName: { type: String, default: '', trim: true },
    headPhone: { type: String, default: '', trim: true },
    headCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    collectionDay: { 
      type: String, 
      enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'], 
      required: true 
    },
    area: { type: String, default: '', trim: true },
    staffName: { type: String, default: '', trim: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    cycle: { type: Number, default: 1 },
    status: { type: String, enum: ['LIVE', 'CLOSED'], default: 'LIVE' },
    totalMembers: { type: Number, default: 0 }
  },
  { timestamps: true }
);

GroupSchema.index({ branchId: 1, collectionDay: 1 });
GroupSchema.index({ groupCode: 1, cycle: 1 });
GroupSchema.index({ status: 1 });

export const Group = mongoose.model<IGroup>('Group', GroupSchema);
