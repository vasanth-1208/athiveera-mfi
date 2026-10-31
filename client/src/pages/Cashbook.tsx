import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Wallet, 
  ArrowDownRight, 
  ArrowUpRight, 
  Search, 
  Calendar, 
  Coins, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  FileSpreadsheet, 
  Save, 
  ChevronRight, 
  ChevronLeft,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';

type CashbookTab = 'DAILY_LEDGER' | 'DENOMINATIONS';

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const Cashbook: React.FC = () => {
  const { selectedBranchId, selectedBranch } = useBranch();
  const { user, isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<CashbookTab>('DAILY_LEDGER');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [accountType, setAccountType] = useState<'CASH' | 'BANK'>('CASH');
  const [search, setSearch] = useState('');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: 'CREDIT' as 'CREDIT' | 'DEBIT',
    accountType: 'CASH' as 'CASH' | 'BANK',
    category: '',
    amount: '',
    vNo: '',
    description: ''
  });

  // Daily Ledger Query
  const { data: ledgerData, isLoading: isLedgerLoading } = useQuery({
    queryKey: ['dailyLedger', selectedBranchId, selectedDate],
    queryFn: () => api.getDailyLedger({ branchId: selectedBranchId, date: selectedDate }),
    enabled: activeTab === 'DAILY_LEDGER'
  });

  // Denominations Query
  const { data: denomData, isLoading: isDenomLoading } = useQuery({
    queryKey: ['denominations', selectedBranchId, selectedDate],
    queryFn: () => api.getDenominations({ branchId: selectedBranchId, date: selectedDate }),
    enabled: activeTab === 'DENOMINATIONS'
  });

  // Denomination Local Form State
  const [denomForm, setDenomForm] = useState({
    notes500: 116,
    notes200: 63,
    notes100: 94,
    notes50: 11,
    notes20: 0,
    notes10: 0,
    coins: 0,
    sbAcc: 52629,
    caAcc: 0,
    notes: ''
  });

  // Staff List Query (Enabled to discover all active collection staff of branch)
  const { data: staffListData } = useQuery({
    queryKey: ['staffList', selectedBranchId],
    queryFn: () => api.getStaffList({ branchId: selectedBranchId }),
  });
  const staffList = staffListData?.staff || [];

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

  // Compute active collection staff dynamically for this branch
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

    // 3. Fallback defaults if no staff records exist yet
    if (list.length === 0) {
      list.push({ name: 'Vignesh P' });
      list.push({ name: 'Chandra Sekar' });
    }

    return list;
  }, [staffList, denomData]);

  // Populate from fetched denomData
  useEffect(() => {
    if (denomData?.denomination) {
      const d = denomData.denomination;
      setDenomForm({
        notes500: d.notes500 || 0,
        notes200: d.notes200 || 0,
        notes100: d.notes100 || 0,
        notes50: d.notes50 || 0,
        notes20: d.notes20 || 0,
        notes10: d.notes10 || 0,
        coins: d.coins || 0,
        sbAcc: d.sbAcc || 0,
        caAcc: d.caAcc || 0,
        notes: d.notes || ''
      });

      if (d.staffDenominations && d.staffDenominations.length > 0) {
        const nextForms: Record<string, StaffDenomForm> = {};
        d.staffDenominations.forEach((s: any) => {
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
    }
  }, [denomData, activeStaffList]);

  const handleUpdateStaffField = (staffKey: string, field: keyof StaffDenomForm, value: number) => {
    setStaffDenomForms(prev => ({
      ...prev,
      [staffKey]: {
        ...(prev[staffKey] || emptyStaffForm),
        [field]: value
      }
    }));
  };

  // Denomination Save Mutation
  const saveDenomMutation = useMutation({
    mutationFn: (payload: any) => api.saveDenominations(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['denominations'] });
      queryClient.invalidateQueries({ queryKey: ['dailyLedger'] });
      alert('Denomination tally successfully saved.');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to save denominations');
    }
  });

  // Calculate live Vault Physical Cash & Bank
  const physicalCashCounted = 
    (denomForm.notes500 * 500) +
    (denomForm.notes200 * 200) +
    (denomForm.notes100 * 100) +
    (denomForm.notes50 * 50) +
    (denomForm.notes20 * 20) +
    (denomForm.notes10 * 10) +
    denomForm.coins;

  const totalVaultCounted = physicalCashCounted + denomForm.sbAcc + denomForm.caAcc;
  const currentSystemCash = ledgerData?.closingBalance ?? (denomData?.currentSystemBalance ?? 133179);
  const variance = totalVaultCounted - currentSystemCash;
  const isTallied = Math.abs(variance) < 1;

  const handleSaveDenominations = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    saveDenomMutation.mutate({
      branchId: selectedBranchId,
      date: selectedDate,
      ...denomForm,
      staffDenominations: activeStaffList.map((s: any) => {
        const key = s.name.toUpperCase().trim();
        const form = staffDenomForms[key] || emptyStaffForm;
        return {
          staffName: s.name,
          ...form,
          total: calcStaffTotal(form)
        };
      })
    });
  };

  // Journal Entry Mutation
  const entryMutation = useMutation({
    mutationFn: (newTx: any) => api.createCashbookEntry(newTx),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashbook'] });
      queryClient.invalidateQueries({ queryKey: ['dailyLedger'] });
      setIsEntryModalOpen(false);
      setFormData({
        type: 'CREDIT',
        accountType: 'CASH',
        category: '',
        amount: '',
        vNo: '',
        description: ''
      });
    }
  });

  const handleEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category || !formData.amount) return;
    entryMutation.mutate({
      ...formData,
      amount: parseFloat(formData.amount),
      branchId: selectedBranchId
    });
  };

  // Date stepper
  const handleShiftDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d + days);
    const newY = dateObj.getFullYear();
    const newM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const newD = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${newY}-${newM}-${newD}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">
            Cashbook & General Ledger
          </h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Double-entry financial journal tracking physical vault cash, collections, loan disbursements, and bank transactions
          </p>
        </div>

        {/* Global Action / Date / New Journal Entry */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Selector */}
          <div className="flex items-center bg-[#fffdfa] border border-[#ded3be] rounded-2xl p-1 shadow-xs">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-[#faf6ee] rounded-xl transition cursor-pointer"
              title="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2">
              <Calendar className="w-3.5 h-3.5 text-amber-700" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-stone-900 focus:outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={() => handleShiftDate(1)}
              className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-[#faf6ee] rounded-xl transition cursor-pointer"
              title="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* New Journal Entry Button */}
          <button
            onClick={() => setIsEntryModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-stone-950 rounded-xl text-xs font-bold shadow-md shadow-amber-900/20 hover:from-amber-500 hover:to-yellow-500 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Journal Entry</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#ece3d4]">
        <button
          onClick={() => setActiveTab('DAILY_LEDGER')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'DAILY_LEDGER'
              ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
              : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-amber-500" />
          <span>Daily Ledger Cashbook (Double-Entry)</span>
        </button>

        <button
          onClick={() => setActiveTab('DENOMINATIONS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'DENOMINATIONS'
              ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
              : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
          }`}
        >
          <Coins className="w-4 h-4 text-amber-500" />
          <span>Denomination Counter & Tally</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. DAILY DOUBLE-ENTRY CASHBOOK LEDGER VIEW               */}
      {/* ======================================================== */}
      {activeTab === 'DAILY_LEDGER' && (
        <div className="space-y-6">
          {/* Daily KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Opening Balance</p>
              <p className="text-xl font-black text-stone-900 mt-0.5">
                ₹{(ledgerData?.openingBalance || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-stone-500 font-medium">Brought forward from previous day</span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Inflows (Credits)</p>
              <p className="text-xl font-black text-emerald-700 mt-0.5">
                ₹{(ledgerData?.summary?.totalCredits || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-emerald-800 font-semibold">Collections & receipts</span>
            </div>

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Total Outflows (Debits)</p>
              <p className="text-xl font-black text-rose-700 mt-0.5">
                ₹{(ledgerData?.summary?.totalDebits || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-rose-800 font-semibold">Disbursements & expenses</span>
            </div>

            <div className="bg-[#fffdfa] dark:bg-[#23160e] p-4 rounded-2xl border border-[#ded3be] dark:border-[#442a1b] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 dark:text-stone-300 uppercase tracking-wider">Closing Cash Balance</p>
              <p className="text-xl font-black text-amber-950 dark:text-white mt-0.5">
                ₹{(ledgerData?.closingBalance || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-amber-800 dark:text-stone-300 font-semibold">Physical vault cash in safe</span>
            </div>
          </div>

          {/* Double Entry Side-by-Side Table (Receipts vs Payments) */}
          <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-amber-800" />
                <h3 className="text-sm font-black text-stone-900">
                  Daily Cashbook Statement — {selectedDate} ({ledgerData?.branchName || selectedBranch?.name || 'Pollachi Branch'})
                </h3>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${
                ledgerData?.summary?.isTallied
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}>
                {ledgerData?.summary?.isTallied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Double-Entry Balanced (₹{(ledgerData?.summary?.totalReceiptsSide || 0).toLocaleString('en-IN')})</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Unbalanced Variance</span>
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#ded3be]">
              {/* Receipts / Credits (Inflows) */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#ece3d4] pb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                    <span>Receipts / Credits (Inflows)</span>
                  </h4>
                  <span className="text-xs font-bold text-stone-500">Amount (₹)</span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Opening Balance Row */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcf9f2] dark:bg-[#2c1c12] border border-[#ece3d4] dark:border-[#442a1b]">
                    <div>
                      <span className="font-bold text-stone-900 dark:text-white block">OPENING BALANCE</span>
                      <span className="text-[10px] text-stone-500 dark:text-stone-300 font-medium">Brought forward cash in safe</span>
                    </div>
                    <span className="font-black text-stone-900 dark:text-white text-sm">
                      ₹{(ledgerData?.openingBalance || 0).toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Individual Inflow Entries */}
                  {ledgerData?.credits?.length > 0 ? (
                    ledgerData.credits.map((cr: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#ece3d4] hover:bg-[#faf6ee] transition">
                        <div>
                          <span className="font-bold text-stone-900 block uppercase">{cr.particulars}</span>
                          <span className="text-[10px] text-stone-500 font-medium">{cr.details || cr.category}</span>
                        </div>
                        <span className="font-black text-emerald-700 text-sm">
                          ₹{cr.amount?.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-stone-400 font-medium">
                      No additional receipts recorded for this date.
                    </div>
                  )}
                </div>

                {/* Subtotal Credits */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#f6f0e4] border border-[#ded3be] font-black text-xs text-amber-950 mt-4">
                  <span>TOTAL RECEIPTS SIDE (Opening + Inflows)</span>
                  <span className="text-sm text-emerald-800">
                    ₹{(ledgerData?.summary?.totalReceiptsSide || (ledgerData?.openingBalance + ledgerData?.summary?.totalCredits) || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Payments / Debits (Outflows) */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#ece3d4] pb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-rose-600" />
                    <span>Payments / Debits (Outflows)</span>
                  </h4>
                  <span className="text-xs font-bold text-stone-500">Amount (₹)</span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Individual Outflow Entries */}
                  {ledgerData?.debits?.length > 0 ? (
                    ledgerData.debits.map((db: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#ece3d4] hover:bg-[#faf6ee] transition">
                        <div>
                          <span className="font-bold text-stone-900 block uppercase">{db.particulars}</span>
                          <span className="text-[10px] text-stone-500 font-medium">{db.details || db.category}</span>
                        </div>
                        <span className="font-black text-rose-700 text-sm">
                          ₹{db.amount?.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-stone-400 font-medium">
                      No debits or disbursements recorded on this date.
                    </div>
                  )}

                  {/* Closing Balance Row */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcf9f2] dark:bg-[#2c1c12] border border-[#ece3d4] dark:border-[#442a1b]">
                    <div>
                      <span className="font-bold text-amber-950 dark:text-white block">CLOSING BALANCE</span>
                      <span className="text-[10px] text-stone-500 dark:text-stone-300 font-medium">Physical cash in office vault / safe</span>
                    </div>
                    <span className="font-black text-amber-950 dark:text-white text-sm">
                      ₹{(ledgerData?.closingBalance || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Subtotal Debits */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#f6f0e4] border border-[#ded3be] font-black text-xs text-amber-950 mt-4">
                  <span>TOTAL PAYMENTS SIDE (Outflows + Closing)</span>
                  <span className="text-sm text-stone-900">
                    ₹{(ledgerData?.summary?.totalPaymentsSide || (ledgerData?.summary?.totalDebits + ledgerData?.closingBalance) || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. DENOMINATION COUNTER & TALLY VIEW                      */}
      {/* ======================================================== */}
      {activeTab === 'DENOMINATIONS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Interactive Denomination Entry Table */}
            <div className="lg:col-span-2 bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
              <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-800" />
                    <span>Physical Vault Cash Denominations (Daily Tally)</span>
                  </h3>
                  <p className="text-[10px] text-stone-500 font-medium">
                    Count notes and coins in the physical vault and tally with the system ledger balance
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveDenominations}
                  disabled={saveDenomMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#251b14] text-amber-300 font-bold rounded-xl text-xs hover:bg-[#322319] transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saveDenomMutation.isPending ? 'Saving...' : 'Save Tally'}</span>
                </button>
              </div>

              <div className="p-5 space-y-4">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#fcf9f2] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ece3d4]">
                    <tr>
                      <th className="px-4 py-2.5">Currency Note / Coin</th>
                      <th className="px-4 py-2.5 w-32 text-center">Count / Quantity</th>
                      <th className="px-4 py-2.5 text-right">Subtotal (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ece3d4]">
                    {/* 500 */}
                    <tr className="hover:bg-[#faf6ee] transition">
                      <td className="px-4 py-3 font-bold text-stone-900">₹500 Notes</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={denomForm.notes500 === 0 ? '' : denomForm.notes500}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setDenomForm(prev => ({ ...prev, notes500: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-24 px-2.5 py-1 text-center font-bold text-stone-900 bg-white border border-[#ded3be] rounded-lg focus:outline-none focus:border-amber-600 shadow-2xs"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-black text-stone-900">
                        ₹{(denomForm.notes500 * 500).toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* 200 */}
                    <tr className="hover:bg-[#faf6ee] transition">
                      <td className="px-4 py-3 font-bold text-stone-900">₹200 Notes</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={denomForm.notes200 === 0 ? '' : denomForm.notes200}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setDenomForm(prev => ({ ...prev, notes200: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-24 px-2.5 py-1 text-center font-bold text-stone-900 bg-white border border-[#ded3be] rounded-lg focus:outline-none focus:border-amber-600 shadow-2xs"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-black text-stone-900">
                        ₹{(denomForm.notes200 * 200).toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* 100 */}
                    <tr className="hover:bg-[#faf6ee] transition">
                      <td className="px-4 py-3 font-bold text-stone-900">₹100 Notes</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={denomForm.notes100 === 0 ? '' : denomForm.notes100}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setDenomForm(prev => ({ ...prev, notes100: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-24 px-2.5 py-1 text-center font-bold text-stone-900 bg-white border border-[#ded3be] rounded-lg focus:outline-none focus:border-amber-600 shadow-2xs"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-black text-stone-900">
                        ₹{(denomForm.notes100 * 100).toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* 50 */}
                    <tr className="hover:bg-[#faf6ee] transition">
                      <td className="px-4 py-3 font-bold text-stone-900">₹50 Notes</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={denomForm.notes50 === 0 ? '' : denomForm.notes50}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setDenomForm(prev => ({ ...prev, notes50: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-24 px-2.5 py-1 text-center font-bold text-stone-900 bg-white border border-[#ded3be] rounded-lg focus:outline-none focus:border-amber-600 shadow-2xs"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-black text-stone-900">
                        ₹{(denomForm.notes50 * 50).toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* 20 */}
                    <tr className="hover:bg-[#faf6ee] transition">
                      <td className="px-4 py-3 font-bold text-stone-900">₹20 Notes</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={denomForm.notes20 === 0 ? '' : denomForm.notes20}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setDenomForm(prev => ({ ...prev, notes20: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-24 px-2.5 py-1 text-center font-bold text-stone-900 bg-white border border-[#ded3be] rounded-lg focus:outline-none focus:border-amber-600 shadow-2xs"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-black text-stone-900">
                        ₹{(denomForm.notes20 * 20).toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* 10 */}
                    <tr className="hover:bg-[#faf6ee] transition">
                      <td className="px-4 py-3 font-bold text-stone-900">₹10 Notes</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={denomForm.notes10 === 0 ? '' : denomForm.notes10}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setDenomForm(prev => ({ ...prev, notes10: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-24 px-2.5 py-1 text-center font-bold text-stone-900 bg-white border border-[#ded3be] rounded-lg focus:outline-none focus:border-amber-600 shadow-2xs"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-black text-stone-900">
                        ₹{(denomForm.notes10 * 10).toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* Coins */}
                    <tr className="hover:bg-[#faf6ee] transition">
                      <td className="px-4 py-3 font-bold text-stone-900">Coins (Total)</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={denomForm.coins === 0 ? '' : denomForm.coins}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setDenomForm(prev => ({ ...prev, coins: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-24 px-2.5 py-1 text-center font-bold text-stone-900 bg-white border border-[#ded3be] rounded-lg focus:outline-none focus:border-amber-600 shadow-2xs"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-black text-stone-900">
                        ₹{denomForm.coins.toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* Subtotal Physical Vault Cash */}
                    <tr className="bg-[#f6f0e4] font-black text-amber-950">
                      <td colSpan={2} className="px-4 py-3">SUBTOTAL: PHYSICAL VAULT CASH</td>
                      <td className="px-4 py-3 text-right text-sm">
                        ₹{physicalCashCounted.toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* SB Acc */}
                    <tr className="hover:bg-[#faf6ee] transition">
                      <td className="px-4 py-3 font-bold text-blue-900">SB Acc (Bank Savings Receipts)</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={denomForm.sbAcc === 0 ? '' : denomForm.sbAcc}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setDenomForm(prev => ({ ...prev, sbAcc: v === '' ? 0 : (parseFloat(v) || 0) }));
                          }}
                          className="w-24 px-2.5 py-1 text-center font-bold text-stone-900 bg-white border border-[#ded3be] rounded-lg focus:outline-none focus:border-amber-600 shadow-2xs"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-black text-blue-900">
                        ₹{denomForm.sbAcc.toLocaleString('en-IN')}
                      </td>
                    </tr>

                    {/* CA Acc */}
                    <tr className="hover:bg-[#faf6ee] transition">
                      <td className="px-4 py-3 font-bold text-blue-900">CA Acc (Current Account Cash Balance)</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={denomForm.caAcc === 0 ? '' : denomForm.caAcc}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setDenomForm(prev => ({ ...prev, caAcc: v === '' ? 0 : (parseFloat(v) || 0) }));
                          }}
                          className="w-24 px-2.5 py-1 text-center font-bold text-stone-900 bg-white border border-[#ded3be] rounded-lg focus:outline-none focus:border-amber-600 shadow-2xs"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-black text-blue-900">
                        ₹{denomForm.caAcc.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right 1 Col: Live Tally & Verification Card */}
            <div className="space-y-4">
              <div className="bg-[#fffdfa] p-5 rounded-2xl border border-[#ded3be] shadow-xs space-y-4">
                <h3 className="text-sm font-black text-stone-900">Tally Verification</h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcf9f2] border border-[#ece3d4]">
                    <span className="font-semibold text-stone-600">Physical Vault Cash</span>
                    <strong className="font-black text-stone-900">₹{physicalCashCounted.toLocaleString('en-IN')}</strong>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcf9f2] border border-[#ece3d4]">
                    <span className="font-semibold text-stone-600">Bank Accounts (SB + CA)</span>
                    <strong className="font-black text-blue-900">₹{(denomForm.sbAcc + denomForm.caAcc).toLocaleString('en-IN')}</strong>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f6f0e4] border border-[#ded3be]">
                    <span className="font-bold text-stone-900">Total Counted Cash & Accounts</span>
                    <strong className="font-black text-stone-900 text-sm">₹{totalVaultCounted.toLocaleString('en-IN')}</strong>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f6f0e4] border border-[#ded3be]">
                    <span className="font-bold text-amber-950">System Ledger Cash Balance</span>
                    <strong className="font-black text-amber-950 text-sm">₹{currentSystemCash.toLocaleString('en-IN')}</strong>
                  </div>
                </div>

                {/* Tally Status Banner */}
                <div className={`p-4 rounded-xl border text-center space-y-1 ${
                  isTallied 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}>
                  <div className="flex items-center justify-center gap-1.5 font-black text-sm">
                    {isTallied ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>TALLIED (0 Variance)</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>VARIANCE: ₹{Math.abs(variance).toLocaleString('en-IN')}</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] font-medium opacity-90">
                    {isTallied 
                      ? 'Counted cash and bank accounts perfectly match the canonical ledger balance.'
                      : variance > 0 
                        ? `Counted physical cash is ₹${variance.toLocaleString('en-IN')} higher than system balance.`
                        : `Counted physical cash is ₹${Math.abs(variance).toLocaleString('en-IN')} lower than system balance.`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveDenominations}
                  disabled={saveDenomMutation.isPending}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 rounded-xl text-xs font-black shadow-md shadow-amber-900/20 transition cursor-pointer disabled:opacity-50"
                >
                  {saveDenomMutation.isPending ? 'Saving...' : 'Save & Certify Daily Denomination'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Manual Entry Modal */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#fffdfa] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#ded3be] space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[#ece3d4] pb-3">
              <h3 className="text-lg font-black text-stone-900">Record Journal Entry</h3>
              <button
                onClick={() => setIsEntryModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEntrySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Transaction Type *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'CREDIT' })}
                    className={`py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                      formData.type === 'CREDIT'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-[#f6f0e4] text-stone-700 border border-[#ded3be]'
                    }`}
                  >
                    Credit (Receipt / Inflow)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'DEBIT' })}
                    className={`py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                      formData.type === 'DEBIT'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-[#f6f0e4] text-stone-700 border border-[#ded3be]'
                    }`}
                  >
                    Debit (Payment / Outflow)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Category *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OFFICE EXPENSES, PETROL, RENT, POOJA"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-semibold text-stone-900 focus:outline-none focus:border-amber-600 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-sm font-black text-stone-900 focus:outline-none focus:border-amber-600 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Voucher / Reference No.
                </label>
                <input
                  type="text"
                  placeholder="Optional V.No"
                  value={formData.vNo}
                  onChange={(e) => setFormData({ ...formData, vNo: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-semibold text-stone-900 focus:outline-none focus:border-amber-600 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Particulars / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Purpose or notes..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:border-amber-600 shadow-2xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#ece3d4]">
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="px-4 py-2 bg-[#f6f0e4] hover:bg-[#ede3d0] text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={entryMutation.isPending}
                  className="px-4 py-2 bg-[#251b14] hover:bg-[#322319] text-amber-300 rounded-xl text-xs font-black shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {entryMutation.isPending ? 'Recording...' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
