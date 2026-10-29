import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FolderTree, Plus, Search, Calendar, MapPin, UserCheck, ArrowUpRight, Phone, Info, Edit3, Trash2, X, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';

const WEEKDAYS = ['ALL', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];

export const Groups: React.FC = () => {
  const { user, isStaff, isManager, isAdmin } = useAuth();
  const isManagerOrAdmin = isAdmin || isManager;
  const { selectedBranchId } = useBranch();
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    collectionDay: 'MONDAY',
    headName: '',
    headPhone: '',
    area: '',
    staffName: '',
    cycle: 1
  });

  // Edit Group Modal State (Manager & Admin)
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
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

  const todayWeekday = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date().getDay()];

  const { data, isLoading } = useQuery({
    queryKey: ['groups', selectedBranchId, selectedDay, search, user?.role, user?.username],
    queryFn: () => api.getGroups({
      branchId: selectedBranchId,
      collectionDay: selectedDay !== 'ALL' ? selectedDay : undefined,
      search
    })
  });

  const createGroupMutation = useMutation({
    mutationFn: (newGrp: any) => api.createGroup(newGrp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setIsModalOpen(false);
      setFormData({ name: '', collectionDay: 'MONDAY', headName: '', headPhone: '', area: '', staffName: '', cycle: 1 });
    }
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setEditingGroup(null);
      setEditGroupError('');
    },
    onError: (err: any) => {
      setEditGroupError(err.message || 'Failed to update group');
    }
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => api.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete group');
    }
  });

  const handleOpenEdit = (g: any) => {
    setEditingGroup(g);
    setEditGroupForm({
      name: g.name || '',
      groupCode: g.groupCode || 1,
      collectionDay: g.collectionDay || 'MONDAY',
      headName: g.headName || '',
      headPhone: g.headPhone || '',
      area: g.area || '',
      staffName: g.staffName || '',
      cycle: g.cycle || 1,
      status: g.status || 'LIVE'
    });
    setEditGroupError('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroupForm.name) {
      setEditGroupError('Group name is required');
      return;
    }
    updateGroupMutation.mutate({
      id: editingGroup._id,
      data: editGroupForm
    });
  };

  const handleDeleteGroup = (g: any) => {
    if (window.confirm(`Are you sure you want to permanently delete group "${g.name}" (Group #${g.groupCode})? This action cannot be undone.`)) {
      deleteGroupMutation.mutate(g._id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createGroupMutation.mutate({
      ...formData,
      branchId: selectedBranchId
    });
  };

  const rawGroups = data?.groups || [];

  const [showClosed, setShowClosed] = useState(false);

  // Filter groups: For collection staff, only show LIVE groups where staff name or ID matches
  const filteredGroups = rawGroups.filter((g: any) => {
    if (isStaff) {
      if (g.status === 'CLOSED') return false;
      const staffName = (g.staffName || '').toLowerCase().trim();
      const uName = (user?.name || '').toLowerCase().trim();
      const uUsername = (user?.username || '').toLowerCase().trim();
      const gStaffId = g.staffId?._id || g.staffId;
      const uId = user?.id || user?._id;

      const idMatch = gStaffId && uId && String(gStaffId) === String(uId);
      const nameMatch = staffName && (
        staffName === uName || 
        staffName === uUsername || 
        uName.includes(staffName) || 
        staffName.includes(uUsername)
      );
      return idMatch || nameMatch;
    }
    return true;
  });

  const totalClosedCount = filteredGroups.filter((g: any) => g.status === 'CLOSED').length;

  const groups = showClosed
    ? [...filteredGroups].sort((a: any, b: any) => {
        const aClosed = a.status === 'CLOSED' ? 1 : 0;
        const bClosed = b.status === 'CLOSED' ? 1 : 0;
        return bClosed - aClosed; // Closed at top, live below
      })
    : filteredGroups.filter((g: any) => g.status !== 'CLOSED'); // Closed hidden, live at top

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">
            {isStaff ? 'My Assigned Groups & Routes' : 'Customer Groups & Routes'}
          </h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            {isStaff
              ? 'Active borrowing circles assigned to you for weekly field collections and route registers'
              : 'Organize borrowing circles by weekday collection routes, assign group heads and field collection officers'}
          </p>
        </div>

        {/* Action Buttons: Settled Groups Toggle + Create Group */}
        <div className="flex items-center gap-2">
          {!isStaff && (
            <button
              type="button"
              onClick={() => setShowClosed(prev => !prev)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs border shrink-0 ${
                showClosed
                  ? 'bg-[#251b14] text-amber-300 border-amber-800/60'
                  : 'bg-white text-stone-700 border-[#ded3be] hover:bg-[#faf6ee]'
              }`}
              title={showClosed ? "Hide closed groups (Closed shown at top)" : "Show closed groups (Closed currently hidden)"}
            >
              {showClosed ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5 text-stone-500" />}
              <span>{showClosed ? 'Closed Groups (Shown)' : 'Closed Groups (Hidden)'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                showClosed ? 'bg-amber-400 text-stone-950' : 'bg-[#ece3d4] text-stone-700'
              }`}>
                {totalClosedCount}
              </span>
            </button>
          )}

          {/* Create Group Button - Only for Manager and Admin */}
          {!isStaff && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 rounded-xl text-xs font-bold shadow-md shadow-amber-900/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Group</span>
            </button>
          )}
        </div>
      </div>

      {/* Weekday Route Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {WEEKDAYS.map((day) => {
            const isToday = day === todayWeekday;
            const isSelected = selectedDay === day;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
                    : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
                }`}
              >
                <span>{day === 'ALL' ? 'All Routes' : `${day} Route`}</span>
                {isToday && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-black tracking-wide uppercase ${
                    isSelected ? 'bg-amber-400 text-stone-950' : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    Today Working
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search group name, head, or area..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-amber-600 shadow-xs"
          />
        </div>
      </div>

      {/* Grid of Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-xs text-stone-400 font-medium bg-[#fffdfa] rounded-2xl border border-[#ded3be]">
            Loading assigned groups...
          </div>
        ) : groups.length > 0 ? (
          groups.map((g: any) => (
            <div
              key={g._id}
              className="bg-[#fffdfa] p-5 rounded-2xl border border-[#ded3be] shadow-xs hover:shadow-md transition space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span 
                    title={g.cycle === 1 ? 'Cycle 1: Initial loan round' : `Cycle ${g.cycle}: Renewal loan round after successfully clearing previous cycle`}
                    className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs inline-flex items-center gap-1.5"
                  >
                    <span>Group #{g.groupCode}</span>
                    <span className="text-amber-500/80">•</span>
                    <span className="text-amber-200">
                      {g.cycle === 1 ? 'Cycle 1 (Fresh)' : g.cycle === 2 ? 'Cycle 2 (Renewal)' : `Cycle ${g.cycle}`}
                    </span>
                  </span>
                  <h3 className="text-base font-black text-stone-900 mt-2">{g.name}</h3>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  g.status === 'LIVE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-stone-100 text-stone-700 border border-stone-300'
                }`}>
                  {g.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-stone-600 pt-2 border-t border-[#ece3d4]">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 flex items-center gap-1 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-amber-700" />
                    <span>Collection Day:</span>
                  </span>
                  <span className="font-bold text-amber-900 uppercase">{g.collectionDay}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 flex items-center gap-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-amber-700" />
                    <span>Area:</span>
                  </span>
                  <span className="font-bold text-stone-800">{g.area || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 flex items-center gap-1 font-medium">
                    <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                    <span>Staff Collector:</span>
                  </span>
                  <span className="font-bold text-stone-800">{g.staffName || 'Unassigned'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-stone-500 font-medium shrink-0">Group Head:</span>
                  <div className="font-bold text-stone-800 flex items-center gap-1.5 flex-wrap justify-end">
                    <span>{g.headName || '-'}</span>
                    {g.headPhone && (
                      <a
                        href={`tel:${g.headPhone.replace(/[^0-9+]/g, '')}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#f6f0e4] hover:bg-emerald-50 text-emerald-800 hover:text-emerald-900 font-mono text-[11px] font-bold rounded border border-[#ded3be] hover:border-emerald-300 transition cursor-pointer"
                        title={`Click to call ${g.headName} (${g.headPhone})`}
                      >
                        <Phone className="w-2.5 h-2.5 text-emerald-600" />
                        <span>{g.headPhone}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#ece3d4] flex items-center justify-between gap-2">
                <span className="text-xs text-stone-500 font-bold shrink-0">
                  {g.totalMembers || 0} Members
                </span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <Link
                    to={`/groups/${g._id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#f6f0e4] hover:bg-[#ede3d0] text-amber-950 font-bold rounded-lg text-xs border border-[#ded3be] transition cursor-pointer"
                    title="View details"
                  >
                    <span>Details</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />
                  </Link>

                  {isManagerOrAdmin && (
                    <button
                      onClick={() => handleOpenEdit(g)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-lg text-xs border border-amber-300 transition cursor-pointer"
                      title="Edit Group (All Fields)"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                      <span>Edit</span>
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteGroup(g)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs border border-rose-300 transition cursor-pointer"
                      title="Delete Group (Admin Only)"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-xs text-stone-400 font-medium bg-[#fffdfa] rounded-2xl border border-[#ded3be]">
            {isStaff
              ? 'No active groups currently assigned to you matching this filter.'
              : 'No groups found matching filter.'}
          </div>
        )}
      </div>

      {/* New Group Modal - Only available for Managers / Admins */}
      {isModalOpen && !isStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-900/30">
            <div className="border-b border-[#ded3be] pb-3">
              <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-amber-700" />
                <span>Create New Group</span>
              </h3>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                Establish a new joint liability collection group.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-stone-800 mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. BALA MURUGAN GROUP - 99"
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Collection Day *</label>
                  <select
                    value={formData.collectionDay}
                    onChange={(e) => setFormData({ ...formData, collectionDay: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-800 focus:outline-none focus:border-amber-600"
                  >
                    <option value="MONDAY">MONDAY</option>
                    <option value="TUESDAY">TUESDAY</option>
                    <option value="WEDNESDAY">WEDNESDAY</option>
                    <option value="THURSDAY">THURSDAY</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Loan Cycle</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.cycle}
                    onChange={(e) => setFormData({ ...formData, cycle: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">Operational Area</label>
                <input
                  type="text"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  placeholder="e.g. PONNAYUR, SOMANDURAI"
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">Assigned Staff / Collector</label>
                <input
                  type="text"
                  value={formData.staffName}
                  onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                  placeholder="e.g. VIGNESH, SEKAR, RASEETH"
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Group Head Name</label>
                  <input
                    type="text"
                    value={formData.headName}
                    onChange={(e) => setFormData({ ...formData, headName: e.target.value })}
                    placeholder="Head name"
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Head Phone</label>
                  <input
                    type="text"
                    value={formData.headPhone}
                    onChange={(e) => setFormData({ ...formData, headPhone: e.target.value })}
                    placeholder="10-digit number"
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#ded3be] rounded-xl font-bold text-stone-700 hover:bg-[#faf6ee] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createGroupMutation.isPending}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-bold rounded-xl shadow-md shadow-amber-900/20 transition cursor-pointer disabled:opacity-50"
                >
                  {createGroupMutation.isPending ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Group Modal (Manager & Admin - All Fields) */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#fffdfa] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 my-8">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <FolderTree className="w-5 h-5 text-amber-700" />
                  <span>Edit Group #{editingGroup.groupCode}: {editingGroup.name}</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Update group details, route day, area, staff collector, head details, and status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
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
                  onClick={() => setEditingGroup(null)}
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
