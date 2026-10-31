import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  HandCoins, 
  Coins, 
  Phone, 
  User, 
  Clock, 
  Calculator, 
  CheckCircle2, 
  ShieldCheck, 
  AlertCircle,
  UserCheck,
  Edit3,
  Trash2,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const LoanDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isManager } = useAuth();
  const isManagerOrAdmin = isAdmin || isManager;
  const queryClient = useQueryClient();
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleDate, setSettleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [settleMethod, setSettleMethod] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [settleRemarks, setSettleRemarks] = useState('');
  const [manualDiscount, setManualDiscount] = useState<number>(0);
  const [deductSavings, setDeductSavings] = useState<boolean>(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');

  // Edit Loan Modal States (Manager & Admin - All Fields)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editLoanForm, setEditLoanForm] = useState({
    loanNumber: '',
    principal: 0,
    interestAmount: 0,
    docCharges: 0,
    savingsAmount: 0,
    totalPayable: 0,
    outstandingTotal: 0,
    totalPaid: 0,
    tenureWeeks: 0,
    status: 'ACTIVE',
    collectionDay: 'MONDAY',
    assignedStaffName: '',
    customerName: '',
    customerPhone: '',
    spouseName: '',
    nomineeName: '',
    nomineePhone: '',
    notes: ''
  });
  const [editLoanError, setEditLoanError] = useState('');

  const approveMutation = useMutation({
    mutationFn: () => api.approveLoan(id!, `Approved by ${user?.name}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', id] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.rejectLoan(id!, `Rejected by ${user?.name}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', id] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    }
  });

  const { data, isLoading } = useQuery({
    queryKey: ['loan', id],
    queryFn: () => api.getLoan(id!),
    enabled: !!id
  });

  const { data: quoteData } = useQuery({
    queryKey: ['settlementQuote', id],
    queryFn: () => api.getSettlementQuote(id!),
    enabled: !!id && data?.loan?.status === 'ACTIVE'
  });

  const disburseMutation = useMutation({
    mutationFn: () => api.disburseLoan(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', id] });
    }
  });

  const settleMutation = useMutation({
    mutationFn: (settleData: any) => api.settleLoan(id!, settleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', id] });
      setIsSettleModalOpen(false);
    }
  });

  const { data: staffUsersData } = useQuery({
    queryKey: ['staffUsersList', data?.loan?.branchId?._id || data?.loan?.branchId],
    queryFn: () => api.getUsers({ role: 'COLLECTION_STAFF', branchId: data?.loan?.branchId?._id || data?.loan?.branchId }),
    enabled: !!data?.loan
  });
  const staffUsers = (staffUsersData?.users || []).filter((u: any) => u.active !== false && u.status !== 'INACTIVE');

  const assignStaffMutation = useMutation({
    mutationFn: (staffId: string) => api.assignLoanStaff(id!, staffId),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['loan', id] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setIsAssignModalOpen(false);
      alert(res?.message || 'Staff transferred successfully!');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to transfer staff');
    }
  });

  const updateLoanMutation = useMutation({
    mutationFn: (updateData: any) => api.updateLoan(id!, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', id] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      setIsEditModalOpen(false);
      setEditLoanError('');
    },
    onError: (err: any) => {
      setEditLoanError(err.message || 'Failed to update loan');
    }
  });

  const deleteLoanMutation = useMutation({
    mutationFn: () => api.deleteLoan(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      alert('Loan account deleted successfully');
      navigate('/loans');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete loan');
    }
  });

  const handleOpenEditLoan = () => {
    if (!loan) return;
    setEditLoanForm({
      loanNumber: loan.loanNumber || '',
      principal: loan.principal || 0,
      interestAmount: loan.interestAmount || 0,
      docCharges: loan.docCharges || 0,
      savingsAmount: loan.savingsAmount || 0,
      totalPayable: loan.totalPayable || 0,
      outstandingTotal: loan.outstandingTotal !== undefined ? loan.outstandingTotal : ((loan.totalPayable || 0) - (loan.totalPaid || 0)),
      totalPaid: loan.totalPaid || 0,
      tenureWeeks: loan.tenureWeeks || 0,
      status: loan.status || 'ACTIVE',
      collectionDay: loan.collectionDay || loan.groupId?.collectionDay || 'MONDAY',
      assignedStaffName: loan.assignedStaffName || loan.assignedStaffId?.name || '',
      customerName: loan.customerName || loan.customerId?.name || '',
      customerPhone: loan.customerPhone || loan.customerId?.phone || '',
      spouseName: loan.spouseName || loan.customerId?.spouseName || '',
      nomineeName: loan.nomineeName || loan.customerId?.nomineeName || '',
      nomineePhone: loan.nomineePhone || loan.customerId?.nomineePhone || '',
      notes: loan.notes || ''
    });
    setEditLoanError('');
    setIsEditModalOpen(true);
  };

  const handleEditLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateLoanMutation.mutate(editLoanForm);
  };

  const handleDeleteLoan = () => {
    if (!loan) return;
    if (window.confirm(`Are you sure you want to permanently delete loan account "${loan.loanNumber}" (${loan.customerName || loan.customerId?.name || 'Borrower'})? All associated installments and repayment records will be deleted. This action cannot be undone.`)) {
      deleteLoanMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-xs text-slate-400">Loading loan account details...</p>
      </div>
    );
  }

  const loan = data?.loan;
  const installments = data?.installments || [];
  const payments = data?.payments || [];
  const quote = quoteData?.quote;

  const totalPaid = (loan?.status === 'SETTLED' || loan?.status === 'CLOSED')
    ? (loan.totalPayable || loan.totalPaid || 0)
    : (loan?.totalPaid !== undefined && loan.totalPaid > 0
        ? loan.totalPaid 
        : installments.reduce((acc: number, inst: any) => acc + (inst.paidAmount || 0), 0));
  const outstandingTotal = (loan?.status === 'SETTLED' || loan?.status === 'CLOSED')
    ? 0
    : (loan?.outstandingTotal !== undefined && loan.outstandingTotal >= 0
        ? loan.outstandingTotal 
        : Math.max(0, (loan?.totalPayable || 0) - totalPaid));

  if (!loan) {
    return (
      <div className="bg-white p-8 rounded-xl text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">Loan Not Found</h3>
        <Link to="/loans" className="text-xs text-brand-600 hover:underline">
          &larr; Back to loans
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link
          to="/loans"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Loan Portfolio</span>
        </Link>

        <div className="flex items-center gap-2">
          {isManagerOrAdmin && (
            <button
              onClick={handleOpenEditLoan}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-xl text-xs border border-amber-300 transition cursor-pointer shadow-xs"
              title="Edit all fields of loan"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-700" />
              <span>Edit Loan</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleDeleteLoan}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-300 transition cursor-pointer shadow-xs"
              title="Delete loan record & installments (Admin only)"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete Loan</span>
            </button>
          )}
        </div>
      </div>

      {/* Account Overview Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-700">
              {loan.loanNumber}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              loan.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
              loan.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
              loan.status === 'APPROVED' ? 'bg-teal-100 text-teal-800' :
              loan.status === 'BAD_DEBT' ? 'bg-purple-100 text-purple-900 border border-purple-300 font-black' :
              loan.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold' :
              loan.status === 'SETTLED' ? 'bg-purple-100 text-purple-800' :
              'bg-slate-100 text-slate-600'
            }`}>
              {loan.status}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Cycle {loan.cycle} &bull; {loan.productType}
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            {loan.customerId?.name} ({loan.customerId?.customerId})
          </h2>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {loan.customerId?.phone && loan.customerId.phone !== '-' && (
              <a
                href={`tel:${loan.customerId.phone.replace(/[^0-9+]/g, '')}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#f6f0e4] hover:bg-emerald-50 text-stone-900 hover:text-emerald-800 font-bold rounded-lg border border-[#ded3be] hover:border-emerald-300 text-xs transition cursor-pointer"
                title={`Click to call ${loan.customerId.name} (${loan.customerId.phone})`}
              >
                <Phone className="w-3 h-3 text-emerald-600" />
                <span>{loan.customerId.phone}</span>
              </a>
            )}
            {loan.customerId?.nomineePhone && loan.customerId.nomineePhone !== '-' && (
              <a
                href={`tel:${loan.customerId.nomineePhone.replace(/[^0-9+]/g, '')}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#fcf9f2] hover:bg-emerald-50 text-stone-700 hover:text-emerald-800 font-medium rounded-lg border border-[#ded3be] hover:border-emerald-300 text-xs transition cursor-pointer"
                title={`Click to call Nominee (${loan.customerId.nomineePhone})`}
              >
                <Phone className="w-3 h-3 text-stone-500" />
                <span>Nominee: {loan.customerId.nomineePhone}</span>
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span>Group: <strong className="text-slate-800">{loan.groupId?.name}</strong></span>
            <span>Route: <strong className="text-brand-700 uppercase">{loan.groupId?.collectionDay}</strong></span>
            <span>Branch: <strong className="text-slate-800">{loan.branchId?.name}</strong></span>
            {loan.approvedBy && (
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Approved by {loan.approvedBy.name}</span>
              </span>
            )}
            <span>Assigned Staff: <strong className="text-amber-800 font-bold">{loan.assignedStaffName || loan.assignedStaffId?.name || 'Branch Manager'}</strong></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isManagerOrAdmin && (
            <button
              onClick={() => {
                setSelectedStaffId(loan.assignedStaffId?._id || loan.assignedStaffId || 'MANAGER');
                setIsAssignModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-bold rounded-xl text-xs shadow-xs transition cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Transfer Staff</span>
            </button>
          )}

          {isManagerOrAdmin && (loan.status === 'VERIFIED' || loan.status === 'SUBMITTED' || loan.status === 'PENDING_VERIFICATION') && (
            <>
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {approveMutation.isPending ? 'Approving...' : 'Approve Application'}
              </button>
              <button
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}

          {loan.status === 'APPROVED' && (
            <button
              onClick={() => disburseMutation.mutate()}
              disabled={disburseMutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              {disburseMutation.isPending ? 'Disbursing...' : 'Disburse Loan to Vault'}
            </button>
          )}

          {(loan.status === 'ACTIVE' || loan.status === 'OVERDUE') && (
            <button
              onClick={() => setIsSettleModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              <span>Early Loan Payoff Quote</span>
            </button>
          )}
        </div>
      </div>

      {/* Field KYC Verification Credentials Card */}
      <div className="bg-[#fffdfa] p-5 rounded-2xl border border-[#ded3be] shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#ece3d4] pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-700" />
            <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider">
              Field KYC Identity Verification Details
            </h3>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
            loan.verification?.status === 'SUBMITTED' || loan.status === 'VERIFIED'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-900'
          }`}>
            {loan.verification?.status === 'SUBMITTED' || loan.status === 'VERIFIED'
              ? `Verified by ${loan.verification?.verifiedByName || loan.assignedStaffName || 'Staff'}`
              : 'Verification Pending'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#fbf7f0] p-2.5 rounded-xl border border-[#ece3d4]">
            <p className="text-[10px] font-bold text-stone-500 uppercase">1. Smart Card Number</p>
            <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
              {loan.verification?.smartCardNumber || loan.customerId?.smartCardNumber || 'Pending'}
            </p>
          </div>
          <div className="bg-[#fbf7f0] p-2.5 rounded-xl border border-[#ece3d4]">
            <p className="text-[10px] font-bold text-stone-500 uppercase">2. Aadhaar Number</p>
            <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
              {loan.verification?.aadharNumber || loan.customerId?.aadharNumber || 'Pending'}
            </p>
          </div>
          <div className="bg-[#fbf7f0] p-2.5 rounded-xl border border-[#ece3d4]">
            <p className="text-[10px] font-bold text-stone-500 uppercase">3. Voter ID Number</p>
            <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
              {loan.verification?.voterIdNumber || loan.customerId?.voterIdNumber || 'Pending'}
            </p>
          </div>
          <div className="bg-[#fbf7f0] p-2.5 rounded-xl border border-[#ece3d4]">
            <p className="text-[10px] font-bold text-stone-500 uppercase">4. PAN Number</p>
            <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
              {loan.verification?.panNumber || loan.customerId?.panNumber || 'Pending'}
            </p>
          </div>
        </div>

        {loan.verification?.remarks && (
          <div className="p-3 bg-[#f6f0e4] rounded-xl border border-[#ded3be] text-xs">
            <span className="font-bold text-amber-950">Field Staff Observations: </span>
            <span className="text-stone-700 font-medium italic">"{loan.verification.remarks}"</span>
          </div>
        )}
      </div>

      {/* Financial Account Summary Cards */}
      <div className={`grid grid-cols-2 ${loan.earlySettlementDiscount > 0 ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4`}>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] uppercase font-semibold text-slate-400">Principal Disbursed</p>
          <p className="text-xl font-bold text-slate-900 mt-1">₹{loan.principal?.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500 mt-0.5">Interest: ₹{loan.interestAmount} ({loan.interestRate}%)</p>
        </div>
        {loan.earlySettlementDiscount > 0 && (
          <div className="bg-purple-50/70 p-4 rounded-xl border border-purple-200 shadow-xs">
            <p className="text-[10px] uppercase font-bold text-purple-700">Interest Discount</p>
            <p className="text-xl font-bold text-purple-900 mt-1">₹{loan.earlySettlementDiscount.toLocaleString('en-IN')}</p>
            <p className="text-xs text-purple-600 mt-0.5">Early Closure Waiver</p>
          </div>
        )}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] uppercase font-semibold text-slate-400">Total Contractual</p>
          <p className="text-xl font-bold text-slate-900 mt-1">₹{loan.totalPayable?.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500 mt-0.5">Includes ₹{loan.savingsAmount} Savings/Doc</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] uppercase font-semibold text-slate-400">Total Repaid</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">₹{totalPaid.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {((totalPaid / (loan.totalPayable || 1)) * 100).toFixed(1)}% repaid
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] uppercase font-semibold text-slate-400">Outstanding Balance</p>
          <p className="text-xl font-bold text-rose-600 mt-1">₹{outstandingTotal.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500 mt-0.5">{loan.tenureWeeks} Total Installments</p>
        </div>
      </div>

      {/* Installment Schedule */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-600" />
            <span>Graduated Repayment Schedule ({installments.length} Weeks)</span>
          </h3>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 sticky top-0 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Week</th>
                <th className="px-4 py-2.5">Due Date</th>
                <th className="px-4 py-2.5">Expected</th>
                <th className="px-4 py-2.5">Principal</th>
                <th className="px-4 py-2.5">Interest</th>
                <th className="px-4 py-2.5">Savings</th>
                <th className="px-4 py-2.5">Paid</th>
                <th className="px-4 py-2.5">Balance</th>
                <th className="px-4 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {installments.map((inst: any) => (
                <tr key={inst._id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-2 font-mono font-bold text-slate-700">W{inst.installmentNumber}</td>
                  <td className="px-4 py-2 text-slate-600 font-mono">
                    {new Date(inst.dueDate).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-2 font-bold text-slate-800">₹{inst.expectedAmount}</td>
                  <td className="px-4 py-2 text-slate-500">₹{inst.allocatedPrincipal}</td>
                  <td className="px-4 py-2 text-slate-500">₹{inst.allocatedInterest}</td>
                  <td className="px-4 py-2 text-slate-500">₹{inst.allocatedSavings}</td>
                  <td className="px-4 py-2 text-emerald-600 font-semibold">₹{inst.paidAmount}</td>
                  <td className="px-4 py-2 text-rose-600 font-semibold">₹{inst.balanceAmount}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      inst.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                      inst.status === 'BAD_DEBT' ? 'bg-purple-100 text-purple-900 border border-purple-300 font-black' :
                      inst.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800 border border-rose-300 font-black' :
                      inst.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
                      inst.status === 'DISCOUNT' ? 'bg-purple-100 text-purple-800 border border-purple-300 font-black' :
                      inst.status === 'WAIVED' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {inst.status === 'PAID' && <CheckCircle2 className="w-2.5 h-2.5" />}
                      <span>{inst.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment & Collection History (Repayment Collections) */}
      <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex items-center justify-between">
          <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>Repayment Collections — Cycle {loan.cycle || 1} ({payments.length})</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
              <tr>
                <th className="px-4 py-2.5">Date & Time</th>
                <th className="px-4 py-2.5">Amount Collected</th>
                <th className="px-4 py-2.5">Method</th>
                <th className="px-4 py-2.5">Receipt #</th>
                <th className="px-4 py-2.5">Collector</th>
                <th className="px-4 py-2.5">Notes / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ece3d4]">
              {payments.length > 0 ? (
                payments.map((p: any) => (
                  <tr key={p._id} className="hover:bg-[#fbf7f0] transition">
                    <td className="px-4 py-2.5 text-stone-700 font-mono font-medium">
                      {new Date(p.paymentDate || p.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className={`px-4 py-2.5 font-bold ${p.paymentMethod === 'DISCOUNT' ? 'text-purple-700 font-black' : 'text-emerald-700'}`}>
                      ₹{p.amount?.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        p.paymentMethod === 'DISCOUNT'
                          ? 'bg-purple-100 text-purple-900 border-purple-300'
                          : 'bg-[#f6f0e4] text-amber-950 border-[#ded3be]'
                      }`}>
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-stone-600 font-medium">{p.receiptNumber || '-'}</td>
                    <td className="px-4 py-2.5 text-stone-700 font-medium">{p.collectorId?.name || p.collectorName || 'Branch Staff'}</td>
                    <td className={`px-4 py-2.5 ${p.paymentMethod === 'DISCOUNT' ? 'text-purple-900 font-bold not-italic' : 'text-stone-600 italic'}`}>
                      {p.isReversed ? (
                        <span className="text-rose-600 font-bold not-italic">REVERSED</span>
                      ) : (
                        p.remarks || 'Master Ledger Repayment'
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-stone-400">
                    No collection receipts recorded for this loan yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Early Settlement Modal with Manual Discount Entry & Savings Refund Breakdown */}
      {isSettleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-amber-900/30">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-amber-700" />
                <span>Early Loan Settlement & Account Closure</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSettleModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Financial Overview Card */}
            <div className="bg-[#fcf9f2] border border-[#ded3be] rounded-xl p-4 space-y-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-[#ece3d4] pb-2">
                <span className="text-stone-600 font-bold">Elapsed Duration:</span>
                <span className="font-bold text-stone-900 font-mono">
                  {quote?.elapsedWeeks ?? 0} Weeks of {loan.tenureWeeks || 32}
                </span>
              </div>

              {/* Total Balance Outstanding */}
              <div className="flex items-center justify-between border-b border-[#ece3d4] pb-2">
                <div>
                  <span className="text-stone-800 font-bold block">Total Contractual Balance Due</span>
                  <span className="text-[10px] text-stone-500 font-medium">All remaining principal, interest & dues</span>
                </div>
                <span className="font-mono font-black text-base text-rose-800">
                  ₹{(quote?.outstandingTotal ?? outstandingTotal ?? 0).toLocaleString('en-IN')}
                </span>
              </div>

              {/* Savings Return */}
              <div className="flex items-center justify-between border-b border-[#ece3d4] pb-2">
                <div>
                  <span className="text-stone-800 font-bold block">Savings Return Accumulation</span>
                  <span className="text-[10px] text-stone-500 font-medium">Refunded to borrower upon closing loan</span>
                </div>
                <span className="font-mono font-bold text-sm text-emerald-700">
                  ₹{(loan?.savingsAmount ?? quote?.savingsAmount ?? 0).toLocaleString('en-IN')}
                </span>
              </div>

              {/* Manual Discount Entry */}
              <div className="bg-white p-3 rounded-xl border border-amber-300 shadow-2xs space-y-1.5">
                <label className="block font-bold text-amber-950 text-xs">
                  Discount Amount to Waive / Reduce (₹)
                </label>
                <p className="text-[11px] text-stone-500 font-medium">
                  Enter any negotiated discount or interest waiver decided for this borrower
                </p>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2 font-bold text-stone-400">₹</span>
                  <input
                    type="number"
                    min={0}
                    max={quote?.outstandingTotal ?? outstandingTotal ?? 0}
                    value={manualDiscount || ''}
                    placeholder="0 (No discount)"
                    onChange={(e) => setManualDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full pl-8 pr-3 py-2 bg-[#fffdfa] border border-[#ded3be] rounded-xl font-mono font-black text-stone-900 text-sm focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              {/* Option: Deduct savings from payoff */}
              {(loan?.savingsAmount ?? quote?.savingsAmount ?? 0) > 0 && (
                <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deductSavings}
                    onChange={(e) => setDeductSavings(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-stone-900 block">
                      Offset Savings Return Against Payoff Amount
                    </span>
                    <span className="text-[10px] text-stone-600">
                      {deductSavings
                        ? `Deducting ₹${(loan?.savingsAmount ?? quote?.savingsAmount ?? 0).toLocaleString('en-IN')} savings from the balance. Borrower only pays the remaining net.`
                        : `Borrower pays full balance; ₹${(loan?.savingsAmount ?? quote?.savingsAmount ?? 0).toLocaleString('en-IN')} savings returned separately to borrower in cash.`}
                    </span>
                  </div>
                </label>
              )}

              {/* Total Settlement Amount */}
              {(() => {
                const totalBalance = quote?.outstandingTotal ?? outstandingTotal ?? 0;
                const savingsRefund = loan?.savingsAmount ?? quote?.savingsAmount ?? 0;
                const discountVal = Math.max(0, manualDiscount || 0);
                const netPayoffAmount = Math.max(0, totalBalance - discountVal - (deductSavings ? savingsRefund : 0));

                return (
                  <div className="bg-[#251b14] p-3.5 rounded-xl border border-amber-800/60 text-center shadow-xs">
                    <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                      Total Early Settlement Payoff Amount
                    </p>
                    <p className="text-2xl font-black text-amber-400 mt-0.5 font-mono">
                      ₹{netPayoffAmount.toLocaleString('en-IN')}
                    </p>
                    {deductSavings ? (
                      <p className="text-[10px] text-amber-200/80 mt-1">
                        (₹{totalBalance.toLocaleString()} Due - ₹{discountVal.toLocaleString()} Discount - ₹{savingsRefund.toLocaleString()} Savings Offset)
                      </p>
                    ) : (
                      <p className="text-[10px] text-amber-200/80 mt-1">
                        (₹{totalBalance.toLocaleString()} Due - ₹{discountVal.toLocaleString()} Discount • Plus ₹{savingsRefund.toLocaleString()} savings handed back)
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-800 mb-1">Payment Method</label>
                <select
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600 shadow-2xs"
                >
                  <option value="CASH">CASH (Vault)</option>
                  <option value="UPI">UPI (Google Pay / PhonePe)</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER (Current Account)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-stone-800 mb-1">Settlement / Closing Date</label>
                <input
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600 shadow-2xs"
                />
                <span className="text-[10px] text-stone-500">
                  Specify actual date of collection / loan closure (defaults to today)
                </span>
              </div>
              <div>
                <label className="block font-bold text-stone-800 mb-1">Settlement Remarks</label>
                <input
                  type="text"
                  value={settleRemarks}
                  onChange={(e) => setSettleRemarks(e.target.value)}
                  placeholder="e.g. Early full settlement by borrower with negotiated discount"
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600 shadow-2xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded3be] text-xs">
              <button
                onClick={() => setIsSettleModalOpen(false)}
                className="px-4 py-2 border border-[#ded3be] rounded-xl font-bold text-stone-700 hover:bg-[#faf6ee] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const totalBalance = quote?.outstandingTotal ?? outstandingTotal ?? 0;
                  const savingsRefund = loan?.savingsAmount ?? quote?.savingsAmount ?? 0;
                  const discountVal = Math.max(0, manualDiscount || 0);
                  const netPayoffAmount = Math.max(0, totalBalance - discountVal - (deductSavings ? savingsRefund : 0));

                  settleMutation.mutate({
                    paymentMethod: settleMethod,
                    remarks: settleRemarks,
                    discountAmount: discountVal,
                    deductSavings,
                    settlementAmount: netPayoffAmount,
                    settlementDate: settleDate
                  });
                }}
                disabled={settleMutation.isPending}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 rounded-xl font-bold shadow-md shadow-amber-900/20 cursor-pointer disabled:opacity-50"
              >
                {settleMutation.isPending ? 'Closing Loan...' : 'Confirm Early Settlement & Close Loan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Staff Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-600" />
                <span>Transfer / Assign Collection Staff</span>
              </h3>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/60">
                <p className="font-bold text-slate-900">{loan.customerId?.name}</p>
                <p className="text-slate-600">Account #{loan.loanNumber} • ₹{loan.principal?.toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-amber-900 font-bold mt-1">Currently assigned: {loan.assignedStaffName || 'Branch Manager'}</p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Select Field Collection Staff *</label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:border-amber-600 shadow-xs"
                >
                  <option value="MANAGER">-- Assign to Branch Manager (Self) --</option>
                  {staffUsers.map((st: any) => (
                    <option key={st._id} value={st._id}>
                      {st.name} ({st.phone || st.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={assignStaffMutation.isPending || !selectedStaffId}
                  onClick={() => assignStaffMutation.mutate(selectedStaffId)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {assignStaffMutation.isPending ? 'Transferring...' : 'Transfer Staff'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Edit Loan Modal (Manager & Admin - All Fields) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#fffdfa] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-700" />
                  <span>Edit Loan Account: {loan.loanNumber}</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Update financial amounts, ledger totals, borrower contact, route schedule, and assigned staff collector.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-[#f6f0e4] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editLoanError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-medium">
                {editLoanError}
              </p>
            )}

            <form onSubmit={handleEditLoanSubmit} className="space-y-4 text-xs">
              {/* Section 1: Account & Schedule */}
              <div className="space-y-3">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-[#ece3d4] pb-1">
                  1. Loan Identification & Routing
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Loan Account # *</label>
                    <input
                      type="text"
                      required
                      value={editLoanForm.loanNumber}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, loanNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Loan Status *</label>
                    <select
                      value={editLoanForm.status}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, status: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="OVERDUE">OVERDUE</option>
                      <option value="BAD_DEBT">BAD_DEBT</option>
                      <option value="CLOSED">CLOSED</option>
                      <option value="SETTLED">SETTLED</option>
                      <option value="SUBMITTED">SUBMITTED</option>
                      <option value="PENDING_VERIFICATION">PENDING VERIFICATION</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Repayment Route Day *</label>
                    <select
                      value={editLoanForm.collectionDay}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, collectionDay: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    >
                      <option value="MONDAY">MONDAY</option>
                      <option value="TUESDAY">TUESDAY</option>
                      <option value="WEDNESDAY">WEDNESDAY</option>
                      <option value="THURSDAY">THURSDAY</option>
                      <option value="FRIDAY">FRIDAY</option>
                      <option value="SATURDAY">SATURDAY</option>
                      <option value="SUNDAY">SUNDAY</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-stone-800 mb-1">Assigned Staff Collector</label>
                    <input
                      type="text"
                      value={editLoanForm.assignedStaffName}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, assignedStaffName: e.target.value })}
                      placeholder="e.g. Chandra Sekar"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Tenure (Weeks) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={editLoanForm.tenureWeeks}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, tenureWeeks: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Financial Amounts & Balances */}
              <div className="space-y-3">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-[#ece3d4] pb-1">
                  2. Financial Amounts & Balance Totals
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Principal (₹) *</label>
                    <input
                      type="number"
                      required
                      value={editLoanForm.principal}
                      onChange={(e) => {
                        const p = parseFloat(e.target.value) || 0;
                        const i = editLoanForm.interestAmount;
                        setEditLoanForm({
                          ...editLoanForm,
                          principal: p,
                          totalPayable: p + i,
                          outstandingTotal: (p + i) - editLoanForm.totalPaid
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Interest Due (₹) *</label>
                    <input
                      type="number"
                      required
                      value={editLoanForm.interestAmount}
                      onChange={(e) => {
                        const i = parseFloat(e.target.value) || 0;
                        const p = editLoanForm.principal;
                        setEditLoanForm({
                          ...editLoanForm,
                          interestAmount: i,
                          totalPayable: p + i,
                          outstandingTotal: (p + i) - editLoanForm.totalPaid
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Doc Charges (₹)</label>
                    <input
                      type="number"
                      value={editLoanForm.docCharges}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, docCharges: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Savings Deposit (₹)</label>
                    <input
                      type="number"
                      value={editLoanForm.savingsAmount}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, savingsAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Total Payable (₹) *</label>
                    <input
                      type="number"
                      required
                      value={editLoanForm.totalPayable}
                      onChange={(e) => {
                        const tp = parseFloat(e.target.value) || 0;
                        setEditLoanForm({
                          ...editLoanForm,
                          totalPayable: tp,
                          outstandingTotal: tp - editLoanForm.totalPaid
                        });
                      }}
                      className="w-full px-3 py-2 bg-[#fcf9f2] border border-[#ded3be] rounded-xl font-mono font-black text-amber-950 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Total Paid So Far (₹)</label>
                    <input
                      type="number"
                      value={editLoanForm.totalPaid}
                      onChange={(e) => {
                        const paid = parseFloat(e.target.value) || 0;
                        setEditLoanForm({
                          ...editLoanForm,
                          totalPaid: paid,
                          outstandingTotal: editLoanForm.totalPayable - paid
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-emerald-700 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-stone-800 mb-1">Remaining Balance / Outstanding (₹)</label>
                    <input
                      type="number"
                      value={editLoanForm.outstandingTotal}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, outstandingTotal: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-[#fcf9f2] border border-[#ded3be] rounded-xl font-mono font-black text-rose-800 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Borrower & Family Contact */}
              <div className="space-y-3">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-[#ece3d4] pb-1">
                  3. Borrower & Nominee Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Borrower Full Name</label>
                    <input
                      type="text"
                      value={editLoanForm.customerName}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, customerName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Borrower Primary Phone</label>
                    <input
                      type="text"
                      value={editLoanForm.customerPhone}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, customerPhone: e.target.value })}
                      placeholder="10-digit number"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Spouse Name</label>
                    <input
                      type="text"
                      value={editLoanForm.spouseName}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, spouseName: e.target.value })}
                      placeholder="Spouse / Husband Name"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Nominee Name</label>
                    <input
                      type="text"
                      value={editLoanForm.nomineeName}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, nomineeName: e.target.value })}
                      placeholder="Nominee full name"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Nominee Phone</label>
                    <input
                      type="text"
                      value={editLoanForm.nomineePhone}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, nomineePhone: e.target.value })}
                      placeholder="Nominee contact number"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Internal Notes & Remarks</label>
                    <input
                      type="text"
                      value={editLoanForm.notes}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, notes: e.target.value })}
                      placeholder="Any account notes..."
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-[#ded3be] rounded-xl font-bold text-stone-700 hover:bg-[#faf6ee] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateLoanMutation.isPending}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-bold rounded-xl shadow-md shadow-amber-900/20 transition cursor-pointer disabled:opacity-50"
                >
                  {updateLoanMutation.isPending ? 'Saving...' : 'Save Loan Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
