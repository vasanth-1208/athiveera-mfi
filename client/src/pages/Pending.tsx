import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock, Phone, MessageSquare, CheckCircle, Search, Filter, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { api } from '../services/api';
import { useBranch } from '../context/BranchContext';

const DAYS = ['ALL', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export const Pending: React.FC = () => {
  const { selectedBranchId } = useBranch();
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OVERDUE' | 'BAD_DEBT'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedFollowUp, setSelectedFollowUp] = useState<any | null>(null);
  const [remarks, setRemarks] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [amountPaidNow, setAmountPaidNow] = useState('');
  const [actionStatus, setActionStatus] = useState<'RESOLVED' | 'PARTIAL' | 'OVERDUE' | 'BAD_DEBT'>('OVERDUE');
  const [sortCol, setSortCol] = useState<string>('customerName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['pendingFollowUps', selectedBranchId, selectedDay, statusFilter, search],
    queryFn: () => api.getPending({
      branchId: selectedBranchId,
      weekday: selectedDay !== 'ALL' ? selectedDay : undefined,
      status: statusFilter,
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
    setActionStatus(
      item.status === 'BAD_DEBT' ? 'BAD_DEBT' :
      item.status === 'RESOLVED' ? 'RESOLVED' : 
      (item.status === 'PARTIAL' ? 'PARTIAL' : 'OVERDUE')
    );
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
      if (actionStatus !== 'BAD_DEBT') {
        setActionStatus('OVERDUE');
      }
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

  const sortedFollowUps = [...followUps].sort((a: any, b: any) => {
    if (sortCol === 'customerName') {
      const cmp = (a.customerName || '').localeCompare(b.customerName || '');
      return sortDir === 'asc' ? cmp : -cmp;
    }
    if (sortCol === 'groupName') {
      const cmp = (a.groupName || '').localeCompare(b.groupName || '');
      return sortDir === 'asc' ? cmp : -cmp;
    }
    if (sortCol === 'status') {
      const cmp = (a.status || '').localeCompare(b.status || '');
      return sortDir === 'asc' ? cmp : -cmp;
    }
    if (sortCol === 'overdueWeeks') {
      const numA = Number(a.overdueWeeks) || 0;
      const numB = Number(b.overdueWeeks) || 0;
      return sortDir === 'asc' ? numA - numB : numB - numA;
    }
    if (sortCol === 'actualPending') {
      const numA = Number(a.actualPending) || 0;
      const numB = Number(b.actualPending) || 0;
      return sortDir === 'asc' ? numA - numB : numB - numA;
    }
    if (sortCol === 'totalSavings') {
      const numA = Number(a.totalSavings) || 0;
      const numB = Number(b.totalSavings) || 0;
      return sortDir === 'asc' ? numA - numB : numB - numA;
    }
    if (sortCol === 'balancePending') {
      const numA = Number(a.balancePending) || 0;
      const numB = Number(b.balancePending) || 0;
      return sortDir === 'asc' ? numA - numB : numB - numA;
    }
    if (sortCol === 'staffName') {
      const cmp = (a.staffName || '').localeCompare(b.staffName || '');
      return sortDir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Overdue & Bad Debts Collections</h2>
          <p className="text-xs text-slate-500">
            Real-time delinquency tracking and bad debts management reproducing PENDING.xlsx with weekday routes, customer-known reconciliation, and staff action logs
          </p>
        </div>
      </div>

      {/* Weekday Route Tabs & Search */}
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

      {/* Category / Status Filter Switcher: ALL vs OVERDUE vs BAD DEBTS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-[#fdfbf7] p-1.5 rounded-2xl border border-[#ded3be] shadow-xs flex-wrap">
          <span className="text-xs font-bold text-stone-600 px-2 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-amber-700" />
            View:
          </span>
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-[#251b14] text-amber-300 shadow-xs'
                : 'text-stone-700 hover:text-stone-900'
            }`}
          >
            All Accounts ({summary.totalRecords || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('OVERDUE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'OVERDUE'
                ? 'bg-rose-900 text-rose-100 shadow-xs'
                : 'text-stone-700 hover:text-stone-900'
            }`}
          >
            Overdue ({summary.totalOverdueCount ?? summary.totalRecords ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('BAD_DEBT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              statusFilter === 'BAD_DEBT'
                ? 'bg-purple-900 text-purple-100 shadow-xs'
                : 'text-stone-700 hover:text-stone-900'
            }`}
          >
            Bad Debts ({summary.totalBadDebtsCount || 0})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search borrower, phone, group..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-600 shadow-xs"
          />
        </div>
      </div>

      {/* KPI Overdue & Bad Debts Summary Cards */}
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
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {statusFilter === 'BAD_DEBT' ? 'Bad Debts Accounts' : statusFilter === 'OVERDUE' ? 'Delinquent Borrowers' : 'Overdue & Bad Debts'}
          </p>
          <p className={`text-xl font-black mt-1 ${statusFilter === 'BAD_DEBT' ? 'text-purple-700' : 'text-amber-600'}`}>
            {statusFilter === 'BAD_DEBT' ? (summary.totalBadDebtsCount || 0) : statusFilter === 'OVERDUE' ? (summary.totalOverdueCount ?? summary.totalRecords ?? 0) : (summary.totalRecords || 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {statusFilter === 'BAD_DEBT' ? 'Unrecoverable / non-accruing' : statusFilter === 'OVERDUE' ? 'Accounts requiring field visits' : `${summary.totalOverdueCount || 0} Overdue • ${summary.totalBadDebtsCount || 0} Bad Debts`}
          </p>
        </div>
      </div>

      {/* Overdue Table */}
      <div className="bg-[#fffdfa] dark:bg-[#23160e] rounded-2xl border border-[#ded3be] dark:border-[#442a1b] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f6f0e4] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
              <tr>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('customerName')}>
                  <div className="flex items-center gap-1">
                    <span>Customer</span>
                    {sortCol === 'customerName' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('groupName')}>
                  <div className="flex items-center gap-1">
                    <span>Group / Route</span>
                    {sortCol === 'groupName' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3">Customer Phone</th>
                <th className="px-4 py-3">Nominee Phone</th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    {sortCol === 'status' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('overdueWeeks')}>
                  <div className="flex items-center gap-1">
                    <span>Weeks Overdue</span>
                    {sortCol === 'overdueWeeks' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('actualPending')}>
                  <div className="flex items-center gap-1">
                    <span>Actual Pending</span>
                    {sortCol === 'actualPending' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('totalSavings')}>
                  <div className="flex items-center gap-1">
                    <span>Total Savings</span>
                    {sortCol === 'totalSavings' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('balancePending')}>
                  <div className="flex items-center gap-1">
                    <span>Balance Pending</span>
                    {sortCol === 'balancePending' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('staffName')}>
                  <div className="flex items-center gap-1">
                    <span>Assigned Staff</span>
                    {sortCol === 'staffName' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3">Remarks / Action</th>
                <th className="px-4 py-3 text-right">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ece3d4]">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-stone-400 font-medium">
                    Loading overdue & bad debt collection records...
                  </td>
                </tr>
              ) : sortedFollowUps.length > 0 ? (
                sortedFollowUps.map((f: any) => (
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
                      {f.status === 'BAD_DEBT' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-300">
                          BAD DEBT
                        </span>
                      ) : f.status === 'PARTIAL' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          PARTIAL
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                          OVERDUE
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold">
                      <span className={`px-2 py-0.5 rounded text-xs ${f.status === 'BAD_DEBT' ? 'bg-purple-50 text-purple-900' : 'bg-rose-100 text-rose-800'}`}>
                        {f.overdueWeeks || 0}
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
                  <td colSpan={12} className="text-center py-10 text-slate-400">
                    No {statusFilter === 'BAD_DEBT' ? 'bad debt' : statusFilter === 'OVERDUE' ? 'overdue' : 'delinquent'} collection accounts found
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
                    <option value="BAD_DEBT">Bad Debts (Uncollectible)</option>
                  </select>
                </div>
              </div>

              {actionStatus === 'BAD_DEBT' && (
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg text-purple-900 text-[11px] font-medium leading-relaxed">
                  ⚠️ <strong>Move to Bad Debts</strong>: This borrower's loan and all remaining installments will be classified as Bad Debts. They will remain visible at the end of the daily collection route for recovery.
                </div>
              )}

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

