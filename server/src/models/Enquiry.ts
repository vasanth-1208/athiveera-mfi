import mongoose, { Schema, Document } from 'mongoose';

export type EnquiryStatus = 'PENDING' | 'APPROVED' | 'KYC_SUBMITTED' | 'REJECTED';

export interface IEnquiryMemberKYC {
  memberIndex: number;
  memberName: string;
  spouseName: string;
  nomineeName: string;
  nomineeRelationship: string;
  phone?: string;
  smartCardNumber: string;
  aadharNumber: string;
  voterIdNumber: string;
  panNumber: string;
}

export interface IEnquiryKYC {
  members: IEnquiryMemberKYC[];
  smartCardNumber: string;
  aadharNumber: string;
  voterIdNumber: string;
  panNumber: string;
  remarks: string;
  submittedAt: Date;
  submittedById: mongoose.Types.ObjectId;
  submittedByName: string;
}

export interface IEnquiry extends Document {
  enquiryNo: string;
  place: string;
  membersCount: number;
  name: string;
  phone: string;
  amount: number;
  remarks: string;
  branchId: mongoose.Types.ObjectId;
  staffId: mongoose.Types.ObjectId;
  staffName: string;
  status: EnquiryStatus;
  managerRemarks: string;
  reviewedById: mongoose.Types.ObjectId | null;
  reviewedByName: string;
  reviewedAt: Date | null;
  kyc?: IEnquiryKYC;
  convertedToLoanId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const EnquirySchema: Schema = new Schema(
  {
    enquiryNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
    place: { type: String, required: true, trim: true },
    membersCount: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    amount: { type: Number, required: true, min: 100 },
    remarks: { type: String, default: '', trim: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    staffName: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['PENDING', 'APPROVED', 'KYC_SUBMITTED', 'REJECTED'], 
      default: 'PENDING' 
    },
    managerRemarks: { type: String, default: '', trim: true },
    reviewedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedByName: { type: String, default: '', trim: true },
    reviewedAt: { type: Date, default: null },
    kyc: {
      members: [
        {
          memberIndex: { type: Number, required: true },
          memberName: { type: String, required: true, trim: true },
          spouseName: { type: String, default: '', trim: true },
          nomineeName: { type: String, default: '', trim: true },
          nomineeRelationship: { type: String, default: 'Spouse', trim: true },
          phone: { type: String, default: '', trim: true },
          smartCardNumber: { type: String, default: '', trim: true },
          aadharNumber: { type: String, default: '', trim: true },
          voterIdNumber: { type: String, default: '', trim: true },
          panNumber: { type: String, default: '', trim: true }
        }
      ],
      smartCardNumber: { type: String, default: '', trim: true },
      aadharNumber: { type: String, default: '', trim: true },
      voterIdNumber: { type: String, default: '', trim: true },
      panNumber: { type: String, default: '', trim: true },
      remarks: { type: String, default: '' },
      submittedAt: { type: Date, default: null },
      submittedById: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      submittedByName: { type: String, default: '' }
    },
    convertedToLoanId: { type: Schema.Types.ObjectId, ref: 'Loan', default: null }
  },
  { timestamps: true }
);

EnquirySchema.index({ branchId: 1, status: 1 });
EnquirySchema.index({ staffId: 1, createdAt: -1 });

export const Enquiry = mongoose.model<IEnquiry>('Enquiry', EnquirySchema);
