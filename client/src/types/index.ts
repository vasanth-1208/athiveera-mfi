export type UserRole = 'MAIN_ADMIN' | 'BRANCH_MANAGER' | 'COLLECTION_STAFF';

export interface User {
  id: string;
  _id?: string;
  username: string;
  name: string;
  role: UserRole;
  branchId?: string | null;
  branch?: {
    _id: string;
    name: string;
    code: string;
  } | null;
  phone?: string;
}

export interface Branch {
  _id: string;
  code: string;
  name: string;
  address: string;
  phone: string;
  cashBalance: number;
  bankBalance: number;
  active: boolean;
}

export interface Customer {
  _id: string;
  customerId: string;
  name: string;
  phone: string;
  nomineeName?: string;
  nomineeRelationship?: string;
  nomineePhone: string;
  address: string;
  area: string;
  smartCardNumber?: string;
  aadharNumber?: string;
  voterIdNumber?: string;
  panNumber?: string;
  branchId: Branch | string;
  activeGroupId?: {
    _id: string;
    name: string;
    groupCode: number;
    collectionDay: string;
  } | null;
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  notes: string;
  createdAt: string;
}

export type Weekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface Group {
  _id: string;
  groupCode: number;
  name: string;
  branchId: Branch | string;
  headName: string;
  headPhone: string;
  collectionDay: Weekday;
  area: string;
  staffName: string;
  staffId?: { _id: string; name: string } | null;
  cycle: number;
  status: 'LIVE' | 'CLOSED';
  totalMembers: number;
}

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

export interface LoanVerification {
  smartCardNumber?: string;
  aadharNumber?: string;
  voterIdNumber?: string;
  panNumber?: string;
  remarks?: string;
  verifiedBy?: any;
  verifiedByName?: string;
  verifiedAt?: string;
  status?: 'PENDING' | 'SUBMITTED' | 'APPROVED';
}

export interface WeekAmortization {
  week: number;
  principal: number;
  interest: number;
  savings: number;
  total: number;
}

export interface AmortizationSlab {
  fromWeek: number;
  toWeek: number;
  principal: number;
  interest: number;
  savings: number;
  total: number;
}

export interface LoanProductPreset {
  code: string;
  name: string;
  category: 'REGULAR' | 'SPECIAL';
  frequency: 'WEEKLY' | 'MONTHLY';
  principal: number;
  interestAmount: number;
  docCharges: number;
  savingsAmount: number;
  totalPayable: number;
  tenureWeeks: number;
  monthlyScheduleType?: 'DATE_OF_MONTH' | 'DAY_OF_WEEK_PATTERN';
  monthlyDayOfMonth?: number;
  monthlyWeekOrdinal?: number;
  monthlyWeekday?: string;
  slabs?: AmortizationSlab[];
  schedule: WeekAmortization[];
}

export interface Loan {
  _id: string;
  loanNumber: string;
  customerId: Customer | any;
  groupId: Group | any;
  branchId: Branch | any;
  cycle: number;
  productType: string;
  principal: number;
  interestRate: number;
  interestAmount: number;
  docCharges: number;
  savingsAmount: number;
  totalPayable: number;
  tenureWeeks: number;
  repaymentFrequency: string;
  monthlyScheduleType?: 'DATE_OF_MONTH' | 'DAY_OF_WEEK_PATTERN';
  monthlyDayOfMonth?: number;
  monthlyWeekOrdinal?: number;
  monthlyWeekday?: string;
  disbursedDate: string;
  status: LoanStatus;
  assignedStaffId?: any;
  assignedStaffName?: string;
  assignedAt?: string;
  verification?: LoanVerification;
  loanCategory?: 'REGULAR' | 'SPECIAL';
  year?: number;
  month?: string;
  collectionDay?: string;
  loanDate?: string;
  groupNo?: string;
  area?: string;
  groupName?: string;
  customerName?: string;
  nomineeName?: string;
  nomineeRelationship?: string;
  customerPhone?: string;
  nomineePhone?: string;
  weekSplit?: WeekAmortization[];
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingTotal: number;
  totalPaid: number;
  approvedBy?: any;
  approvedAt?: string;
  approvalRemarks?: string;
  notes?: string;
  createdAt: string;
}

export interface EnquiryMemberKYC {
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

export interface EnquiryKYC {
  members?: EnquiryMemberKYC[];
  smartCardNumber: string;
  aadharNumber: string;
  voterIdNumber: string;
  panNumber: string;
  remarks?: string;
  submittedAt?: string;
  submittedByName?: string;
}

export interface Enquiry {
  _id: string;
  enquiryNo: string;
  place: string;
  membersCount: number;
  name: string;
  phone?: string;
  amount: number;
  remarks?: string;
  branchId: Branch | any;
  staffId: User | any;
  staffName: string;
  status: 'PENDING' | 'APPROVED' | 'KYC_SUBMITTED' | 'REJECTED';
  managerRemarks?: string;
  reviewedById?: User | any;
  reviewedByName?: string;
  reviewedAt?: string;
  kyc?: EnquiryKYC;
  convertedToLoanId?: string | null;
  createdAt: string;
  updatedAt: string;
}


export interface Installment {
  _id: string;
  loanId: string;
  installmentNumber: number;
  dueDate: string;
  expectedAmount: number;
  allocatedPrincipal: number;
  allocatedInterest: number;
  allocatedSavings: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WAIVED';
  paidDate?: string | null;
  overdueDays: number;
  overdueWeeks: number;
  remarks?: string;
}

export interface Payment {
  _id: string;
  receiptNumber: string;
  loanId: string | any;
  customerId: Customer | any;
  groupId: Group | any;
  branchId: Branch | any;
  collectorId?: any;
  paymentDate: string;
  amount: number;
  paymentMethod: 'CASH' | 'UPI' | 'BANK_TRANSFER';
  referenceNo: string;
  remarks: string;
  isReversed: boolean;
  allocations: Array<{
    installmentId: string;
    installmentNumber: number;
    amount: number;
  }>;
}

export interface FollowUp {
  _id: string;
  customerId: Customer | any;
  customerName: string;
  customerPhone: string;
  nomineePhone: string;
  groupId?: Group | any;
  groupName: string;
  branchId: Branch | any;
  collectionDay: string;
  actualPending: number;
  customerKnown: number;
  overdueWeeks: number;
  staffName: string;
  remarks: string;
  nextFollowUpDate?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED';
  history: Array<{
    date: string;
    remarks: string;
    staffName: string;
    actionTaken: string;
  }>;
}

export interface CashTransaction {
  _id: string;
  branchId: Branch | any;
  transactionDate: string;
  type: 'CREDIT' | 'DEBIT';
  accountType: 'CASH' | 'BANK';
  category: string;
  amount: number;
  vNo: string;
  relatedEntityType: string;
  description: string;
  runningBalance: number;
}

export interface Expense {
  _id: string;
  branchId: Branch | any;
  expenseDate: string;
  category: string;
  amount: number;
  billRef: string;
  description: string;
  travelKM: number;
  fuelRate: number;
  staffName: string;
  paymentMethod: 'CASH' | 'BANK';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface BranchTransfer {
  _id: string;
  transferNumber: string;
  sourceBranchId: Branch | any;
  destinationBranchId: Branch | any;
  transferDate: string;
  amount: number;
  accountType: 'CASH' | 'BANK';
  purpose: string;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
}
