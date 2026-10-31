import mongoose, { Schema, Document } from 'mongoose';

export type LoanStatus = 
  | 'DRAFT' 
  | 'SUBMITTED' 
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'APPROVED' 
  | 'REJECTED' 
  | 'DISBURSED' 
  | 'ACTIVE' 
  | 'OVERDUE' 
  | 'CLOSED' 
  | 'SETTLED'
  | 'BAD_DEBT';

export interface ILoanVerification {
  smartCardNumber: string;
  aadharNumber: string;
  voterIdNumber: string;
  panNumber: string;
  remarks: string;
  verifiedBy: mongoose.Types.ObjectId | null;
  verifiedByName: string;
  verifiedAt: Date | null;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED';
}

export interface ILoan extends Document {
  loanNumber: string;
  customerId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  cycle: number;
  productType: 'TIER_A_20K' | 'TIER_B_25K' | 'TIER_C_30K' | 'CUSTOM';
  principal: number;
  interestRate: number; // percentage
  interestAmount: number;
  docCharges: number;
  savingsAmount: number;
  totalPayable: number;
  tenureWeeks: number;
  repaymentFrequency: 'WEEKLY' | 'DAILY' | 'MONTHLY';
  disbursedDate: Date;
  status: LoanStatus;
  assignedStaffId: mongoose.Types.ObjectId | null;
  assignedStaffName: string;
  assignedAt: Date | null;
  transferType?: 'PERMANENT' | 'TEMPORARY';
  isTemporaryTransfer?: boolean;
  transferRemarks?: string;
  verification: ILoanVerification;
  approvedBy: mongoose.Types.ObjectId | null;
  approvedAt: Date | null;
  approvalRemarks: string;
  // Formal Loan Structure Fields
  loanCategory?: 'REGULAR' | 'SPECIAL';
  year?: number;
  month?: string;
  collectionDay?: string;
  loanDate?: Date;
  groupNo?: string;
  area?: string;
  groupName?: string;
  customerName?: string;
  spouseName?: string;
  nomineeName?: string;
  nomineeRelationship?: string;
  customerPhone?: string;
  nomineePhone?: string;
  weekSplit?: Array<{
    week: number;
    principal: number;
    interest: number;
    savings: number;
    total: number;
  }>;
  monthlyScheduleType?: 'DATE_OF_MONTH' | 'DAY_OF_WEEK_PATTERN';
  monthlyDayOfMonth?: number;
  monthlyWeekOrdinal?: number;
  monthlyWeekday?: string;
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingTotal: number;
  totalPaid: number;
  earlySettlementDiscount: number;
  closedDate: Date | null;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const LoanSchema: Schema = new Schema(
  {
    loanNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    cycle: { type: Number, default: 1 },
    productType: { 
      type: String, 
      enum: ['TIER_A_20K', 'TIER_B_25K', 'TIER_C_30K', 'CUSTOM'], 
      default: 'TIER_A_20K' 
    },
    principal: { type: Number, required: true },
    interestRate: { type: Number, required: true },
    interestAmount: { type: Number, required: true },
    docCharges: { type: Number, default: 0 },
    savingsAmount: { type: Number, default: 0 },
    totalPayable: { type: Number, required: true },
    tenureWeeks: { type: Number, default: 32 },
    repaymentFrequency: { 
      type: String, 
      enum: ['WEEKLY', 'DAILY', 'MONTHLY'], 
      default: 'WEEKLY' 
    },
    disbursedDate: { type: Date, default: Date.now },
    status: { 
      type: String, 
      enum: ['DRAFT', 'SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'APPROVED', 'REJECTED', 'DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'SETTLED', 'BAD_DEBT'], 
      default: 'ACTIVE' 
    },
    assignedStaffId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedStaffName: { type: String, default: '' },
    assignedAt: { type: Date, default: null },
    transferType: { type: String, enum: ['PERMANENT', 'TEMPORARY'], default: 'PERMANENT' },
    isTemporaryTransfer: { type: Boolean, default: false },
    transferRemarks: { type: String, default: '' },
    verification: {
      smartCardNumber: { type: String, default: '', trim: true },
      aadharNumber: { type: String, default: '', trim: true },
      voterIdNumber: { type: String, default: '', trim: true },
      panNumber: { type: String, default: '', trim: true },
      remarks: { type: String, default: '' },
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      verifiedByName: { type: String, default: '' },
      verifiedAt: { type: Date, default: null },
      status: { type: String, enum: ['PENDING', 'SUBMITTED', 'APPROVED'], default: 'PENDING' }
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    approvalRemarks: { type: String, default: '' },
    // Formal Loan Structure Fields
    loanCategory: { type: String, enum: ['REGULAR', 'SPECIAL'], default: 'REGULAR' },
    year: { type: Number, default: () => new Date().getFullYear() },
    month: { type: String, default: '' },
    collectionDay: { type: String, default: '' },
    loanDate: { type: Date, default: Date.now },
    groupNo: { type: String, default: '' },
    area: { type: String, default: '', trim: true },
    groupName: { type: String, default: '', trim: true },
    customerName: { type: String, default: '', trim: true },
    spouseName: { type: String, default: '', trim: true },
    nomineeName: { type: String, default: '', trim: true },
    nomineeRelationship: { type: String, default: '', trim: true },
    customerPhone: { type: String, default: '', trim: true },
    nomineePhone: { type: String, default: '', trim: true },
    weekSplit: [
      {
        week: { type: Number, required: true },
        principal: { type: Number, default: 0 },
        interest: { type: Number, default: 0 },
        savings: { type: Number, default: 0 },
        total: { type: Number, required: true }
      }
    ],
    monthlyScheduleType: { type: String, enum: ['DATE_OF_MONTH', 'DAY_OF_WEEK_PATTERN'], default: 'DATE_OF_MONTH' },
    monthlyDayOfMonth: { type: Number, default: 5 },
    monthlyWeekOrdinal: { type: Number, default: 2 },
    monthlyWeekday: { type: String, default: 'FRIDAY' },
    outstandingPrincipal: { type: Number, default: 0 },
    outstandingInterest: { type: Number, default: 0 },
    outstandingTotal: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    earlySettlementDiscount: { type: Number, default: 0 },
    closedDate: { type: Date, default: null },
    notes: { type: String, default: '' }
  },

  { timestamps: true }
);

LoanSchema.index({ branchId: 1, status: 1 });
LoanSchema.index({ customerId: 1, cycle: 1 });
LoanSchema.index({ groupId: 1 });

export const Loan = mongoose.model<ILoan>('Loan', LoanSchema);
