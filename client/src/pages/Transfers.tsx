import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Plus,
  Building2,
  CheckCircle2,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  FileSpreadsheet,
  Coins
} from 'lucide-react';
import { api } from '../services/api';
import { useBranch } from '../context/BranchContext';

export const Transfers: React.FC = () => {
  const { selectedBranchId, selectedBranch, branches } = useBranch();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'RECEIVED' | 'PAID'>('ALL');

  const [formData, setFormData] = useState({
    sourceBranchId: '',
    destinationBranchId: '',
    amount: '',
    accountType: 'CASH' as 'CASH' | 'BANK',
    purpose: '',
    transferDate: new Date().toISOString().split('T')[0]
  });

  const { data, isLoading } = useQuery({
    queryKey: ['transfers', selectedBranchId],
    queryFn: () => api.getTransfers({ branchId: selectedBranchId })
  });

  const transferMutation = useMutation({
    mutationFn: (newTrf: any) => api.createTransfer(newTrf),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      setIsModalOpen(false);
      setFormData({
        sourceBranchId: '',
        destinationBranchId: '',
        amount: '',
        accountType: 'CASH',
        purpose: '',
        transferDate: new Date().toISOString().split('T')[0]
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sourceBranchId || !formData.destinationBranchId || !formData.amount) {
      alert('Please fill all required transfer fields');
      return;
    }
    transferMutation.mutate({
      ...formData,
      amount: parseFloat(formData.amount)
    });
  };

  const transfers = data?.transfers || [];

  // Determine active branch perspective:
  // If Madathukulam is selected, perspective is MDKM.
  // If Pollachi or Consolidated is selected, default perspective is Pollachi.
  const isMDKM = selectedBranch?.code === 'MDKM';
  const targetCode = isMDKM ? 'MDKM' : 'POLLACHI';
  const otherShort = isMDKM ? 'Pollachi' : 'MDKM';

  // Dynamic aggregates
  const receivedList = transfers.filter((t: any) => t.destinationBranchId?.code === targetCode);
  const totalReceived = receivedList.reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const receivedCount = receivedList.length;

  const paidList = transfers.filter((t: any) => t.sourceBranchId?.code === targetCode);
  const totalPaid = paidList.reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const paidCount = paidList.length;

  const netBalance = totalReceived - totalPaid;

  const filteredTransfers = transfers.filter((t: any) => {
    const isReceived = t.destinationBranchId?.code === targetCode;
    if (directionFilter === 'RECEIVED' && !isReceived) return false;
    if (directionFilter === 'PAID' && isReceived) return false;

    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      t.transferNumber?.toLowerCase().includes(s) ||
      t.purpose?.toLowerCase().includes(s) ||
      String(t.amount).includes(s) ||
      t.sourceBranchId?.name?.toLowerCase().includes(s) ||
      t.destinationBranchId?.name?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
            <ArrowLeftRight className="w-6 h-6 text-amber-700" />
            <span>Branch-to-Branch Cash Transfers</span>
          </h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Canonical CASH TRANFER register: verified liquidity movements and expense funding between Pollachi and Madathukulam branches.
          </p>
        </div>
        <button
          onClick={() => {
            const pollachi = branches.find((b: any) => b.code === 'POLLACHI');
            const mdkm = branches.find((b: any) => b.code === 'MDKM');
            setIsModalOpen(true);
            setFormData({
              ...formData,
              sourceBranchId: isMDKM ? (mdkm?._id || '') : (pollachi?._id || ''),
              destinationBranchId: isMDKM ? (pollachi?._id || '') : (mdkm?._id || '')
            });
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 rounded-xl text-xs font-bold shadow-md shadow-amber-900/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record Branch Transfer</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-800 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Total Transfers</p>
            <p className="text-xl font-black text-stone-900 mt-0.5">{transfers.length}</p>
            <p className="text-[10px] text-stone-500 font-medium">Audited Ledger Movements</p>
          </div>
        </div>

        <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-700 shrink-0">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Received from {otherShort}</p>
            <p className="text-xl font-black text-emerald-800 mt-0.5">₹{totalReceived.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-stone-500 font-medium">{receivedCount} Inflow Transactions</p>
          </div>
        </div>

        <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center text-rose-700 shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Transferred to {otherShort}</p>
            <p className="text-xl font-black text-rose-800 mt-0.5">₹{totalPaid.toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-stone-500 font-medium">{paidCount} Outflow Transactions</p>
          </div>
        </div>

        <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-700/15 flex items-center justify-center text-amber-900 shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">Net Inter-Branch Balance</p>
            <p className="text-xl font-black text-amber-900 mt-0.5">₹{Math.abs(netBalance).toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-stone-500 font-medium">
              {isMDKM ? 'Net Transferred to Pollachi' : (selectedBranch?.code === 'POLLACHI' ? 'Net Pollachi Funds Inflow' : 'Net Consolidated Balance')}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#fffdfa] p-3 rounded-2xl border border-[#ded3be] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transfer ref, purpose, or amount..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-amber-600 shadow-xs"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-[#ece3d4] p-1 rounded-xl border border-[#ded3be]">
            <button
              onClick={() => setDirectionFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                directionFilter === 'ALL'
                  ? 'bg-[#251b14] text-amber-300 shadow-xs'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              All ({transfers.length})
            </button>
            <button
              onClick={() => setDirectionFilter('RECEIVED')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                directionFilter === 'RECEIVED'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              Received ({receivedCount})
            </button>
            <button
              onClick={() => setDirectionFilter('PAID')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                directionFilter === 'PAID'
                  ? 'bg-rose-800 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              Paid ({paidCount})
            </button>
          </div>
        </div>

        <div className="text-xs text-stone-500 font-bold self-end sm:self-center">
          Showing {filteredTransfers.length} of {transfers.length} Records
        </div>
      </div>

      {/* Transfers Table */}
      <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f6f0e4] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
              <tr>
                <th className="px-4 py-3">Transfer Ref #</th>
                <th className="px-4 py-3">Transfer Date</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Sending Branch</th>
                <th className="px-4 py-3">Receiving Branch</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Transfer Amount</th>
                <th className="px-4 py-3">Purpose & Ledger Remarks</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ece3d4]">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-stone-400 font-medium">
                    Loading branch transfers...
                  </td>
                </tr>
              ) : filteredTransfers.length > 0 ? (
                filteredTransfers.map((t: any) => {
                  const isReceived = t.destinationBranchId?.code === targetCode;

                  return (
                    <tr key={t._id} className="hover:bg-[#fbf7f0] transition">
                      <td className="px-4 py-3.5 font-mono font-bold text-stone-900">{t.transferNumber}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-stone-800">
                        {t.transferDate ? new Date(t.transferDate).toLocaleDateString('en-GB') : '-'}
                      </td>
                      <td className="px-4 py-3.5">
                        {isReceived ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <ArrowDownLeft className="w-3 h-3 text-emerald-700" />
                            <span>INFLOW</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                            <ArrowUpRight className="w-3 h-3 text-rose-700" />
                            <span>OUTFLOW</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-stone-800">
                        {t.sourceBranchId?.name}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-stone-800">
                        {t.destinationBranchId?.name}
                      </td>
                      <td className="px-4 py-3.5 font-mono uppercase text-stone-600 font-semibold">{t.accountType}</td>
                      <td className="px-4 py-3.5 font-mono font-black text-sm text-stone-900">
                        ₹{t.amount?.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3.5 text-stone-700 font-medium max-w-sm">
                        <span className="bg-[#fcf9f2] px-2 py-0.5 rounded border border-[#ded3be] text-[11px] block truncate" title={t.purpose}>
                          {t.purpose || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />
                          <span>{t.status}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-stone-400 font-medium">
                    No branch transfers found matching filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 text-xs">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-amber-700" />
                <span>Record Branch-to-Branch Transfer</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Sending Branch *</label>
                  <select
                    value={formData.sourceBranchId}
                    onChange={(e) => setFormData({ ...formData, sourceBranchId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    required
                  >
                    <option value="">-- Sending Branch --</option>
                    {branches.map((b: any) => (
                      <option key={b._id} value={b._id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Receiving Branch *</label>
                  <select
                    value={formData.destinationBranchId}
                    onChange={(e) => setFormData({ ...formData, destinationBranchId: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    required
                  >
                    <option value="">-- Receiving Branch --</option>
                    {branches.map((b: any) => (
                      <option key={b._id} value={b._id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Transfer Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.transferDate}
                    onChange={(e) => setFormData({ ...formData, transferDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Transfer Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="e.g. 25000"
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">Purpose / Specific Ledger Note *</label>
                <input
                  type="text"
                  required
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  placeholder="e.g. VIGNESH SALARY, OFFICE RENT, LOAN ISSUE PURPOSE"
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#ded3be] rounded-xl font-bold text-stone-700 hover:bg-[#faf6ee]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferMutation.isPending}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 rounded-xl font-bold shadow-md shadow-amber-900/20 disabled:opacity-50"
                >
                  {transferMutation.isPending ? 'Processing...' : 'Complete Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

