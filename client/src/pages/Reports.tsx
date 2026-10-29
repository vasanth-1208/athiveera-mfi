import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FileSpreadsheet, 
  Download, 
  Calendar, 
  HandCoins, 
  AlertTriangle, 
  BookOpen, 
  TrendingUp, 
  Building2, 
  CalendarDays, 
  Coins, 
  FolderTree, 
  Users, 
  Phone, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  Filter, 
  Wallet,
  Receipt,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { useBranch } from '../context/BranchContext';

type ReportTab = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PENDING_EMI' | 'PROFIT_LOSS' | 'BRANCH_WISE';

export const Reports: React.FC = () => {
  const { selectedBranchId, selectedBranch } = useBranch();
  const [activeTab, setActiveTab] = useState<ReportTab>('DAILY');

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [pendingDayFilter, setPendingDayFilter] = useState<string>('ALL');

  // Excel Download Helper
  const handleExport = (endpoint: string, params: Record<string, any> = {}) => {
    const token = localStorage.getItem('athiveera_token');
    const searchParams = new URLSearchParams();
    if (token) searchParams.append('token', token);
    if (selectedBranchId) searchParams.append('branchId', selectedBranchId);

    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, String(v));
      }
    }
    const url = `/api/reports/${endpoint}?${searchParams.toString()}`;
    window.open(url, '_blank');
  };

  // Queries for each report type
  const { data: dailyData, isLoading: isDailyLoading } = useQuery({
    queryKey: ['reportDaily', selectedBranchId, selectedDate],
    queryFn: () => api.getDailyReport({ branchId: selectedBranchId, date: selectedDate }),
    enabled: activeTab === 'DAILY'
  });

  const { data: weeklyData, isLoading: isWeeklyLoading } = useQuery({
    queryKey: ['reportWeekly', selectedBranchId],
    queryFn: () => api.getWeeklyReport({ branchId: selectedBranchId }),
    enabled: activeTab === 'WEEKLY'
  });

  const { data: monthlyData, isLoading: isMonthlyLoading } = useQuery({
    queryKey: ['reportMonthly', selectedBranchId, selectedYear, selectedMonth],
    queryFn: () => api.getMonthlyReport({ branchId: selectedBranchId, year: selectedYear, month: selectedMonth }),
    enabled: activeTab === 'MONTHLY'
  });

  const { data: pendingData, isLoading: isPendingLoading } = useQuery({
    queryKey: ['reportPendingEmi', selectedBranchId, pendingDayFilter],
    queryFn: () => api.getPendingEmiReport({ branchId: selectedBranchId, collectionDay: pendingDayFilter !== 'ALL' ? pendingDayFilter : undefined }),
    enabled: activeTab === 'PENDING_EMI'
  });

  const { data: plData, isLoading: isPlLoading } = useQuery({
    queryKey: ['reportProfitLoss', selectedBranchId],
    queryFn: () => api.getProfitLossReport({ branchId: selectedBranchId }),
    enabled: activeTab === 'PROFIT_LOSS'
  });

  const { data: branchWiseData, isLoading: isBranchWiseLoading } = useQuery({
    queryKey: ['reportBranchWise'],
    queryFn: () => api.getBranchWiseReport(),
    enabled: activeTab === 'BRANCH_WISE'
  });

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">Financial & Operational Reports</h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Audit-ready statements, daily route sheets, weekly performance, monthly ledgers, pending EMI follow-ups, profit & loss, and branch statistics
          </p>
        </div>

        {/* Global Branch Scope Badge */}
        <div className="flex items-center gap-2 bg-[#f6f0e4] border border-[#ded3be] rounded-2xl px-4 py-2 text-xs font-semibold">
          <Building2 className="w-4 h-4 text-amber-700" />
          <span className="text-stone-500 font-bold uppercase text-[10px]">Report Scope:</span>
          <strong className="text-stone-900 font-black">{selectedBranch?.name || 'All Branches (Consolidated)'}</strong>
        </div>
      </div>

      {/* Primary Report Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#ded3be]">
        <button
          onClick={() => setActiveTab('DAILY')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'DAILY'
              ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
              : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
          }`}
        >
          <Calendar className="w-4 h-4 text-amber-500" />
          <span>Daily Reports</span>
        </button>

        <button
          onClick={() => setActiveTab('WEEKLY')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'WEEKLY'
              ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
              : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
          }`}
        >
          <FolderTree className="w-4 h-4 text-amber-500" />
          <span>Weekly Reports</span>
        </button>

        <button
          onClick={() => setActiveTab('MONTHLY')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'MONTHLY'
              ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
              : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
          }`}
        >
          <CalendarDays className="w-4 h-4 text-amber-500" />
          <span>Monthly Reports</span>
        </button>

        <button
          onClick={() => setActiveTab('PENDING_EMI')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'PENDING_EMI'
              ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
              : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Pending EMI Reports</span>
        </button>

        <button
          onClick={() => setActiveTab('PROFIT_LOSS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'PROFIT_LOSS'
              ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
              : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-amber-500" />
          <span>Profit & Loss</span>
        </button>

        <button
          onClick={() => setActiveTab('BRANCH_WISE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'BRANCH_WISE'
              ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
              : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-500" />
          <span>Branch Wise Reports</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. DAILY REPORTS TAB */}
      {/* ======================================================== */}
      {activeTab === 'DAILY' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-stone-700">Select Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
              />
            </div>

            <button
              onClick={() => handleExport('daily/export', { date: selectedDate })}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#251b14] hover:bg-[#34271e] text-amber-300 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Daily Report (.xlsx)</span>
            </button>
          </div>

          {/* Daily KPI Summary Cards (Collections, Shortfall, Disbursements) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#fffdfa] p-5 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Collections Received</p>
              <p className="text-2xl font-black text-emerald-700 mt-1">
                ₹{(dailyData?.summary?.totalCollected || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-xs text-stone-500 font-medium">
                Cash: ₹{(dailyData?.summary?.totalCash || 0).toLocaleString('en-IN')} • Digital: ₹{(dailyData?.summary?.totalDigital || 0).toLocaleString('en-IN')} ({dailyData?.payments?.length || 0} Receipts)
              </span>
            </div>

            <div className="bg-[#fffdfa] p-5 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Daily Collection Shortfall</p>
              <p className="text-2xl font-black text-rose-600 mt-1">
                ₹{(dailyData?.summary?.shortfall || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-xs text-stone-500 font-medium">
                Expected route due: ₹{(dailyData?.summary?.expectedDue || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="bg-[#fffdfa] p-5 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Loans Disbursed Today</p>
              <p className="text-2xl font-black text-amber-950 mt-1">
                ₹{(dailyData?.summary?.totalDisbursed || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-xs text-amber-800 font-semibold">
                {dailyData?.summary?.disbursementCount || 0} New Loans Issued Today
              </span>
            </div>
          </div>

          {/* Collections Received Table */}
          <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex items-center justify-between">
              <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-700" />
                <span>Collections Received Today ({dailyData?.payments?.length || 0})</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                  <tr>
                    <th className="px-4 py-3">Receipt #</th>
                    <th className="px-4 py-3">Borrower / Phone</th>
                    <th className="px-4 py-3">Group & Day</th>
                    <th className="px-4 py-3">Collector</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece3d4]">
                  {isDailyLoading ? (
                    <tr><td colSpan={6} className="text-center py-8 text-stone-400">Loading daily transactions...</td></tr>
                  ) : dailyData?.payments?.length > 0 ? (
                    dailyData.payments.map((p: any) => (
                      <tr key={p._id} className="hover:bg-[#faf6ee] transition">
                        <td className="px-4 py-3 font-mono font-bold text-stone-800">{p.receiptNumber}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-stone-900 block">{p.customerId?.name}</span>
                          <span className="font-mono text-[11px] text-stone-500">{p.customerId?.phone || '-'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-stone-800 block">{p.groupId?.name}</span>
                          <span className="text-[10px] font-bold uppercase text-amber-800">{p.groupId?.collectionDay}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-stone-700">{p.collectorId?.name || 'Staff'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f6f0e4] text-stone-800 border border-[#ded3be]">
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-emerald-700 text-sm">
                          ₹{p.amount?.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className="text-center py-8 text-stone-400">No collections recorded on this date.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Loans Disbursed Today Table (Matching Collections Received Today) */}
          <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex items-center justify-between">
              <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-amber-800" />
                <span>Loans Disbursed Today ({dailyData?.disbursements?.length || 0})</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                  <tr>
                    <th className="px-4 py-3">Account #</th>
                    <th className="px-4 py-3">Borrower / Phone</th>
                    <th className="px-4 py-3">Group Name</th>
                    <th className="px-4 py-3">Principal (₹)</th>
                    <th className="px-4 py-3">Doc Charge (₹)</th>
                    <th className="px-4 py-3">Contract Payable (₹)</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece3d4]">
                  {isDailyLoading ? (
                    <tr><td colSpan={7} className="text-center py-8 text-stone-400">Loading daily disbursements...</td></tr>
                  ) : dailyData?.disbursements?.length > 0 ? (
                    dailyData.disbursements.map((d: any) => (
                      <tr key={d._id} className="hover:bg-[#faf6ee] transition font-medium">
                        <td className="px-4 py-3 font-mono font-bold text-stone-800">{d.loanNumber}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-stone-900 block">{d.customerId?.name}</span>
                          <span className="font-mono text-[11px] text-stone-500">{d.customerId?.phone || '-'}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-amber-950">{d.groupId?.name || '-'}</td>
                        <td className="px-4 py-3 font-black text-stone-900">₹{d.principal?.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 font-bold text-amber-800">₹{d.docCharges?.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 font-bold text-stone-700">₹{d.totalPayable?.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7} className="text-center py-8 text-stone-400 font-medium">No loans disbursed on this date.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. WEEKLY REPORTS TAB */}
      {/* ======================================================== */}
      {activeTab === 'WEEKLY' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
            <div>
              <h3 className="text-sm font-black text-stone-900">Weekly Route Performance & Collections</h3>
              <p className="text-xs text-stone-500">4-Day Field Route collection register analysis (Monday to Thursday)</p>
            </div>

            <button
              onClick={() => handleExport('weekly/export')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#251b14] hover:bg-[#34271e] text-amber-300 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Weekly Report (.xlsx)</span>
            </button>
          </div>

          {/* Weekly KPI Cards (Includes Disbursed Principal and Loan Count) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Weekly Expected Due</p>
              <p className="text-xl font-black text-amber-950 mt-0.5">
                ₹{(weeklyData?.summary?.weeklyExpected || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-stone-500 font-medium">
                {weeklyData?.summary?.totalScheduledGroups || 0} Groups • {weeklyData?.summary?.totalActiveBorrowers || 0} Borrowers
              </span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Weekly Collected</p>
              <p className="text-xl font-black text-emerald-700 mt-0.5">
                ₹{(weeklyData?.summary?.weeklyCollected || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-emerald-800 font-bold">
                {weeklyData?.summary?.overallEfficiency || 0}% Recovery Efficiency
              </span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Weekly Shortfall</p>
              <p className="text-xl font-black text-rose-700 mt-0.5">
                ₹{(weeklyData?.summary?.weeklyShortfall || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-stone-500 font-medium">To be collected</span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Overall Efficiency</p>
              <p className="text-xl font-black text-stone-900 mt-0.5">
                {weeklyData?.summary?.overallEfficiency || 0}%
              </p>
              <div className="w-full bg-[#ece3d4] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full"
                  style={{ width: `${Math.min(100, weeklyData?.summary?.overallEfficiency || 0)}%` }}
                />
              </div>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Loans Disbursed This Week</p>
              <p className="text-xl font-black text-amber-950 mt-0.5">
                ₹{(weeklyData?.summary?.weeklyDisbursedAmount || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-amber-800 font-semibold">
                {weeklyData?.summary?.weeklyDisbursedCount || 0} Loans Issued
              </span>
            </div>
          </div>

          {/* Day-by-Day Breakdown Table (Includes Loans Disbursed) */}
          <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be]">
              <h3 className="text-sm font-black text-stone-900">Route Day Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                  <tr>
                    <th className="px-4 py-3">Route Day</th>
                    <th className="px-4 py-3">Scheduled Groups</th>
                    <th className="px-4 py-3">Active Borrowers</th>
                    <th className="px-4 py-3">Expected Target (₹)</th>
                    <th className="px-4 py-3">Collected (₹)</th>
                    <th className="px-4 py-3">Shortfall (₹)</th>
                    <th className="px-4 py-3">Disbursed (₹)</th>
                    <th className="px-4 py-3 text-right">Recovery Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece3d4]">
                  {isWeeklyLoading ? (
                    <tr><td colSpan={8} className="text-center py-8 text-stone-400">Loading weekly routes...</td></tr>
                  ) : weeklyData?.days?.map((d: any) => (
                    <tr key={d.day} className="hover:bg-[#faf6ee] transition font-medium">
                      <td className="px-4 py-3 font-bold text-stone-900 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-600" />
                        <span>{d.day} ROUTE</span>
                      </td>
                      <td className="px-4 py-3">{d.groupsCount} Groups</td>
                      <td className="px-4 py-3">{d.borrowersCount} Borrowers</td>
                      <td className="px-4 py-3 font-bold text-stone-900">₹{d.expected?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700">₹{d.collected?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-bold text-rose-700">₹{d.shortfall?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-bold text-amber-950">
                        {d.disbursedAmount > 0 ? `₹${d.disbursedAmount.toLocaleString('en-IN')} (${d.disbursedCount})` : '₹0'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {d.efficiency}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. MONTHLY REPORTS TAB */}
      {/* ======================================================== */}
      {activeTab === 'MONTHLY' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-stone-700">Select Month & Year:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleExport('monthly/export', { year: selectedYear, month: selectedMonth })}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#251b14] hover:bg-[#34271e] text-amber-300 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Monthly Report (.xlsx)</span>
            </button>
          </div>

          {/* Monthly KPI Summary Cards (Target, Collections, Shortfall, Recovery %, Disbursed, Count) */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Target to Collect</p>
              <p className="text-xl font-black text-amber-950 mt-0.5">
                ₹{(monthlyData?.summary?.targetToCollect || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-stone-500 font-medium">Scheduled due this month</span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Collections Realized</p>
              <p className="text-xl font-black text-emerald-700 mt-0.5">
                ₹{(monthlyData?.summary?.totalCollected || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-emerald-800 font-semibold">
                {monthlyData?.summary?.recoveryPercentage || 0}% Recovery Efficiency
              </span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Monthly Shortfall</p>
              <p className="text-xl font-black text-rose-700 mt-0.5">
                ₹{Math.max(0, (monthlyData?.summary?.targetToCollect || 0) - (monthlyData?.summary?.totalCollected || 0)).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-rose-600 font-semibold">Uncollected this month</span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Recovery Rate</p>
              <p className="text-xl font-black text-stone-900 mt-0.5">
                {monthlyData?.summary?.recoveryPercentage || 0}%
              </p>
              <div className="w-full bg-[#ece3d4] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full"
                  style={{ width: `${Math.min(100, monthlyData?.summary?.recoveryPercentage || 0)}%` }}
                />
              </div>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Loan Amount Disbursed</p>
              <p className="text-xl font-black text-stone-900 mt-0.5">
                ₹{(monthlyData?.summary?.totalPrincipalDisbursed || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-amber-800 font-semibold">Principal capital issued</span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Loans Count Disbursed</p>
              <p className="text-xl font-black text-stone-900 mt-0.5">
                {monthlyData?.summary?.disbursementCount || 0} Loans
              </p>
              <span className="text-[10px] text-stone-500 font-medium">Borrowers financed</span>
            </div>
          </div>

          {/* Monthly Disbursements List */}
          <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex items-center justify-between">
              <h3 className="text-sm font-black text-stone-900">
                Loans Disbursed in {monthlyData?.monthName} {monthlyData?.year} ({monthlyData?.loansDisbursed?.length || 0})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                  <tr>
                    <th className="px-4 py-3">Loan Account #</th>
                    <th className="px-4 py-3">Borrower Name</th>
                    <th className="px-4 py-3">Disbursed Date</th>
                    <th className="px-4 py-3">Group</th>
                    <th className="px-4 py-3">Principal (₹)</th>
                    <th className="px-4 py-3">Doc Charge (₹)</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece3d4]">
                  {isMonthlyLoading ? (
                    <tr><td colSpan={7} className="text-center py-8 text-stone-400">Loading monthly ledger...</td></tr>
                  ) : monthlyData?.loansDisbursed?.length > 0 ? (
                    monthlyData.loansDisbursed.map((l: any) => (
                      <tr key={l._id} className="hover:bg-[#faf6ee] transition font-medium">
                        <td className="px-4 py-3 font-mono font-bold text-stone-800">{l.loanNumber}</td>
                        <td className="px-4 py-3 font-bold text-stone-900">{l.customerId?.name}</td>
                        <td className="px-4 py-3 text-stone-600">{new Date(l.disbursedDate).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3 text-amber-900 font-semibold">{l.groupId?.name || '-'}</td>
                        <td className="px-4 py-3 font-bold text-stone-900">₹{l.principal?.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 font-bold text-amber-800">₹{l.docCharges?.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7} className="text-center py-8 text-stone-400">No loans disbursed during this month.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. PENDING EMI REPORTS TAB */}
      {/* ======================================================== */}
      {activeTab === 'PENDING_EMI' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-700">Filter by Route Day:</span>
              {['ALL', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'].map((d) => (
                <button
                  key={d}
                  onClick={() => setPendingDayFilter(d)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    pendingDayFilter === d
                      ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
                      : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
                  }`}
                >
                  {d === 'ALL' ? 'All Days' : d}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleExport('pending-emi/export', { collectionDay: pendingDayFilter !== 'ALL' ? pendingDayFilter : undefined })}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#251b14] hover:bg-[#34271e] text-amber-300 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Pending EMI Report (.xlsx)</span>
            </button>
          </div>

          {/* Pending KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Delinquent Borrowers</p>
              <p className="text-xl font-black text-rose-700 mt-0.5">
                {pendingData?.summary?.totalBorrowers || 0} Accounts
              </p>
              <span className="text-[10px] text-stone-500 font-medium">Pending field follow-up</span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Pending EMI Amount</p>
              <p className="text-xl font-black text-rose-800 mt-0.5">
                ₹{(pendingData?.summary?.totalOverdueAmount || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-rose-700 font-bold">Uncollected installments</span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">High Risk Delinquency (&ge;3 Weeks)</p>
              <p className="text-xl font-black text-amber-950 mt-0.5">
                {pendingData?.summary?.highRiskCount || 0} Borrowers
              </p>
              <span className="text-[10px] text-amber-900 font-semibold">Immediate escalation required</span>
            </div>
          </div>

          {/* Pending Table */}
          <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be]">
              <h3 className="text-sm font-black text-stone-900">
                Overdue & Delinquent Borrower Register ({pendingData?.pendingList?.length || 0})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                  <tr>
                    <th className="px-4 py-3">Borrower & Phone</th>
                    <th className="px-4 py-3">Nominee Phone</th>
                    <th className="px-4 py-3">Group & Day</th>
                    <th className="px-4 py-3">Overdue Weeks</th>
                    <th className="px-4 py-3">Pending Amount (₹)</th>
                    <th className="px-4 py-3">Assigned Staff</th>
                    <th className="px-4 py-3">Staff Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece3d4]">
                  {isPendingLoading ? (
                    <tr><td colSpan={7} className="text-center py-8 text-stone-400">Loading overdue follow-ups...</td></tr>
                  ) : pendingData?.pendingList?.length > 0 ? (
                    pendingData.pendingList.map((p: any) => (
                      <tr key={p.id} className="hover:bg-[#faf6ee] transition font-medium">
                        <td className="px-4 py-3">
                          <span className="font-bold text-stone-900 block">{p.customerName}</span>
                          {p.phone && p.phone !== '-' && (
                            <a
                              href={`tel:${p.phone.replace(/[^0-9+]/g, '')}`}
                              className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-800 hover:text-emerald-950 font-bold hover:underline"
                            >
                              <Phone className="w-2.5 h-2.5 text-emerald-600" />
                              <span>{p.phone}</span>
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-stone-600">
                          {p.nomineePhone && p.nomineePhone !== '-' ? (
                            <a
                              href={`tel:${p.nomineePhone.replace(/[^0-9+]/g, '')}`}
                              className="hover:underline text-stone-700"
                            >
                              {p.nomineePhone}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-stone-900 block">{p.groupName}</span>
                          <span className="text-[10px] font-bold uppercase text-amber-800">{p.collectionDay}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-900 border border-rose-300">
                            {p.overdueWeeks}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-black text-rose-800 text-sm">
                          ₹{p.actualPending?.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-stone-700 font-bold">{p.collector || 'Staff'}</td>
                        <td className="px-4 py-3 text-stone-600 text-[11px] italic max-w-xs truncate">
                          {p.remarks || 'Follow-up pending'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={7} className="text-center py-8 text-stone-400">No overdue EMI borrowers found matching filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. PROFIT AND LOSS (P&L) TAB */}
      {/* ======================================================== */}
      {activeTab === 'PROFIT_LOSS' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
            <div>
              <h3 className="text-sm font-black text-stone-900">Profit & Loss Financial Statement</h3>
              <p className="text-xs text-stone-500">Operating revenues, documentation fees, interest margin, and operational expenditure</p>
            </div>

            <button
              onClick={() => handleExport('profit-loss/export')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#251b14] hover:bg-[#34271e] text-amber-300 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export P&L Statement (.xlsx)</span>
            </button>
          </div>

          {/* P&L Top Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Operating Revenue</p>
              <p className="text-xl font-black text-emerald-700 mt-0.5">
                ₹{(plData?.revenue?.totalRevenue || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-stone-500 font-medium">Interest + Documentation charges</span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Operating Expenses</p>
              <p className="text-xl font-black text-rose-700 mt-0.5">
                ₹{(plData?.expenses?.totalExpenses || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-stone-500 font-medium">Travel, fuel, rent & salaries</span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Net Operating Profit</p>
              <p className={`text-xl font-black mt-0.5 ${(plData?.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                ₹{(plData?.netProfit || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-emerald-800 font-bold">Surplus after all overheads</span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Operating Margin</p>
              <p className="text-xl font-black text-amber-950 mt-0.5">
                {plData?.profitMargin || 0}%
              </p>
              <span className="text-[10px] text-stone-500 font-medium">Net profit / Total revenue</span>
            </div>
          </div>

          {/* Two-Column Financial Ledger */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue Column */}
            <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
              <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
                <h4 className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                  Operating Inflows & Revenue
                </h4>
                <span className="font-mono font-black text-emerald-800 text-sm">
                  ₹{(plData?.revenue?.totalRevenue || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-4 space-y-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-[#ece3d4]">
                  <div>
                    <span className="font-bold text-stone-900 block">Documentation & Processing Fees (6%)</span>
                    <span className="text-[10px] text-stone-500">Collected upfront at loan disbursement</span>
                  </div>
                  <span className="font-mono font-black text-stone-900 text-sm">
                    ₹{(plData?.revenue?.docCharges || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-[#ece3d4]">
                  <div>
                    <span className="font-bold text-stone-900 block">Repayment Interest Realized</span>
                    <span className="text-[10px] text-stone-500">Interest collected from weekly loan repayments</span>
                  </div>
                  <span className="font-mono font-black text-emerald-700 text-sm">
                    ₹{(plData?.revenue?.interestEarned || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 font-black text-emerald-950 text-sm">
                  <span>TOTAL OPERATING REVENUE</span>
                  <span>₹{(plData?.revenue?.totalRevenue || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Expenses Column */}
            <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
              <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
                <h4 className="text-sm font-black text-rose-950 uppercase tracking-wide">
                  Operating Outflows & Expenditure
                </h4>
                <span className="font-mono font-black text-rose-800 text-sm">
                  ₹{(plData?.expenses?.totalExpenses || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-4 space-y-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-[#ece3d4]">
                  <div>
                    <span className="font-bold text-stone-900 block">Route Travel & Fuel Reimbursements</span>
                    <span className="text-[10px] text-stone-500">Calculated staff travel claims</span>
                  </div>
                  <span className="font-mono font-black text-rose-700 text-sm">
                    ₹{(plData?.expenses?.fuel || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-[#ece3d4]">
                  <div>
                    <span className="font-bold text-stone-900 block">Branch Rent & Electricity Utilities</span>
                    <span className="text-[10px] text-stone-500">Operational facilities cost</span>
                  </div>
                  <span className="font-mono font-black text-stone-900 text-sm">
                    ₹{(plData?.expenses?.rent || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-[#ece3d4]">
                  <div>
                    <span className="font-bold text-stone-900 block">Staff Salaries & Field Incentives</span>
                    <span className="text-[10px] text-stone-500">Collection officer remuneration</span>
                  </div>
                  <span className="font-mono font-black text-stone-900 text-sm">
                    ₹{(plData?.expenses?.salaries || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-[#ece3d4]">
                  <div>
                    <span className="font-bold text-stone-900 block">Printing, Stationery & General Admin</span>
                    <span className="text-[10px] text-stone-500">Passbooks, paper & office running costs</span>
                  </div>
                  <span className="font-mono font-black text-stone-900 text-sm">
                    ₹{(plData?.expenses?.general || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 font-black text-rose-950 text-sm">
                  <span>TOTAL OPERATING EXPENSES</span>
                  <span>₹{(plData?.expenses?.totalExpenses || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. BRANCH WISE REPORTS TAB */}
      {/* ======================================================== */}
      {activeTab === 'BRANCH_WISE' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
            <div>
              <h3 className="text-sm font-black text-stone-900">Branch-Wise Comparative Performance</h3>
              <p className="text-xs text-stone-500">Cross-branch operational portfolio analysis, recoveries, and financial contributions</p>
            </div>

            <button
              onClick={() => handleExport('branch-wise/export')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#251b14] hover:bg-[#34271e] text-amber-300 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Branch-Wise Report (.xlsx)</span>
            </button>
          </div>

          {/* Consolidated KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Active Branches</p>
              <p className="text-xl font-black text-stone-900 mt-0.5">
                {branchWiseData?.consolidated?.totalBranches || 0} Branches
              </p>
              <span className="text-[10px] text-amber-800 font-semibold">
                {branchWiseData?.consolidated?.totalGroups || 0} Groups • {branchWiseData?.consolidated?.totalBorrowers || 0} Borrowers
              </span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Portfolio Disbursed</p>
              <p className="text-xl font-black text-amber-950 mt-0.5">
                ₹{(branchWiseData?.consolidated?.totalDisbursed || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-stone-500 font-medium">Consolidated across all branches</span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Recoveries Collected</p>
              <p className="text-xl font-black text-emerald-700 mt-0.5">
                ₹{(branchWiseData?.consolidated?.totalCollected || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-emerald-800 font-semibold">Recovered repayments</span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Outstanding Balance</p>
              <p className="text-xl font-black text-stone-900 mt-0.5">
                ₹{(branchWiseData?.consolidated?.totalOutstanding || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-rose-700 font-bold">
                Overdue: ₹{(branchWiseData?.consolidated?.totalOverdue || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Branch-Wise Comparison Table */}
          <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be]">
              <h3 className="text-sm font-black text-stone-900">Branch Performance Comparison Table</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                  <tr>
                    <th className="px-4 py-3">Branch Name & Code</th>
                    <th className="px-4 py-3">Cash In Hand</th>
                    <th className="px-4 py-3">Active Borrowers</th>
                    <th className="px-4 py-3">Total Disbursed (₹)</th>
                    <th className="px-4 py-3">Total Collected (₹)</th>
                    <th className="px-4 py-3">Outstanding Balance (₹)</th>
                    <th className="px-4 py-3">Overdue Rate</th>
                    <th className="px-4 py-3 text-right">Operating Expenses (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece3d4]">
                  {isBranchWiseLoading ? (
                    <tr><td colSpan={8} className="text-center py-8 text-stone-400">Loading branch data...</td></tr>
                  ) : branchWiseData?.branches?.map((b: any) => (
                    <tr key={b.branchId} className="hover:bg-[#faf6ee] transition font-medium">
                      <td className="px-4 py-3">
                        <span className="font-bold text-stone-900 block">{b.name}</span>
                        <span className="font-mono text-[10px] text-stone-500 font-semibold">{b.code} &bull; {b.address}</span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-stone-800">₹{b.cashBalance?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-bold text-stone-900">{b.borrowersCount} Borrowers</td>
                      <td className="px-4 py-3 font-bold text-stone-900">₹{b.disbursedAmount?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700">₹{b.collectedAmount?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-bold text-stone-900">₹{b.outstandingAmount?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.overduePercent <= 5 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {b.overduePercent}% Overdue
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-rose-700">
                        ₹{b.expensesAmount?.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Grand Total Footer */}
                {branchWiseData?.consolidated && (
                  <tfoot className="bg-[#f6f0e4] font-black border-t-2 border-[#ded3be] text-stone-950">
                    <tr>
                      <td className="px-4 py-3 uppercase">ALL BRANCHES CONSOLIDATED</td>
                      <td className="px-4 py-3 font-mono">₹{branchWiseData.consolidated.totalCashBalance?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">{branchWiseData.consolidated.totalBorrowers} Borrowers</td>
                      <td className="px-4 py-3">₹{branchWiseData.consolidated.totalDisbursed?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-emerald-800">₹{branchWiseData.consolidated.totalCollected?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">₹{branchWiseData.consolidated.totalOutstanding?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-rose-800">Overdue: ₹{branchWiseData.consolidated.totalOverdue?.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-rose-800">₹{branchWiseData.consolidated.totalExpenses?.toLocaleString('en-IN')}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
