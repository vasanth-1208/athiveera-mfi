import React, { useState, useEffect, useMemo } from 'react';
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
  Wallet, 
  Save, 
  X
} from 'lucide-react';
import { api } from '../services/api';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const getTodayWeekday = (): string => {
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const todayName = dayNames[new Date().getDay()];
  if (DAYS.includes(todayName)) {
    return todayName;
  }
  return 'MONDAY';
};

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const Collections: React.FC = () => {
  const { selectedBranchId } = useBranch();
  const { user, isAdmin, isManager } = useAuth();
  const isManagerOrAdmin = isAdmin || isManager;
  const queryClient = useQueryClient();

  const todayWeekday = getTodayWeekday();
  const [selectedDay, setSelectedDay] = useState<string>(todayWeekday);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [payingLoanId, setPayingLoanId] = useState<string | null>(null);
  const [payingGroupId, setPayingGroupId] = useState<string | null>(null);
  const [showCompletedGroups, setShowCompletedGroups] = useState<boolean>(false);

  // Optimistic tracking for instant zero-latency updates without waiting for server refetch
  const [optimisticPaidLoans, setOptimisticPaidLoans] = useState<Record<string, { amount: number; time: number }>>({});

  // Partial Collection Modal State
  const [isPartialModalOpen, setIsPartialModalOpen] = useState(false);
  const [partialMember, setPartialMember] = useState<any | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [remarks, setRemarks] = useState('');

  const isCollectionStaff = user?.role === 'COLLECTION_STAFF';

  // Staff Denominations Handover Modal State
  const [isStaffDenomModalOpen, setIsStaffDenomModalOpen] = useState(false);
  const [modalStaffTab, setModalStaffTab] = useState<string>('ALL');
  const [denomDate, setDenomDate] = useState<string>(getTodayDateString());

  // Staff List Query (Enabled for all roles to discover branch collection staff)
  const { data: staffListData } = useQuery({
    queryKey: ['staffList', selectedBranchId],
    queryFn: () => api.getStaffList({ branchId: selectedBranchId }),
  });
  const staffList = staffListData?.staff || [];

  // Denominations Query for Handover Modal (syncs with denomDate / selectedDate)
  const { data: denomData } = useQuery({
    queryKey: ['denominations', selectedBranchId, denomDate],
    queryFn: () => api.getDenominations({ branchId: selectedBranchId, date: denomDate }),
    enabled: isStaffDenomModalOpen
  });

  // Dynamic Staff Handover Form State: Map of staffKey (uppercase trimmed name) -> counts
  interface StaffDenomForm {
    notes500: number;
    notes200: number;
    notes100: number;
    notes50: number;
    notes20: number;
    notes10: number;
    coins: number;
    sbAcc: number;
    caAcc: number;
  }

  const emptyStaffForm: StaffDenomForm = {
    notes500: 0,
    notes200: 0,
    notes100: 0,
    notes50: 0,
    notes20: 0,
    notes10: 0,
    coins: 0,
    sbAcc: 0,
    caAcc: 0
  };

  const calcStaffTotal = (form?: StaffDenomForm) => {
    if (!form) return 0;
    return (
      (form.notes500 * 500) +
      (form.notes200 * 200) +
      (form.notes100 * 100) +
      (form.notes50 * 50) +
      (form.notes20 * 20) +
      (form.notes10 * 10) +
      (form.coins || 0) +
      (form.sbAcc || 0) +
      (form.caAcc || 0)
    );
  };

  const [staffDenomForms, setStaffDenomForms] = useState<Record<string, StaffDenomForm>>({});

  // Helper to match staff names without creating duplicate entries
  const findStaffMatch = (rawName: string, candidates: Array<{ id?: string; name: string }>) => {
    const rawClean = (rawName || '').toUpperCase().trim();
    if (!rawClean) return null;
    return candidates.find(candidate => {
      const cClean = candidate.name.toUpperCase().trim();
      if (cClean === rawClean) return true;
      const cParts = cClean.split(/\s+/);
      const rParts = rawClean.split(/\s+/);
      if (cParts.some(p => p === rawClean) || rParts.some(p => p === cClean)) return true;
      if (cClean.includes(rawClean) || rawClean.includes(cClean)) return true;
      return false;
    });
  };

  // Compute active collection staff dynamically for this branch without duplicates
  const activeStaffList = useMemo(() => {
    const list: Array<{ id?: string; name: string }> = [];

    // 1. Staff from branch user database (source of truth)
    staffList.forEach((s: any) => {
      if (s.name && !list.some(item => item.name.toUpperCase().trim() === s.name.toUpperCase().trim())) {
        list.push({ id: s._id, name: s.name });
      }
    });

    // 2. Staff from saved denomination records if any (only add if not matched to existing staff!)
    if (denomData?.denomination?.staffDenominations) {
      denomData.denomination.staffDenominations.forEach((s: any) => {
        if (s.staffName) {
          const match = findStaffMatch(s.staffName, list);
          if (!match) {
            list.push({ name: s.staffName });
          }
        }
      });
    }

    // 3. Logged-in collection staff if not in list
    if (isCollectionStaff && user?.name) {
      const match = findStaffMatch(user.name, list);
      if (!match) {
        list.push({ id: user.id || user._id, name: user.name });
      }
    }

    // 4. Fallback defaults if no staff records exist yet
    if (list.length === 0) {
      list.push({ name: 'Vignesh P' });
      list.push({ name: 'Chandra Sekar' });
    }

    return list;
  }, [staffList, denomData, isCollectionStaff, user]);

  // Populate dynamic forms from fetched denomination records
  useEffect(() => {
    if (denomData?.denomination?.staffDenominations && denomData.denomination.staffDenominations.length > 0) {
      const nextForms: Record<string, StaffDenomForm> = {};
      denomData.denomination.staffDenominations.forEach((s: any) => {
        const match = findStaffMatch(s.staffName, activeStaffList);
        const targetKey = match ? match.name.toUpperCase().trim() : s.staffName?.toUpperCase().trim();
        if (targetKey) {
          const hasVals = (s.notes500 || s.notes200 || s.notes100 || s.notes50 || s.notes20 || s.notes10 || s.sbAcc || s.caAcc);
          const existing = nextForms[targetKey];
          if (!existing || hasVals) {
            nextForms[targetKey] = {
              notes500: s.notes500 || 0,
              notes200: s.notes200 || 0,
              notes100: s.notes100 || 0,
              notes50: s.notes50 || 0,
              notes20: s.notes20 || 0,
              notes10: s.notes10 || 0,
              coins: s.coins || 0,
              sbAcc: s.sbAcc || 0,
              caAcc: s.caAcc || 0
            };
          }
        }
      });
      setStaffDenomForms(prev => ({ ...prev, ...nextForms }));
    }
  }, [denomData, activeStaffList]);

  const handleOpenStaffDenomModal = () => {
    if (isCollectionStaff) {
      const myStaffObj = activeStaffList.find((s: any) => 
        s.name.toUpperCase().trim() === user?.name?.toUpperCase().trim() ||
        (user?.name && s.name.toUpperCase().includes(user.name.toUpperCase().trim())) ||
        (s.id && (s.id === user?.id || s.id === user?._id))
      );
      setModalStaffTab(myStaffObj?.name?.toUpperCase().trim() || activeStaffList[0]?.name?.toUpperCase().trim() || 'ALL');
    } else if (selectedStaffId !== 'ALL') {
      const selectedStaffObj = staffList.find((s: any) => s._id === selectedStaffId);
      const stKey = selectedStaffObj?.name?.toUpperCase().trim();
      if (stKey && activeStaffList.some((s: any) => s.name.toUpperCase().trim() === stKey)) {
        setModalStaffTab(stKey);
      } else {
        setModalStaffTab('ALL');
      }
    } else {
      setModalStaffTab('ALL');
    }
    setDenomDate(selectedDate);
    setIsStaffDenomModalOpen(true);
  };

  const handleUpdateStaffField = (staffKey: string, field: keyof StaffDenomForm, value: number) => {
    setStaffDenomForms(prev => ({
      ...prev,
      [staffKey]: {
        ...(prev[staffKey] || emptyStaffForm),
        [field]: value
      }
    }));
  };

  const grandCombinedTotal = useMemo(() => {
    return activeStaffList.reduce((sum: number, s: any) => {
      const key = s.name.toUpperCase().trim();
      return sum + calcStaffTotal(staffDenomForms[key]);
    }, 0);
  }, [activeStaffList, staffDenomForms]);

  const saveDenomMutation = useMutation({
    mutationFn: (payload: any) => api.saveDenominations(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['denominations'] });
      queryClient.invalidateQueries({ queryKey: ['dailyLedger'] });
      queryClient.invalidateQueries({ queryKey: ['dailySheet'] });
      queryClient.invalidateQueries({ queryKey: ['weeklySheet'] });
      alert('Staff denomination handover tally successfully saved.');
      setIsStaffDenomModalOpen(false);
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to save staff denominations');
    }
  });

  const handleSaveStaffDenominations = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let payloadStaffDenoms: any[] = [];
    if (modalStaffTab !== 'ALL') {
      const targetStaff = activeStaffList.find((s: any) => s.name.toUpperCase().trim() === modalStaffTab);
      const form = staffDenomForms[modalStaffTab] || emptyStaffForm;
      payloadStaffDenoms = [{
        staffName: targetStaff?.name || modalStaffTab,
        ...form,
        total: calcStaffTotal(form)
      }];
    } else {
      payloadStaffDenoms = activeStaffList.map((s: any) => {
        const key = s.name.toUpperCase().trim();
        const form = staffDenomForms[key] || emptyStaffForm;
        return {
          staffName: s.name,
          ...form,
          total: calcStaffTotal(form)
        };
      });
    }

    saveDenomMutation.mutate({
      branchId: selectedBranchId,
      date: denomDate,
      staffDenominations: payloadStaffDenoms
    });
  };

  // Daily Sheet Query (dynamically filtered by selected staff and selected date)
  const { data: dailySheetData, isLoading: isDailyLoading } = useQuery({
    queryKey: ['dailySheet', selectedBranchId, selectedDay, selectedStaffId, selectedDate],
    queryFn: () => api.getDailySheet({ 
      branchId: selectedBranchId, 
      weekday: selectedDay,
      staffId: selectedStaffId !== 'ALL' ? selectedStaffId : undefined,
      date: selectedDate
    }),
    enabled: selectedDay !== 'WEEKLY'
  });

  // Weekly Sheet Query (Manager & Admin - dynamically filtered by selected staff and selected date)
  const { data: weeklySheetData, isLoading: isWeeklyLoading } = useQuery({
    queryKey: ['weeklySheet', selectedBranchId, selectedStaffId, selectedDate],
    queryFn: () => api.getWeeklySheet({ 
      branchId: selectedBranchId,
      staffId: selectedStaffId !== 'ALL' ? selectedStaffId : undefined,
      date: selectedDate
    }),
    enabled: isManagerOrAdmin
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
      queryClient.invalidateQueries({ queryKey: ['dailyLedger'] });
      queryClient.invalidateQueries({ queryKey: ['cashbook'] });
      queryClient.invalidateQueries({ queryKey: ['denominations'] });
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
      queryClient.invalidateQueries({ queryKey: ['dailyLedger'] });
      queryClient.invalidateQueries({ queryKey: ['cashbook'] });
      queryClient.invalidateQueries({ queryKey: ['denominations'] });
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

  // Remaining to be collected for this week's due
  const totalRouteRemaining = isWeekly
    ? (weeklySheetData?.weeklySummary?.weeklyRemaining ?? Math.max(0, totalRouteExpected - totalRouteCollected))
    : Math.max(0, totalRouteExpected - totalRouteCollected);

  const totalRouteMembers = isWeekly
    ? (weeklySheetData?.weeklySummary?.totalMembers || 0)
    : rawGroups.reduce((sum: number, g: any) => sum + (g.members?.length || 0), 0);

  const totalRouteGroups = isWeekly
    ? (weeklySheetData?.weeklySummary?.totalGroups || 0)
    : rawGroups.length;

  const weeklyDays = weeklySheetData?.days || {};

  return (
    <div className="space-y-6">
      {/* Header: Title and Quick Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">
            Daily Collections & Route Register
          </h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Organized by collection weekday and consolidated weekly routes. Mark installments as Paid or record partial amounts.
          </p>
        </div>

        {/* Action Buttons: Date Selector, Staff Denominations & Settled Groups Toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Selector for Viewing Collections & Denominations for a Specific Date */}
          <div className="flex items-center bg-white border border-[#ded3be] rounded-xl px-3 py-1.5 shadow-xs gap-2">
            <Calendar className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="text-[10px] font-black uppercase text-stone-500 hidden sm:inline">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                const newDate = e.target.value;
                if (!newDate) return;
                setSelectedDate(newDate);
                setDenomDate(newDate);
                const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                const parts = newDate.split('-');
                const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                const correspondingDay = dayNames[dateObj.getDay()];
                if (selectedDay !== 'WEEKLY') {
                  setSelectedDay(correspondingDay);
                }
              }}
              className="text-xs font-bold text-stone-800 bg-transparent focus:outline-none cursor-pointer"
            />
            {selectedDate !== getTodayDateString() && (
              <button
                type="button"
                onClick={() => {
                  const today = getTodayDateString();
                  setSelectedDate(today);
                  setDenomDate(today);
                  if (selectedDay !== 'WEEKLY') {
                    setSelectedDay(todayWeekday);
                  }
                }}
                className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-black cursor-pointer transition"
                title="Reset to today's date"
              >
                Today
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenStaffDenomModal}
            className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs border bg-white text-stone-800 border-[#ded3be] hover:bg-[#faf6ee]"
            title="Open staff field collection denominations handover dialog"
          >
            <Wallet className="w-4 h-4 text-amber-700" />
            <span>{isCollectionStaff ? 'My Handover Denominations' : 'Staff Denominations'}</span>
          </button>

          {/* Settled Groups Toggle Button */}
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
            <span className="sm:hidden">Settled</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              showCompletedGroups ? 'bg-amber-400 text-stone-950' : 'bg-[#ece3d4] text-stone-700'
            }`}>
              {totalCompletedGroups}
            </span>
          </button>
        </div>
      </div>

      {/* Route & Officer Selection Bar */}
      <div className="flex flex-col gap-3">
        {/* Officer Switcher (Manager & Admin only: All Officers vs specific field collector) */}
        {isManagerOrAdmin && staffList.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap bg-[#fdfbf7] p-2 rounded-2xl border border-[#ded3be]">
            <span className="text-xs font-bold text-stone-600 flex items-center gap-1.5 pl-1 shrink-0">
              <Users className="w-4 h-4 text-amber-700" />
              Officer View:
            </span>
            <div className="flex items-center bg-[#ece3d4] p-1 rounded-xl border border-[#ded3be] shadow-xs flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setSelectedStaffId('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedStaffId === 'ALL'
                    ? 'bg-[#251b14] text-amber-300 shadow-xs'
                    : 'text-stone-700 hover:text-stone-900'
                }`}
              >
                All Officers
              </button>
              {staffList.map((st: any) => (
                <button
                  key={st._id}
                  type="button"
                  onClick={() => setSelectedStaffId(st._id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedStaffId === st._id
                      ? 'bg-[#251b14] text-amber-300 shadow-xs'
                      : 'text-stone-700 hover:text-stone-900'
                  }`}
                >
                  {st.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Route Tabs Bar (Dedicated horizontal scrollable bar with shrink-0 buttons) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 max-w-full">
          {/* Weekly View Button for Manager and Admin */}
          {isManagerOrAdmin && (
            <button
              onClick={() => setSelectedDay('WEEKLY')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
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
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 ${
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

        {/* Search Bar Row (Cleanly placed below route tabs - NEVER overlays Sunday) */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
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
                Today marked as paid
              </span>
            </div>
            <div className="bg-[#fffdfa] p-3.5 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Remaining Balance Due</p>
              <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
                <p className="text-xl font-black text-rose-700">
                  ₹{totalRouteRemaining.toLocaleString('en-IN')}
                </p>
                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0" title="Route Collection Efficiency">
                  {totalRouteExpected > 0 
                    ? `${Math.round((totalRouteCollected / totalRouteExpected) * 100)}%`
                    : '100%'}
                </span>
              </div>
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
                const grpRemaining = item.remainingDue !== undefined 
                  ? Math.max(0, item.remainingDue - optAddedToGroup)
                  : Math.max(0, grpExpected - grpCollected);

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
                            [...item.members]
                              .sort((a: any, b: any) => {
                                const aBad = (a.installmentStatus === 'BAD_DEBT' || a.isBadDebt) ? 1 : 0;
                                const bBad = (b.installmentStatus === 'BAD_DEBT' || b.isBadDebt) ? 1 : 0;
                                if (aBad !== bBad) return aBad - bBad;
                                return 0;
                              })
                              .map((m: any) => {
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
                                      <div>
                                        <span className={`font-mono font-bold px-2 py-0.5 rounded-lg border text-xs ${
                                          m.installmentStatus === 'OVERDUE' || (m.overdueWeeks && m.overdueWeeks > 0)
                                            ? 'bg-rose-50 text-rose-900 border-rose-300 font-black'
                                            : 'bg-[#f6f0e4] text-amber-950 border-[#ded3be]'
                                        }`}>
                                          Week {m.installmentNumber} of {m.tenureWeeks || 32}
                                        </span>
                                        {m.overdueWeeks > 1 && (
                                          <span className="text-[10px] text-rose-700 font-bold block mt-1">
                                            {m.overdueWeeks} weeks due up to today
                                          </span>
                                        )}
                                      </div>
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
                                    ) : m.installmentStatus === 'BAD_DEBT' ? (
                                      <div>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-300">
                                          <span>BAD DEBT</span>
                                        </span>
                                        <span className="text-[10px] text-purple-700 font-semibold block mt-0.5">
                                          Uncollectible
                                        </span>
                                      </div>
                                    ) : m.installmentStatus === 'OVERDUE' || (m.overdueWeeks && m.overdueWeeks > 0) ? (
                                      <div>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                          <AlertCircle className="w-3 h-3 text-rose-600" />
                                          <span>OVERDUE {m.overdueWeeks > 1 ? `(${m.overdueWeeks} Weeks)` : '(1 Week)'}</span>
                                        </span>
                                        {isPartial && (
                                          <span className="text-[10px] text-amber-800 font-bold block mt-0.5">
                                            Partial (₹{m.installmentPaid?.toLocaleString('en-IN')} Recd)
                                          </span>
                                        )}
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
                                      m.installmentStatus === 'BAD_DEBT' ? (
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            onClick={() => handleQuickMarkPaid(m)}
                                            disabled={isPayingThis || recordMutation.isPending}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                                            title="Record recovery payment for this bad debt"
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>{isPayingThis ? 'Recording...' : `Recover (₹${(m.expectedAmount || m.installmentExpected || 0).toLocaleString('en-IN')})`}</span>
                                          </button>
                                          <button
                                            onClick={() => handleOpenPartialModal(m)}
                                            disabled={isPayingThis || recordMutation.isPending}
                                            className="px-2.5 py-1.5 bg-[#f6f0e4] hover:bg-[#ede3d0] text-amber-950 font-bold rounded-xl text-xs border border-[#ded3be] transition cursor-pointer disabled:opacity-50"
                                            title="Record recovery payment for this bad debt"
                                          >
                                            Partial
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-end gap-2">
                                          {/* 1-Click Fast Mark Paid Button */}
                                          <button
                                            onClick={() => handleQuickMarkPaid(m)}
                                            disabled={isPayingThis || recordMutation.isPending}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
                                            title="Mark full installment as collected"
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>{isPayingThis ? 'Recording...' : `Mark Paid (₹${m.expectedAmount?.toLocaleString('en-IN')})`}</span>
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
                                      )
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
                <span className="text-stone-700 font-bold">Total Dues Up To Today:</span>
                <span className="font-black text-amber-950 text-sm">₹{partialMember.expectedAmount?.toLocaleString('en-IN')}</span>
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
                  {[partialMember.expectedAmount, partialMember.totalOverdueDue, 500].filter(Boolean).filter((val, i, arr) => arr.indexOf(val) === i).map((amt, idx) => (
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
                      {amt === partialMember.totalOverdueDue && partialMember.overdueWeeks > 1 
                        ? `Full Overdue (${partialMember.overdueWeeks} Wks): ₹${amt}` 
                        : amt === partialMember.expectedAmount 
                          ? `This Week: ₹${amt}` 
                          : `₹${amt}`}
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

      {/* Staff Field Collection Denominations Handover Modal */}
      {isStaffDenomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] dark:bg-[#1a120c] rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-amber-900/40 dark:border-[#442a1b] max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex flex-col gap-3 border-b border-[#ded3be] dark:border-[#382316] pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <span>{isCollectionStaff ? 'My Route Collection Denominations' : 'Staff Field Collection Denominations'}</span>
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-300 font-medium mt-0.5">
                    {isCollectionStaff 
                      ? `Enter currency notes and bank payments collected on your route (${user?.name || ''})`
                      : `Enter currency notes and bank payments collected by field officers (${activeStaffList.map((s: any) => s.name).join(', ')})`}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <input
                    type="date"
                    value={denomDate}
                    onChange={(e) => setDenomDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-white dark:bg-[#2c1c12] border border-[#ded3be] dark:border-[#442a1b] rounded-xl text-xs font-bold text-stone-800 dark:text-stone-100 focus:outline-none focus:border-amber-600 shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={handleSaveStaffDenominations}
                    disabled={saveDenomMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-black rounded-xl text-xs shadow-md shadow-amber-900/20 transition cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saveDenomMutation.isPending ? 'Saving...' : isCollectionStaff ? 'Save My Handover' : 'Save Staff Handover'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsStaffDenomModalOpen(false)}
                    className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-[#f6f0e4] dark:hover:bg-[#2c1c12] rounded-lg transition cursor-pointer"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Staff Switcher inside Modal for Manager / Admin */}
              {!isCollectionStaff && (
                <div className="flex items-center gap-2 pt-1 border-t border-[#ece3d4] dark:border-[#382316] overflow-x-auto pb-1">
                  <span className="text-xs font-bold text-stone-600 dark:text-stone-300 shrink-0">Officer View:</span>
                  <div className="flex items-center gap-1.5 p-1 bg-[#ede3d0]/60 dark:bg-[#2c1c12] rounded-xl">
                    <button
                      type="button"
                      onClick={() => setModalStaffTab('ALL')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                        modalStaffTab === 'ALL'
                          ? 'bg-[#251b14] dark:bg-amber-600 text-amber-300 dark:text-stone-950 shadow-xs'
                          : 'text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                      }`}
                    >
                      All Staff (Consolidated)
                    </button>
                    {activeStaffList.map((s: any) => {
                      const sKey = s.name.toUpperCase().trim();
                      return (
                        <button
                          key={sKey}
                          type="button"
                          onClick={() => setModalStaffTab(sKey)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                            modalStaffTab === sKey
                              ? 'bg-[#251b14] dark:bg-amber-600 text-amber-300 dark:text-stone-950 shadow-xs'
                              : 'text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                          }`}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Staff Denomination Tables */}
            <div className={modalStaffTab === 'ALL' && activeStaffList.length > 1 ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "max-w-md mx-auto w-full"}>
              {(modalStaffTab === 'ALL' ? activeStaffList : activeStaffList.filter((s: any) => s.name.toUpperCase().trim() === modalStaffTab)).map((staffObj: any) => {
                const sKey = staffObj.name.toUpperCase().trim();
                const form = staffDenomForms[sKey] || emptyStaffForm;
                const staffTotal = calcStaffTotal(form);

                return (
                  <div key={sKey} className="bg-white dark:bg-[#23160e] rounded-2xl border border-[#ded3be] dark:border-[#442a1b] shadow-sm overflow-hidden">
                    <div className="p-3 bg-gradient-to-r from-[#2a1c12] via-[#1e140d] to-[#2a1c12] border-b border-amber-900/50 text-center">
                      <h4 className="text-xs font-black text-amber-300 tracking-widest uppercase flex items-center justify-center gap-2">
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        <span>{staffObj.name}</span>
                      </h4>
                    </div>
                    <div className="p-3 bg-[#faf6ee]/50 dark:bg-[#1a110a]">
                      <table className="w-full text-center text-xs font-semibold">
                        <thead className="bg-[#f6f0e4] dark:bg-[#2c1c12] text-amber-950 dark:text-amber-300 border-b border-[#ded3be] dark:border-[#442a1b] text-[11px] font-bold uppercase tracking-wider">
                          <tr>
                            <th className="py-2 px-3 text-left">Denomination</th>
                            <th className="py-2 px-2 text-center">Count</th>
                            <th className="py-2 px-3 text-right">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ece3d4] dark:divide-[#382316]">
                          {[500, 200, 100, 50, 20, 10].map((denom) => {
                            const fieldKey = `notes${denom}` as keyof StaffDenomForm;
                            const countVal = form[fieldKey] || 0;
                            return (
                              <tr key={denom} className="hover:bg-[#f6f0e4]/60 dark:hover:bg-[#2c1c12]/60 transition">
                                <td className="py-2 px-3 text-left">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100/70 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 font-mono font-black text-xs border border-amber-300/50 dark:border-amber-800/50">
                                    ₹{denom}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={countVal === 0 ? '' : countVal}
                                    placeholder="0"
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      handleUpdateStaffField(sKey, fieldKey, v === '' ? 0 : (parseInt(v, 10) || 0));
                                    }}
                                    className="w-18 px-2 py-1 text-center font-bold text-stone-900 dark:text-white bg-white dark:bg-[#2c1c12] border border-stone-300 dark:border-[#442a1b] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition shadow-inner font-mono text-xs"
                                  />
                                </td>
                                <td className="py-2 px-3 text-right font-black font-mono text-stone-900 dark:text-white">
                                  {(countVal * denom).toLocaleString('en-IN')}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="hover:bg-[#f6f0e4]/60 dark:hover:bg-[#2c1c12]/60 transition">
                            <td className="py-2 px-3 text-left">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-300 font-mono font-black text-xs border border-sky-300/50 dark:border-sky-800/50">
                                SB Acc
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                value={form.sbAcc === 0 ? '' : form.sbAcc}
                                placeholder="0"
                                onChange={(e) => {
                                  const v = e.target.value;
                                  handleUpdateStaffField(sKey, 'sbAcc', v === '' ? 0 : (parseFloat(v) || 0));
                                }}
                                className="w-22 px-2 py-1 text-center font-bold text-stone-900 dark:text-white bg-white dark:bg-[#2c1c12] border border-stone-300 dark:border-[#442a1b] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition shadow-inner font-mono text-xs"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-black font-mono text-stone-900 dark:text-white">
                              {form.sbAcc.toLocaleString('en-IN')}
                            </td>
                          </tr>
                          <tr className="hover:bg-[#f6f0e4]/60 dark:hover:bg-[#2c1c12]/60 transition">
                            <td className="py-2 px-3 text-left">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 font-mono font-black text-xs border border-blue-300/50 dark:border-blue-800/50">
                                CA Acc
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                value={form.caAcc === 0 ? '' : form.caAcc}
                                placeholder="0"
                                onChange={(e) => {
                                  const v = e.target.value;
                                  handleUpdateStaffField(sKey, 'caAcc', v === '' ? 0 : (parseFloat(v) || 0));
                                }}
                                className="w-22 px-2 py-1 text-center font-bold text-stone-900 dark:text-white bg-white dark:bg-[#2c1c12] border border-stone-300 dark:border-[#442a1b] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition shadow-inner font-mono text-xs"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-black font-mono text-stone-900 dark:text-white">
                              {form.caAcc.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-amber-600/70 bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 dark:from-amber-950/40 dark:via-amber-900/30 dark:to-amber-950/40 font-black text-xs text-stone-950 dark:text-white">
                            <td colSpan={2} className="py-2.5 px-3 text-center tracking-wider text-amber-950 dark:text-amber-300 font-bold uppercase">
                              TOTAL
                            </td>
                            <td className="py-2.5 px-3 text-right font-black font-mono text-sm text-stone-950 dark:text-amber-300">
                              ₹{staffTotal.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Handover Summary & Modal Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#ded3be] dark:border-[#382316]">
              <div className="text-xs font-bold text-stone-700 dark:text-stone-300">
                {modalStaffTab === 'ALL' ? (
                  <>
                    Combined Staff Handover Total:{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400 text-sm font-black font-mono">
                      ₹{grandCombinedTotal.toLocaleString('en-IN')}
                    </strong>
                  </>
                ) : (
                  <>
                    {activeStaffList.find((s: any) => s.name.toUpperCase().trim() === modalStaffTab)?.name || modalStaffTab} Handover Total:{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400 text-sm font-black font-mono">
                      ₹{(calcStaffTotal(staffDenomForms[modalStaffTab])).toLocaleString('en-IN')}
                    </strong>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsStaffDenomModalOpen(false)}
                  className="px-4 py-2 border border-[#ded3be] dark:border-[#442a1b] rounded-xl text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-[#faf6ee] dark:hover:bg-[#2c1c12] transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveStaffDenominations}
                  disabled={saveDenomMutation.isPending}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 rounded-xl text-xs font-black shadow-md shadow-amber-900/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saveDenomMutation.isPending ? 'Saving...' : isCollectionStaff ? 'Save My Handover' : 'Save Staff Handover'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};