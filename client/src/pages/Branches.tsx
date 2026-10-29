import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Phone, MapPin, Wallet, BookOpen, Edit3, Trash2, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const Branches: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    phone: ''
  });

  // Edit Branch State (Admin Only - All Fields)
  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [editBranchForm, setEditBranchForm] = useState({
    code: '',
    name: '',
    address: '',
    phone: '',
    cashBalance: 0,
    bankBalance: 0,
    active: true
  });
  const [editBranchError, setEditBranchError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['branchesList'],
    queryFn: () => api.getBranches()
  });

  const createBranchMutation = useMutation({
    mutationFn: (newB: any) => api.createBranch(newB),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branchesList'] });
      setIsModalOpen(false);
      setFormData({ code: '', name: '', address: '', phone: '' });
    }
  });

  const updateBranchMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateBranch(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branchesList'] });
      setEditingBranch(null);
      setEditBranchError('');
    },
    onError: (err: any) => {
      setEditBranchError(err.message || 'Failed to update branch');
    }
  });

  const deleteBranchMutation = useMutation({
    mutationFn: (id: string) => api.deleteBranch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branchesList'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete branch');
    }
  });

  const handleOpenEditBranch = (b: any) => {
    setEditingBranch(b);
    setEditBranchForm({
      code: b.code || '',
      name: b.name || '',
      address: b.address || '',
      phone: b.phone || '',
      cashBalance: b.cashBalance || 0,
      bankBalance: b.bankBalance || 0,
      active: b.active !== false
    });
    setEditBranchError('');
  };

  const handleEditBranchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBranchForm.name || !editBranchForm.code) {
      setEditBranchError('Branch name and code are required');
      return;
    }
    updateBranchMutation.mutate({
      id: editingBranch._id,
      data: editBranchForm
    });
  };

  const handleDeleteBranch = (b: any) => {
    if (window.confirm(`Are you sure you want to permanently delete branch "${b.name}" (${b.code})? This action cannot be undone.`)) {
      deleteBranchMutation.mutate(b._id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) return;
    createBranchMutation.mutate(formData);
  };

  const branches = data?.branches || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Branch Management</h2>
          <p className="text-xs text-slate-500">
            Configure multi-branch locations, track separate physical vault cash reserves, and manage branch parameters
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Branch</span>
        </button>
      </div>

      {/* Branch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">Loading branches...</div>
        ) : branches.length > 0 ? (
          branches.map((b: any) => (
            <div
              key={b._id}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-700">
                    CODE: {b.code}
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 mt-2">{b.name}</h3>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  {b.active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1 font-semibold uppercase">
                    <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Physical Vault Cash</span>
                  </div>
                  <p className="text-xl font-black text-slate-900">₹{b.cashBalance?.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1 font-semibold uppercase">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    <span>Current Bank A/C</span>
                  </div>
                  <p className="text-xl font-black text-slate-900">₹{b.bankBalance?.toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-600 pt-1">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{b.address || 'Address not configured'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono">{b.phone || 'Phone not configured'}</span>
                </div>
              </div>

              {isAdmin && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleOpenEditBranch(b)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-lg text-xs border border-amber-300 transition cursor-pointer"
                    title="Edit Branch (All Fields)"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                    <span>Edit Branch</span>
                  </button>

                  <button
                    onClick={() => handleDeleteBranch(b)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs border border-rose-300 transition cursor-pointer"
                    title="Delete Branch (Admin Only)"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">No branches configured</div>
        )}
      </div>

      {/* Add Branch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-600" />
              <span>Add New Branch Location</span>
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Branch Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. POLLACHI, MDKM"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold focus:outline-none focus:border-brand-500 uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Branch phone"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Pollachi Branch"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Location address..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                />
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
                  disabled={createBranchMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {createBranchMutation.isPending ? 'Creating...' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Branch Modal (Admin Only - All Fields) */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-600" />
                  <span>Edit Branch: {editingBranch.name}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Update branch code, name, vault cash reserve, bank balances, contact, and status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingBranch(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editBranchError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-medium">
                {editBranchError}
              </p>
            )}

            <form onSubmit={handleEditBranchSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Branch Code *</label>
                  <input
                    type="text"
                    required
                    value={editBranchForm.code}
                    onChange={(e) => setEditBranchForm({ ...editBranchForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold uppercase text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editBranchForm.phone}
                    onChange={(e) => setEditBranchForm({ ...editBranchForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  value={editBranchForm.name}
                  onChange={(e) => setEditBranchForm({ ...editBranchForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Physical Vault Cash (₹)</label>
                  <input
                    type="number"
                    value={editBranchForm.cashBalance}
                    onChange={(e) => setEditBranchForm({ ...editBranchForm, cashBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-emerald-800 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Current Bank Balance (₹)</label>
                  <input
                    type="number"
                    value={editBranchForm.bankBalance}
                    onChange={(e) => setEditBranchForm({ ...editBranchForm, bankBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-blue-800 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Physical Address</label>
                <textarea
                  rows={2}
                  value={editBranchForm.address}
                  onChange={(e) => setEditBranchForm({ ...editBranchForm, address: e.target.value })}
                  placeholder="Location address..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Branch Operating Status</label>
                <select
                  value={editBranchForm.active ? 'ACTIVE' : 'INACTIVE'}
                  onChange={(e) => setEditBranchForm({ ...editBranchForm, active: e.target.value === 'ACTIVE' })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-amber-600"
                >
                  <option value="ACTIVE">ACTIVE (Operational)</option>
                  <option value="INACTIVE">INACTIVE (Closed / Suspended)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateBranchMutation.isPending}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {updateBranchMutation.isPending ? 'Saving...' : 'Save Branch Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
