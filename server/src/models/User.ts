import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'MAIN_ADMIN' | 'BRANCH_MANAGER' | 'COLLECTION_STAFF';

export interface IUser extends Document {
  username: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  branchId: mongoose.Types.ObjectId | null;
  phone: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { 
      type: String, 
      enum: ['MAIN_ADMIN', 'BRANCH_MANAGER', 'COLLECTION_STAFF'], 
      required: true,
      default: 'COLLECTION_STAFF'
    },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    phone: { type: String, default: '' },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

UserSchema.index({ branchId: 1, role: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
