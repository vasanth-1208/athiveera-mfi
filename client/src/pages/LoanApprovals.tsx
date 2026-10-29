import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CheckSquare, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ShieldAlert, 
  CreditCard, 
  UserCheck, 
  FileCheck2,
  AlertCircle,
  Eye,
  Check,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { Link } from 'react-router-dom';

export const LoanApprovals: React.FC = () => {
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const queryClient = useQueryClient();

  const isManagerOrAdmin = user?.role === 'MAIN_ADMIN' || user?.role === 'BRANCH_MANAGER';

  const [activeTab, setActiveTab] = useState<'VERIFIED' | 'SUBMITTED' | 'ALL'>('VERIFIED');
  const [remarks, setRemarks] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [inspectLoan, setInspectLoan] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pendingLoans', selectedBranchId, activeTab],
    queryFn: () => api.getLoans({
      branchId: selectedBranchId,
      status: activeTab === 'ALL' ? undefined : activeTab
    }),
    enabled: isManagerOrAdmin
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) => api.approveLoan(id, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingLoans'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setSelectedLoanId(null);
      setActionType(null);
      setInspectLoan(null);
      setRemarks('');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) => api.rejectLoan(id, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingLoans'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setSelectedLoanId(null);
      setActionType(null);
      setInspectLoan(null);
      setRemarks('');
    }
  });

  const handleConfirmAction = () => {
    if (!selectedLoanId || !actionType) return;
    if (actionType === 'APPROVE') {
      approveMutation.mutate({ id: selectedLoanId, remarks });
    } else {
      rejectMutation.mutate({ id: selectedLoanId, remarks });
    }
  };

  if (!isManagerOrAdmin) {
    return (
      <div className="bg-[#fffdfa] p-8 rounded-2xl border border-[#ded3be] text-center space-y-3 shadow-xs">
        <ShieldAlert className="w-8 h-8 text-rose-600 mx-auto" />
        <h3 className="text-base font-black text-stone-900">Access Restricted</h3>
        <p className="text-xs text-stone-500 font-medium">
          Only Branch Managers and Administrators are authorized to review verification KYC and approve credit facilities.
        </p>
      </div>
    );
  }

  const allLoans = data?.loans || [];
  // Filter for actionable loans (VERIFIED, SUBMITTED, PENDING_VERIFICATION)
  const loans = allLoans.filter((l: any) => 
    activeTab === 'ALL' 
      ? ['VERIFIED', 'SUBMITTED', 'PENDING_VERIFICATION'].includes(l.status)
      : l.status === activeTab
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-stone-900 tracking-tight">Manager Credit Approval Queue</h2>
        <p className="text-xs text-stone-500 font-medium mt-0.5">
          Review borrower field KYC verifications (Smart Card, Aadhaar, Voter ID, PAN), verify capacity, and authorize loan disbursements
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('VERIFIED')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'VERIFIED'
              ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
              : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>KYC Verified Applications</span>
        </button>
        <button
          onClick={() => setActiveTab('SUBMITTED')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'SUBMITTED'
              ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
              : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>Direct / Unverified Submissions</span>
        </button>
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
              : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
          }`}
        >
          <span>All Pending Decision</span>
        </button>
      </div>

      {/* Queue Table */}
      <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f6f0e4] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
              <tr>
                <th className="px-4 py-3">Loan Account</th>
                <th className="px-4 py-3">Borrower Name</th>
                <th className="px-4 py-3">Group Route</th>
                <th className="px-4 py-3">Principal Amount</th>
                <th className="px-4 py-3">Total Payable</th>
                <th className="px-4 py-3">Verified KYC Identity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Manager Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ece3d4]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-stone-400 font-medium">
                    Loading credit approval queue...
                  </td>
                </tr>
              ) : loans.length > 0 ? (
                loans.map((l: any) => {
                  const hasKYC = l.verification?.smartCardNumber || l.customerId?.smartCardNumber;
                  const isVerified = l.status === 'VERIFIED';

                  return (
                    <tr key={l._id} className="hover:bg-[#fbf7f0] transition">
                      {/* Loan Account */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-stone-900 block">{l.loanNumber}</span>
                        <span className="text-[10px] text-stone-500 font-semibold">{l.tenureWeeks} Weeks Weekly</span>
                      </td>

                      {/* Borrower */}
                      <td className="px-4 py-3.5 font-bold text-stone-900">
                        {l.customerId?.name}
                        <span className="block text-[10px] text-stone-500 font-mono font-normal">{l.customerId?.phone}</span>
                      </td>

                      {/* Group Route */}
                      <td className="px-4 py-3.5">
                        <span className="text-amber-900 font-bold block">{l.groupId?.name}</span>
                        <span className="text-[10px] text-amber-800 font-semibold uppercase">{l.groupId?.collectionDay}</span>
                      </td>

                      {/* Principal */}
                      <td className="px-4 py-3.5 font-bold text-stone-900 text-sm">
                        ₹{l.principal?.toLocaleString('en-IN')}
                      </td>

                      {/* Total Payable */}
                      <td className="px-4 py-3.5 font-black text-amber-900 text-sm">
                        ₹{l.totalPayable?.toLocaleString('en-IN')}
                      </td>

                      {/* Verified KYC */}
                      <td className="px-4 py-3.5">
                        {hasKYC ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-stone-800">
                              <span className="text-stone-400 text-[10px]">SC:</span>
                              <span>{l.verification?.smartCardNumber || l.customerId?.smartCardNumber}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-stone-800">
                              <span className="text-stone-400 text-[10px]">UID:</span>
                              <span>{l.verification?.aadharNumber || l.customerId?.aadharNumber}</span>
                            </div>
                            {l.verification?.verifiedByName && (
                              <span className="text-[10px] text-emerald-800 font-semibold block">
                                Verified by {l.verification.verifiedByName}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-800 font-medium italic">
                            Verification Pending from Staff
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          isVerified ? 'bg-cyan-100 text-cyan-900 border border-cyan-300' :
                          l.status === 'PENDING_VERIFICATION' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                          'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}>
                          {isVerified ? 'KYC Verified' :
                           l.status === 'PENDING_VERIFICATION' ? 'Verification Pending' : 'Submitted'}
                        </span>
                      </td>

                      {/* Decision Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasKYC && (
                            <button
                              onClick={() => setInspectLoan(l)}
                              title="Inspect Full KYC Dossier"
                              className="p-1.5 bg-[#f6f0e4] hover:bg-[#ede3d0] text-amber-900 rounded-lg border border-[#ded3be] transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedLoanId(l._id);
                              setActionType('APPROVE');
                              setRemarks(`Approved by ${user?.name} (${user?.role.replace('_', ' ')})`);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedLoanId(l._id);
                              setActionType('REJECT');
                              setRemarks('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-stone-400 font-medium">
                    No loan applications currently pending credit approval in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect KYC Dossier Modal */}
      {inspectLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-amber-900/30">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-700" />
                <span>Verified Field KYC Dossier</span>
              </h3>
              <button
                onClick={() => setInspectLoan(null)}
                className="text-stone-400 hover:text-stone-700 text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="bg-[#f6f0e4] p-3 rounded-xl border border-[#ded3be] text-xs">
              <p className="font-bold text-stone-900 text-sm">{inspectLoan.customerId?.name}</p>
              <p className="text-stone-600">Loan #{inspectLoan.loanNumber} • ₹{inspectLoan.principal?.toLocaleString('en-IN')}</p>
              <p className="text-amber-800 font-semibold">{inspectLoan.groupId?.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#fbf7f0] p-3 rounded-xl border border-[#ece3d4]">
                <p className="text-[10px] text-stone-500 font-bold uppercase">1. Smart Card Number</p>
                <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
                  {inspectLoan.verification?.smartCardNumber || inspectLoan.customerId?.smartCardNumber || 'N/A'}
                </p>
              </div>
              <div className="bg-[#fbf7f0] p-3 rounded-xl border border-[#ece3d4]">
                <p className="text-[10px] text-stone-500 font-bold uppercase">2. Aadhaar Number</p>
                <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
                  {inspectLoan.verification?.aadharNumber || inspectLoan.customerId?.aadharNumber || 'N/A'}
                </p>
              </div>
              <div className="bg-[#fbf7f0] p-3 rounded-xl border border-[#ece3d4]">
                <p className="text-[10px] text-stone-500 font-bold uppercase">3. Voter ID Number</p>
                <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
                  {inspectLoan.verification?.voterIdNumber || inspectLoan.customerId?.voterIdNumber || 'N/A'}
                </p>
              </div>
              <div className="bg-[#fbf7f0] p-3 rounded-xl border border-[#ece3d4]">
                <p className="text-[10px] text-stone-500 font-bold uppercase">4. PAN Number</p>
                <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
                  {inspectLoan.verification?.panNumber || inspectLoan.customerId?.panNumber || 'N/A'}
                </p>
              </div>
            </div>

            {inspectLoan.verification?.remarks && (
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 text-xs">
                <p className="text-[10px] font-bold text-amber-900 uppercase">Field Staff Verification Remarks:</p>
                <p className="text-stone-800 font-medium mt-0.5 italic">"{inspectLoan.verification.remarks}"</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ded3be]">
              <button
                type="button"
                onClick={() => setInspectLoan(null)}
                className="px-4 py-2 border border-[#ded3be] rounded-xl text-stone-700 font-bold hover:bg-[#f6f0e4] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision Remarks Confirmation Modal */}
      {selectedLoanId && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-900/30">
            <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
              {actionType === 'APPROVE' ? (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span>Confirm Credit Approval</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-600" />
                  <span>Confirm Credit Rejection</span>
                </>
              )}
            </h3>

            <p className="text-xs text-stone-500 font-medium">
              {actionType === 'APPROVE'
                ? 'Approving authorizes loan disbursement and activates the scheduled installment timeline for weekly collections.'
                : 'Rejecting terminates this loan application and returns it to unapproved state.'}
            </p>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">Administrative Decision Remarks *</label>
              <textarea
                rows={3}
                required
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter credit sanction justification or rejection grounds..."
                className="w-full px-3.5 py-2.5 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:border-amber-600 shadow-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ded3be]">
              <button
                onClick={() => {
                  setSelectedLoanId(null);
                  setActionType(null);
                }}
                className="px-4 py-2 border border-[#ded3be] rounded-xl text-xs font-bold text-stone-600 hover:bg-[#f6f0e4] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={approveMutation.isPending || rejectMutation.isPending}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition shadow-sm cursor-pointer disabled:opacity-50 ${
                  actionType === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Confirm {actionType === 'APPROVE' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
