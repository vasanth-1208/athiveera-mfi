import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Users, Calendar, MapPin, UserCheck, Phone, HandCoins, ArrowUpRight, Edit3, Trash2, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const GroupDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isManager } = useAuth();
  const isManagerOrAdmin = isAdmin || isManager;

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editGroupForm, setEditGroupForm] = useState({
    name: '',
    groupCode: 1,
    collectionDay: 'MONDAY',
    headName: '',
    headPhone: '',
    area: '',
    staffName: '',
    cycle: 1,
    status: 'LIVE'
  });
  const [editGroupError, setEditGroupError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: () => api.getGroup(id!),
    enabled: !!id
  });

  const updateGroupMutation = useMutation({
    mutationFn: (updateData: any) => api.updateGroup(id!, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setIsEditModalOpen(false);
      setEditGroupError('');
    },
    onError: (err: any) => {
      setEditGroupError(err.message || 'Failed to update group');
    }
  });

  const deleteGroupMutation = useMutation({
    mutationFn: () => api.deleteGroup(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      alert('Group deleted successfully');
      navigate('/groups');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete group');
    }
  });

  const handleOpenEdit = () => {
    if (!group) return;
    setEditGroupForm({
      name: group.name || '',
      groupCode: group.groupCode || 1,
      collectionDay: group.collectionDay || 'MONDAY',
      headName: group.headName || '',
      headPhone: group.headPhone || '',
      area: group.area || '',
      staffName: group.staffName || '',
      cycle: group.cycle || 1,
      status: group.status || 'LIVE'
    });
    setEditGroupError('');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroupForm.name) {
      setEditGroupError('Group name is required');
      return;
    }
    updateGroupMutation.mutate(editGroupForm);
  };

  const handleDeleteGroup = () => {
    if (!group) return;
    if (window.confirm(`Are you sure you want to permanently delete group "${group.name}" (Group #${group.groupCode})? This action cannot be undone.`)) {
      deleteGroupMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-xs text-slate-400">Loading group details...</p>
      </div>
    );
  }

  const group = data?.group;
  const rawMembers = data?.members || [];
  const loans = data?.loans || [];
  const summary = data?.summary || {};

  // Build unified member list (members + loan borrowers)
  const memberMap = new Map<string, any>();
  rawMembers.forEach((m: any) => {
    if (m && m._id) memberMap.set(String(m._id), m);
  });
  loans.forEach((l: any) => {
    if (l.customerId && typeof l.customerId === 'object' && l.customerId._id) {
      const custIdStr = String(l.customerId._id);
      if (!memberMap.has(custIdStr)) {
        memberMap.set(custIdStr, l.customerId);
      }
    }
  });
  const members = Array.from(memberMap.values());

  if (!group) {
    return (
      <div className="bg-white p-8 rounded-xl text-center space-y-3">
        <p className="text-base font-bold text-slate-800">Group not found</p>
        <Link to="/groups" className="text-xs text-brand-600 hover:underline">
          &larr; Back to groups
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link
          to="/groups"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Groups & Routes</span>
        </Link>

        <div className="flex items-center gap-2">
          {isManagerOrAdmin && (
            <button
              onClick={handleOpenEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-xl text-xs border border-amber-300 transition cursor-pointer shadow-xs"
              title="Edit all fields of group"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-700" />
              <span>Edit Group</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleDeleteGroup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-300 transition cursor-pointer shadow-xs"
              title="Delete group record (Admin only)"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Delete Group</span>
            </button>
          )}
        </div>
      </div>

      {/* Header Banner */}
      <div className="bg-[#fffdfa] p-6 rounded-2xl border border-[#ded3be] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs">
              Group #{group.groupCode} &bull; Cycle {group.cycle} {group.cycle === 1 ? '(Fresh)' : '(Renewal)'}
            </span>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
              group.status === 'LIVE' 
                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60' 
                : 'bg-stone-200 dark:bg-stone-800/60 text-stone-800 dark:text-stone-300 border border-stone-300 dark:border-stone-700'
            }`}>
              {group.status}
            </span>
          </div>
          <h2 className="text-2xl font-black text-stone-900">{group.name}</h2>
          <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600 pt-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 uppercase">
              <Calendar className="w-3.5 h-3.5 text-amber-700" />
              <span>Route: {group.collectionDay}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-700" />
              <span>Area: <strong className="text-stone-800">{group.area || 'N/A'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-amber-700" />
              <span>Staff: <strong className="text-stone-800">{group.staffName || 'Unassigned'}</strong></span>
            </div>
            {group.headPhone && (
              <a
                href={`tel:${group.headPhone.replace(/[^0-9+]/g, '')}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#f6f0e4] hover:bg-emerald-50 text-emerald-900 hover:text-emerald-950 font-bold rounded-lg border border-[#ded3be] hover:border-emerald-300 transition cursor-pointer"
                title={`Click to call Group Head: ${group.headName} (${group.headPhone})`}
              >
                <Phone className="w-3 h-3 text-emerald-600" />
                <span>Head: {group.headName} ({group.headPhone})</span>
              </a>
            )}
          </div>
        </div>

        {/* Group Totals Card */}
        <div className="grid grid-cols-2 gap-3 bg-[#fcf9f2] p-4 rounded-xl border border-[#ded3be] text-xs">
          <div>
            <p className="text-stone-500 text-[10px] uppercase font-bold">Total Portfolio</p>
            <p className="font-black text-stone-900 text-base">₹{Number(summary.totalPrincipal || 0).toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-stone-500 text-[10px] uppercase font-bold">Total Collected</p>
            <p className="font-black text-emerald-700 text-base">₹{Number(summary.totalCollected || 0).toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-stone-500 text-[10px] uppercase font-bold">Balance Due</p>
            <p className="font-black text-rose-700 text-base">₹{Number(summary.totalOutstanding || 0).toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-stone-500 text-[10px] uppercase font-bold">Active Members</p>
            <p className="font-black text-amber-900 text-base">{members.length}</p>
          </div>
        </div>
      </div>

      {/* Group Members and Individual Loans */}
      <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-800" />
            <span>Group Members & Loan Accounts ({members.length})</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#fcf9f2] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
              <tr>
                <th className="px-4 py-3">Member Name</th>
                <th className="px-4 py-3">Customer ID</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Loan Account</th>
                <th className="px-4 py-3">Principal</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Outstanding</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ece3d4]">
              {members.length > 0 ? (
                members.map((m: any) => {
                  const memberLoan = loans.find((l: any) => String(l.customerId?._id) === String(m._id) || String(l.customerId) === String(m._id));
                  return (
                    <tr key={m._id} className="hover:bg-[#fbf7f0] transition">
                      <td className="px-4 py-3.5 font-bold text-stone-900">{m.name}</td>
                      <td className="px-4 py-3.5 font-mono text-stone-700 font-bold">{m.customerId}</td>
                      <td className="px-4 py-3.5">
                        {m.phone && m.phone !== '-' && m.phone !== 'No phone' ? (
                          <a
                            href={`tel:${m.phone.replace(/[^0-9+]/g, '')}`}
                            className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#f6f0e4] hover:bg-emerald-50 text-stone-800 hover:text-emerald-700 font-mono text-xs font-bold rounded-lg border border-[#ded3be] hover:border-emerald-300 transition cursor-pointer"
                            title={`Click to call ${m.name} (${m.phone})`}
                          >
                            <Phone className="w-2.5 h-2.5 text-emerald-600" />
                            <span>{m.phone}</span>
                          </a>
                        ) : (
                          <span className="font-mono text-stone-400 italic">No phone</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-stone-700">
                        {memberLoan ? memberLoan.loanNumber : <span className="text-stone-400 italic">No loan</span>}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-stone-800">
                        {memberLoan ? `₹${memberLoan.principal?.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-emerald-700">
                        {memberLoan ? `₹${memberLoan.totalPaid?.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-rose-700">
                        {memberLoan ? `₹${memberLoan.outstandingTotal?.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={`/customers/${m._id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#f6f0e4] hover:bg-[#ede3d0] text-amber-950 font-bold rounded-lg text-xs border border-[#ded3be] transition cursor-pointer"
                        >
                          <span>Profile</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-stone-400">
                    No members registered in this group
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Edit Group Modal (Manager & Admin - All Fields) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#fffdfa] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 my-8">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-700" />
                  <span>Edit Group #{group.groupCode}: {group.name}</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Update group details, route day, area, staff collector, head details, and status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-[#f6f0e4] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editGroupError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-medium">
                {editGroupError}
              </p>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-stone-800 mb-1">Group Name *</label>
                  <input
                    type="text"
                    required
                    value={editGroupForm.name}
                    onChange={(e) => setEditGroupForm({ ...editGroupForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">Group Code / Number *</label>
                  <input
                    type="number"
                    required
                    value={editGroupForm.groupCode}
                    onChange={(e) => setEditGroupForm({ ...editGroupForm, groupCode: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">Collection Day *</label>
                  <select
                    value={editGroupForm.collectionDay}
                    onChange={(e) => setEditGroupForm({ ...editGroupForm, collectionDay: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                  >
                    <option value="MONDAY">MONDAY</option>
                    <option value="TUESDAY">TUESDAY</option>
                    <option value="WEDNESDAY">WEDNESDAY</option>
                    <option value="THURSDAY">THURSDAY</option>
                    <option value="FRIDAY">FRIDAY</option>
                    <option value="SATURDAY">SATURDAY</option>
                    <option value="SUNDAY">SUNDAY</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">Operational Area / Village</label>
                  <input
                    type="text"
                    value={editGroupForm.area}
                    onChange={(e) => setEditGroupForm({ ...editGroupForm, area: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">Staff Collector</label>
                  <input
                    type="text"
                    value={editGroupForm.staffName}
                    onChange={(e) => setEditGroupForm({ ...editGroupForm, staffName: e.target.value })}
                    placeholder="e.g. Chandra Sekar"
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">Group Head Leader Name</label>
                  <input
                    type="text"
                    value={editGroupForm.headName}
                    onChange={(e) => setEditGroupForm({ ...editGroupForm, headName: e.target.value })}
                    placeholder="e.g. KAVITHA.M"
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">Group Head Phone</label>
                  <input
                    type="text"
                    value={editGroupForm.headPhone}
                    onChange={(e) => setEditGroupForm({ ...editGroupForm, headPhone: e.target.value })}
                    placeholder="10-digit number"
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">Lending Cycle</label>
                  <input
                    type="number"
                    min={1}
                    value={editGroupForm.cycle}
                    onChange={(e) => setEditGroupForm({ ...editGroupForm, cycle: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">Group Status</label>
                  <select
                    value={editGroupForm.status}
                    onChange={(e) => setEditGroupForm({ ...editGroupForm, status: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                  >
                    <option value="LIVE">LIVE (Active)</option>
                    <option value="CLOSED">CLOSED (Completed)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-[#ded3be] rounded-xl font-bold text-stone-700 hover:bg-[#faf6ee] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateGroupMutation.isPending}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-bold rounded-xl shadow-md shadow-amber-900/20 transition cursor-pointer disabled:opacity-50"
                >
                  {updateGroupMutation.isPending ? 'Saving...' : 'Save Group Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
