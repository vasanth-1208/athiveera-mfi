import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Layers, 
  Plus, 
  RotateCcw, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  Sliders,
  DollarSign,
  Calendar,
  Percent,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface SlabItem {
  fromWeek: number;
  toWeek: number;
  principal: number;
  interest: number;
  savings: number;
  total: number;
}

interface LoanTierItem {
  _id: string;
  code: string;
  name: string;
  category: 'REGULAR' | 'SPECIAL';
  frequency: 'WEEKLY' | 'MONTHLY';
  principal: number;
  interestAmount: number;
  docCharges: number;
  savingsAmount: number;
  totalPayable: number;
  tenureWeeks: number;
  slabs: SlabItem[];
  schedule: any[];
  isActive: boolean;
  sortOrder: number;
}

export const LoanTiers: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const isManagerOrAdmin = isAdmin || isManager;
  const queryClient = useQueryClient();

  const [filterCategory, setFilterCategory] = useState<'ALL' | 'REGULAR' | 'SPECIAL'>('ALL');
  const [expandedTierId, setExpandedTierId] = useState<string | null>(null);

  // Edit / Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'REGULAR' as 'REGULAR' | 'SPECIAL',
    frequency: 'WEEKLY' as 'WEEKLY' | 'MONTHLY',
    principal: 20000,
    docCharges: 1200,
    sortOrder: 1,
    isActive: true,
    slabs: [] as SlabItem[]
  });

  const { data, isLoading } = useQuery({
    queryKey: ['loanTiers'],
    queryFn: () => api.getLoanTiers()
  });

  const tiers: LoanTierItem[] = data?.tiers || [];

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateLoanTier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loanTiers'] });
      queryClient.invalidateQueries({ queryKey: ['loanPresets'] });
      setIsModalOpen(false);
      setEditingTierId(null);
    },
    onError: (err: any) => alert(err.message || 'Failed to update loan tier')
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createLoanTier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loanTiers'] });
      queryClient.invalidateQueries({ queryKey: ['loanPresets'] });
      setIsModalOpen(false);
      setEditingTierId(null);
    },
    onError: (err: any) => alert(err.message || 'Failed to create loan tier')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteLoanTier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loanTiers'] });
      queryClient.invalidateQueries({ queryKey: ['loanPresets'] });
    },
    onError: (err: any) => alert(err.message || 'Failed to delete loan tier')
  });

  const resetMutation = useMutation({
    mutationFn: () => api.resetLoanTiers(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loanTiers'] });
      queryClient.invalidateQueries({ queryKey: ['loanPresets'] });
      alert('All loan tiers reset to canonical NEW LOAN INT.xlsx master specifications.');
    },
    onError: (err: any) => alert(err.message || 'Failed to reset loan tiers')
  });

  const handleOpenCreate = () => {
    setEditingTierId(null);
    setFormData({
      code: 'TIER_CUSTOM',
      name: 'Custom Loan Tier',
      category: 'REGULAR',
      frequency: 'WEEKLY',
      principal: 20000,
      docCharges: 1200,
      sortOrder: tiers.length + 1,
      isActive: true,
      slabs: [
        { fromWeek: 1, toWeek: 10, principal: 625, interest: 185, savings: 40, total: 850 },
        { fromWeek: 11, toWeek: 20, principal: 635, interest: 125, savings: 40, total: 800 },
        { fromWeek: 21, toWeek: 30, principal: 640, interest: 70, savings: 40, total: 750 },
        { fromWeek: 31, toWeek: 32, principal: 500, interest: 0, savings: 0, total: 500 }
      ]
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tier: LoanTierItem) => {
    setEditingTierId(tier._id);
    setFormData({
      code: tier.code,
      name: tier.name,
      category: tier.category,
      frequency: tier.frequency,
      principal: tier.principal,
      docCharges: tier.docCharges,
      sortOrder: tier.sortOrder || 1,
      isActive: tier.isActive,
      slabs: (tier.slabs || []).map(s => ({ ...s }))
    });
    setIsModalOpen(true);
  };

  const handleSlabChange = (index: number, field: keyof SlabItem, val: number) => {
    setFormData(prev => {
      const nextSlabs = [...prev.slabs];
      const cur = { ...nextSlabs[index], [field]: val };
      if (field === 'principal' || field === 'interest' || field === 'savings') {
        cur.total = (cur.principal || 0) + (cur.interest || 0) + (cur.savings || 0);
      }
      nextSlabs[index] = cur;
      return { ...prev, slabs: nextSlabs };
    });
  };

  const handleAddSlab = () => {
    setFormData(prev => {
      const last = prev.slabs[prev.slabs.length - 1];
      const nextFrom = last ? last.toWeek + 1 : 1;
      const nextTo = nextFrom + 9;
      return {
        ...prev,
        slabs: [
          ...prev.slabs,
          { fromWeek: nextFrom, toWeek: nextTo, principal: 600, interest: 100, savings: 50, total: 750 }
        ]
      };
    });
  };

  const handleRemoveSlab = (index: number) => {
    setFormData(prev => ({
      ...prev,
      slabs: prev.slabs.filter((_, idx) => idx !== index)
    }));
  };

  // Calculations for current form modal
  const calcTenure = formData.slabs.reduce((acc, s) => acc + Math.max(0, (s.toWeek - s.fromWeek + 1)), 0);
  const calcPrincipalSum = formData.slabs.reduce((acc, s) => {
    const count = Math.max(0, s.toWeek - s.fromWeek + 1);
    return acc + count * (s.principal || 0);
  }, 0);
  const calcInterestSum = formData.slabs.reduce((acc, s) => {
    const count = Math.max(0, s.toWeek - s.fromWeek + 1);
    return acc + count * (s.interest || 0);
  }, 0);
  const calcSavingsSum = formData.slabs.reduce((acc, s) => {
    const count = Math.max(0, s.toWeek - s.fromWeek + 1);
    return acc + count * (s.savings || 0);
  }, 0);
  const calcPayableSum = formData.slabs.reduce((acc, s) => {
    const count = Math.max(0, s.toWeek - s.fromWeek + 1);
    return acc + count * (s.total || 0);
  }, 0);

  const isPrincipalMatched = calcPrincipalSum === Number(formData.principal);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('Tier name is required.');
    if (formData.slabs.length === 0) return alert('At least one amortization slab is required.');

    const payload = {
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      category: formData.category,
      frequency: formData.frequency,
      principal: Number(formData.principal),
      docCharges: Number(formData.docCharges),
      sortOrder: Number(formData.sortOrder),
      isActive: formData.isActive,
      slabs: formData.slabs
    };

    if (editingTierId) {
      updateMutation.mutate({ id: editingTierId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const visibleTiers = tiers.filter(t => filterCategory === 'ALL' || t.category === filterCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-6 h-6 text-amber-700" />
            <h2 className="text-2xl font-black text-stone-900 tracking-tight">Loan Tiers & Slab Management</h2>
          </div>
          <p className="text-xs text-stone-500 font-medium mt-1">
            Canonical loan product tiers from <strong className="text-stone-800">NEW LOAN INT.xlsx</strong> with graduated weekly repayment distributions. Any modification updates the defaults when creating new loans.
          </p>
        </div>

        {isManagerOrAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Reset all loan tiers back to the default slabs defined in NEW LOAN INT.xlsx? Custom changes will be restored.')) {
                    resetMutation.mutate();
                  }
                }}
                disabled={resetMutation.isPending}
                className="px-3.5 py-2 bg-white border border-[#ded3be] hover:bg-[#faf6ee] text-stone-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                <span>{resetMutation.isPending ? 'Resetting...' : 'Reset Default Slabs'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-[#251b14] hover:bg-[#34261c] text-amber-300 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Add Loan Tier</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
        <div className="flex items-center gap-2">
          {(['ALL', 'REGULAR', 'SPECIAL'] as const).map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterCategory === cat
                  ? 'bg-[#251b14] text-amber-300 shadow-xs'
                  : 'bg-white text-stone-600 border border-[#ded3be] hover:bg-[#faf6ee]'
              }`}
            >
              {cat === 'ALL' ? 'All Tiers' : cat === 'REGULAR' ? 'Regular Tiers' : 'Special Business Tiers'}
            </button>
          ))}
        </div>

        <span className="text-xs font-semibold text-stone-500">
          Showing <strong>{visibleTiers.length}</strong> Configured Products
        </span>
      </div>

      {/* Tiers List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-[#fffdfa] p-12 text-center text-xs text-stone-400 font-medium rounded-2xl border border-[#ded3be]">
            Loading configured loan product tiers...
          </div>
        ) : visibleTiers.length > 0 ? (
          visibleTiers.map(tier => {
            const isExpanded = expandedTierId === tier._id;
            const intPercent = tier.principal > 0 ? ((tier.interestAmount / tier.principal) * 100).toFixed(1) : '0';

            return (
              <div 
                key={tier._id} 
                className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden transition"
              >
                {/* Tier Card Header */}
                <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#251b14] text-amber-300 font-black text-sm flex flex-col items-center justify-center border border-amber-800/60 shadow-xs shrink-0">
                      <span>₹{(tier.principal / 1000).toFixed(0)}k</span>
                      <span className="text-[9px] text-amber-400/80 font-mono">{tier.tenureWeeks}W</span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-stone-900">{tier.name}</h3>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#251b14] text-amber-300 font-bold border border-amber-800/60 shadow-2xs">
                          {tier.code}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          tier.category === 'SPECIAL'
                            ? 'bg-purple-100 text-purple-900 border-purple-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}>
                          {tier.category}
                        </span>
                        {tier.isActive ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Active ✓
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-300">
                            Inactive
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-stone-500 mt-1 font-medium">
                        Repayment: <strong className="text-stone-800">{tier.frequency}</strong> &bull; Total Contractual Payable:{' '}
                        <strong className="text-emerald-800 font-black">₹{tier.totalPayable.toLocaleString('en-IN')}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Financial Metrics Summary */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-stone-500 block">Principal</span>
                      <span className="font-black text-stone-900 text-sm">₹{tier.principal.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="h-7 w-px bg-[#ded3be] hidden sm:block" />

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-stone-500 block">Interest ({intPercent}%)</span>
                      <span className="font-black text-amber-900 text-sm">₹{tier.interestAmount.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="h-7 w-px bg-[#ded3be] hidden sm:block" />

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-stone-500 block">Doc Charges</span>
                      <span className="font-black text-stone-700 text-sm">₹{tier.docCharges.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="h-7 w-px bg-[#ded3be] hidden sm:block" />

                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-stone-500 block">Savings Return</span>
                      <span className="font-black text-emerald-700 text-sm">₹{tier.savingsAmount.toLocaleString('en-IN')}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        type="button"
                        onClick={() => setExpandedTierId(isExpanded ? null : tier._id)}
                        className="px-3 py-1.5 bg-white border border-[#ded3be] hover:bg-[#faf6ee] text-stone-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <span>{isExpanded ? 'Hide Slabs' : `View ${tier.slabs?.length || 0} Slabs`}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isManagerOrAdmin && (
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(tier)}
                          className="p-1.5 bg-white border border-[#ded3be] hover:bg-amber-100 text-amber-900 rounded-xl transition cursor-pointer"
                          title="Edit Tier & Slabs"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}

                      {isAdmin && tier.code.startsWith('TIER_CUSTOM') && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete custom tier ${tier.name}?`)) {
                              deleteMutation.mutate(tier._id);
                            }
                          }}
                          className="p-1.5 bg-white border border-[#ded3be] hover:bg-rose-100 text-rose-700 rounded-xl transition cursor-pointer"
                          title="Delete Tier"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Slabs Breakdown Table (Expandable) */}
                {isExpanded && (
                  <div className="overflow-x-auto border-t border-[#ded3be] bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase text-amber-950 tracking-wider">
                        Graduated Installment Schedule ({tier.tenureWeeks} Total Weeks)
                      </h4>
                      <span className="text-[11px] text-stone-500 font-medium">
                        Standard microfinance graduated structure from NEW LOAN INT.xlsx
                      </span>
                    </div>

                    <table className="w-full text-left text-xs border border-[#ece3d4] rounded-xl overflow-hidden">
                      <thead className="bg-[#fcf9f2] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ece3d4]">
                        <tr>
                          <th className="px-4 py-2.5">Week Interval</th>
                          <th className="px-4 py-2.5">Duration</th>
                          <th className="px-4 py-2.5">Principal / Wk</th>
                          <th className="px-4 py-2.5">Interest / Wk</th>
                          <th className="px-4 py-2.5">Savings / Wk</th>
                          <th className="px-4 py-2.5">Expected Due / Wk</th>
                          <th className="px-4 py-2.5 text-right">Interval Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ece3d4]">
                        {tier.slabs?.map((slab, idx) => {
                          const weekCount = slab.toWeek - slab.fromWeek + 1;
                          const subtotal = weekCount * slab.total;

                          return (
                            <tr key={idx} className="hover:bg-[#faf6ee] transition font-medium">
                              <td className="px-4 py-2.5 font-bold text-stone-900">
                                Week {slab.fromWeek} to Week {slab.toWeek}
                              </td>
                              <td className="px-4 py-2.5 text-stone-600">
                                {weekCount} {weekCount === 1 ? 'Week' : 'Weeks'}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-stone-800">
                                ₹{slab.principal.toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-amber-900">
                                ₹{slab.interest.toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-emerald-700">
                                ₹{slab.savings.toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-2.5 font-black text-stone-950">
                                ₹{slab.total.toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-2.5 text-right font-black text-amber-950">
                                ₹{subtotal.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-[#f6f0e4] font-black text-stone-900 border-t border-[#ded3be]">
                        <tr>
                          <td className="px-4 py-2.5" colSpan={2}>
                            TOTALS ({tier.tenureWeeks} WEEKS)
                          </td>
                          <td className="px-4 py-2.5">₹{tier.principal.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-2.5 text-amber-900">₹{tier.interestAmount.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-2.5 text-emerald-800">₹{tier.savingsAmount.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-2.5">-</td>
                          <td className="px-4 py-2.5 text-right text-emerald-900">
                            ₹{tier.totalPayable.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-[#fffdfa] p-12 text-center text-xs text-stone-400 font-medium rounded-2xl border border-[#ded3be]">
            No loan tiers found matching category: {filterCategory}.
          </div>
        )}
      </div>

      {/* Edit / Create Tier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#fffdfa] rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl border border-amber-900/30 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-700" />
                  <span>{editingTierId ? 'Edit Loan Tier & Slabs' : 'Add New Loan Product Tier'}</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Modifying this tier directly affects newly disbursed loans under this product code.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-lg font-bold px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-stone-700 uppercase block mb-1">Product Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    disabled={Boolean(editingTierId)}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-mono font-bold text-stone-800 disabled:bg-stone-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-stone-700 uppercase block mb-1">Product Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-stone-700 uppercase block mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-800"
                  >
                    <option value="REGULAR">REGULAR</option>
                    <option value="SPECIAL">SPECIAL (Business)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-stone-700 uppercase block mb-1">Principal Amount (₹)</label>
                  <input
                    type="number"
                    value={formData.principal}
                    onChange={e => setFormData({ ...formData, principal: Number(e.target.value) })}
                    required
                    min={1000}
                    step={1000}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-800"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-stone-700 uppercase block mb-1">Doc / Processing Charges (₹)</label>
                  <input
                    type="number"
                    value={formData.docCharges}
                    onChange={e => setFormData({ ...formData, docCharges: Number(e.target.value) })}
                    min={0}
                    step={100}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-800"
                  />
                </div>
              </div>

              {/* Slabs Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase text-amber-950 tracking-wider">
                    Graduated Amortization Slabs
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSlab}
                    className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Slab</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {formData.slabs.map((slab, idx) => (
                    <div 
                      key={idx} 
                      className="grid grid-cols-7 gap-2 p-2.5 bg-[#f6f0e4] rounded-xl border border-[#ded3be] items-center text-xs"
                    >
                      <div className="col-span-1">
                        <span className="text-[9px] font-bold uppercase text-stone-500 block">From Wk</span>
                        <input
                          type="number"
                          value={slab.fromWeek}
                          onChange={e => handleSlabChange(idx, 'fromWeek', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-[#ded3be] rounded text-xs font-bold text-stone-900"
                        />
                      </div>

                      <div className="col-span-1">
                        <span className="text-[9px] font-bold uppercase text-stone-500 block">To Wk</span>
                        <input
                          type="number"
                          value={slab.toWeek}
                          onChange={e => handleSlabChange(idx, 'toWeek', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-[#ded3be] rounded text-xs font-bold text-stone-900"
                        />
                      </div>

                      <div className="col-span-1">
                        <span className="text-[9px] font-bold uppercase text-stone-500 block">Principal</span>
                        <input
                          type="number"
                          value={slab.principal}
                          onChange={e => handleSlabChange(idx, 'principal', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-[#ded3be] rounded text-xs font-bold text-stone-900"
                        />
                      </div>

                      <div className="col-span-1">
                        <span className="text-[9px] font-bold uppercase text-stone-500 block">Interest</span>
                        <input
                          type="number"
                          value={slab.interest}
                          onChange={e => handleSlabChange(idx, 'interest', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-[#ded3be] rounded text-xs font-bold text-stone-900"
                        />
                      </div>

                      <div className="col-span-1">
                        <span className="text-[9px] font-bold uppercase text-stone-500 block">Savings</span>
                        <input
                          type="number"
                          value={slab.savings}
                          onChange={e => handleSlabChange(idx, 'savings', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-[#ded3be] rounded text-xs font-bold text-stone-900"
                        />
                      </div>

                      <div className="col-span-1 text-right">
                        <span className="text-[9px] font-bold uppercase text-stone-500 block">Due / Wk</span>
                        <span className="font-black text-stone-900 text-xs">₹{slab.total}</span>
                      </div>

                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveSlab(idx)}
                          className="p-1 text-rose-600 hover:text-rose-800 transition cursor-pointer"
                          title="Remove Slab"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Validation and Summary Banner */}
                <div className={`p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
                  isPrincipalMatched
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-rose-50 border-rose-300 text-rose-950'
                }`}>
                  <div className="flex items-center gap-2">
                    {isPrincipalMatched ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>
                      Tenure: <strong>{calcTenure} Weeks</strong> &bull; Total Principal Sum:{' '}
                      <strong>₹{calcPrincipalSum.toLocaleString('en-IN')}</strong>{' '}
                      {isPrincipalMatched ? '✓ Matches' : `⚠️ Mismatch (Expected ₹${formData.principal})`}
                    </span>
                  </div>

                  <div className="font-bold flex items-center gap-3">
                    <span>Int: ₹{calcInterestSum.toLocaleString('en-IN')}</span>
                    <span>Sav: ₹{calcSavingsSum.toLocaleString('en-IN')}</span>
                    <span className="font-black">Total Payable: ₹{calcPayableSum.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#ded3be] hover:bg-stone-100 rounded-xl text-xs font-bold text-stone-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending || createMutation.isPending}
                  className="px-5 py-2 bg-[#251b14] hover:bg-[#34261c] text-amber-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  {updateMutation.isPending || createMutation.isPending ? 'Saving...' : 'Save Tier Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

