import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar, 
  CheckCircle2, 
  Search, 
  HandCoins, 
  Coins, 
  AlertCircle, 
  Clock, 
  User, 
  Phone, 
  ArrowRight,
  TrendingUp,
  FolderTree,
  Filter,
  Users,
  ChevronDown,
  ChevronUp,
  Building2,
  CalendarDays,
  Target,
  ArrowUpRight,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];

const getTodayWeekday = (): string => {
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const todayName = dayNames[new Date().getDay()];
  if (DAYS.includes(todayName)) {
    return todayName;
  }
  return 'MONDAY';
};

export const Collections: React.FC = () => {
  const { selectedBranchId } = useBranch();
  const { user, isAdmin, isManager } = useAuth();
  const isManagerOrAdmin = isAdmin || isManager;
  const queryClient = useQueryClient();

  const todayWeekday = getTodayWeekday();
  const [selectedDay, setSelectedDay] = useState<string>(todayWeekday);
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'STAFF_WISE'>('REGISTER');
  const [search, setSearch] = useState('');
  const [payingLoanId, setPayingLoanId] = useState<string | null>(null);
  const [payingGroupId, setPayingGroupId] = useState<string | null>(null);
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [showCompletedGroups, setShowCompletedGroups] = useState<boolean>(false);

  // Optimistic tracking for instant zero-latency updates without waiting for server refetch
  const [optimisticPaidLoans, setOptimisticPaidLoans] = useState<Record<string, { amount: number; time: number }>>({});

  // Partial Collection Modal State
  const [isPartialModalOpen, setIsPartialModalOpen] = useState(false);
  const [partialMember, setPartialMember] = useState<any | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [remarks, setRemarks] = useState('');

  // Daily Sheet Query
  const { data: dailySheetData, isLoading: isDailyLoading } = useQuery({
    queryKey: ['dailySheet', selectedBranchId, selectedDay],
    queryFn: () => api.getDailySheet({ branchId: selectedBranchId, weekday: selectedDay }),
    enabled: activeTab === 'REGISTER' && selectedDay !== 'WEEKLY'
  });

  // Weekly Sheet Query (Manager & Admin - Always fetched for live weekly route progress stats)
  const { data: weeklySheetData, isLoading: isWeeklyLoading } = useQuery({
    queryKey: ['weeklySheet', selectedBranchId],
    queryFn: () => api.getWeeklySheet({ branchId: selectedBranchId }),
    enabled: isManagerOrAdmin
  });

  // Staff-Wise Collections Query (Manager & Admin)
  const { data: staffData, isLoading: isStaffLoading } = useQuery({
    queryKey: ['staffCollections', selectedBranchId],
    queryFn: () => api.getStaffCollections({ branchId: selectedBranchId }),
    enabled: activeTab === 'STAFF_WISE' && isManagerOrAdmin
  });

  const recordMutation = useMutation({
    mutationFn: (payData: any) => api.recordCollection(payData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailySheet'] });
      queryClient.invalidateQueries({ queryKey: ['weeklySheet'] });
      queryClient.invalidateQueries({ queryKey: ['staffCollections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardCharts'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setIsPartialModalOpen(false);
      setPartialMember(null);
      setPartialAmount('');
      setRemarks('');
      setPayingLoanId(null);
    },
    onError: (err: any, variables: any) => {
      if (variables?.loanId) {
        setOptimisticPaidLoans(prev => {
          const next = { ...prev };
          delete next[variables.loanId];
          return next;
        });
      }
      alert(err.message || 'Failed to record collection');
      setPayingLoanId(null);
    }
  });

  // Fast 1-click Mark Full Expected Installment as Paid with instant optimistic 0ms UI update
  const handleQuickMarkPaid = (member: any) => {
    if (!member.expectedAmount || member.expectedAmount <= 0) return;
    setOptimisticPaidLoans(prev => ({
      ...prev,
      [member.loanId]: { amount: member.expectedAmount, time: Date.now() }
    }));
    setPayingLoanId(member.loanId);
    recordMutation.mutate({
      loanId: member.loanId,
      amount: member.expectedAmount,
      paymentMethod: 'CASH',
      remarks: `Full week ${member.installmentNumber || ''} payment`,
      weekday: selectedDay === 'WEEKLY' ? (member.collectionDay || todayWeekday) : selectedDay,
      installmentId: member.installmentId
    });
  };

  // 1-click Mark Whole Group as Paid with instant optimistic 0ms UI update across all members
  const handleMarkWholeGroupPaid = async (item: any) => {
    const unpaidMembers = item.members?.filter((m: any) => {
      const isAlreadyPaid = Boolean(optimisticPaidLoans[m.loanId]) || m.isPaidToday || m.installmentStatus === 'PAID' || !m.installmentNumber || m.expectedAmount <= 0;
      return !isAlreadyPaid;
    }) || [];
    if (unpaidMembers.length === 0) return;

    setPayingGroupId(item.group?._id);
    const newOpts: Record<string, { amount: number; time: number }> = {};
    unpaidMembers.forEach((m: any) => {
      newOpts[m.loanId] = { amount: m.expectedAmount, time: Date.now() };
    });
    setOptimisticPaidLoans(prev => ({ ...prev, ...newOpts }));

    try {
      await api.recordGroupCollection({
        groupId: item.group?._id,
        weekday: selectedDay === 'WEEKLY' ? (item.collectionDay || todayWeekday) : selectedDay,
        paymentMethod: 'CASH'
      });
      queryClient.invalidateQueries({ queryKey: ['dailySheet'] });
      queryClient.invalidateQueries({ queryKey: ['weeklySheet'] });
      queryClient.invalidateQueries({ queryKey: ['staffCollections'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    } catch (err: any) {
      alert(err.message || 'Failed to record group collection');
    } finally {
      setPayingGroupId(null);
    }
  };

  // Open Partial Payment Modal
  const handleOpenPartialModal = (member: any) => {
    setPartialMember(member);
    setPartialAmount(String(member.expectedAmount || ''));
    setPaymentMethod('CASH');
    setRemarks('');
    setIsPartialModalOpen(true);
  };

  const handlePartialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(partialAmount);
    if (!partialMember || isNaN(parsedAmt) || parsedAmt <= 0) return;

    recordMutation.mutate({
      loanId: partialMember.loanId,
      amount: parsedAmt,
      paymentMethod,
      remarks: remarks || (parsedAmt < partialMember.expectedAmount ? 'Partial payment received' : 'Full payment received'),
      weekday: selectedDay === 'WEEKLY' ? (partialMember.collectionDay || todayWeekday) : selectedDay,
      installmentId: partialMember.installmentId
    });
  };

  const isWeekly = selectedDay === 'WEEKLY' && isManagerOrAdmin;
  const isLoading = isWeekly ? isWeeklyLoading : isDailyLoading;
  const rawGroups = isWeekly ? (weeklySheetData?.groups || []) : (dailySheetData?.groups || []);

  // Filter groups and members by search term
  const groups = rawGroups
    .map((item: any) => {
      if (!search.trim()) return item;
      const term = search.toLowerCase();
      const matchGroup = item.group?.name?.toLowerCase().includes(term) ||
                         String(item.group?.groupCode).includes(term) ||
                         item.group?.area?.toLowerCase().includes(term) ||
                         item.collectionDay?.toLowerCase().includes(term);

      const matchingMembers = item.members?.filter((m: any) =>
        m.customer?.name?.toLowerCase().includes(term) ||
        m.customer?.phone?.includes(term) ||
        m.loanNumber?.toLowerCase().includes(term)
      );

      if (matchGroup) return item;
      if (matchingMembers && matchingMembers.length > 0) {
        return { ...item, members: matchingMembers };
      }
      return null;
    })
    .filter(Boolean);

  // Helper: check if a group is settled/completed (no active loan installments pending and no collections due today)
  const isGroupCompleted = (item: any) => {
    if (!item.members || item.members.length === 0) return true;
    const hasPendingInstallments = item.members.some((m: any) => 
      (m.expectedAmount > 0) || 
      (m.todayPaid > 0) || 
      (m.installmentNumber && m.installmentStatus !== 'PAID')
    );
    const hasDueOrPaid = (item.expectedTotal > 0) || (item.collectedToday > 0);
    return !hasPendingInstallments && !hasDueOrPaid;
  };

  const totalCompletedGroups = groups.filter(isGroupCompleted).length;
  const totalActiveGroups = groups.length - totalCompletedGroups;
  const displayGroups = showCompletedGroups
    ? [...groups].sort((a: any, b: any) => {
        const aComp = isGroupCompleted(a) ? 1 : 0;
        const bComp = isGroupCompleted(b) ? 1 : 0;
        return bComp - aComp; // Closed groups at top, live groups below when ON
      })
    : groups.filter((g: any) => !isGroupCompleted(g)); // Live groups at top, closed hidden when OFF

  // Overall route statistics
  const totalRouteExpected = isWeekly 
    ? (weeklySheetData?.weeklySummary?.weeklyExpected || 0)
    : rawGroups.reduce((sum: number, g: any) => sum + (g.expectedTotal || 0), 0);

  const totalRouteCollected = isWeekly
    ? (weeklySheetData?.weeklySummary?.weeklyCollected || 0)
    : rawGroups.reduce((sum: number, g: any) => sum + (g.collectedToday || 0), 0);

  const totalRouteMembers = isWeekly
    ? (weeklySheetData?.weeklySummary?.totalMembers || 0)
    : rawGroups.reduce((sum: number, g: any) => sum + (g.members?.length || 0), 0);

  const totalRouteGroups = isWeekly
    ? (weeklySheetData?.weeklySummary?.totalGroups || 0)
    : rawGroups.length;

  const weeklyDays = weeklySheetData?.days || {};

  // Live Collection Stats: Today's Route vs Weekly Consolidated
  const todayDayStat = weeklyDays[todayWeekday];
  const todayExpected = todayDayStat?.expected ?? (
    selectedDay === todayWeekday 
      ? rawGroups.reduce((sum: number, g: any) => sum + (g.expectedTotal || 0), 0)
      : 0
  );
  const todayCollected = todayDayStat?.collected ?? (
    selectedDay === todayWeekday
      ? rawGroups.reduce((sum: number, g: any) => sum + (g.collectedToday || 0), 0)
      : 0
  );

  const weeklySummary = weeklySheetData?.weeklySummary;
  const weeklyExpected = weeklySummary?.weeklyExpected || 0;
  const weeklyCollected = weeklySummary?.weeklyCollected || 0;

  return (
    <div className="space-y-6">
      {/* Header: Clean, Responsive, occupying full width with View Mode Toggle and Dual Today & Weekly Progress Indicators */}
      <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">
            {activeTab === 'STAFF_WISE' ? 'Staff-Wise Collections & Performance' : 'Daily Collections & Route Register'}
          </h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            {activeTab === 'STAFF_WISE'
              ? 'Real-time performance tracking per field collection officer across assigned groups, collection targets, and efficiency'
              : 'Organized by collection weekday and consolidated weekly routes. Mark installments as Paid or record partial amounts.'}
          </p>
        </div>

        {/* View Mode Toggle & Settled Groups Button & Dual Progress Indicators */}
        <div className="flex flex-wrap items-center justify-start 2xl:justify-end gap-2.5">
          {isManagerOrAdmin && (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[#ece3d4] p-1 rounded-2xl border border-[#ded3be] shadow-xs">
                <button
                  onClick={() => setActiveTab('REGISTER')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === 'REGISTER'
                      ? 'bg-[#251b14] text-amber-300 shadow-xs'
                      : 'text-stone-700 hover:text-stone-900'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Route Register</span>
                </button>
                <button
                  onClick={() => setActiveTab('STAFF_WISE')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === 'STAFF_WISE'
                      ? 'bg-[#251b14] text-amber-300 shadow-xs'
                      : 'text-stone-700 hover:text-stone-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Staff-Wise Collections</span>
                </button>
              </div>

              {/* Settled Groups Toggle Button - Top Left next to Route Register & Staff-Wise */}
              <button
                type="button"
                onClick={() => setShowCompletedGroups(prev => !prev)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs border shrink-0 ${
                  showCompletedGroups
                    ? 'bg-[#251b14] text-amber-300 border-amber-800/60'
                    : 'bg-white text-stone-700 border-[#ded3be] hover:bg-[#faf6ee]'
                }`}
                title={showCompletedGroups ? "Hide settled groups (Closed groups shown at top)" : "Show settled groups (Closed groups currently hidden)"}
              >
                {showCompletedGroups ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5 text-stone-500" />}
                <span className="hidden sm:inline">{showCompletedGroups ? 'Settled Groups (Shown)' : 'Settled Groups (Hidden)'}</span>
                <span className="sm:hidden">{showCompletedGroups ? 'Settled' : 'Settled'}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  showCompletedGroups ? 'bg-amber-400 text-stone-950' : 'bg-[#ece3d4] text-stone-700'
                }`}>
                  {totalCompletedGroups}
                </span>
              </button>
            </div>
          )}

          {/* Dual Progress Indicators: Today's Collection & Weekly Collection */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Today's Collection */}
            <div className="flex items-center gap-2.5 bg-[#f6f0e4] border border-[#ded3be] rounded-2xl px-3 py-1.5 shadow-xs">
              <HandCoins className="w-4 h-4 text-amber-700 shrink-0" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                    Today's:
                  </span>
                  <span className="text-xs font-black text-emerald-800">
                    ₹{todayCollected.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-stone-500 font-semibold">
                    / ₹{todayExpected.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="w-28 bg-[#ece3d4] h-1.5 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${todayExpected > 0 ? Math.min(100, (todayCollected / todayExpected) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Weekly Collection */}
            <div className="flex items-center gap-2.5 bg-[#f6f0e4] border border-[#ded3be] rounded-2xl px-3 py-1.5 shadow-xs">
              <CalendarDays className="w-4 h-4 text-amber-800 shrink-0" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                    Weekly:
                  </span>
                  <span className="text-xs font-black text-emerald-800">
                    ₹{weeklyCollected.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-stone-500 font-semibold">
                    / ₹{weeklyExpected.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="w-28 bg-[#ece3d4] h-1.5 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="bg-amber-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${weeklyExpected > 0 ? Math.min(100, (weeklyCollected / weeklyExpected) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW: STAFF-WISE COLLECTIONS */}
      {activeTab === 'STAFF_WISE' && isManagerOrAdmin && (
        <div className="space-y-6">
          {/* Staff Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Field Officers</p>
              <p className="text-xl font-black text-stone-900 mt-0.5">
                {staffData?.staffSummaries?.length || 0} Officers
              </p>
              <span className="text-[10px] text-amber-800 font-semibold">Assigned Branch Staff</span>
            </div>
            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Expected Due</p>
              <p className="text-xl font-black text-amber-950 mt-0.5">
                ₹{(staffData?.totals?.totalExpected || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-stone-500 font-medium">Daily route target</span>
            </div>
            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Collected Today</p>
              <p className="text-xl font-black text-emerald-700 mt-0.5">
                ₹{(staffData?.totals?.totalCollected || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-emerald-800 font-bold">
                {staffData?.totals?.efficiencyPercent || 0}% Overall Collection Rate
              </span>
            </div>
            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Shortfall / Balance Due</p>
              <p className="text-xl font-black text-rose-700 mt-0.5">
                ₹{(staffData?.totals?.totalShortfall || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-stone-500 font-medium">Field pending collection</span>
            </div>
          </div>

          {/* Staff Cards List */}
          <div className="space-y-4">
            {isStaffLoading ? (
              <div className="bg-[#fffdfa] p-12 text-center text-xs text-stone-400 font-medium rounded-2xl border border-[#ded3be]">
                Loading staff collection performance...
              </div>
            ) : staffData?.staffSummaries?.length > 0 ? (
              staffData.staffSummaries.map((staff: any) => {
                const isExpanded = expandedStaffId === staff.staffId;
                const eff = staff.efficiencyPercent || 0;

                return (
                  <div key={staff.staffId} className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
                    {/* Staff Header Row */}
                    <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-[#251b14] text-amber-300 font-black text-base flex items-center justify-center border border-amber-800/60 shadow-xs shrink-0">
                          {staff.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-stone-900">{staff.name}</h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#ded3be] text-stone-700">
                              {staff.role === 'COLLECTION_STAFF' ? 'Collection Staff' : 'Branch Manager'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-stone-600 mt-0.5 font-medium">
                            {staff.phone && staff.phone !== '-' ? (
                              <a
                                href={`tel:${staff.phone.replace(/[^0-9+]/g, '')}`}
                                className="inline-flex items-center gap-1 font-mono text-emerald-800 hover:text-emerald-950 font-bold hover:underline cursor-pointer"
                              >
                                <Phone className="w-2.5 h-2.5 text-emerald-600" />
                                <span>{staff.phone}</span>
                              </a>
                            ) : (
                              <span className="text-stone-400 font-mono text-[11px]">No phone</span>
                            )}
                            <span>&bull;</span>
                            <span>{staff.totalGroups} Assigned Groups</span>
                            <span>&bull;</span>
                            <span>{staff.totalBorrowers} Active Borrowers</span>
                          </div>
                        </div>
                      </div>

                      {/* Staff Metrics & Progress */}
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase text-stone-500 block">Expected Due</span>
                          <span className="font-black text-stone-900 text-sm">₹{staff.expectedAmount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="h-7 w-px bg-[#ded3be] hidden sm:block" />
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase text-stone-500 block">Collected Today</span>
                          <span className="font-black text-emerald-700 text-sm">₹{staff.collectedToday.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="h-7 w-px bg-[#ded3be] hidden sm:block" />
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase text-stone-500 block">Shortfall</span>
                          <span className="font-black text-rose-700 text-sm">₹{staff.shortfall.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="h-7 w-px bg-[#ded3be] hidden sm:block" />
                        {/* Efficiency pill */}
                        <div className="min-w-[100px]">
                          <div className="flex items-center justify-between text-[10px] font-black mb-1">
                            <span className="text-stone-600">Efficiency</span>
                            <span className={eff >= 80 ? 'text-emerald-700' : eff >= 50 ? 'text-amber-700' : 'text-rose-700'}>
                              {eff}%
                            </span>
                          </div>
                          <div className="w-24 bg-[#ece3d4] h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                eff >= 80 ? 'bg-emerald-600' : eff >= 50 ? 'bg-amber-600' : 'bg-rose-600'
                              }`}
                              style={{ width: `${Math.min(100, eff)}%` }}
                            />
                          </div>
                        </div>

                        {/* Toggle Group Table Button */}
                        <button
                          onClick={() => setExpandedStaffId(isExpanded ? null : staff.staffId)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-[#ded3be] hover:bg-[#faf6ee] text-stone-800 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                        >
                          <span>{isExpanded ? 'Hide Groups' : `View ${staff.groups.length} Groups`}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Group Breakdown Table */}
                    {isExpanded && (
                      <div className="overflow-x-auto border-t border-[#ded3be] bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#fcf9f2] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ece3d4]">
                            <tr>
                              <th className="px-4 py-2.5">Group Code & Name</th>
                              <th className="px-4 py-2.5">Route Day</th>
                              <th className="px-4 py-2.5">Area</th>
                              <th className="px-4 py-2.5">Borrowers</th>
                              <th className="px-4 py-2.5">Expected (₹)</th>
                              <th className="px-4 py-2.5">Collected Today (₹)</th>
                              <th className="px-4 py-2.5 text-right">Shortfall (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#ece3d4]">
                            {staff.groups?.length > 0 ? (
                              staff.groups.map((grp: any) => (
                                <tr key={grp.groupId} className="hover:bg-[#faf6ee] transition">
                                  <td className="px-4 py-3">
                                    <span className="font-bold text-stone-900 block">{grp.groupName}</span>
                                    <span className="font-mono text-[10px] text-stone-500 font-semibold">Group #{grp.groupCode}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-2xs">
                                      {grp.collectionDay}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 font-medium text-stone-700">{grp.area || '-'}</td>
                                  <td className="px-4 py-3 font-bold text-stone-900">{grp.borrowersCount} Borrowers</td>
                                  <td className="px-4 py-3 font-bold text-stone-900">₹{grp.expectedAmount.toLocaleString('en-IN')}</td>
                                  <td className="px-4 py-3 font-bold text-emerald-700">₹{grp.collectedToday.toLocaleString('en-IN')}</td>
                                  <td className="px-4 py-3 text-right font-bold text-rose-700">
                                    ₹{grp.remainingDue.toLocaleString('en-IN')}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={7} className="px-4 py-6 text-center text-stone-400 font-medium">
                                  No groups currently assigned to this officer.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-[#fffdfa] p-12 text-center text-xs text-stone-400 font-medium rounded-2xl border border-[#ded3be]">
                No staff members found for this branch.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: ROUTE REGISTER (DAILY / WEEKLY) */}
      {activeTab === 'REGISTER' && (
        <div className="space-y-6">
          {/* Weekday Selection Bar & Search */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            {/* Route Tabs: WEEKLY (to the left of daily routes for Manager/Admin) + Daily Routes */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
              {/* Weekly View Button for Manager and Admin */}
              {isManagerOrAdmin && (
                <button
                  onClick={() => setSelectedDay('WEEKLY')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    selectedDay === 'WEEKLY'
                      ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
                      : 'bg-white border border-[#ded3be] text-stone-700 hover:bg-[#faf6ee]'
                  }`}
                >
                  <FolderTree className="w-3.5 h-3.5 text-amber-500" />
                  <span>WEEKLY VIEW</span>
                </button>
              )}

              {/* Daily Route Tabs */}
              {DAYS.map((day) => {
                const isToday = day === todayWeekday;
                const isSelected = selectedDay === day;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
                        : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    <span>{day} ROUTE</span>
                    {isToday && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-black tracking-wide uppercase ${
                        isSelected
                          ? 'bg-amber-400 text-stone-950'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}>
                        Today
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search Bar: Expands to cleanly occupy the right space */}
            <div className="flex items-center gap-2.5 flex-1 justify-start xl:justify-end min-w-0">
              <div className="relative flex-1 max-w-md min-w-[200px]">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search borrower, phone, group code, area..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-amber-600 shadow-xs"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* WEEKLY BREAKDOWN CARDS (When Weekly View is Selected) */}
          {isWeekly && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DAYS.map((day) => {
                const dayStat = weeklyDays[day] || { expected: 0, collected: 0, remaining: 0, groupsCount: 0 };
                const isToday = day === todayWeekday;

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs cursor-pointer hover:border-amber-600 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-amber-950 flex items-center gap-1">
                        <span>{day}</span>
                        {isToday && (
                          <span className="text-[8px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-black">
                            TODAY
                          </span>
                        )}
                      </span>
                      <ArrowRight className="w-3 h-3 text-stone-400 group-hover:text-amber-700 transition" />
                    </div>
                    <p className="text-base font-black text-stone-900 mt-1">
                      ₹{dayStat.expected?.toLocaleString('en-IN')}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-stone-500 font-medium mt-1">
                      <span className="text-emerald-700 font-bold">₹{dayStat.collected?.toLocaleString('en-IN')} paid</span>
                      <span>{dayStat.groupsCount || 0} groups</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Route Quick Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                {isWeekly ? 'Weekly Scheduled Groups' : 'Scheduled Groups'}
              </p>
              <p className="text-xl font-black text-stone-900 mt-0.5">
                {showCompletedGroups ? `${totalRouteGroups} Groups` : `${totalActiveGroups} Active Groups`}
              </p>
              <span className="text-[10px] text-amber-800 font-semibold">
                {totalRouteMembers} Active Borrowers {totalCompletedGroups > 0 && `• ${totalCompletedGroups} Settled`}
              </span>
            </div>
            <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                {isWeekly ? 'Weekly Total Expected Due' : 'Route Expected Due'}
              </p>
              <p className="text-xl font-black text-amber-950 mt-0.5">₹{totalRouteExpected.toLocaleString('en-IN')}</p>
              <span className="text-[10px] text-stone-500 font-medium">
                {isWeekly ? 'Consolidated 4-day routes' : `For ${selectedDay} collection`}
              </span>
            </div>
            <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                {isWeekly ? 'Weekly Collected' : 'Collected Today'}
              </p>
              <p className="text-xl font-black text-emerald-700 mt-0.5">₹{totalRouteCollected.toLocaleString('en-IN')}</p>
              <span className="text-[10px] text-emerald-800 font-semibold">
                {totalRouteExpected > 0 ? `${Math.round((totalRouteCollected / totalRouteExpected) * 100)}% Collected` : 'Up to date'}
              </span>
            </div>
            <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Remaining Balance Due</p>
              <p className="text-xl font-black text-rose-700 mt-0.5">
                ₹{Math.max(0, totalRouteExpected - totalRouteCollected).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-stone-500 font-medium">To be collected</span>
            </div>
          </div>

          {/* Groups in the Route */}
          <div className="space-y-6">
            {isLoading ? (
              <div className="bg-[#fffdfa] p-12 text-center text-xs text-stone-400 font-medium rounded-2xl border border-[#ded3be]">
                Loading {isWeekly ? 'weekly consolidated' : selectedDay} collection routes...
              </div>
            ) : displayGroups.length > 0 ? (
              displayGroups.map((item: any) => {
                const optAddedToGroup = item.members?.reduce((sum: number, mem: any) => {
                  if (optimisticPaidLoans[mem.loanId] && !mem.isPaidToday && mem.expectedAmount > 0) {
                    return sum + (optimisticPaidLoans[mem.loanId].amount || 0);
                  }
                  return sum;
                }, 0) || 0;
                const grpExpected = item.expectedTotal || 0;
                const grpCollected = (item.collectedToday || 0) + optAddedToGroup;
                const grpRemaining = Math.max(0, grpExpected - grpCollected);

                return (
                  <div key={item.group?._id} className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
                    {/* Group Card Header */}
                    <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-stone-900">{item.group?.name}</h3>
                          <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-[#251b14] text-amber-300 font-bold border border-amber-800/60 shadow-xs">
                            Group #{item.group?.groupCode}
                          </span>
                          {isWeekly && item.collectionDay && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 border border-amber-300">
                              {item.collectionDay}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 mt-1 font-medium">
                          Area: <strong className="text-stone-800">{item.group?.area || 'Pollachi Rural'}</strong> &bull; Collector:{' '}
                          <strong className="text-amber-900">{item.group?.staffName || 'Chandra Sekar'}</strong>
                        </p>
                      </div>

                      {/* Group Totals */}
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-semibold bg-[#fcf9f2] px-3.5 py-2 rounded-xl border border-[#ece3d4]">
                        <div>
                          <span className="text-stone-500 text-[10px] uppercase block font-bold">Expected Due</span>
                          <strong className="text-stone-900 font-black text-sm">₹{grpExpected.toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="h-6 w-px bg-[#ded3be]" />
                        <div>
                          <span className="text-stone-500 text-[10px] uppercase block font-bold">Collected Today</span>
                          <strong className="text-emerald-700 font-black text-sm">₹{grpCollected.toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="h-6 w-px bg-[#ded3be]" />
                        <div>
                          <span className="text-stone-500 text-[10px] uppercase block font-bold">Remaining Due</span>
                          <strong className="text-rose-700 font-black text-sm">₹{grpRemaining.toLocaleString('en-IN')}</strong>
                        </div>

                        {/* Whole Group Collection Button */}
                        <div className="sm:ml-auto flex items-center gap-2">
                          {grpRemaining > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleMarkWholeGroupPaid(item)}
                              disabled={payingGroupId === item.group?._id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                              title={`Collect all remaining ₹${grpRemaining.toLocaleString('en-IN')} dues in this group`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                              <span>{payingGroupId === item.group?._id ? 'Collecting...' : `Collect Full Group (₹${grpRemaining.toLocaleString('en-IN')})`}</span>
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Group 100% Cleared</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Group Members Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                          <tr>
                            <th className="px-4 py-3">Borrower Name & Contact</th>
                            <th className="px-4 py-3">Loan Account</th>
                            <th className="px-4 py-3">Week Due</th>
                            <th className="px-4 py-3">Expected (₹)</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Collection Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ece3d4]">
                          {item.members?.length > 0 ? (
                            item.members.map((m: any) => {
                              const opt = optimisticPaidLoans[m.loanId];
                              const isOptPaid = Boolean(opt);
                              const isFullyPaid = isOptPaid || m.isPaidToday || m.installmentStatus === 'PAID' || !m.installmentNumber || m.expectedAmount <= 0;
                              const isPartial = !isFullyPaid && (m.installmentStatus === 'PARTIAL' || (m.installmentPaid > 0 && m.expectedAmount > 0));
                              const isPayingThis = payingLoanId === m.loanId;
                              const displayExpected = isOptPaid ? 0 : (m.installmentExpected || m.expectedAmount || m.todayPaid || 0);
                              const displayTodayPaid = (m.todayPaid || 0) + (isOptPaid ? opt.amount : 0);

                              return (
                                <tr key={m.loanId} className="hover:bg-[#fbf7f0] transition">
                                  {/* Borrower */}
                                  <td className="px-4 py-3.5">
                                    <span className="font-bold text-stone-900 block text-xs">{m.customer?.name}</span>
                                    {m.customer?.phone && m.customer.phone !== '-' && m.customer.phone.toLowerCase() !== 'no phone' ? (
                                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                        {m.customer.phone.split(/[/,]/).map((num: string, idx: number) => {
                                          const cleanNum = num.trim();
                                          if (!cleanNum) return null;
                                          return (
                                            <a
                                              key={idx}
                                              href={`tel:${cleanNum.replace(/[^0-9+]/g, '')}`}
                                              className="inline-flex items-center gap-1 text-[11px] font-mono text-stone-600 hover:text-emerald-700 font-bold transition cursor-pointer"
                                              title={`Click to call ${m.customer.name} (${cleanNum})`}
                                            >
                                              <Phone className="w-2.5 h-2.5 text-emerald-600" />
                                              <span>{cleanNum}</span>
                                            </a>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <span className="font-mono text-[11px] text-stone-400">-</span>
                                    )}
                                  </td>

                                  {/* Loan Account */}
                                  <td className="px-4 py-3.5">
                                    <span className="font-mono font-bold text-stone-800">{m.loanNumber}</span>
                                    <span className="text-[10px] text-stone-500 block">
                                      Bal: ₹{m.outstandingTotal?.toLocaleString('en-IN')}
                                    </span>
                                  </td>

                                  {/* Week Due */}
                                  <td className="px-4 py-3.5">
                                    {m.installmentNumber ? (
                                      <span className="font-mono font-bold text-amber-950 bg-[#f6f0e4] px-2 py-0.5 rounded-lg border border-[#ded3be]">
                                        Week {m.installmentNumber} of {m.tenureWeeks || 32}
                                      </span>
                                    ) : (
                                      <span className="font-bold text-emerald-700">All Weeks Cleared</span>
                                    )}
                                  </td>

                                  {/* Expected Amount */}
                                  <td className="px-4 py-3.5">
                                    <span className="font-black text-stone-900 text-sm">
                                      ₹{displayExpected.toLocaleString('en-IN')}
                                    </span>
                                    {isPartial && (
                                      <span className="text-[10px] text-amber-800 block font-semibold">
                                        Recd: ₹{m.installmentPaid?.toLocaleString('en-IN')}
                                      </span>
                                    )}
                                  </td>

                                  {/* Status Badge */}
                                  <td className="px-4 py-3.5">
                                    {isFullyPaid ? (
                                      <div>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                          <CheckCircle2 className="w-3 h-3" />
                                          <span>Paid</span>
                                        </span>
                                        {displayTodayPaid > 0 && (
                                          <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                                            +₹{displayTodayPaid.toLocaleString('en-IN')} Collected
                                          </span>
                                        )}
                                      </div>
                                    ) : isPartial ? (
                                      <div>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                          <Clock className="w-3 h-3 text-amber-700" />
                                          <span>Partial (₹{m.installmentPaid} Recd)</span>
                                        </span>
                                        {displayTodayPaid > 0 && (
                                          <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                                            +₹{displayTodayPaid.toLocaleString('en-IN')} Collected
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <div>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-300">
                                          <span>Pending</span>
                                        </span>
                                        {displayTodayPaid > 0 && (
                                          <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                                            +₹{displayTodayPaid.toLocaleString('en-IN')} Collected
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </td>

                                  {/* Actions */}
                                  <td className="px-4 py-3.5 text-right">
                                    {!isFullyPaid ? (
                                      <div className="flex items-center justify-end gap-2">
                                        {/* 1-Click Fast Mark Paid Button */}
                                        <button
                                          onClick={() => handleQuickMarkPaid(m)}
                                          disabled={isPayingThis || recordMutation.isPending}
                                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                                          title="Mark full installment as collected"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          <span>{isPayingThis ? 'Recording...' : `Mark Paid (₹${m.expectedAmount})`}</span>
                                        </button>

                                        {/* Mark Partial Button */}
                                        <button
                                          onClick={() => handleOpenPartialModal(m)}
                                          disabled={isPayingThis || recordMutation.isPending}
                                          className="px-3 py-1.5 bg-[#f6f0e4] hover:bg-[#ede3d0] text-amber-950 font-bold rounded-xl text-xs border border-[#ded3be] transition cursor-pointer disabled:opacity-50"
                                          title="Record a custom or partial repayment amount"
                                        >
                                          Partial
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        <span>Payment Recorded</span>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={6} className="text-center py-6 text-stone-400 font-medium">
                                No active loan installments pending in this group.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-[#fffdfa] p-12 text-center text-xs text-stone-500 font-medium rounded-2xl border border-[#ded3be] space-y-3">
                {totalCompletedGroups > 0 && !showCompletedGroups ? (
                  <div className="space-y-2">
                    <p className="text-sm font-black text-stone-900">
                      All {totalCompletedGroups} scheduled groups for {selectedDay} are settled (0 active installments due).
                    </p>
                    <p className="text-stone-500">
                      Inactive groups are hidden from daily collection by default.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCompletedGroups(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#251b14] text-amber-300 font-bold rounded-xl text-xs hover:bg-[#322319] transition cursor-pointer shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Show {totalCompletedGroups} Settled Groups</span>
                    </button>
                  </div>
                ) : user?.role === 'COLLECTION_STAFF' ? (
                  <div className="space-y-2 max-w-md mx-auto py-4">
                    <p className="text-sm font-black text-stone-900">
                      No routes scheduled for {user?.name || 'you'} on {selectedDay}.
                    </p>
                    <p className="text-stone-500 leading-relaxed">
                      Field routes are organized by weekday schedule. If your assigned routes run on <strong>Tuesday & Thursday</strong> (or <strong>Monday & Wednesday</strong>), click the route day tabs above to view your assigned groups and collect installments.
                    </p>
                  </div>
                ) : (
                  <p>No collection groups scheduled for {selectedDay}.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Record Partial / Custom Collection Modal */}
      {isPartialModalOpen && partialMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-900/30">
            <div className="border-b border-[#ded3be] pb-3">
              <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-700" />
                <span>Mark Collection / Partial Repayment</span>
              </h3>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                Record the amount actually received from the borrower.
              </p>
            </div>

            {/* Member Snapshot */}
            <div className="bg-[#f6f0e4] border border-[#ded3be] rounded-xl p-3 text-xs space-y-1.5 font-medium">
              <div className="flex justify-between">
                <span className="text-stone-600">Borrower:</span>
                <span className="font-bold text-stone-900">{partialMember.customer?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Loan Account:</span>
                <span className="font-mono text-stone-800 font-bold">{partialMember.loanNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">Installment:</span>
                <span className="font-bold text-amber-950">Week {partialMember.installmentNumber}</span>
              </div>
              <div className="flex justify-between border-t border-[#ded3be] pt-1.5">
                <span className="text-stone-700 font-bold">Total Installment Due:</span>
                <span className="font-black text-amber-950 text-sm">₹{partialMember.expectedAmount}</span>
              </div>
            </div>

            <form onSubmit={handlePartialSubmit} className="space-y-4 text-xs">
              {/* Amount Input */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  Amount Received (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="Enter received amount..."
                  className="w-full px-3 py-2.5 bg-white border border-[#ded3be] rounded-xl text-lg font-black text-stone-900 focus:outline-none focus:border-amber-600 shadow-xs"
                />

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {[200, 300, 500, partialMember.expectedAmount].filter(Boolean).map((amt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPartialAmount(String(amt))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        String(partialAmount) === String(amt)
                          ? 'bg-[#251b14] text-amber-300 border-amber-800'
                          : 'bg-white border-[#ded3be] text-stone-700 hover:bg-[#faf6ee]'
                      }`}
                    >
                      {amt === partialMember.expectedAmount ? `Full: ₹${amt}` : `₹${amt}`}
                    </button>
                  ))}
                </div>

                {/* Live Balance Calculation */}
                {partialAmount && (
                  <div className="mt-2.5 p-2 bg-[#fbf7f0] rounded-lg border border-[#ece3d4] text-[11px]">
                    {parseFloat(partialAmount) >= partialMember.expectedAmount ? (
                      <span className="text-emerald-800 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Full installment marked as Paid!
                      </span>
                    ) : (
                      <span className="text-amber-900 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Partial payment. Remaining Week Balance: <strong className="text-rose-700 font-bold">₹{Math.max(0, partialMember.expectedAmount - parseFloat(partialAmount))}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-800 focus:outline-none focus:border-amber-600"
                >
                  <option value="CASH">CASH (Field / Hand Collection)</option>
                  <option value="UPI">UPI (Google Pay / PhonePe)</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER (Direct Account)</option>
                </select>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">Collection Notes (Optional)</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Paid in morning / will clear balance tomorrow"
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-800 focus:outline-none focus:border-amber-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setIsPartialModalOpen(false)}
                  className="px-4 py-2 border border-[#ded3be] rounded-xl font-bold text-stone-700 hover:bg-[#faf6ee] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordMutation.isPending}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 rounded-xl font-bold shadow-md shadow-amber-900/20 transition cursor-pointer disabled:opacity-50"
                >
                  {recordMutation.isPending ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};