/*  */import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock, Phone, MessageSquare, CheckCircle, Search } from 'lucide-react';
import { api } from '../services/api';
import { useBranch } from '../context/BranchContext';

const DAYS = ['ALL', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];

export const Pending: React.FC = () => {
  const { selectedBranchId } = useBranch();
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedFollowUp, setSelectedFollowUp] = useState<any | null>(null);
  const [remarks, setRemarks] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [amountPaidNow, setAmountPaidNow] = useState('');
  const [actionStatus, setActionStatus] = useState<'RESOLVED' | 'PARTIAL' | 'OVERDUE'>('OVERDUE');

  const { data, isLoading } = useQuery({
    queryKey: ['pendingFollowUps', selectedBranchId, selectedDay, search],
    queryFn: () => api.getPending({
      branchId: selectedBranchId,
      weekday: selectedDay !== 'ALL' ? selectedDay : undefined,
      search
    })
  });

  const followUpMutation = useMutation({
    mutationFn: (body: any) => api.recordFollowUp(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingFollowUps'] });
      queryClient.invalidateQueries({ queryKey: ['dailySheet'] });
      queryClient.invalidateQueries({ queryKey: ['dailyLedger'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setSelectedFollowUp(null);
      setRemarks('');
      setNextDate('');
      setAmountPaidNow('');
    }
  });

  const handleOpenFollowUp = (item: any) => {
    setSelectedFollowUp(item);
    setRemarks(item.remarks || '');
    setNextDate(item.nextFollowUpDate ? item.nextFollowUpDate.split('T')[0] : '');
    setAmountPaidNow('');
    setActionStatus(item.status === 'RESOLVED' ? 'RESOLVED' : (item.status === 'PARTIAL' ? 'PARTIAL' : 'OVERDUE'));
  };

  const handleAmountPaidChange = (val: string) => {
    setAmountPaidNow(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      if (selectedFollowUp && num >= selectedFollowUp.actualPending) {
        setActionStatus('RESOLVED');
      } else {
        setActionStatus('PARTIAL');
      }
    } else {
      setActionStatus('OVERDUE');
    }
  };

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFollowUp || !remarks) return;
    followUpMutation.mutate({
      id: selectedFollowUp._id,
      remarks,
      nextFollowUpDate: nextDate || undefined,
      amountPaidNow: amountPaidNow ? parseFloat(amountPaidNow) : 0,
      status: actionStatus
    });
  };

  const followUps = data?.followUps || [];
  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Pending & Overdue Collections</h2>
          <p className="text-xs text-slate-500">
            Real-time delinquency tracking reproducing PENDING.xlsx with weekday routes, customer-known reconciliation, and staff action logs
          </p>
        </div>
      </div>

      {/* Weekday Route Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {DAYS.map((day) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${selectedDay === day
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
          >
            {day === 'ALL' ? 'All Weekdays' : `${day} Route`}
          </button>
        ))}
      </div>

      {/* KPI Overdue Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Actual Pending</p>
          <p className="text-xl font-black text-rose-600 mt-1">₹{Number(summary.totalActualPending || 0).toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Calculated system outstanding</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Savings</p>
          <p className="text-xl font-black text-emerald-600 mt-1">₹{Number(summary.totalSavings || 0).toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Held security deposits</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Net Balance Pending</p>
          <p className="text-xl font-black text-amber-800 mt-1">₹{Number(summary.totalBalancePending || 0).toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Actual minus savings</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Delinquent Borrowers</p>
          <p className="text-xl font-black text-amber-600 mt-1">{summary.totalRecords || 0}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Accounts requiring field visits</p>
        </div>
      </div>

      {/* Overdue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Group / Route</th>
                <th className="px-4 py-3">Customer Phone</th>
                <th className="px-4 py-3">Nominee Phone</th>
                <th className="px-4 py-3">Weeks Overdue</th>
                <th className="px-4 py-3">Actual Pending</th>
                <th className="px-4 py-3">Total Savings</th>
                <th className="px-4 py-3">Balance Pending</th>
                <th className="px-4 py-3">Assigned Staff</th>
                <th className="px-4 py-3">Remarks / Action</th>
                <th className="px-4 py-3 text-right">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-slate-400">
                    Loading overdue collection records...
                  </td>
                </tr>
              ) : followUps.length > 0 ? (
                followUps.map((f: any) => (
                  <tr key={f._id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-semibold text-slate-900">{f.customerName}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {f.groupName}
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">{f.collectionDay}</span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {f.customerPhone && f.customerPhone !== '-' && f.customerPhone !== 'No phone' ? (
                        <a
                          href={`tel:${f.customerPhone.replace(/[^0-9+]/g, '')}`}
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-200 text-xs transition cursor-pointer"
                          title={`Click to call ${f.customerName} (${f.customerPhone})`}
                        >
                          <Phone className="w-3 h-3 text-emerald-600" />
                          <span>{f.customerPhone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 italic">No phone</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {f.nomineePhone && f.nomineePhone !== '-' ? (
                        <a
                          href={`tel:${f.nomineePhone.replace(/[^0-9+]/g, '')}`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded transition cursor-pointer text-xs"
                          title={`Click to call nominee (${f.nomineePhone})`}
                        >
                          <Phone className="w-2.5 h-2.5 text-slate-400" />
                          <span>{f.nomineePhone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-xs">
                        {f.overdueWeeks} {f.overdueWeeks === 1 ? 'Week' : 'Weeks'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-rose-600 text-sm">₹{f.actualPending?.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700 text-sm">₹{(f.totalSavings || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 font-bold text-sm">
                      {f.balancePending > 0 ? (
                        <span className="text-amber-900">₹{f.balancePending.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ₹0 (Covered)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{f.staffName || 'Staff'}</td>
                    <td className="px-4 py-3 text-slate-600 italic max-w-xs truncate">{f.remarks || 'No notes'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenFollowUp(f)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Log Action</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-slate-400">
                    No pending collections found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Action Modal */}
      {selectedFollowUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-600" />
              <span>Record Follow-Up & Action</span>
            </h3>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span>Borrower: <strong className="text-slate-900">{selectedFollowUp.customerName}</strong></span>
                <span className="font-mono text-[11px] text-slate-500">{selectedFollowUp.loanNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Group: <strong className="text-slate-800">{selectedFollowUp.groupName}</strong> ({selectedFollowUp.collectionDay})</span>
                <span>Staff: <strong className="text-slate-700">{selectedFollowUp.staffName}</strong></span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 font-bold">
                <span className="text-slate-600">Pending Amount:</span>
                <span className="text-rose-600 text-sm font-black">₹{selectedFollowUp.actualPending?.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <form onSubmit={handleFollowUpSubmit} className="space-y-3.5 text-xs">
              {/* How Much Paid Now */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  How Much Paid Now? (₹)
                  <span className="text-slate-400 font-normal ml-1">(Optional - records collection immediately)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    max={selectedFollowUp.actualPending}
                    value={amountPaidNow}
                    onChange={(e) => handleAmountPaidChange(e.target.value)}
                    placeholder={`Max ₹${selectedFollowUp.actualPending}`}
                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 text-sm focus:outline-none focus:border-amber-600 shadow-2xs"
                  />
                </div>
                {parseFloat(amountPaidNow) > 0 && (
                  <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                    ✓ ₹{parseFloat(amountPaidNow).toLocaleString('en-IN')} will be credited to today's cashbook and reduce loan pending.
                  </p>
                )}
              </div>

              {/* Next Action Date & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Next Action Date</label>
                  <input
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={actionStatus}
                    onChange={(e) => setActionStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold focus:outline-none focus:border-amber-600"
                  >
                    <option value="OVERDUE">Overdue (Promise to Pay)</option>
                    <option value="PARTIAL">Partial (Part Paid)</option>
                    <option value="RESOLVED">Resolved (Collected / Settled)</option>
                  </select>
                </div>
              </div>

              {/* Follow-Up Remarks */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Follow-Up Remarks *</label>
                <textarea
                  rows={3}
                  required
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Visited borrower, promised payment on next route..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedFollowUp(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={followUpMutation.isPending}
                  className="px-4 py-2 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white rounded-lg font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {followUpMutation.isPending ? 'Saving...' : 'Save Follow-Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
