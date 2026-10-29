import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  UserCheck, 
  Plus, 
  ShieldCheck, 
  Phone, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  Trash2,
  Search, 
  Users, 
  Building2, 
  KeyRound,
  Filter
} from 'lucide-react';
import { api } from '../services/api';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';

export const Staff: React.FC = () => {
  const { branches } = useBranch();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'MAIN_ADMIN' | 'BRANCH_MANAGER' | 'COLLECTION_STAFF'>('ALL');
  
  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'COLLECTION_STAFF' as 'MAIN_ADMIN' | 'BRANCH_MANAGER' | 'COLLECTION_STAFF',
    branchId: '',
    phone: ''
  });

  // Edit / Reset Password Modal State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'COLLECTION_STAFF' as 'MAIN_ADMIN' | 'BRANCH_MANAGER' | 'COLLECTION_STAFF',
    branchId: '',
    phone: '',
    password: '',
    active: true
  });

  const { data, isLoading } = useQuery({
    queryKey: ['staffList'],
    queryFn: () => api.getUsers()
  });

  const createUserMutation = useMutation({
    mutationFn: (newU: any) => api.createUser(newU),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffList'] });
      setIsCreateOpen(false);
      setCreateForm({ username: '', password: '', name: '', role: 'COLLECTION_STAFF', branchId: '', phone: '' });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffList'] });
      setEditingUser(null);
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staffList'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete user account');
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.username || !createForm.password || !createForm.name) return;
    createUserMutation.mutate(createForm);
  };

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      role: user.role || 'COLLECTION_STAFF',
      branchId: user.branchId ? (user.branchId._id || user.branchId) : '',
      phone: user.phone || '',
      password: '',
      active: user.active !== false
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const payload: any = {
      name: editForm.name,
      role: editForm.role,
      branchId: editForm.role === 'MAIN_ADMIN' ? null : editForm.branchId,
      phone: editForm.phone,
      active: editForm.active
    };
    if (editForm.password.trim()) {
      payload.password = editForm.password.trim();
    }
    updateUserMutation.mutate({ id: editingUser._id, data: payload });
  };

  const users: any[] = data?.users || [];

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesSearch = 
      search === '' || 
      u.name?.toLowerCase().includes(search.toLowerCase()) || 
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone?.includes(search);
    return matchesRole && matchesSearch;
  });

  // Role stats
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'MAIN_ADMIN').length;
  const managerCount = users.filter(u => u.role === 'BRANCH_MANAGER').length;
  const staffCount = users.filter(u => u.role === 'COLLECTION_STAFF').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">User Management & Staff Roles</h2>
          <p className="text-xs text-slate-500">
            Create, manage, and configure role-based permissions and passwords for all administrators, managers, and field staff
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-teal-500 hover:from-brand-500 hover:to-teal-400 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New User</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold uppercase">Total Users</span>
            <Users className="w-4 h-4 text-brand-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalUsers}</p>
          <p className="text-[10px] text-slate-400">All registered accounts</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-purple-600">
            <span className="text-[11px] font-semibold uppercase">Main Admins</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-purple-900 mt-1">{adminCount}</p>
          <p className="text-[10px] text-slate-400">Cross-branch & approvals</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-blue-600">
            <span className="text-[11px] font-semibold uppercase">Branch Managers</span>
            <Building2 className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-blue-900 mt-1">{managerCount}</p>
          <p className="text-[10px] text-slate-400">Branch operations heads</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-teal-600">
            <span className="text-[11px] font-semibold uppercase">Collection Staff</span>
            <UserCheck className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-teal-900 mt-1">{staffCount}</p>
          <p className="text-[10px] text-slate-400">Route field officers</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-semibold mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Role:</span>
          </span>
          {(['ALL', 'MAIN_ADMIN', 'BRANCH_MANAGER', 'COLLECTION_STAFF'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer text-xs ${
                roleFilter === r
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r === 'ALL' ? 'All Roles' : r.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, username..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Assigned Branch</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">Loading user accounts...</td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((u: any) => (
                  <tr key={u._id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-semibold text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        u.role === 'MAIN_ADMIN' ? 'bg-purple-100 text-purple-800' :
                        u.role === 'BRANCH_MANAGER' ? 'bg-blue-100 text-blue-800' :
                        'bg-teal-100 text-teal-800'
                      }`}>
                        <ShieldCheck className="w-3 h-3" />
                        <span>{u.role?.replace('_', ' ')}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {u.branchId ? u.branchId.name : <span className="text-slate-400 font-mono italic">Global (All Branches)</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{u.phone || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {u.active ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                        <span>{u.active ? 'ACTIVE' : 'INACTIVE'}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Edit / Reset</span>
                        </button>
                        {isAdmin && u.role !== 'MAIN_ADMIN' && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to permanently delete user account "${u.name}" (${u.username})? This action cannot be undone.`)) {
                                deleteUserMutation.mutate(u._id);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs border border-rose-300 transition cursor-pointer"
                            title="Delete User Account (Admin Only)"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No matching users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-brand-600" />
              <span>Create New User Account</span>
            </h3>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Vignesh P"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase() })}
                    placeholder="e.g. vignesh"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 lowercase font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">System Role *</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold focus:outline-none focus:border-brand-500"
                  >
                    <option value="COLLECTION_STAFF">Collection Staff</option>
                    <option value="BRANCH_MANAGER">Branch Manager</option>
                    <option value="MAIN_ADMIN">Main Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Branch</label>
                  <select
                    disabled={createForm.role === 'MAIN_ADMIN'}
                    value={createForm.branchId}
                    onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold focus:outline-none focus:border-brand-500 disabled:opacity-50"
                  >
                    <option value="">-- Choose Branch --</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  placeholder="+91 9500485596"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {createUserMutation.isPending ? 'Saving...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER & RESET PASSWORD MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-brand-600" />
              <span>Edit User: {editingUser.username}</span>
            </h3>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">System Role *</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold focus:outline-none focus:border-brand-500"
                  >
                    <option value="COLLECTION_STAFF">Collection Staff</option>
                    <option value="BRANCH_MANAGER">Branch Manager</option>
                    <option value="MAIN_ADMIN">Main Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Branch</label>
                  <select
                    disabled={editForm.role === 'MAIN_ADMIN'}
                    value={editForm.branchId}
                    onChange={(e) => setEditForm({ ...editForm, branchId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold focus:outline-none focus:border-brand-500 disabled:opacity-50"
                  >
                    <option value="">-- Choose Branch --</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  <span>Reset Password (leave empty to keep current password)</span>
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Enter new password to reset"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="userActiveToggle"
                  checked={editForm.active}
                  onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="userActiveToggle" className="font-semibold text-slate-700 cursor-pointer">
                  Account is Active (uncheck to deactivate access)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {updateUserMutation.isPending ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
