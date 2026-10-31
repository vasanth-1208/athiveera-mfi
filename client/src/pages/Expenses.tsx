import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingDown, Plus, Fuel, CheckCircle, Clock, Edit3, Trash2, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { api } from '../services/api';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';

export const Expenses: React.FC = () => {
  const { selectedBranchId } = useBranch();
  const { isAdmin, isManager } = useAuth();
  const isManagerOrAdmin = isAdmin || isManager;
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Category management
  const DEFAULT_CATEGORIES = [
    'FUEL / PETROL EXPENSES',
    'STAFF WELFARE EXPENSES',
    'OFFICE EXPENSES',
    'OFFICE RENT',
    'ELECTRICAL MAINTENANCE',
    'PRINTING AND STATIONARY',
    'COMPUTER & IT MAINTENANCE',
    'WAGES / LABOUR',
    'POOJA EXPENSES',
    'BONUS / ALLOWANCE',
    'OTHERS'
  ];

  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('athiveera_custom_expense_categories');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');

  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...customCategories]));

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCatInput.trim().toUpperCase();
    if (!cleanName) return;
    if (!allCategories.includes(cleanName)) {
      const updated = [...customCategories, cleanName];
      setCustomCategories(updated);
      try {
        localStorage.setItem('athiveera_custom_expense_categories', JSON.stringify(updated));
      } catch (err) {
        // ignore
      }
    }
    setFormData(prev => ({ ...prev, category: cleanName }));
    setNewCatInput('');
    setIsNewCatModalOpen(false);
  };

  const [formData, setFormData] = useState({
    category: 'FUEL / PETROL EXPENSES',
    amount: '',
    fuelRate: '2.16',
    billRef: '',
    description: '',
    travelKM: '',
    staffId: '',
    staffName: '',
    expenseDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH' as 'CASH' | 'BANK'
  });

  // Edit Expense State (Manager & Admin - All Fields)
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [editExpenseForm, setEditExpenseForm] = useState({
    category: 'FUEL / PETROL EXPENSES',
    amount: '',
    fuelRate: '2.16',
    billRef: '',
    description: '',
    travelKM: '',
    staffId: '',
    staffName: '',
    paymentMethod: 'CASH' as 'CASH' | 'BANK',
    status: 'PENDING' as 'PENDING' | 'APPROVED'
  });
  const [editExpenseError, setEditExpenseError] = useState('');

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.getUsers()
  });
  const staffList = (usersData?.users || []).filter((u: any) => u.active !== false);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', selectedBranchId],
    queryFn: () => api.getExpenses({ branchId: selectedBranchId })
  });

  const createExpenseMutation = useMutation({
    mutationFn: (newExp: any) => api.createExpense(newExp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsModalOpen(false);
      setFormData({
        category: 'STAFF WELFARE EXPENSES',
        amount: '',
        fuelRate: '2.16',
        billRef: '',
        description: '',
        travelKM: '',
        staffId: '',
        staffName: '',
        expenseDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'CASH'
      });
    }
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setEditingExpense(null);
      setEditExpenseError('');
    },
    onError: (err: any) => {
      setEditExpenseError(err.message || 'Failed to update expense');
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => api.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete expense');
    }
  });

  const handleOpenEditExpense = (e: any) => {
    setEditingExpense(e);
    setEditExpenseForm({
      category: e.category || 'STAFF WELFARE EXPENSES',
      amount: String(e.amount || 0),
      fuelRate: String(e.fuelRate || '2.16'),
      billRef: e.billRef || '',
      description: e.description || '',
      travelKM: String(e.travelKM || ''),
      staffId: e.staffId?._id || e.staffId || '',
      staffName: e.staffName || '',
      paymentMethod: e.paymentMethod || 'CASH',
      status: e.status || 'PENDING'
    });
    setEditExpenseError('');
  };

  const handleEditExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(editExpenseForm.amount);
    if (!amt || amt <= 0) {
      setEditExpenseError('Expense amount must be greater than zero');
      return;
    }
    updateExpenseMutation.mutate({
      id: editingExpense._id,
      data: {
        category: editExpenseForm.category,
        amount: amt,
        fuelRate: parseFloat(editExpenseForm.fuelRate) || 2.16,
        billRef: editExpenseForm.billRef,
        description: editExpenseForm.description,
        travelKM: parseFloat(editExpenseForm.travelKM) || 0,
        staffId: editExpenseForm.staffId || null,
        staffName: editExpenseForm.staffName,
        paymentMethod: editExpenseForm.paymentMethod,
        status: editExpenseForm.status
      }
    });
  };

  const handleDeleteExpense = (e: any) => {
    if (window.confirm(`Are you sure you want to permanently delete this expense of ₹${e.amount} (${e.category})? This action cannot be undone.`)) {
      deleteExpenseMutation.mutate(e._id);
    }
  };

  const handleKMChange = (kmVal: string) => {
    const km = parseFloat(kmVal) || 0;
    const rate = parseFloat(formData.fuelRate) || 2.16;
    setFormData({
      ...formData,
      travelKM: kmVal,
      amount: kmVal ? String(Math.round(km * rate)) : ''
    });
  };

  const handleFuelRateChange = (rateVal: string) => {
    const rate = parseFloat(rateVal) || 0;
    const km = parseFloat(formData.travelKM) || 0;
    setFormData({
      ...formData,
      fuelRate: rateVal,
      amount: km > 0 && rate > 0 ? String(Math.round(km * rate)) : formData.amount
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createExpenseMutation.mutate({
      ...formData,
      amount: parseFloat(formData.amount) || 0,
      branchId: selectedBranchId
    });
  };

  const expenses = data?.expenses || [];
  const totalAmount = data?.totalAmount || 0;

  const [sortCol, setSortCol] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortedExpenses = [...expenses].sort((a: any, b: any) => {
    if (sortCol === 'date') {
      const timeA = new Date(a.expenseDate).getTime();
      const timeB = new Date(b.expenseDate).getTime();
      return sortDir === 'asc' ? timeA - timeB : timeB - timeA;
    }
    if (sortCol === 'category') {
      const cmp = (a.category || '').localeCompare(b.category || '');
      return sortDir === 'asc' ? cmp : -cmp;
    }
    if (sortCol === 'billRef') {
      const cmp = (a.billRef || '').localeCompare(b.billRef || '');
      return sortDir === 'asc' ? cmp : -cmp;
    }
    if (sortCol === 'staff') {
      const cmp = (a.staffName || '').localeCompare(b.staffName || '');
      return sortDir === 'asc' ? cmp : -cmp;
    }
    if (sortCol === 'amount') {
      const numA = Number(a.amount) || 0;
      const numB = Number(b.amount) || 0;
      return sortDir === 'asc' ? numA - numB : numB - numA;
    }
    if (sortCol === 'status') {
      const cmp = (a.status || '').localeCompare(b.status || '');
      return sortDir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 dark:text-white tracking-tight">Operating Expenses & Travel KM</h2>
          <p className="text-xs text-stone-500 dark:text-stone-300 font-medium mt-0.5">
            Track branch utility bills, office maintenance, salaries, and staff petrol claims with exact ₹2.16/km calculation
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 rounded-xl text-xs font-bold shadow-md shadow-amber-900/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record Expense / KM Claim</span>
        </button>
      </div>

      {/* Expense Summary Banner */}
      <div className="bg-[#fffdfa] dark:bg-[#23160e] p-5 rounded-2xl border border-[#ded3be] dark:border-[#442a1b] shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-stone-500 dark:text-stone-300 uppercase tracking-wider">Total Recorded Expenses</span>
          <p className="text-3xl font-black text-stone-900 dark:text-white mt-1">₹{totalAmount.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 shadow-xs">
          <TrendingDown className="w-6 h-6" />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-[#fffdfa] dark:bg-[#23160e] rounded-2xl border border-[#ded3be] dark:border-[#442a1b] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f6f0e4] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
              <tr>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    {sortCol === 'date' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('category')}>
                  <div className="flex items-center gap-1">
                    <span>Particulars / Category</span>
                    {sortCol === 'category' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('billRef')}>
                  <div className="flex items-center gap-1">
                    <span>Bill / Ref</span>
                    {sortCol === 'billRef' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3">KM / Rate</th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('staff')}>
                  <div className="flex items-center gap-1">
                    <span>Staff</span>
                    {sortCol === 'staff' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('amount')}>
                  <div className="flex items-center gap-1">
                    <span>Amount</span>
                    {sortCol === 'amount' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
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
                <th className="px-4 py-3">Description</th>
                {(isAdmin || isManager) && <th className="px-4 py-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ece3d4]">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-stone-400 font-medium">
                    Loading operating expenses...
                  </td>
                </tr>
              ) : sortedExpenses.length > 0 ? (
                sortedExpenses.map((e: any) => (
                  <tr key={e._id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {new Date(e.expenseDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{e.category}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{e.billRef || '-'}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {e.travelKM > 0 ? `${e.travelKM} KM @ ₹${e.fuelRate}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{e.staffName || 'Staff'}</td>
                    <td className={`px-4 py-3 font-bold text-sm ${e.amount < 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {e.amount < 0 ? `-₹${Math.abs(e.amount).toLocaleString('en-IN')}` : `₹${e.amount?.toLocaleString('en-IN')}`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${e.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 italic max-w-xs truncate">{e.description || '-'}</td>
                    {(isAdmin || isManager) && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {e.status === 'PENDING' && (
                            <button
                              onClick={() => approveMutation.mutate(e._id)}
                              disabled={approveMutation.isPending}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition cursor-pointer"
                            >
                              Approve
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenEditExpense(e)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded text-[11px] border border-amber-300 transition cursor-pointer"
                            title="Edit Expense Details (All Fields)"
                          >
                            <Edit3 className="w-3 h-3 text-amber-700" />
                            <span>Edit</span>
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteExpense(e)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded text-[11px] border border-rose-300 transition cursor-pointer"
                              title="Delete Expense (Admin Only)"
                            >
                              <Trash2 className="w-3 h-3 text-rose-600" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    No operating expenses recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-brand-600" />
                <span>Record Expense</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700">Expense Category *</label>
                  <button
                    type="button"
                    onClick={() => setIsNewCatModalOpen(true)}
                    className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create Category</span>
                  </button>
                </div>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:border-brand-500"
                >
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assign Staff / Beneficiary (Optional)</label>
                <select
                  value={formData.staffId}
                  onChange={(e) => {
                    const sel = staffList.find((u: any) => u._id === e.target.value);
                    setFormData({
                      ...formData,
                      staffId: e.target.value,
                      staffName: sel ? sel.name : ''
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:border-brand-500"
                >
                  <option value="">-- No Specific Staff / Branch Level --</option>
                  {staffList.map((u: any) => (
                    <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Total expense amount (e.g. 500 or -500)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:border-brand-500 font-mono"
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  Enter positive (e.g. 500) for outgoing expense (deducted from vault). Enter negative (e.g. -500) for incoming credit / recovery (added to vault).
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bill / Voucher Reference</label>
                <input
                  type="text"
                  value={formData.billRef}
                  onChange={(e) => setFormData({ ...formData, billRef: e.target.value })}
                  placeholder="Invoice / Voucher number (optional)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Route / Purpose *</label>
                <textarea
                  rows={2}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g. Somandurai route fuel or tea for meeting..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expense Date</label>
                  <input
                    type="date"
                    required
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:border-brand-500"
                  >
                    <option value="CASH">Cash Vault</option>
                    <option value="BANK">Bank Account</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createExpenseMutation.isPending}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition"
                >
                  {createExpenseMutation.isPending ? 'Saving...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Custom Category Modal */}
      {isNewCatModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Create New Expense Category</h4>
              <button
                type="button"
                onClick={() => setIsNewCatModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  placeholder="e.g. GENERATOR DIESEL"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold uppercase focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewCatModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700"
                >
                  Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Expense Modal (Manager & Admin - All Fields) */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-600" />
                  <span>Edit Expense Record</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Update category, amount, travel KM, payment method, bill ref, or status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editExpenseError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-medium">
                {editExpenseError}
              </p>
            )}

            <form onSubmit={handleEditExpenseSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Expense Category *</label>
                <select
                  value={editExpenseForm.category}
                  onChange={(e) => setEditExpenseForm({ ...editExpenseForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                >
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assigned Staff / Claimed By</label>
                <select
                  value={editExpenseForm.staffId}
                  onChange={(e) => {
                    const sel = staffList.find((u: any) => u._id === e.target.value);
                    setEditExpenseForm({
                      ...editExpenseForm,
                      staffId: e.target.value,
                      staffName: sel ? sel.name : ''
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                >
                  <option value="">-- No Specific Staff / Branch Level --</option>
                  {staffList.map((u: any) => (
                    <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editExpenseForm.amount}
                  onChange={(e) => setEditExpenseForm({ ...editExpenseForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                />
                <p className="text-[10px] text-stone-500 mt-1">
                  Positive: outgoing expense (deducted from vault). Negative: incoming credit / recovery (added to vault).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={editExpenseForm.paymentMethod}
                    onChange={(e) => setEditExpenseForm({ ...editExpenseForm, paymentMethod: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                  >
                    <option value="CASH">CASH</option>
                    <option value="BANK">BANK / ONLINE</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Approval Status</label>
                  <select
                    value={editExpenseForm.status}
                    onChange={(e) => setEditExpenseForm({ ...editExpenseForm, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="APPROVED">APPROVED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Bill Reference / Invoice #</label>
                <input
                  type="text"
                  value={editExpenseForm.billRef}
                  onChange={(e) => setEditExpenseForm({ ...editExpenseForm, billRef: e.target.value })}
                  placeholder="Receipt or bill reference..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={editExpenseForm.description}
                  onChange={(e) => setEditExpenseForm({ ...editExpenseForm, description: e.target.value })}
                  placeholder="Items purchased or justification..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateExpenseMutation.isPending}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {updateExpenseMutation.isPending ? 'Saving...' : 'Save Expense Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
