import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  HandCoins, 
  Coins, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ShieldCheck,
  Heart,
  Edit3,
  Trash2,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isManager } = useAuth();
  const isManagerOrAdmin = isAdmin || isManager;

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    spouseName: '',
    nomineeName: '',
    nomineeRelationship: 'Spouse',
    nomineePhone: '',
    address: '',
    area: '',
    smartCardNumber: '',
    aadharNumber: '',
    voterIdNumber: '',
    panNumber: '',
    status: 'ACTIVE',
    notes: ''
  });
  const [editFormError, setEditFormError] = useState('');

  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.getCustomer(id!),
    enabled: !!id,
    refetchOnMount: 'always',
    staleTime: 0
  });

  const updateCustomerMutation = useMutation({
    mutationFn: (updateData: any) => api.updateCustomer(id!, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsEditModalOpen(false);
      setEditFormError('');
    },
    onError: (err: any) => {
      setEditFormError(err.message || 'Failed to update customer');
    }
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: () => api.deleteCustomer(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      alert('Customer deleted successfully');
      navigate('/customers');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete customer');
    }
  });

  const handleOpenEdit = () => {
    if (!customer) return;
    setEditFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      spouseName: customer.spouseName || '',
      nomineeName: customer.nomineeName || '',
      nomineeRelationship: customer.nomineeRelationship || 'Spouse',
      nomineePhone: customer.nomineePhone || '',
      address: customer.address || '',
      area: customer.area || '',
      smartCardNumber: customer.smartCardNumber || '',
      aadharNumber: customer.aadharNumber || '',
      voterIdNumber: customer.voterIdNumber || '',
      panNumber: customer.panNumber || '',
      status: customer.status || 'ACTIVE',
      notes: customer.notes || ''
    });
    setEditFormError('');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.name) {
      setEditFormError('Customer name is required');
      return;
    }
    updateCustomerMutation.mutate(editFormData);
  };

  const handleDeleteCustomer = () => {
    if (!customer) return;
    if (window.confirm(`Are you sure you want to permanently delete customer "${customer.name}" (${customer.customerId})? This action cannot be undone.`)) {
      deleteCustomerMutation.mutate();
    }
  };

  const customer = data?.customer;
  const loans = data?.loans || [];
  const activeLoan = data?.activeLoan;

  // Derive effective loan ID to view: selected loan or active loan or first loan
  const effectiveLoanId = selectedLoanId || activeLoan?._id || loans[0]?._id;

  // Fetch full details, installments and payments for the selected cycle
  const { data: loanDetailData, isLoading: isLoanDetailLoading } = useQuery({
    queryKey: ['loanDetails', effectiveLoanId],
    queryFn: () => api.getLoan(effectiveLoanId!),
    enabled: !!effectiveLoanId,
    refetchOnMount: 'always',
    staleTime: 0
  });

  const currentLoan = loanDetailData?.loan || (loans.find((l: any) => l._id === effectiveLoanId) || activeLoan);
  const installments = loanDetailData?.installments || data?.installments || [];
  const payments = loanDetailData?.payments || data?.payments || [];
  const followUps = data?.followUps || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-xs text-slate-400">Loading customer profile...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="bg-white p-8 rounded-xl text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">Customer Not Found</h3>
        <Link to="/customers" className="text-xs text-brand-600 hover:underline">
          &larr; Back to customer directory
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers</span>
        </Link>

        <div className="flex items-center gap-2">
          {isManagerOrAdmin && (
            <button
              onClick={handleOpenEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-xl text-xs border border-amber-300 transition cursor-pointer shadow-xs"
              title="Edit all fields of customer"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-700" />
              <span>Edit Customer</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleDeleteCustomer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-300 transition cursor-pointer shadow-xs"
              title="Delete customer record (Admin only)"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* Customer Header Banner */}
      <div className="bg-[#fffdfa] p-6 rounded-2xl border border-[#ded3be] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-600 flex items-center justify-center text-stone-950 font-black text-xl shadow-md shrink-0">
            {customer.name?.charAt(0) || <User className="w-6 h-6" />}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-stone-900">{customer.name}</h2>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs">
                {customer.customerId}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {customer.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
              {customer.phone && customer.phone !== '-' && (
                <a
                  href={`tel:${customer.phone.replace(/[^0-9+]/g, '')}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#f6f0e4] hover:bg-emerald-50 text-stone-900 hover:text-emerald-800 font-bold rounded-lg border border-[#ded3be] hover:border-emerald-300 transition cursor-pointer"
                  title={`Click to call ${customer.name} (${customer.phone})`}
                >
                  <Phone className="w-3 h-3 text-emerald-600" />
                  <span>{customer.phone}</span>
                </a>
              )}
              {customer.nomineePhone && customer.nomineePhone !== '-' && (
                <a
                  href={`tel:${customer.nomineePhone.replace(/[^0-9+]/g, '')}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#fcf9f2] hover:bg-emerald-50 text-stone-700 hover:text-emerald-800 font-medium rounded-lg border border-[#ded3be] hover:border-emerald-300 transition cursor-pointer"
                  title={`Click to call Nominee (${customer.nomineePhone})`}
                >
                  <Phone className="w-3 h-3 text-stone-500" />
                  <span>Nominee: {customer.nomineePhone}</span>
                </a>
              )}
              <div className="flex items-center gap-1 text-stone-600">
                <MapPin className="w-3.5 h-3.5 text-amber-700" />
                <span>{customer.area || 'Unknown Area'}</span>
              </div>
              <div className="flex items-center gap-1 text-stone-600">
                <Calendar className="w-3.5 h-3.5 text-amber-700" />
                <span>Branch: {customer.branchId?.name}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Group Badge */}
        <div className="bg-[#fcf9f2] border border-[#ded3be] p-4 rounded-xl text-right">
          <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Allocated Group</p>
          <p className="text-sm font-black text-stone-900">{customer.activeGroupId?.name || 'No Active Group'}</p>
          {customer.activeGroupId && (
            <p className="text-xs text-amber-800 font-bold uppercase mt-0.5">
              Route: {customer.activeGroupId.collectionDay}
            </p>
          )}
        </div>
      </div>

      {/* Customer KYC & Government Identity Verification Card */}
      <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#ece3d4] pb-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-700" />
            <div>
              <h3 className="text-sm font-black text-stone-900 uppercase tracking-wide">Customer KYC & Identity Documents</h3>
              <p className="text-[11px] text-stone-500 font-medium">Permanent identification credentials and family nominee records</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
            customer.aadharNumber || customer.smartCardNumber
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-amber-100 text-amber-900 border border-amber-300'
          }`}>
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            <span>{customer.aadharNumber || customer.smartCardNumber ? 'KYC Documented' : 'KYC Pending'}</span>
          </span>
        </div>

        {/* 4 Identity Document Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-[#fcf9f2] p-3 rounded-xl border border-[#ded3be]">
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">1. Smart Card Number</p>
            <p className="font-mono font-bold text-stone-900 text-sm mt-1">
              {customer.smartCardNumber || 'Not recorded'}
            </p>
          </div>
          <div className="bg-[#fcf9f2] p-3 rounded-xl border border-[#ded3be]">
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">2. Aadhaar Number</p>
            <p className="font-mono font-bold text-stone-900 text-sm mt-1">
              {customer.aadharNumber || 'Not recorded'}
            </p>
          </div>
          <div className="bg-[#fcf9f2] p-3 rounded-xl border border-[#ded3be]">
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">3. Voter ID Number</p>
            <p className="font-mono font-bold text-stone-900 text-sm mt-1">
              {customer.voterIdNumber || 'Not recorded'}
            </p>
          </div>
          <div className="bg-[#fcf9f2] p-3 rounded-xl border border-[#ded3be]">
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">4. PAN Card Number</p>
            <p className="font-mono font-bold text-stone-900 text-sm mt-1 uppercase">
              {customer.panNumber || 'Not recorded'}
            </p>
          </div>
        </div>

        {/* Family & Nominee Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1 border-t border-[#ece3d4]">
          <div className="bg-[#faf6ee] p-3 rounded-xl border border-[#ded3be]">
            <span className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Spouse / Father Name</span>
            <span className="font-bold text-stone-900 text-sm">{customer.spouseName || '—'}</span>
          </div>
          <div className="bg-[#faf6ee] p-3 rounded-xl border border-[#ded3be]">
            <span className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Nominee & Relationship</span>
            <span className="font-bold text-stone-900 text-sm">
              {customer.nomineeName ? `${customer.nomineeName} (${customer.nomineeRelationship || 'Spouse'})` : '—'}
            </span>
          </div>
          <div className="bg-[#faf6ee] p-3 rounded-xl border border-[#ded3be]">
            <span className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Residential Address</span>
            <span className="font-medium text-stone-800 text-xs">
              {customer.address ? `${customer.address}, ${customer.area}` : customer.area || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Loan Cycles Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-brand-600" />
            <span>Loan Cycle History ({loans.length})</span>
          </h3>
          <Link
            to={`/loans?customerId=${customer._id}`}
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            Apply New Loan Cycle
          </Link>
        </div>

        {/* Quick Cycle Switcher Tabs */}
        {loans.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-500 mr-1">Switch Cycle:</span>
            {loans.map((l: any) => {
              const isSelected = effectiveLoanId === l._id;
              return (
                <button
                  key={l._id}
                  onClick={() => setSelectedLoanId(l._id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>Cycle {l.cycle} ({l.status})</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isSelected ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    ₹{l.principal?.toLocaleString('en-IN')}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {loans.map((l: any) => {
            const isSelected = effectiveLoanId === l._id;
            return (
              <div
                key={l._id}
                onClick={() => setSelectedLoanId(l._id)}
                className={`p-4 rounded-xl border transition cursor-pointer relative ${
                  isSelected
                    ? 'bg-amber-50/40 border-brand-500 shadow-md ring-2 ring-brand-500'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-slate-700">{l.loanNumber}</span>
                  <div className="flex items-center gap-1.5">
                    {isSelected && (
                      <span className="bg-brand-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      l.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                      l.status === 'CLOSED' ? 'bg-slate-100 text-slate-600' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {l.status}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-500">Cycle {l.cycle} &bull; {l.productType}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-400">Principal</p>
                    <p className="font-bold text-slate-800">₹{l.principal?.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Total Payable</p>
                    <p className="font-bold text-slate-800">₹{l.totalPayable?.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Paid to date</p>
                    <p className="font-bold text-emerald-600">₹{l.totalPaid?.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Balance</p>
                    <p className="font-bold text-rose-600">₹{l.outstandingTotal?.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {isSelected ? 'Viewing this schedule below' : 'Click to view schedule'}
                  </span>
                  <Link
                    to={`/loans/${l._id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-brand-600 hover:text-brand-800"
                  >
                    Manage &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Loan Amortization Schedule */}
      {currentLoan && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">
                  Repayment Schedule — Cycle {currentLoan.cycle} ({currentLoan.loanNumber})
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  currentLoan.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                  currentLoan.status === 'CLOSED' ? 'bg-slate-100 text-slate-600' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {currentLoan.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Principal ₹{currentLoan.principal?.toLocaleString('en-IN')} &bull; Total Payable ₹{currentLoan.totalPayable?.toLocaleString('en-IN')} across {currentLoan.tenureWeeks} weeks
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 font-medium">Outstanding Balance: </span>
              <span className="text-sm font-bold text-rose-600">₹{currentLoan.outstandingTotal?.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">#</th>
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
                        inst.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800 border border-rose-300 font-black' :
                        inst.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
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
      )}

      {/* Payment & Collection History */}
      <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex items-center justify-between">
          <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>Repayment Collections — Cycle {currentLoan?.cycle} ({payments.length})</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
              <tr>
                <th className="px-4 py-2.5">Date & Time</th>
                <th className="px-4 py-2.5">Amount Collected</th>
                <th className="px-4 py-2.5">Method</th>
                <th className="px-4 py-2.5">Notes / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ece3d4]">
              {payments.length > 0 ? (
                payments.map((p: any) => (
                  <tr key={p._id} className="hover:bg-[#fbf7f0] transition">
                    <td className="px-4 py-2.5 text-stone-700 font-mono font-medium">
                      {new Date(p.paymentDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-4 py-2.5 font-black text-emerald-700 text-sm">₹{p.amount?.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-[#f6f0e4] border border-[#ded3be] text-stone-800 text-[10px] font-mono font-bold uppercase">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-stone-500 italic">{p.remarks || 'Regular payment'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-stone-400 font-medium">
                    No payment collections recorded for this customer yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Edit Customer Modal (Manager & Admin - All Fields) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#fffdfa] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-700" />
                  <span>Edit Customer: {customer.name}</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Update customer records, nominee contact, KYC documents, and account status.
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

            {editFormError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-medium">
                {editFormError}
              </p>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              {/* Section 1: Basic Information */}
              <div className="space-y-3">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-[#ece3d4] pb-1">
                  1. Borrower Basic Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Customer Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Primary Phone Number</label>
                    <input
                      type="text"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Spouse Name</label>
                    <input
                      type="text"
                      value={editFormData.spouseName}
                      onChange={(e) => setEditFormData({ ...editFormData, spouseName: e.target.value })}
                      placeholder="Spouse / Husband Name"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Operational Area / Village</label>
                    <input
                      type="text"
                      value={editFormData.area}
                      onChange={(e) => setEditFormData({ ...editFormData, area: e.target.value })}
                      placeholder="e.g. PONNAYUR, SOMANDURAI"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-stone-800 mb-1">Residential Address</label>
                    <textarea
                      rows={2}
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      placeholder="Complete residential address..."
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Nominee Details */}
              <div className="space-y-3">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-[#ece3d4] pb-1">
                  2. Family / Nominee Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Nominee Name</label>
                    <input
                      type="text"
                      value={editFormData.nomineeName}
                      onChange={(e) => setEditFormData({ ...editFormData, nomineeName: e.target.value })}
                      placeholder="Nominee full name"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Relationship</label>
                    <input
                      type="text"
                      value={editFormData.nomineeRelationship}
                      onChange={(e) => setEditFormData({ ...editFormData, nomineeRelationship: e.target.value })}
                      placeholder="e.g. Spouse, Mother, Son"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Nominee Phone</label>
                    <input
                      type="text"
                      value={editFormData.nomineePhone}
                      onChange={(e) => setEditFormData({ ...editFormData, nomineePhone: e.target.value })}
                      placeholder="Nominee contact number"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: KYC & Identity Documents */}
              <div className="space-y-3">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-[#ece3d4] pb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  <span>3. KYC & Government Identification Credentials</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Smart Card (Ration Card) #</label>
                    <input
                      type="text"
                      value={editFormData.smartCardNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, smartCardNumber: e.target.value.toUpperCase() })}
                      placeholder="e.g. 33/G/0294821"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono uppercase text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Aadhaar Card #</label>
                    <input
                      type="text"
                      value={editFormData.aadharNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, aadharNumber: e.target.value })}
                      placeholder="e.g. 9845 2841 0294"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Voter ID Card #</label>
                    <input
                      type="text"
                      value={editFormData.voterIdNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, voterIdNumber: e.target.value.toUpperCase() })}
                      placeholder="e.g. TN/12/084/102948"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono uppercase text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">PAN Card #</label>
                    <input
                      type="text"
                      value={editFormData.panNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, panNumber: e.target.value.toUpperCase() })}
                      placeholder="e.g. ABCDE1234F"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono uppercase text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Status & Notes */}
              <div className="space-y-3">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-[#ece3d4] pb-1">
                  4. Status & Verification Remarks
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Account Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="BLACKLISTED">BLACKLISTED</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-stone-800 mb-1">Internal Notes / KYC Remarks</label>
                    <input
                      type="text"
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                      placeholder="Any additional borrower remarks..."
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
                  disabled={updateCustomerMutation.isPending}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-bold rounded-xl shadow-md shadow-amber-900/20 transition cursor-pointer disabled:opacity-50"
                >
                  {updateCustomerMutation.isPending ? 'Saving Changes...' : 'Save All Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
