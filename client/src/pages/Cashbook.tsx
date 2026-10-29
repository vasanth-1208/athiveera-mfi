import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  BookOpen, 
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

type CashbookTab = 'DAILY_LEDGER' | 'DENOMINATIONS' | 'STAFF_DENOMINATIONS' | 'JOURNAL';

export const Cashbook: React.FC = () => {
  const { selectedBranchId, selectedBranch } = useBranch();
  const { user, isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<CashbookTab>('DAILY_LEDGER');
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-29');
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
    enabled: activeTab === 'DENOMINATIONS' || activeTab === 'STAFF_DENOMINATIONS'
  });

  // Raw Journal Transactions Query
  const { data: journalData, isLoading: isJournalLoading } = useQuery({
    queryKey: ['cashbook', selectedBranchId, accountType, search],
    queryFn: () => api.getCashbook({
      branchId: selectedBranchId,
      accountType,
      category: search
    }),
    enabled: activeTab === 'JOURNAL'
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

  // Staff Denominations Local Form State (Vignesh & Sekar)
  const [vigneshForm, setVigneshForm] = useState({
    notes500: 39,
    notes200: 12,
    notes100: 15,
    notes50: 2,
    notes20: 0,
    notes10: 0,
    coins: 0,
    sbAcc: 2550,
    caAcc: 0
  });

  const [sekarForm, setSekarForm] = useState({
    notes500: 27,
    notes200: 0,
    notes100: 9,
    notes50: 2,
    notes20: 0,
    notes10: 0,
    coins: 0,
    sbAcc: 1850,
    caAcc: 0
  });

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
        const vig = d.staffDenominations.find((s: any) => s.staffName?.toUpperCase().includes('VIGNESH'));
        if (vig) {
          setVigneshForm({
            notes500: vig.notes500 || 0,
            notes200: vig.notes200 || 0,
            notes100: vig.notes100 || 0,
            notes50: vig.notes50 || 0,
            notes20: vig.notes20 || 0,
            notes10: vig.notes10 || 0,
            coins: vig.coins || 0,
            sbAcc: vig.sbAcc || 0,
            caAcc: vig.caAcc || 0
          });
        }
        const sek = d.staffDenominations.find((s: any) => s.staffName?.toUpperCase().includes('SEKAR'));
        if (sek) {
          setSekarForm({
            notes500: sek.notes500 || 0,
            notes200: sek.notes200 || 0,
            notes100: sek.notes100 || 0,
            notes50: sek.notes50 || 0,
            notes20: sek.notes20 || 0,
            notes10: sek.notes10 || 0,
            coins: sek.coins || 0,
            sbAcc: sek.sbAcc || 0,
            caAcc: sek.caAcc || 0
          });
        }
      }
    }
  }, [denomData]);

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

  // Staff Totals
  const vigneshTotal = 
    (vigneshForm.notes500 * 500) +
    (vigneshForm.notes200 * 200) +
    (vigneshForm.notes100 * 100) +
    (vigneshForm.notes50 * 50) +
    (vigneshForm.notes20 * 20) +
    (vigneshForm.notes10 * 10) +
    vigneshForm.coins +
    vigneshForm.sbAcc +
    vigneshForm.caAcc;

  const sekarTotal = 
    (sekarForm.notes500 * 500) +
    (sekarForm.notes200 * 200) +
    (sekarForm.notes100 * 100) +
    (sekarForm.notes50 * 50) +
    (sekarForm.notes20 * 20) +
    (sekarForm.notes10 * 10) +
    sekarForm.coins +
    sekarForm.sbAcc +
    sekarForm.caAcc;

  const handleSaveDenominations = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    saveDenomMutation.mutate({
      branchId: selectedBranchId,
      date: selectedDate,
      ...denomForm,
      staffDenominations: [
        { staffName: 'VIGNESH', ...vigneshForm, total: vigneshTotal },
        { staffName: 'SEKAR', ...sekarForm, total: sekarTotal }
      ]
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
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
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

        <button
          onClick={() => setActiveTab('STAFF_DENOMINATIONS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'STAFF_DENOMINATIONS'
              ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
              : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
          }`}
        >
          <Users className="w-4 h-4 text-amber-500" />
          <span>Staff-Wise Denominations (Vignesh & Sekar)</span>
        </button>

        <button
          onClick={() => setActiveTab('JOURNAL')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'JOURNAL'
              ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
              : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
          }`}
        >
          <BookOpen className="w-4 h-4 text-amber-500" />
          <span>Journal Transactions Register</span>
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

            <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Closing Cash Balance</p>
              <p className="text-xl font-black text-amber-950 mt-0.5">
                ₹{(ledgerData?.closingBalance || 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-amber-800 font-semibold">Physical vault cash in safe</span>
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
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcf9f2] border border-[#ece3d4]">
                    <div>
                      <span className="font-bold text-stone-900 block">OPENING BALANCE</span>
                      <span className="text-[10px] text-stone-500 font-medium">Brought forward cash in safe</span>
                    </div>
                    <span className="font-black text-stone-900 text-sm">
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
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#fcf9f2] border border-[#ece3d4]">
                    <div>
                      <span className="font-bold text-amber-950 block">CLOSING BALANCE</span>
                      <span className="text-[10px] text-stone-500 font-medium">Physical cash in office vault / safe</span>
                    </div>
                    <span className="font-black text-amber-950 text-sm">
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

      {/* ======================================================== */}
      {/* 3. STAFF-WISE DENOMINATIONS (VIGNESH & SEKAR)             */}
      {/* ======================================================== */}
      {activeTab === 'STAFF_DENOMINATIONS' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs">
            <div>
              <h3 className="text-sm font-black text-stone-900">
                Staff Field Collection Denominations — {selectedDate}
              </h3>
              <p className="text-[10px] text-stone-500 font-medium">
                Enter currency notes and bank payments collected by field officers (Vignesh & Chandra Sekar)
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveDenominations}
              disabled={saveDenomMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#251b14] text-amber-300 font-bold rounded-xl text-xs hover:bg-[#322319] transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveDenomMutation.isPending ? 'Saving...' : 'Save Staff Handover'}</span>
            </button>
          </div>

          {/* Two Side-by-Side Tables (Matching user image media_1793188883843_088a09b6.png) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Table 1: VIGNESH */}
            <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
              <div className="p-3 bg-[#b5b0aa] border-b border-[#9c968f] text-center">
                <h4 className="text-sm font-black text-red-700 tracking-wider">VIGNESH</h4>
              </div>
              <div className="p-4 bg-[#cfcbca]/40">
                <table className="w-full text-center text-xs font-semibold">
                  <thead className="text-stone-700 border-b border-stone-300">
                    <tr>
                      <th className="py-1.5">Denomination</th>
                      <th className="py-1.5">Count</th>
                      <th className="py-1.5 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-300/80">
                    <tr>
                      <td className="py-2 font-bold text-stone-900">500</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={vigneshForm.notes500 === 0 ? '' : vigneshForm.notes500}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setVigneshForm(prev => ({ ...prev, notes500: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{(vigneshForm.notes500 * 500)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-stone-900">200</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={vigneshForm.notes200 === 0 ? '' : vigneshForm.notes200}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setVigneshForm(prev => ({ ...prev, notes200: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{(vigneshForm.notes200 * 200)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-stone-900">100</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={vigneshForm.notes100 === 0 ? '' : vigneshForm.notes100}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setVigneshForm(prev => ({ ...prev, notes100: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{(vigneshForm.notes100 * 100)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-stone-900">50</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={vigneshForm.notes50 === 0 ? '' : vigneshForm.notes50}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setVigneshForm(prev => ({ ...prev, notes50: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{(vigneshForm.notes50 * 50)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-stone-900">20</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={vigneshForm.notes20 === 0 ? '' : vigneshForm.notes20}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setVigneshForm(prev => ({ ...prev, notes20: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{(vigneshForm.notes20 * 20)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-stone-900">10</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={vigneshForm.notes10 === 0 ? '' : vigneshForm.notes10}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setVigneshForm(prev => ({ ...prev, notes10: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{(vigneshForm.notes10 * 10)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-stone-900">SB Acc</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={vigneshForm.sbAcc === 0 ? '' : vigneshForm.sbAcc}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setVigneshForm(prev => ({ ...prev, sbAcc: v === '' ? 0 : (parseFloat(v) || 0) }));
                          }}
                          className="w-20 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{vigneshForm.sbAcc}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-stone-900">CA Acc</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={vigneshForm.caAcc === 0 ? '' : vigneshForm.caAcc}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setVigneshForm(prev => ({ ...prev, caAcc: v === '' ? 0 : (parseFloat(v) || 0) }));
                          }}
                          className="w-20 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{vigneshForm.caAcc}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-stone-950 font-black text-sm text-stone-950">
                      <td colSpan={2} className="py-3 text-center tracking-wider">TOTAL</td>
                      <td className="py-3 text-right">{vigneshTotal.toLocaleString('en-IN')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Table 2: SEKAR */}
            <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
              <div className="p-3 bg-[#b5b0aa] border-b border-[#9c968f] text-center">
                <h4 className="text-sm font-black text-red-700 tracking-wider">SEKAR</h4>
              </div>
              <div className="p-4 bg-[#cfcbca]/40">
                <table className="w-full text-center text-xs font-semibold">
                  <thead className="text-stone-700 border-b border-stone-300">
                    <tr>
                      <th className="py-1.5">Denomination</th>
                      <th className="py-1.5">Count</th>
                      <th className="py-1.5 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-300/80">
                    <tr>
                      <td className="py-2 font-bold text-stone-900">500</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={sekarForm.notes500 === 0 ? '' : sekarForm.notes500}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setSekarForm(prev => ({ ...prev, notes500: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{(sekarForm.notes500 * 500)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-stone-900">200</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={sekarForm.notes200 === 0 ? '' : sekarForm.notes200}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setSekarForm(prev => ({ ...prev, notes200: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{(sekarForm.notes200 * 200)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-stone-900">100</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={sekarForm.notes100 === 0 ? '' : sekarForm.notes100}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setSekarForm(prev => ({ ...prev, notes100: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{(sekarForm.notes100 * 100)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-stone-900">50</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={sekarForm.notes50 === 0 ? '' : sekarForm.notes50}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setSekarForm(prev => ({ ...prev, notes50: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{(sekarForm.notes50 * 50)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-stone-900">20</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={sekarForm.notes20 === 0 ? '' : sekarForm.notes20}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setSekarForm(prev => ({ ...prev, notes20: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{(sekarForm.notes20 * 20)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-stone-900">10</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={sekarForm.notes10 === 0 ? '' : sekarForm.notes10}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setSekarForm(prev => ({ ...prev, notes10: v === '' ? 0 : (parseInt(v, 10) || 0) }));
                          }}
                          className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{(sekarForm.notes10 * 10)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-stone-900">SB Acc</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={sekarForm.sbAcc === 0 ? '' : sekarForm.sbAcc}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setSekarForm(prev => ({ ...prev, sbAcc: v === '' ? 0 : (parseFloat(v) || 0) }));
                          }}
                          className="w-20 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{sekarForm.sbAcc}</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-bold text-stone-900">CA Acc</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          value={sekarForm.caAcc === 0 ? '' : sekarForm.caAcc}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            setSekarForm(prev => ({ ...prev, caAcc: v === '' ? 0 : (parseFloat(v) || 0) }));
                          }}
                          className="w-20 px-1.5 py-0.5 text-center font-bold bg-white border border-stone-300 rounded"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-stone-900">{sekarForm.caAcc}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-stone-950 font-black text-sm text-stone-950">
                      <td colSpan={2} className="py-3 text-center tracking-wider">TOTAL</td>
                      <td className="py-3 text-right">{sekarTotal.toLocaleString('en-IN')}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. GENERAL JOURNAL TRANSACTIONS REGISTER                 */}
      {/* ======================================================== */}
      {activeTab === 'JOURNAL' && (
        <div className="space-y-6">
          <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
            <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAccountType('CASH')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    accountType === 'CASH'
                      ? 'bg-[#251b14] text-amber-300 shadow-xs'
                      : 'bg-white border border-[#ded3be] text-stone-700 hover:bg-[#faf6ee]'
                  }`}
                >
                  Vault Cash Journal
                </button>
                <button
                  onClick={() => setAccountType('BANK')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    accountType === 'BANK'
                      ? 'bg-[#251b14] text-amber-300 shadow-xs'
                      : 'bg-white border border-[#ded3be] text-stone-700 hover:bg-[#faf6ee]'
                  }`}
                >
                  Bank / Current A/C Journal
                </button>
              </div>

              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter category or description..."
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-amber-600 shadow-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fcf9f2] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ece3d4]">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Particulars & Remarks</th>
                    <th className="px-4 py-3">V.No</th>
                    <th className="px-4 py-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece3d4]">
                  {isJournalLoading ? (
                    <tr><td colSpan={6} className="text-center py-8 text-stone-400">Loading journal ledger...</td></tr>
                  ) : (journalData?.transactions || []).length > 0 ? (
                    journalData.transactions.map((t: any) => (
                      <tr key={t._id} className="hover:bg-[#faf6ee] transition">
                        <td className="px-4 py-3 font-mono font-bold text-stone-800">
                          {new Date(t.transactionDate).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            t.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-stone-900">{t.category}</td>
                        <td className="px-4 py-3 text-stone-600 font-medium">{t.notes || t.description || '-'}</td>
                        <td className="px-4 py-3 font-mono text-stone-500">{t.vNo || '-'}</td>
                        <td className={`px-4 py-3 text-right font-black text-sm ${t.type === 'CREDIT' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {t.type === 'CREDIT' ? '+' : '-'}₹{t.amount?.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-stone-400 font-medium">
                        No transactions found for the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
