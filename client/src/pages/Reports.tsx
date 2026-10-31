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
  ArrowRight,
  Search,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { api } from '../services/api';
import { useBranch } from '../context/BranchContext';

type ReportTab = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PENDING_EMI' | 'PROFIT_LOSS';

export const Reports: React.FC = () => {
  const { selectedBranchId, selectedBranch } = useBranch();
  const [activeTab, setActiveTab] = useState<ReportTab>('DAILY');

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isDateRangeMode, setIsDateRangeMode] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // 1st of month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [pendingDayFilter, setPendingDayFilter] = useState<string>('ALL');
  const [pendingIsRangeMode, setPendingIsRangeMode] = useState<boolean>(false);
  const [pendingStartDate, setPendingStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [pendingEndDate, setPendingEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Profit & Loss Date Range State
  const [plIsRangeMode, setPlIsRangeMode] = useState<boolean>(false);
  const [plStartDate, setPlStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [plEndDate, setPlEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Profit & Loss Interactive Views & Filters
  const [plViewMode, setPlViewMode] = useState<'REGISTER' | 'EXPENSES' | 'STATEMENT'>('REGISTER');
  const [plSearch, setPlSearch] = useState<string>('');
  const [plDayFilter, setPlDayFilter] = useState<string>('ALL');
  const [plExpenseSearch, setPlExpenseSearch] = useState<string>('');
  const [plExpenseCategory, setPlExpenseCategory] = useState<string>('ALL');
  const [plWeekRange, setPlWeekRange] = useState<string>('1-15');

  // Profit & Loss Sorting State
  const [pnlSortCol, setPnlSortCol] = useState<'sNo' | 'groupCode' | 'customerName' | 'groupName' | 'loanDate' | 'collectionDay'>('sNo');
  const [pnlSortDir, setPnlSortDir] = useState<'asc' | 'desc'>('asc');

  const handlePnlSort = (col: 'sNo' | 'groupCode' | 'customerName' | 'groupName' | 'loanDate' | 'collectionDay') => {
    if (pnlSortCol === col) {
      setPnlSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPnlSortCol(col);
      setPnlSortDir('asc');
    }
  };

  const [exportLoading, setExportLoading] = useState<string | null>(null);

  // Authenticated Excel Download Helper (Fixes 401 token required error and supports Date Range)
  const handleExport = async (endpoint: string, params: Record<string, any> = {}, defaultName = 'report') => {
    try {
      setExportLoading(endpoint);
      const token = localStorage.getItem('athiveera_token');
      const searchParams = new URLSearchParams();
      if (token) searchParams.append('token', token);
      if (selectedBranchId) searchParams.append('branchId', selectedBranchId);

      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          searchParams.append(k, String(v));
        }
      }

      const res = await fetch(`/api/reports/${endpoint}?${searchParams.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.message || `Download failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition');
      let filename = `${defaultName}_${new Date().toISOString().split('T')[0]}.xlsx`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert(`Excel Export Failed: ${err.message || 'Please check your connection and try again.'}`);
    } finally {
      setExportLoading(null);
    }
  };

  // Queries for each report type
  const { data: dailyData, isLoading: isDailyLoading } = useQuery({
    queryKey: ['reportDaily', selectedBranchId, isDateRangeMode ? `${startDate}_${endDate}` : selectedDate],
    queryFn: () => isDateRangeMode
      ? api.getDailyReport({ branchId: selectedBranchId, startDate, endDate })
      : api.getDailyReport({ branchId: selectedBranchId, date: selectedDate }),
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
    queryKey: ['reportPendingEmi', selectedBranchId, pendingDayFilter, pendingIsRangeMode ? `${pendingStartDate}_${pendingEndDate}` : 'all'],
    queryFn: () => api.getPendingEmiReport({
      branchId: selectedBranchId,
      collectionDay: pendingDayFilter !== 'ALL' ? pendingDayFilter : undefined,
      startDate: pendingIsRangeMode ? pendingStartDate : undefined,
      endDate: pendingIsRangeMode ? pendingEndDate : undefined
    }),
    enabled: activeTab === 'PENDING_EMI'
  });

  const { data: plData, isLoading: isPlLoading } = useQuery({
    queryKey: ['reportProfitLoss', selectedBranchId, plIsRangeMode ? `${plStartDate}_${plEndDate}` : 'all_time'],
    queryFn: () => api.getProfitLossReport({
      branchId: selectedBranchId,
      startDate: plIsRangeMode ? plStartDate : undefined,
      endDate: plIsRangeMode ? plEndDate : undefined
    }),
    enabled: activeTab === 'PROFIT_LOSS'
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
          <span>Daily & Date Range Reports</span>
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
      </div>

      {/* ======================================================== */}
      {/* 1. DAILY & DATE RANGE REPORTS TAB */}
      {/* ======================================================== */}
      {activeTab === 'DAILY' && (
        <div className="space-y-6">
          {/* Controls Bar: Single Date vs Date Range (Date-to-Date) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Range Toggle */}
              <div className="flex items-center bg-[#ece3d4] p-1 rounded-xl border border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setIsDateRangeMode(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    !isDateRangeMode
                      ? 'bg-[#251b14] text-amber-300 shadow-xs'
                      : 'text-stone-700 hover:text-stone-900'
                  }`}
                >
                  Single Date
                </button>
                <button
                  type="button"
                  onClick={() => setIsDateRangeMode(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    isDateRangeMode
                      ? 'bg-[#251b14] text-amber-300 shadow-xs'
                      : 'text-stone-700 hover:text-stone-900'
                  }`}
                >
                  Date-to-Date Range
                </button>
              </div>

              {!isDateRangeMode ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-700">Select Date:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-stone-700">From Date:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
                  />
                  <span className="text-xs font-bold text-stone-700">To Date:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
                  />
                </div>
              )}
            </div>

            <button
              onClick={() => isDateRangeMode
                ? handleExport('daily/export', { startDate, endDate }, `report_${startDate}_to_${endDate}`)
                : handleExport('daily/export', { date: selectedDate }, `daily_report_${selectedDate}`)
              }
              disabled={!!exportLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#251b14] hover:bg-[#34271e] text-amber-300 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {exportLoading === 'daily/export'
                  ? 'Exporting...'
                  : isDateRangeMode
                    ? 'Export Date Range Report (.xlsx)'
                    : 'Export Daily Report (.xlsx)'}
              </span>
            </button>
          </div>

          {/* 10 Canonical Summary KPI Cards */}
          <div className="space-y-3">
            {/* Row 1: Route Dues, Collections & Total Cash Inflows */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Expected Due</p>
                <p className="text-xl font-black text-amber-950 mt-1">
                  ₹{(dailyData?.summary?.expectedDue || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Route scheduled target
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Collected Amount</p>
                <p className="text-xl font-black text-emerald-700 mt-1">
                  ₹{(dailyData?.summary?.collectedAmount || dailyData?.summary?.totalCollected || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-emerald-800 font-semibold block mt-0.5">
                  Repayments on route • {dailyData?.payments?.length || 0} Receipts
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Shortfall</p>
                <p className="text-xl font-black text-rose-600 mt-1">
                  ₹{(dailyData?.summary?.shortfall || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Expected due − route collected
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Document Charges</p>
                <p className="text-xl font-black text-amber-900 mt-1">
                  ₹{(dailyData?.summary?.docCharges || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-amber-800 font-medium block mt-0.5">
                  Collected upfront on loans given
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-emerald-300 bg-emerald-50/40 shadow-xs">
                <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">Total Collected</p>
                <p className="text-xl font-black text-emerald-800 mt-1">
                  ₹{(dailyData?.summary?.totalCollected || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                  Repayments + Upfront Doc Charges
                </span>
              </div>
            </div>

            {/* Row 2: Loans Disbursed, Interest Given & Collections Component Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Loan Given</p>
                <p className="text-xl font-black text-stone-900 mt-1">
                  ₹{(dailyData?.summary?.totalLoanGiven ?? dailyData?.summary?.totalDisbursed ?? 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] font-black text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-300/60 inline-block mt-0.5">
                  {dailyData?.summary?.disbursementCount || 0} Loans Given
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Interest Given</p>
                <p className="text-xl font-black text-amber-900 mt-1">
                  ₹{(dailyData?.summary?.interestGiven || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Contractual interest on loans given
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Collected Principal</p>
                <p className="text-xl font-black text-stone-900 mt-1">
                  ₹{(dailyData?.summary?.collectedPrincipal || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Principal portion realized
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Collected Interest</p>
                <p className="text-xl font-black text-amber-800 mt-1">
                  ₹{(dailyData?.summary?.collectedInterest || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Interest portion realized
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Collected Savings</p>
                <p className="text-xl font-black text-emerald-700 mt-1">
                  ₹{(dailyData?.summary?.collectedSavings || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Savings portion realized
                </span>
              </div>
            </div>
          </div>

          {/* Collections Received Table */}
          <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex items-center justify-between">
              <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-700" />
                <span>Collections Received ({dailyData?.payments?.length || 0})</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                  <tr>
                    <th className="px-4 py-3">Receipt #</th>
                    {isDateRangeMode && <th className="px-4 py-3">Date</th>}
                    <th className="px-4 py-3">Borrower / Phone</th>
                    <th className="px-4 py-3">Group & Day</th>
                    <th className="px-4 py-3">Collector</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece3d4]">
                  {isDailyLoading ? (
                    <tr><td colSpan={isDateRangeMode ? 7 : 6} className="text-center py-8 text-stone-400">Loading daily transactions...</td></tr>
                  ) : dailyData?.payments?.length > 0 ? (
                    dailyData.payments.map((p: any) => (
                      <tr key={p._id} className="hover:bg-[#faf6ee] transition">
                        <td className="px-4 py-3 font-mono font-bold text-stone-800">{p.receiptNumber}</td>
                        {isDateRangeMode && (
                          <td className="px-4 py-3 font-mono text-[11px] text-stone-600">
                            {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : '-'}
                          </td>
                        )}
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
                    <tr><td colSpan={isDateRangeMode ? 7 : 6} className="text-center py-8 text-stone-400">No collections recorded in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Loans Disbursed Table */}
          <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex items-center justify-between">
              <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-amber-800" />
                <span>Loans Disbursed ({dailyData?.disbursements?.length || 0})</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                  <tr>
                    <th className="px-4 py-3">Account #</th>
                    {isDateRangeMode && <th className="px-4 py-3">Date</th>}
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
                    <tr><td colSpan={isDateRangeMode ? 8 : 7} className="text-center py-8 text-stone-400">Loading disbursements...</td></tr>
                  ) : dailyData?.disbursements?.length > 0 ? (
                    dailyData.disbursements.map((d: any) => (
                      <tr key={d._id} className="hover:bg-[#faf6ee] transition font-medium">
                        <td className="px-4 py-3 font-mono font-bold text-stone-800">{d.loanNumber}</td>
                        {isDateRangeMode && (
                          <td className="px-4 py-3 font-mono text-[11px] text-stone-600">
                            {d.disbursedDate ? new Date(d.disbursedDate).toLocaleDateString('en-IN') : '-'}
                          </td>
                        )}
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
                    <tr><td colSpan={isDateRangeMode ? 8 : 7} className="text-center py-8 text-stone-400 font-medium">No loans disbursed in this period.</td></tr>
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
              <p className="text-xs text-stone-500">Field Route collection register analysis (Monday to Sunday)</p>
            </div>

            <button
              onClick={() => handleExport('weekly/export')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#251b14] hover:bg-[#34271e] text-amber-300 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Weekly Report (.xlsx)</span>
            </button>
          </div>

          {/* Weekly 10 Canonical Summary KPI Cards */}
          <div className="space-y-3">
            {/* Row 1: Weekly Route Targets & Total Inflows */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Expected Due</p>
                <p className="text-xl font-black text-amber-950 mt-1">
                  ₹{(weeklyData?.summary?.expectedDue || weeklyData?.summary?.weeklyExpected || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  {weeklyData?.summary?.totalScheduledGroups || 0} Groups • {weeklyData?.summary?.totalActiveBorrowers || 0} Borrowers
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Collected Amount</p>
                <p className="text-xl font-black text-emerald-700 mt-1">
                  ₹{(weeklyData?.summary?.collectedAmount || weeklyData?.summary?.weeklyCollected || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-emerald-800 font-semibold block mt-0.5">
                  {weeklyData?.summary?.overallEfficiency || 0}% Route Efficiency
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Shortfall</p>
                <p className="text-xl font-black text-rose-600 mt-1">
                  ₹{(weeklyData?.summary?.shortfall || weeklyData?.summary?.weeklyShortfall || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Weekly route deficit
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Document Charges</p>
                <p className="text-xl font-black text-amber-900 mt-1">
                  ₹{(weeklyData?.summary?.docCharges || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-amber-800 font-medium block mt-0.5">
                  Collected upfront this week
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-emerald-300 bg-emerald-50/40 shadow-xs">
                <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">Total Collected</p>
                <p className="text-xl font-black text-emerald-800 mt-1">
                  ₹{(weeklyData?.summary?.totalCollected ?? (((weeklyData?.summary?.collectedAmount || weeklyData?.summary?.weeklyCollected || 0)) + (weeklyData?.summary?.docCharges || 0))).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                  Repayments + Upfront Doc Charges
                </span>
              </div>
            </div>

            {/* Row 2: Weekly Disbursed Principal, Interest Given & Collections Component Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Loan Given</p>
                <p className="text-xl font-black text-stone-900 mt-1">
                  ₹{(weeklyData?.summary?.totalLoanGiven || weeklyData?.summary?.weeklyDisbursedAmount || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] font-black text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-300/60 inline-block mt-0.5">
                  {weeklyData?.summary?.disbursementCount || weeklyData?.summary?.weeklyDisbursedCount || 0} Loans Given
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Interest Given</p>
                <p className="text-xl font-black text-amber-900 mt-1">
                  ₹{(weeklyData?.summary?.interestGiven || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Contractual interest on loans given
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Collected Principal</p>
                <p className="text-xl font-black text-stone-900 mt-1">
                  ₹{(weeklyData?.summary?.collectedPrincipal || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Principal portion realized
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Collected Interest</p>
                <p className="text-xl font-black text-amber-800 mt-1">
                  ₹{(weeklyData?.summary?.collectedInterest || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Interest portion realized
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Collected Savings</p>
                <p className="text-xl font-black text-emerald-700 mt-1">
                  ₹{(weeklyData?.summary?.collectedSavings || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Savings portion realized
                </span>
              </div>
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

          {/* Monthly 10 Canonical Summary KPI Cards */}
          <div className="space-y-3">
            {/* Row 1: Monthly Route Targets & Total Inflows */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Expected Due</p>
                <p className="text-xl font-black text-amber-950 mt-1">
                  ₹{(monthlyData?.summary?.expectedDue || monthlyData?.summary?.targetToCollect || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Scheduled due for {monthlyData?.monthName || 'month'}
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Collected Amount</p>
                <p className="text-xl font-black text-emerald-700 mt-1">
                  ₹{(monthlyData?.summary?.collectedAmount || monthlyData?.summary?.totalCollected || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-emerald-800 font-semibold block mt-0.5">
                  {monthlyData?.summary?.recoveryPercentage || 0}% Recovery Efficiency
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Shortfall</p>
                <p className="text-xl font-black text-rose-600 mt-1">
                  ₹{(monthlyData?.summary?.shortfall ?? Math.max(0, (monthlyData?.summary?.targetToCollect || 0) - (monthlyData?.summary?.totalCollected || 0))).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Uncollected this month
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Document Charges</p>
                <p className="text-xl font-black text-amber-900 mt-1">
                  ₹{(monthlyData?.summary?.docCharges || monthlyData?.summary?.totalDocCharges || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-amber-800 font-medium block mt-0.5">
                  Collected upfront this month
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-emerald-300 bg-emerald-50/40 shadow-xs">
                <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">Total Collected</p>
                <p className="text-xl font-black text-emerald-800 mt-1">
                  ₹{(monthlyData?.summary?.totalCollected ?? (((monthlyData?.summary?.collectedAmount || 0)) + (monthlyData?.summary?.docCharges || 0))).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                  Repayments + Upfront Doc Charges
                </span>
              </div>
            </div>

            {/* Row 2: Monthly Disbursed Principal, Interest Given & Collections Component Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Loan Given</p>
                <p className="text-xl font-black text-stone-900 mt-1">
                  ₹{(monthlyData?.summary?.totalLoanGiven || monthlyData?.summary?.totalPrincipalDisbursed || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] font-black text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded border border-amber-300/60 inline-block mt-0.5">
                  {monthlyData?.summary?.disbursementCount || 0} Loans Given
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Interest Given</p>
                <p className="text-xl font-black text-amber-900 mt-1">
                  ₹{(monthlyData?.summary?.interestGiven || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Contractual interest on loans given
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Collected Principal</p>
                <p className="text-xl font-black text-stone-900 mt-1">
                  ₹{(monthlyData?.summary?.collectedPrincipal || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Principal portion realized
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Collected Interest</p>
                <p className="text-xl font-black text-amber-800 mt-1">
                  ₹{(monthlyData?.summary?.collectedInterest || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Interest portion realized
                </span>
              </div>

              <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Collected Savings</p>
                <p className="text-xl font-black text-emerald-700 mt-1">
                  ₹{(monthlyData?.summary?.collectedSavings || 0).toLocaleString('en-IN')}
                </p>
                <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                  Savings portion realized
                </span>
              </div>
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
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-stone-700">Route Day:</span>
                {['ALL', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((d) => (
                  <button
                    key={d}
                    onClick={() => setPendingDayFilter(d)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                      pendingDayFilter === d
                        ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
                        : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
                    }`}
                  >
                    {d === 'ALL' ? 'All Days' : d}
                  </button>
                ))}
              </div>

              {/* Range Toggle */}
              <div className="flex items-center bg-[#ece3d4] p-1 rounded-xl border border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setPendingIsRangeMode(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    !pendingIsRangeMode
                      ? 'bg-[#251b14] text-amber-300 shadow-xs'
                      : 'text-stone-700 hover:text-stone-900'
                  }`}
                >
                  All Overdue
                </button>
                <button
                  type="button"
                  onClick={() => setPendingIsRangeMode(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    pendingIsRangeMode
                      ? 'bg-[#251b14] text-amber-300 shadow-xs'
                      : 'text-stone-700 hover:text-stone-900'
                  }`}
                >
                  Date-to-Date
                </button>
              </div>

              {pendingIsRangeMode && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-stone-700">From:</span>
                  <input
                    type="date"
                    value={pendingStartDate}
                    onChange={(e) => setPendingStartDate(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
                  />
                  <span className="text-xs font-bold text-stone-700">To:</span>
                  <input
                    type="date"
                    value={pendingEndDate}
                    onChange={(e) => setPendingEndDate(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
                  />
                </div>
              )}
            </div>

            <button
              onClick={() => handleExport('pending-emi/export', {
                collectionDay: pendingDayFilter !== 'ALL' ? pendingDayFilter : undefined,
                startDate: pendingIsRangeMode ? pendingStartDate : undefined,
                endDate: pendingIsRangeMode ? pendingEndDate : undefined
              })}
              disabled={exportLoading === 'pending-emi/export'}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#251b14] hover:bg-[#34271e] text-amber-300 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>{exportLoading === 'pending-emi/export' ? 'Exporting...' : 'Export Pending EMI Report (.xlsx)'}</span>
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
      {activeTab === 'PROFIT_LOSS' && (() => {
        // Calculate filtered PnL rows
        const filteredPnlRows = (plData?.pnlRows || []).filter((row: any) => {
          if (plDayFilter !== 'ALL' && row.collectionDay !== plDayFilter) return false;
          if (plSearch.trim()) {
            const q = plSearch.toLowerCase();
            return (
              row.customerName?.toLowerCase().includes(q) ||
              row.groupName?.toLowerCase().includes(q) ||
              row.loanDate?.toLowerCase().includes(q)
            );
          }
          return true;
        });

        // Sort filtered PnL rows
        const sortedPnlRows = [...filteredPnlRows].sort((a: any, b: any) => {
          const valA = a[pnlSortCol];
          const valB = b[pnlSortCol];

          if (pnlSortCol === 'sNo' || pnlSortCol === 'groupCode') {
            const numA = Number(String(valA || '').replace(/\D/g, '')) || 0;
            const numB = Number(String(valB || '').replace(/\D/g, '')) || 0;
            return pnlSortDir === 'asc' ? numA - numB : numB - numA;
          }

          if (pnlSortCol === 'loanDate') {
            const parseDate = (dStr: string) => {
              if (!dStr || dStr === '-') return 0;
              const parts = dStr.split('/');
              if (parts.length === 3) {
                return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
              }
              return 0;
            };
            const tsA = parseDate(valA);
            const tsB = parseDate(valB);
            return pnlSortDir === 'asc' ? tsA - tsB : tsB - tsA;
          }

          const strA = String(valA || '').toLowerCase();
          const strB = String(valB || '').toLowerCase();
          const comp = strA.localeCompare(strB);
          return pnlSortDir === 'asc' ? comp : -comp;
        });

        // Calculate filtered Expenses rows
        const filteredExpenseRows = (plData?.expenseRows || []).filter((e: any) => {
          if (plExpenseCategory !== 'ALL' && e.particulars !== plExpenseCategory) return false;
          if (plExpenseSearch.trim()) {
            const q = plExpenseSearch.toLowerCase();
            return (
              e.particulars?.toLowerCase().includes(q) ||
              e.remarks?.toLowerCase().includes(q) ||
              e.date?.toLowerCase().includes(q) ||
              e.staffName?.toLowerCase().includes(q)
            );
          }
          return true;
        });

        const distinctCategories = Array.from(
          new Set<string>((plData?.expenseRows || []).map((e: any) => e.particulars).filter(Boolean))
        ).sort();

        // Calculate displayed weeks
        const maxAvailableWeeks = plData?.maxWeeks || 50;
        let startW = 1;
        let endW = 15;
        if (plWeekRange === '16-30') {
          startW = 16;
          endW = 30;
        } else if (plWeekRange === '31-50') {
          startW = 31;
          endW = Math.max(50, maxAvailableWeeks);
        } else if (plWeekRange === 'ALL') {
          startW = 1;
          endW = maxAvailableWeeks;
        } else {
          startW = 1;
          endW = 15;
        }

        const displayedWeeks: number[] = [];
        for (let w = startW; w <= endW; w++) {
          displayedWeeks.push(w);
        }

        // Dynamic sums of filtered PnL rows
        const pnlFilteredTotals = filteredPnlRows.reduce((acc: any, r: any) => {
          acc.principalAmt += (r.principalAmt || 0);
          acc.totalCollAmt += (r.totalCollAmt || 0);
          acc.totalPrincipal += (r.totalPrincipal || 0);
          acc.totalInterest += (r.totalInterest || 0);
          acc.totalSavings += (r.totalSavings || 0);
          acc.totalCollected += (r.totalCollected || 0);
          acc.docCharge += (r.docCharge || 0);
          return acc;
        }, {
          principalAmt: 0,
          totalCollAmt: 0,
          totalPrincipal: 0,
          totalInterest: 0,
          totalSavings: 0,
          totalCollected: 0,
          docCharge: 0
        });

        // Dynamic week sums for displayed weeks
        const displayedWeekSums: Record<number, { p: number; i: number; s: number; tot: number }> = {};
        displayedWeeks.forEach(w => {
          displayedWeekSums[w] = { p: 0, i: 0, s: 0, tot: 0 };
        });
        filteredPnlRows.forEach((r: any) => {
          displayedWeeks.forEach(w => {
            const wk = r.weeks?.[w];
            if (wk) {
              displayedWeekSums[w].p += (wk.p || 0);
              displayedWeekSums[w].i += (wk.i || 0);
              displayedWeekSums[w].s += (wk.s || 0);
              displayedWeekSums[w].tot += (wk.tot || 0);
            }
          });
        });

        const totalFilteredExpenses = filteredExpenseRows.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

        return (
          <div className="space-y-6">
            {/* Controls Bar: All-Time vs Range & Export Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <h3 className="text-sm font-black text-stone-900">Profit & Loss Financial Statement & Ledgers</h3>
                  <p className="text-xs text-stone-500">Operating revenues, weekly collections register, documentation fees, and operational expenditure</p>
                </div>

                {/* Range Toggle */}
                <div className="flex items-center bg-[#ece3d4] p-1 rounded-xl border border-[#ded3be]">
                  <button
                    type="button"
                    onClick={() => setPlIsRangeMode(false)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      !plIsRangeMode
                        ? 'bg-[#251b14] text-amber-300 shadow-xs'
                        : 'text-stone-700 hover:text-stone-900'
                    }`}
                  >
                    All-Time
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlIsRangeMode(true)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      plIsRangeMode
                        ? 'bg-[#251b14] text-amber-300 shadow-xs'
                        : 'text-stone-700 hover:text-stone-900'
                    }`}
                  >
                    Date-to-Date Range
                  </button>
                </div>

                {plIsRangeMode && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-stone-700">From Date:</span>
                    <input
                      type="date"
                      value={plStartDate}
                      onChange={(e) => setPlStartDate(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
                    />
                    <span className="text-xs font-bold text-stone-700">To Date:</span>
                    <input
                      type="date"
                      value={plEndDate}
                      onChange={(e) => setPlEndDate(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons: Export P&L Full Workbook + Export Expenses */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleExport('profit-loss/export', plIsRangeMode ? { startDate: plStartDate, endDate: plEndDate } : {}, 'profit_loss_workbook')}
                  disabled={exportLoading === 'profit-loss/export'}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#251b14] hover:bg-[#34271e] text-amber-300 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>{exportLoading === 'profit-loss/export' ? 'Exporting...' : 'Export P&L Workbook (.xlsx)'}</span>
                </button>

                <button
                  onClick={() => handleExport('expenses/export', plIsRangeMode ? { startDate: plStartDate, endDate: plEndDate } : {}, 'expenses_register')}
                  disabled={exportLoading === 'expenses/export'}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-[#faf6ee] text-stone-800 border border-[#ded3be] rounded-xl text-xs font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-amber-600" />
                  <span>{exportLoading === 'expenses/export' ? 'Exporting...' : 'Export Expenses (.xlsx)'}</span>
                </button>
              </div>
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

            {/* View Mode Switcher */}
            <div className="flex items-center gap-2 p-1.5 bg-[#f6f0e4] border border-[#ded3be] rounded-2xl w-fit flex-wrap">
              <button
                type="button"
                onClick={() => setPlViewMode('REGISTER')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  plViewMode === 'REGISTER'
                    ? 'bg-[#251b14] text-amber-300 shadow-xs'
                    : 'text-stone-700 hover:text-stone-900'
                }`}
              >
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span>Loan P&L Register ({filteredPnlRows.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setPlViewMode('EXPENSES')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  plViewMode === 'EXPENSES'
                    ? 'bg-[#251b14] text-amber-300 shadow-xs'
                    : 'text-stone-700 hover:text-stone-900'
                }`}
              >
                <Receipt className="w-4 h-4 text-amber-400" />
                <span>Operational Expenses ({filteredExpenseRows.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setPlViewMode('STATEMENT')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  plViewMode === 'STATEMENT'
                    ? 'bg-[#251b14] text-amber-300 shadow-xs'
                    : 'text-stone-700 hover:text-stone-900'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <span>Executive P&L Statement</span>
              </button>
            </div>

            {/* VIEW 1: LOAN P&L REGISTER (Template Matching) */}
            {plViewMode === 'REGISTER' && (
              <div className="space-y-4">
                <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
                  {/* Search & Week Filter Header */}
                  <div className="p-3 bg-[#f6f0e4] border-b border-[#ded3be] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                      <Search className="w-4 h-4 text-stone-500" />
                      <input
                        type="text"
                        placeholder="Search by borrower name, group, date..."
                        value={plSearch}
                        onChange={(e) => setPlSearch(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:border-amber-600 shadow-2xs"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Day Filter */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-stone-600">Day:</span>
                        <select
                          value={plDayFilter}
                          onChange={(e) => setPlDayFilter(e.target.value)}
                          className="px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
                        >
                          <option value="ALL">All Days</option>
                          <option value="MONDAY">MONDAY</option>
                          <option value="TUESDAY">TUESDAY</option>
                          <option value="WEDNESDAY">WEDNESDAY</option>
                          <option value="THURSDAY">THURSDAY</option>
                          <option value="FRIDAY">FRIDAY</option>
                          <option value="SATURDAY">SATURDAY</option>
                          <option value="SUNDAY">SUNDAY</option>
                        </select>
                      </div>

                      {/* Week Range Filter */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-stone-600">Weeks:</span>
                        <select
                          value={plWeekRange}
                          onChange={(e) => setPlWeekRange(e.target.value)}
                          className="px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
                        >
                          <option value="1-15">Weeks 1 – 15</option>
                          <option value="16-30">Weeks 16 – 30</option>
                          <option value="31-50">Weeks 31 – 50</option>
                          <option value="ALL">All Weeks (1 – {maxAvailableWeeks})</option>
                        </select>
                      </div>

                      <span className="text-xs font-bold text-stone-500 bg-[#ece3d4] px-2.5 py-1.5 rounded-xl border border-[#ded3be]">
                        {filteredPnlRows.length} Loans
                      </span>
                    </div>
                  </div>

                  {/* Full Ledger Table with 2-Row Header */}
                  <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider sticky top-0 z-20 shadow-xs">
                        {/* Row 1 Headers */}
                        <tr className="border-b border-[#ece3d4]">
                          <th className="px-3 py-2 border-r border-[#ece3d4] sticky left-0 bg-[#fbf7f0] z-30" rowSpan={2}>
                            <button
                              type="button"
                              onClick={() => handlePnlSort('sNo')}
                              className="flex items-center gap-1 hover:text-amber-700 cursor-pointer w-full text-left font-bold"
                              title="Sort by Serial Number (Front/Reverse)"
                            >
                              <span>S.No</span>
                              {pnlSortCol === 'sNo' ? (
                                pnlSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                              )}
                            </button>
                          </th>
                          <th className="px-2 py-2 border-r border-[#ece3d4] min-w-[75px] text-center" rowSpan={2}>
                            <button
                              type="button"
                              onClick={() => handlePnlSort('groupCode')}
                              className="flex items-center justify-center gap-1 hover:text-amber-700 cursor-pointer w-full text-center font-bold"
                              title="Sort by Group Number (Front/Reverse)"
                            >
                              <span>Group #</span>
                              {pnlSortCol === 'groupCode' ? (
                                pnlSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                              )}
                            </button>
                          </th>
                          <th className="px-3 py-2 border-r border-[#ece3d4] min-w-[150px]" rowSpan={2}>
                            <button
                              type="button"
                              onClick={() => handlePnlSort('customerName')}
                              className="flex items-center gap-1 hover:text-amber-700 cursor-pointer w-full text-left font-bold"
                              title="Sort by Borrower Name (Front/Reverse)"
                            >
                              <span>Name</span>
                              {pnlSortCol === 'customerName' ? (
                                pnlSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                              )}
                            </button>
                          </th>
                          <th className="px-3 py-2 border-r border-[#ece3d4] min-w-[140px]" rowSpan={2}>
                            <button
                              type="button"
                              onClick={() => handlePnlSort('groupName')}
                              className="flex items-center gap-1 hover:text-amber-700 cursor-pointer w-full text-left font-bold"
                              title="Sort by Group Name (Front/Reverse)"
                            >
                              <span>Group Name</span>
                              {pnlSortCol === 'groupName' ? (
                                pnlSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                              )}
                            </button>
                          </th>
                          <th className="px-3 py-2 border-r border-[#ece3d4] min-w-[90px]" rowSpan={2}>
                            <button
                              type="button"
                              onClick={() => handlePnlSort('loanDate')}
                              className="flex items-center gap-1 hover:text-amber-700 cursor-pointer w-full text-left font-bold"
                              title="Sort by Loan Date (Front/Reverse)"
                            >
                              <span>Loan Date</span>
                              {pnlSortCol === 'loanDate' ? (
                                pnlSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                              )}
                            </button>
                          </th>
                          <th className="px-3 py-2 border-r border-[#ece3d4]" rowSpan={2}>
                            <button
                              type="button"
                              onClick={() => handlePnlSort('collectionDay')}
                              className="flex items-center gap-1 hover:text-amber-700 cursor-pointer w-full text-left font-bold"
                              title="Sort by Collection Day (Front/Reverse)"
                            >
                              <span>Coll Day</span>
                              {pnlSortCol === 'collectionDay' ? (
                                pnlSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                              )}
                            </button>
                          </th>
                          {displayedWeeks.map(w => (
                            <th key={`h1-w-${w}`} colSpan={4} className="px-2 py-1 text-center border-r border-[#ece3d4] bg-amber-100/60 font-black text-amber-950">
                              {w} WEEK
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right border-r border-[#ece3d4] min-w-[110px]" rowSpan={2}>Principal Amt</th>
                          <th className="px-3 py-2 text-right border-r border-[#ece3d4] min-w-[110px]" rowSpan={2}>Total Coll Amt</th>
                          <th colSpan={4} className="px-2 py-1 text-center border-r border-[#ece3d4] bg-emerald-100 font-black text-emerald-950">
                            TOTAL
                          </th>
                          <th className="px-3 py-2 text-right bg-amber-50 text-amber-900 min-w-[120px]" rowSpan={2}>Document Charge</th>
                        </tr>

                        {/* Row 2 Subheaders */}
                        <tr className="text-[10px] text-stone-600 bg-[#f6f0e4] border-b border-[#ded3be]">
                          {displayedWeeks.map(w => (
                            <React.Fragment key={`h2-w-${w}`}>
                              <th className="px-1.5 py-1 text-right border-r border-[#ece3d4]">Prin</th>
                              <th className="px-1.5 py-1 text-right border-r border-[#ece3d4]">Int</th>
                              <th className="px-1.5 py-1 text-right border-r border-[#ece3d4]">Sav</th>
                              <th className="px-1.5 py-1 text-right border-r border-[#ded3be] font-bold text-amber-950 bg-amber-50/60">Tot</th>
                            </React.Fragment>
                          ))}
                          <th className="px-2 py-1 text-right border-r border-[#ece3d4] bg-emerald-50">Principal</th>
                          <th className="px-2 py-1 text-right border-r border-[#ece3d4] bg-emerald-50">Interest</th>
                          <th className="px-2 py-1 text-right border-r border-[#ece3d4] bg-emerald-50">Savings</th>
                          <th className="px-2 py-1 text-right border-r border-[#ded3be] bg-emerald-100 font-black text-emerald-950">Total</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#ece3d4] bg-white font-mono text-[11px]">
                        {sortedPnlRows.length === 0 ? (
                          <tr>
                            <td colSpan={10 + displayedWeeks.length * 4} className="p-8 text-center text-stone-500 font-sans">
                              No loan records found matching the selected filter.
                            </td>
                          </tr>
                        ) : (
                          sortedPnlRows.map((row: any, idx: number) => (
                            <tr key={row.loanId || idx} className="hover:bg-amber-50/40 transition">
                              <td className="px-3 py-2 text-stone-500 border-r border-[#ece3d4] sticky left-0 bg-white group-hover:bg-amber-50">
                                {pnlSortCol === 'sNo' && pnlSortDir === 'desc' ? row.sNo : idx + 1}
                              </td>
                              <td className="px-2 py-2 text-center border-r border-[#ece3d4] font-bold text-amber-900 dark:text-amber-300 font-sans">
                                {row.groupCode ? `#${row.groupCode}` : '-'}
                              </td>
                              <td className="px-3 py-2 font-bold font-sans text-stone-900 border-r border-[#ece3d4] bg-white group-hover:bg-amber-50 whitespace-nowrap">
                                {row.customerName}
                              </td>
                              <td className="px-3 py-2 font-sans text-stone-700 border-r border-[#ece3d4] whitespace-nowrap">
                                {row.groupName}
                              </td>
                              <td className="px-3 py-2 text-stone-600 border-r border-[#ece3d4] whitespace-nowrap">
                                {row.loanDate}
                              </td>
                              <td className="px-3 py-2 font-bold text-stone-800 border-r border-[#ece3d4]">
                                {row.collectionDay}
                              </td>

                              {/* Weeks Columns */}
                              {displayedWeeks.map(w => {
                                const wk = row.weeks?.[w];
                                return (
                                  <React.Fragment key={`cell-${row.loanId}-w${w}`}>
                                    <td className="px-1.5 py-2 text-right border-r border-[#ece3d4] text-stone-600">
                                      {wk?.p ? wk.p.toLocaleString('en-IN') : '-'}
                                    </td>
                                    <td className="px-1.5 py-2 text-right border-r border-[#ece3d4] text-amber-800">
                                      {wk?.i ? wk.i.toLocaleString('en-IN') : '-'}
                                    </td>
                                    <td className="px-1.5 py-2 text-right border-r border-[#ece3d4] text-emerald-700">
                                      {wk?.s ? wk.s.toLocaleString('en-IN') : '-'}
                                    </td>
                                    <td className="px-1.5 py-2 text-right border-r border-[#ded3be] font-bold text-amber-950 bg-amber-50/30">
                                      {wk?.tot ? wk.tot.toLocaleString('en-IN') : '-'}
                                    </td>
                                  </React.Fragment>
                                );
                              })}

                              {/* Summary Columns */}
                              <td className="px-3 py-2 text-right border-r border-[#ece3d4] font-bold text-stone-900">
                                ₹{(row.principalAmt || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="px-3 py-2 text-right border-r border-[#ece3d4] font-bold text-stone-900">
                                ₹{(row.totalCollAmt || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="px-2 py-2 text-right border-r border-[#ece3d4] text-stone-800 bg-emerald-50/20">
                                ₹{(row.totalPrincipal || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="px-2 py-2 text-right border-r border-[#ece3d4] text-amber-900 font-bold bg-emerald-50/20">
                                ₹{(row.totalInterest || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="px-2 py-2 text-right border-r border-[#ece3d4] text-emerald-800 bg-emerald-50/20">
                                ₹{(row.totalSavings || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="px-2 py-2 text-right border-r border-[#ded3be] font-black text-emerald-950 bg-emerald-100/60">
                                ₹{(row.totalCollected || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="px-3 py-2 text-right font-black text-amber-900 bg-amber-50/60">
                                ₹{(row.docCharge || 0).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>

                      {/* Grand Totals Footer */}
                      <tfoot className="sticky bottom-0 bg-[#f6f0e4] border-t-2 border-[#ded3be] font-black text-amber-950 text-xs shadow-md">
                        <tr>
                          <td colSpan={6} className="px-4 py-3 border-r border-[#ded3be] uppercase tracking-wider text-right sticky left-0 bg-[#f6f0e4] z-20">
                            GRAND TOTAL ({filteredPnlRows.length} Loans):
                          </td>

                          {/* Weeks Sums */}
                          {displayedWeeks.map(w => {
                            const s = displayedWeekSums[w] || { p: 0, i: 0, s: 0, tot: 0 };
                            return (
                              <React.Fragment key={`tot-w${w}`}>
                                <td className="px-1.5 py-3 text-right border-r border-[#ece3d4] text-[10px]">
                                  {s.p ? s.p.toLocaleString('en-IN') : '-'}
                                </td>
                                <td className="px-1.5 py-3 text-right border-r border-[#ece3d4] text-[10px] text-amber-800">
                                  {s.i ? s.i.toLocaleString('en-IN') : '-'}
                                </td>
                                <td className="px-1.5 py-3 text-right border-r border-[#ece3d4] text-[10px] text-emerald-700">
                                  {s.s ? s.s.toLocaleString('en-IN') : '-'}
                                </td>
                                <td className="px-1.5 py-3 text-right border-r border-[#ded3be] text-[10px] font-black bg-amber-100/60">
                                  {s.tot ? s.tot.toLocaleString('en-IN') : '-'}
                                </td>
                              </React.Fragment>
                            );
                          })}

                          {/* Grand Summary Columns */}
                          <td className="px-3 py-3 text-right border-r border-[#ded3be] whitespace-nowrap">
                            ₹{pnlFilteredTotals.principalAmt.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-3 text-right border-r border-[#ded3be] whitespace-nowrap">
                            ₹{pnlFilteredTotals.totalCollAmt.toLocaleString('en-IN')}
                          </td>
                          <td className="px-2 py-3 text-right border-r border-[#ece3d4] bg-emerald-100/40 whitespace-nowrap">
                            ₹{pnlFilteredTotals.totalPrincipal.toLocaleString('en-IN')}
                          </td>
                          <td className="px-2 py-3 text-right border-r border-[#ece3d4] text-amber-900 bg-emerald-100/40 whitespace-nowrap">
                            ₹{pnlFilteredTotals.totalInterest.toLocaleString('en-IN')}
                          </td>
                          <td className="px-2 py-3 text-right border-r border-[#ece3d4] text-emerald-800 bg-emerald-100/40 whitespace-nowrap">
                            ₹{pnlFilteredTotals.totalSavings.toLocaleString('en-IN')}
                          </td>
                          <td className="px-2 py-3 text-right border-r border-[#ded3be] text-emerald-950 bg-emerald-200/80 font-black whitespace-nowrap">
                            ₹{pnlFilteredTotals.totalCollected.toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-3 text-right text-amber-900 bg-amber-100/80 font-black whitespace-nowrap">
                            ₹{pnlFilteredTotals.docCharge.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Bottom Realized Revenue Statement Card (Matching bottom of Excel template) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">DOCUMENT CHARGE</p>
                      <p className="text-lg font-black text-amber-900 mt-0.5">
                        ₹{pnlFilteredTotals.docCharge.toLocaleString('en-IN')}
                      </p>
                      <span className="text-[10px] text-stone-500">Collected upfront at disbursement</span>
                    </div>
                    <Coins className="w-8 h-8 text-amber-600/30" />
                  </div>

                  <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">INTEREST REALIZED</p>
                      <p className="text-lg font-black text-emerald-700 mt-0.5">
                        ₹{pnlFilteredTotals.totalInterest.toLocaleString('en-IN')}
                      </p>
                      <span className="text-[10px] text-stone-500">Repayment interest earned</span>
                    </div>
                    <TrendingUp className="w-8 h-8 text-emerald-600/30" />
                  </div>

                  <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-300 shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-emerald-900 uppercase tracking-wider">INT & DOCUMENT CHARGE</p>
                      <p className="text-xl font-black text-emerald-800 mt-0.5">
                        ₹{(pnlFilteredTotals.docCharge + pnlFilteredTotals.totalInterest).toLocaleString('en-IN')}
                      </p>
                      <span className="text-[10px] text-emerald-700 font-bold">Total Operating Revenue</span>
                    </div>
                    <Wallet className="w-8 h-8 text-emerald-600/40" />
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: OPERATIONAL EXPENSES REGISTER (Template Matching EXPENSES - POLLACHI) */}
            {plViewMode === 'EXPENSES' && (
              <div className="space-y-4">
                <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
                  {/* Search & Category Header */}
                  <div className="p-3 bg-[#f6f0e4] border-b border-[#ded3be] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                      <Search className="w-4 h-4 text-stone-500" />
                      <input
                        type="text"
                        placeholder="Search particulars, remarks, staff..."
                        value={plExpenseSearch}
                        onChange={(e) => setPlExpenseSearch(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:border-amber-600 shadow-2xs"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-stone-600">Category:</span>
                      <select
                        value={plExpenseCategory}
                        onChange={(e) => setPlExpenseCategory(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-600 cursor-pointer shadow-2xs"
                      >
                        <option value="ALL">All Particulars ({plData?.expenseRows?.length || 0})</option>
                        {distinctCategories.map((cat: string) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>

                      <span className="text-xs font-bold text-stone-500 bg-[#ece3d4] px-2.5 py-1.5 rounded-xl border border-[#ded3be]">
                        {filteredExpenseRows.length} Expenses
                      </span>
                    </div>
                  </div>

                  {/* Expenses Table */}
                  <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-[#ded3be] shadow-xs">
                        <tr>
                          <th className="px-3 py-2.5 border-r border-[#ece3d4] w-14">S.No</th>
                          <th className="px-4 py-2.5 border-r border-[#ece3d4] w-28">Date</th>
                          <th className="px-4 py-2.5 border-r border-[#ece3d4] min-w-[200px]">Particulars</th>
                          <th className="px-4 py-2.5 text-right border-r border-[#ece3d4] w-36">Amt (₹)</th>
                          <th className="px-4 py-2.5 min-w-[250px]">Remarks / Narration</th>
                          <th className="px-3 py-2.5 text-stone-600 w-28">Staff / Method</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#ece3d4] bg-white text-xs">
                        {filteredExpenseRows.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-stone-500">
                              No operational expense records found matching the filter.
                            </td>
                          </tr>
                        ) : (
                          filteredExpenseRows.map((e: any, idx: number) => (
                            <tr key={e.id || idx} className="hover:bg-rose-50/30 transition">
                              <td className="px-3 py-2 text-stone-500 border-r border-[#ece3d4] font-mono">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-2 font-mono text-stone-800 border-r border-[#ece3d4] whitespace-nowrap">
                                {e.date}
                              </td>
                              <td className="px-4 py-2 font-black text-stone-900 border-r border-[#ece3d4]">
                                {e.particulars}
                              </td>
                              <td className="px-4 py-2 font-mono font-black text-right text-rose-700 border-r border-[#ece3d4]">
                                ₹{(e.amount || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-2 text-stone-600">
                                {e.remarks || '-'}
                              </td>
                              <td className="px-3 py-2 text-[10px] text-stone-500 font-medium">
                                {e.staffName || e.paymentMethod || 'CASH'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>

                      {/* Grand Total Row */}
                      <tfoot className="sticky bottom-0 bg-[#f6f0e4] border-t-2 border-[#ded3be] font-black text-rose-950 text-xs shadow-md">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 uppercase tracking-wider text-right border-r border-[#ded3be]">
                            TOTAL OPERATIONAL EXPENSES:
                          </td>
                          <td className="px-4 py-3 font-mono font-black text-right text-rose-800 border-r border-[#ded3be] text-sm">
                            ₹{totalFilteredExpenses.toLocaleString('en-IN')}
                          </td>
                          <td colSpan={2} className="px-4 py-3 text-stone-600 text-[11px] font-medium">
                            Across {filteredExpenseRows.length} vouchers / entries
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 3: EXECUTIVE FINANCIAL STATEMENT */}
            {plViewMode === 'STATEMENT' && (
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
                        <span className="font-bold text-stone-900 block">Documentation & Processing Fees</span>
                        <span className="text-[10px] text-stone-500">Collected upfront at loan disbursement</span>
                      </div>
                      <span className="font-mono font-black text-stone-900 text-sm">
                        ₹{(plData?.revenue?.docCharges || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-[#ece3d4]">
                      <div>
                        <span className="font-bold text-stone-900 block">Repayment Interest Realized</span>
                        <span className="text-[10px] text-stone-500">Interest collected from weekly repayments</span>
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
                        <span className="font-bold text-stone-900 block">Route Travel & Fuel Claims</span>
                        <span className="text-[10px] text-stone-500">Staff travel reimbursements</span>
                      </div>
                      <span className="font-mono font-black text-rose-700 text-sm">
                        ₹{(plData?.expenses?.fuel || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-[#ece3d4]">
                      <div>
                        <span className="font-bold text-stone-900 block">Branch Rent & Facilities</span>
                        <span className="text-[10px] text-stone-500">Rent, electricity & premises overheads</span>
                      </div>
                      <span className="font-mono font-black text-stone-900 text-sm">
                        ₹{(plData?.expenses?.rent || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-[#ece3d4]">
                      <div>
                        <span className="font-bold text-stone-900 block">Staff Salaries & Field Incentives</span>
                        <span className="text-[10px] text-stone-500">Officer compensation and wages</span>
                      </div>
                      <span className="font-mono font-black text-stone-900 text-sm">
                        ₹{(plData?.expenses?.salaries || 0).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-[#ece3d4]">
                      <div>
                        <span className="font-bold text-stone-900 block">Printing, Stationery & General Admin</span>
                        <span className="text-[10px] text-stone-500">Passbooks, paper, materials & running costs</span>
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
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default Reports;
