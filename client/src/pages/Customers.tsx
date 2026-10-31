import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Phone,
  ArrowUpRight,
  CheckCircle2,
  Edit3,
  Trash2,
  ShieldCheck,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';

export const Customers: React.FC = () => {
  const { selectedBranchId } = useBranch();
  const { isAdmin, isManager } = useAuth();
  const isManagerOrAdmin = isAdmin || isManager;
  const queryClient = useQueryClient();

  // Filters & Pagination State
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [sortBy, setSortBy] = useState('id_asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(100);

  const initialFormData = {
    name: '',
    phone: '',
    nomineePhone: '',
    address: '',
    area: '',
    smartCardNumber: '',
    aadharNumber: '',
    voterIdNumber: '',
    panNumber: '',
    notes: ''
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [formError, setFormError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<{
    field: string;
    value: string;
    customer: any;
  } | null>(null);

  // Edit Customer Modal State (Manager & Admin)
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    spouseName: '',
    nomineeName: '',
    nomineeRelationship: 'Spouse',
    nomineePhone: '',
    address: '',
    area: '',
    smartCardNumber: '',
    aadharNumber: '',
    voterIdNumber: '',
    panNumber: '',
    status: 'ACTIVE',
    notes: ''
  });
  const [editFormError, setEditFormError] = useState('');
  const [editDuplicateWarning, setEditDuplicateWarning] = useState<{
    field: string;
    value: string;
    customer: any;
  } | null>(null);

  const checkDuplicateForNew = (field: string, val: string) => {
    if (!val || val.trim().length < 3) {
      setDuplicateWarning(null);
      return;
    }
    const cleanVal = val.trim();
    api.checkCustomerDuplicate({ [field]: cleanVal })
      .then((res: any) => {
        if (res?.exists && res?.customer) {
          setDuplicateWarning({
            field: res.matchedField,
            value: res.matchedValue || cleanVal,
            customer: res.customer
          });
        } else {
          setDuplicateWarning(prev => (prev?.value === cleanVal ? null : prev));
        }
      })
      .catch(() => {});
  };

  const checkDuplicateForEdit = (field: string, val: string) => {
    if (!val || val.trim().length < 3) {
      setEditDuplicateWarning(null);
      return;
    }
    const cleanVal = val.trim();
    api.checkCustomerDuplicate({ [field]: cleanVal, excludeId: editingCustomer?._id })
      .then((res: any) => {
        if (res?.exists && res?.customer) {
          setEditDuplicateWarning({
            field: res.matchedField,
            value: res.matchedValue || cleanVal,
            customer: res.customer
          });
        } else {
          setEditDuplicateWarning(prev => (prev?.value === cleanVal ? null : prev));
        }
      })
      .catch(() => {});
  };

  const { data, isLoading } = useQuery({
    queryKey: ['customers', selectedBranchId, search, area, page, pageSize, sortBy],
    queryFn: () =>
      api.getCustomers({
        branchId: selectedBranchId,
        search,
        area,
        page,
        limit: pageSize === 'ALL' ? 'all' : pageSize,
        sortBy
      })
  });

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= (data?.pagination?.pages || 1)) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageSizeChange = (size: number | 'ALL') => {
    setPageSize(size);
    setPage(1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleAreaChange = (val: string) => {
    setArea(val);
    setPage(1);
  };

  const createCustomerMutation = useMutation({
    mutationFn: (newCust: any) => api.createCustomer(newCust),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsModalOpen(false);
      setFormData(initialFormData);
      setDuplicateWarning(null);
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create customer');
    }
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateCustomer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setEditingCustomer(null);
      setEditFormError('');
    },
    onError: (err: any) => {
      setEditFormError(err.message || 'Failed to update customer');
    }
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: string) => api.deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete customer');
    }
  });

  const handleOpenEdit = (c: any) => {
    setEditingCustomer(c);
    setEditFormData({
      name: c.name || '',
      phone: c.phone || '',
      spouseName: c.spouseName || '',
      nomineeName: c.nomineeName || '',
      nomineeRelationship: c.nomineeRelationship || 'Spouse',
      nomineePhone: c.nomineePhone || '',
      address: c.address || '',
      area: c.area || '',
      smartCardNumber: c.smartCardNumber || '',
      aadharNumber: c.aadharNumber || '',
      voterIdNumber: c.voterIdNumber || '',
      panNumber: c.panNumber || '',
      status: c.status || 'ACTIVE',
      notes: c.notes || ''
    });
    setEditFormError('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.name) {
      setEditFormError('Customer name is required');
      return;
    }
    updateCustomerMutation.mutate({
      id: editingCustomer._id,
      data: editFormData
    });
  };

  const handleDeleteCustomer = (c: any) => {
    if (window.confirm(`Are you sure you want to permanently delete customer "${c.name}" (${c.customerId})? This action cannot be undone.`)) {
      deleteCustomerMutation.mutate(c._id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setFormError('Customer name is required');
      return;
    }
    createCustomerMutation.mutate({
      ...formData,
      branchId: selectedBranchId
    });
  };

  const customers = data?.customers || [];
  const counts = data?.counts || { total: 0, active: 0, closed: 0, activeLoansCount: 0, closedLoansCount: 0 };
  const pagination = data?.pagination || { page: 1, limit: 100, total: 0, pages: 1 };

  const [custSortCol, setCustSortCol] = useState<string>('customerId');
  const [custSortDir, setCustSortDir] = useState<'asc' | 'desc'>('asc');

  const handleCustSort = (col: string) => {
    if (custSortCol === col) {
      setCustSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setCustSortCol(col);
      setCustSortDir('asc');
    }
  };

  const sortedCustomers = [...customers].sort((a: any, b: any) => {
    let valA = '';
    let valB = '';
    if (custSortCol === 'customerId') {
      const numA = parseInt((a.customerId || '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt((b.customerId || '').replace(/\D/g, ''), 10) || 0;
      return custSortDir === 'asc' ? numA - numB : numB - numA;
    }
    if (custSortCol === 'name') {
      valA = a.name || '';
      valB = b.name || '';
    } else if (custSortCol === 'phone') {
      valA = a.phone || '';
      valB = b.phone || '';
    } else if (custSortCol === 'nomineePhone') {
      valA = a.nomineePhone || '';
      valB = b.nomineePhone || '';
    } else if (custSortCol === 'area') {
      valA = a.area || '';
      valB = b.area || '';
    } else if (custSortCol === 'group') {
      valA = a.activeGroupId?.name || '';
      valB = b.activeGroupId?.name || '';
    } else if (custSortCol === 'loan') {
      const balA = a.loan?.balanceOutstanding ?? 0;
      const balB = b.loan?.balanceOutstanding ?? 0;
      return custSortDir === 'asc' ? balA - balB : balB - balA;
    }
    const cmp = valA.localeCompare(valB);
    return custSortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">Customer Directory</h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Manage permanent borrower records, contact information, loan history, and group allocations
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 rounded-xl text-xs font-bold shadow-md shadow-amber-900/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Register Customer</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-800 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Total Borrowers</p>
            <p className="text-xl font-black text-stone-900 mt-0.5">{counts.total?.toLocaleString() || customers.length}</p>
            <p className="text-[10px] text-stone-500 font-medium">Permanent Master Registry</p>
          </div>
        </div>

        <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-700 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Active Loan Cycles</p>
            <p className="text-xl font-black text-emerald-800 mt-0.5">{counts.activeLoansCount?.toLocaleString() || '197'}</p>
            <p className="text-[10px] text-stone-500 font-medium">Weekly Collections Route</p>
          </div>
        </div>

        <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-700/15 flex items-center justify-center text-amber-900 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">Settled / Closed</p>
            <p className="text-xl font-black text-amber-900 mt-0.5">{counts.closedLoansCount?.toLocaleString() || '154'}</p>
            <p className="text-[10px] text-stone-500 font-medium">Ready for New Reloan</p>
          </div>
        </div>

        <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-500/15 flex items-center justify-center text-stone-700 shrink-0">
            <Filter className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Currently Showing</p>
            <p className="text-xl font-black text-stone-900 mt-0.5">
              {customers.length} <span className="text-xs font-bold text-stone-500">/ {counts.total || customers.length}</span>
            </p>
            <p className="text-[10px] text-stone-500 font-medium">
              Page {pagination.page} of {pagination.pages || 1} • {pageSize === 'ALL' ? 'All' : `${pageSize}/page`}
            </p>
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-[#fffdfa] p-3 rounded-2xl border border-[#ded3be] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by customer name, phone, ID, or area..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-amber-600 shadow-xs"
            />
            {search && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>



          {/* Sort Dropdown */}
          <div className="relative sm:w-56">
            <ArrowUpDown className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
            <select
              value={sortBy}
              onChange={handleSortChange}
              className="w-full pl-8 pr-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-600 appearance-none cursor-pointer"
            >
              <option value="id_asc">ID: Low to High</option>
              <option value="id_desc">ID: High to Low</option>
              <option value="name_asc">Borrower: Name (A → Z)</option>
              <option value="name_desc">Borrower: Name (Z → A)</option>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Page Size Selector */}
        <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
          <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">Per Page:</span>
          {([50, 100, 200, 'ALL'] as (number | 'ALL')[]).map((size) => (
            <button
              key={size}
              onClick={() => handlePageSizeChange(size)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                pageSize === size
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-stone-700 border border-[#ded3be] hover:bg-stone-100'
              }`}
            >
              {size === 'ALL' ? `All (${counts.total || customers.length})` : size}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f6f0e4] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
              <tr>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleCustSort('customerId')}>
                  <div className="flex items-center gap-1">
                    <span>Customer ID</span>
                    {custSortCol === 'customerId' ? (
                      custSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleCustSort('name')}>
                  <div className="flex items-center gap-1">
                    <span>Borrower Name</span>
                    {custSortCol === 'name' ? (
                      custSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleCustSort('phone')}>
                  <div className="flex items-center gap-1">
                    <span>Primary Phone</span>
                    {custSortCol === 'phone' ? (
                      custSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleCustSort('nomineePhone')}>
                  <div className="flex items-center gap-1">
                    <span>Nominee Phone</span>
                    {custSortCol === 'nomineePhone' ? (
                      custSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleCustSort('area')}>
                  <div className="flex items-center gap-1">
                    <span>Operational Area</span>
                    {custSortCol === 'area' ? (
                      custSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleCustSort('group')}>
                  <div className="flex items-center gap-1">
                    <span>Assigned Group</span>
                    {custSortCol === 'group' ? (
                      custSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleCustSort('loan')}>
                  <div className="flex items-center gap-1">
                    <span>Loan Status & Balance</span>
                    {custSortCol === 'loan' ? (
                      custSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-700" /> : <ArrowDown className="w-3 h-3 text-amber-700" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ece3d4]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-stone-400 font-medium">
                    Loading customer directory...
                  </td>
                </tr>
              ) : sortedCustomers.length > 0 ? (
                sortedCustomers.map((c: any) => (
                  <tr key={c._id} className="hover:bg-[#fbf7f0] transition">
                    <td className="px-4 py-3.5 font-mono font-bold text-stone-800">{c.customerId}</td>
                    <td className="px-4 py-3.5 font-bold text-stone-900">{c.name}</td>
                    <td className="px-4 py-3.5 text-stone-600 font-mono">
                      {c.phone && c.phone !== '-' && c.phone.toLowerCase() !== 'no phone' ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.phone.split(/[/,]/).map((num: string, idx: number) => {
                            const cleanNum = num.trim();
                            if (!cleanNum) return null;
                            return (
                              <a
                                key={idx}
                                href={`tel:${cleanNum.replace(/[^0-9+]/g, '')}`}
                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#f6f0e4] hover:bg-emerald-50 text-stone-800 hover:text-emerald-700 font-bold rounded-lg border border-[#ded3be] hover:border-emerald-300 transition cursor-pointer"
                                title={`Click to call ${c.name} (${cleanNum})`}
                              >
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <span>{cleanNum}</span>
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-stone-400 italic">No phone</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-stone-500 font-mono">
                      {c.nomineePhone && c.nomineePhone !== '-' && c.nomineePhone !== '-----' ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {c.nomineePhone.split(/[/,]/).map((num: string, idx: number) => {
                            const cleanNum = num.trim();
                            if (!cleanNum) return null;
                            return (
                              <a
                                key={idx}
                                href={`tel:${cleanNum.replace(/[^0-9+]/g, '')}`}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 hover:bg-emerald-50 text-stone-700 hover:text-emerald-700 font-medium rounded-lg border border-transparent hover:border-emerald-200 transition cursor-pointer"
                                title={`Click to call nominee (${cleanNum})`}
                              >
                                <Phone className="w-2.5 h-2.5 text-stone-400" />
                                <span>{cleanNum}</span>
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-stone-800 font-medium">{c.area || '-'}</td>
                    <td className="px-4 py-3.5 text-stone-800">
                      {c.activeGroupId ? (
                        <div>
                          <span className="font-bold text-stone-900 block">{c.activeGroupId.name}</span>
                          <span className="text-[10px] text-amber-800 font-bold uppercase">
                            {c.activeGroupId.collectionDay}
                          </span>
                        </div>
                      ) : (
                        <span className="text-stone-400 italic text-[11px]">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {c.loan ? (
                        c.loan.status === 'ACTIVE' || c.loan.status === 'OVERDUE' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              <span>ACTIVE LOAN</span>
                            </span>
                            <div className="font-mono text-[11px] text-stone-700">
                              <span className="font-bold text-stone-900">₹{(c.loan.outstandingTotal ?? 0).toLocaleString()}</span>
                              <span className="text-stone-400"> / ₹{((c.loan.totalPayable || c.loan.totalReceivable) ?? c.loan.principal ?? 0).toLocaleString()}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <ShieldCheck className="w-2.5 h-2.5 text-amber-700" />
                              <span>SETTLED (CLOSED)</span>
                            </span>
                            <p className="text-[10px] text-stone-500 font-medium">Eligible for Reloan</p>
                          </div>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-300">
                          <span>NO ACTIVE LOAN</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/customers/${c._id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#f6f0e4] hover:bg-[#ede3d0] text-amber-950 font-bold rounded-lg text-xs border border-[#ded3be] transition cursor-pointer"
                          title="View Profile & Loan History"
                        >
                          <span>Profile</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />
                        </Link>

                        {isManagerOrAdmin && (
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-lg text-xs border border-amber-300 transition cursor-pointer"
                            title="Edit Customer Details (All Fields)"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                            <span>Edit</span>
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteCustomer(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs border border-rose-300 transition cursor-pointer"
                            title="Delete Customer (Admin Only)"
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
                  <td colSpan={8} className="text-center py-12 text-stone-400 font-medium">
                    No customers found matching filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-[#fbf7f0] border-t border-[#ded3be] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-stone-600 font-medium">
            Showing{' '}
            <span className="font-bold text-stone-900">
              {customers.length === 0
                ? 0
                : (pagination.page - 1) * (pageSize === 'ALL' ? counts.total : pageSize) + 1}
            </span>
            {' '}–{' '}
            <span className="font-bold text-stone-900">
              {customers.length === 0
                ? 0
                : Math.min(
                    (pagination.page - 1) * (pageSize === 'ALL' ? counts.total : pageSize) + customers.length,
                    counts.total
                  )}
            </span>
            {' '}of{' '}
            <span className="font-bold text-amber-900">{counts.total}</span> Registered Customers
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg border border-[#ded3be] bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg border border-[#ded3be] bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 py-1 bg-white border border-[#ded3be] rounded-lg font-bold text-stone-900 text-xs">
              Page {pagination.page} of {Math.max(1, pagination.pages || 1)}
            </div>

            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= (pagination.pages || 1)}
              className="p-1.5 rounded-lg border border-[#ded3be] bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePageChange(pagination.pages || 1)}
              disabled={pagination.page >= (pagination.pages || 1)}
              className="p-1.5 rounded-lg border border-[#ded3be] bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* New Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-900/30">
            <div className="border-b border-[#ded3be] pb-3">
              <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-700" />
                <span>Register New Customer</span>
              </h3>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                Add a new verified borrower to the branch registry.
              </p>
            </div>

            {formError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-medium">
                {formError}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-stone-800 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. KAVITHA.M"
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      checkDuplicateForNew('phone', e.target.value);
                    }}
                    placeholder="10-digit number"
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Nominee Contact</label>
                  <input
                    type="text"
                    value={formData.nomineePhone}
                    onChange={(e) => setFormData({ ...formData, nomineePhone: e.target.value })}
                    placeholder="Nominee phone"
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              {/* KYC Identification Inputs */}
              <div className="space-y-2 pt-1 border-t border-[#ded3be]">
                <span className="font-bold text-stone-700 text-[11px] block">Government KYC Credentials</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 text-[10px] mb-0.5">Aadhaar Card #</label>
                    <input
                      type="text"
                      maxLength={14}
                      value={formData.aadharNumber}
                      onChange={(e) => {
                        setFormData({ ...formData, aadharNumber: e.target.value });
                        checkDuplicateForNew('aadharNumber', e.target.value);
                      }}
                      placeholder="12-digit Aadhaar"
                      className="w-full px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 text-[10px] mb-0.5">Smart Card (Ration) #</label>
                    <input
                      type="text"
                      value={formData.smartCardNumber}
                      onChange={(e) => {
                        setFormData({ ...formData, smartCardNumber: e.target.value.toUpperCase() });
                        checkDuplicateForNew('smartCardNumber', e.target.value);
                      }}
                      placeholder="e.g. 33/G/0294821"
                      className="w-full px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 text-[10px] mb-0.5">Voter ID #</label>
                    <input
                      type="text"
                      value={formData.voterIdNumber}
                      onChange={(e) => {
                        setFormData({ ...formData, voterIdNumber: e.target.value.toUpperCase() });
                        checkDuplicateForNew('voterIdNumber', e.target.value);
                      }}
                      placeholder="e.g. TN/12/084/102948"
                      className="w-full px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600 uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 text-[10px] mb-0.5">PAN Card #</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={formData.panNumber}
                      onChange={(e) => {
                        setFormData({ ...formData, panNumber: e.target.value.toUpperCase() });
                        checkDuplicateForNew('panNumber', e.target.value);
                      }}
                      placeholder="e.g. ABCDE1234F"
                      className="w-full px-3 py-1.5 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600 uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Real-time duplicate warning */}
              {duplicateWarning && (
                <div className="p-2.5 bg-rose-50 border-2 border-rose-400 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">
                      ⚠️ Duplicate Number! Already exists in system.
                    </p>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      Matched {duplicateWarning.field} (<strong>{duplicateWarning.value}</strong>) belonging to: <strong>{duplicateWarning.customer.name}</strong> ({duplicateWarning.customer.customerId} • Area: {duplicateWarning.customer.area || 'N/A'})
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-stone-800 mb-1">Operational Area / Village</label>
                <input
                  type="text"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  placeholder="e.g. PONNAYUR, SOMANDURAI, ANAIMALAI"
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">Residential Address</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street name, landmark..."
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                />
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
                  disabled={createCustomerMutation.isPending}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-bold rounded-xl shadow-md shadow-amber-900/20 transition cursor-pointer disabled:opacity-50"
                >
                  {createCustomerMutation.isPending ? 'Registering...' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Customer Modal (Manager & Admin - All Fields) */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#fffdfa] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-700" />
                  <span>Edit Customer: {editingCustomer.name}</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Update customer records, nominee contact, KYC documents, and account status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-[#f6f0e4] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editFormError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-medium">
                {editFormError}
              </p>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              {/* Section 1: Basic Information */}
              <div className="space-y-3">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-[#ece3d4] pb-1">
                  1. Borrower Basic Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Customer Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Primary Phone Number</label>
                    <input
                      type="text"
                      value={editFormData.phone}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, phone: e.target.value });
                        checkDuplicateForEdit('phone', e.target.value);
                      }}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Spouse Name</label>
                    <input
                      type="text"
                      value={editFormData.spouseName}
                      onChange={(e) => setEditFormData({ ...editFormData, spouseName: e.target.value })}
                      placeholder="Spouse / Husband Name"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Operational Area / Village</label>
                    <input
                      type="text"
                      value={editFormData.area}
                      onChange={(e) => setEditFormData({ ...editFormData, area: e.target.value })}
                      placeholder="e.g. PONNAYUR, SOMANDURAI"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-stone-800 mb-1">Residential Address</label>
                    <textarea
                      rows={2}
                      value={editFormData.address}
                      onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                      placeholder="Complete residential address..."
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Nominee Details */}
              <div className="space-y-3">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-[#ece3d4] pb-1">
                  2. Family / Nominee Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Nominee Name</label>
                    <input
                      type="text"
                      value={editFormData.nomineeName}
                      onChange={(e) => setEditFormData({ ...editFormData, nomineeName: e.target.value })}
                      placeholder="Nominee full name"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Relationship</label>
                    <input
                      type="text"
                      value={editFormData.nomineeRelationship}
                      onChange={(e) => setEditFormData({ ...editFormData, nomineeRelationship: e.target.value })}
                      placeholder="e.g. Spouse, Mother, Son"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Nominee Phone</label>
                    <input
                      type="text"
                      value={editFormData.nomineePhone}
                      onChange={(e) => setEditFormData({ ...editFormData, nomineePhone: e.target.value })}
                      placeholder="Nominee contact number"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: KYC & Identity Documents */}
              <div className="space-y-3">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-[#ece3d4] pb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                  <span>3. KYC & Government Identification Credentials</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Smart Card (Ration Card) #</label>
                    <input
                      type="text"
                      value={editFormData.smartCardNumber}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, smartCardNumber: e.target.value.toUpperCase() });
                        checkDuplicateForEdit('smartCardNumber', e.target.value);
                      }}
                      placeholder="e.g. 33/G/0294821"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono uppercase text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Aadhaar Card #</label>
                    <input
                      type="text"
                      value={editFormData.aadharNumber}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, aadharNumber: e.target.value });
                        checkDuplicateForEdit('aadharNumber', e.target.value);
                      }}
                      placeholder="e.g. 9845 2841 0294"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Voter ID Card #</label>
                    <input
                      type="text"
                      value={editFormData.voterIdNumber}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, voterIdNumber: e.target.value.toUpperCase() });
                        checkDuplicateForEdit('voterIdNumber', e.target.value);
                      }}
                      placeholder="e.g. TN/12/084/102948"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono uppercase text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">PAN Card #</label>
                    <input
                      type="text"
                      value={editFormData.panNumber}
                      onChange={(e) => {
                        setEditFormData({ ...editFormData, panNumber: e.target.value.toUpperCase() });
                        checkDuplicateForEdit('panNumber', e.target.value);
                      }}
                      placeholder="e.g. ABCDE1234F"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono uppercase text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>

                {/* Edit real-time duplicate warning */}
                {editDuplicateWarning && (
                  <div className="p-2.5 bg-rose-50 border-2 border-rose-400 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        ⚠️ Duplicate KYC Detected! Number already registered.
                      </p>
                      <p className="text-[11px] text-rose-700 mt-0.5">
                        Matched {editDuplicateWarning.field} (<strong>{editDuplicateWarning.value}</strong>) belonging to: <strong>{editDuplicateWarning.customer.name}</strong> ({editDuplicateWarning.customer.customerId} • Area: {editDuplicateWarning.customer.area || 'N/A'})
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Status & Notes */}
              <div className="space-y-3">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-[#ece3d4] pb-1">
                  4. Status & Verification Remarks
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Account Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="BLACKLISTED">BLACKLISTED</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-stone-800 mb-1">Internal Notes / KYC Remarks</label>
                    <input
                      type="text"
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                      placeholder="Any additional borrower remarks..."
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 border border-[#ded3be] rounded-xl font-bold text-stone-700 hover:bg-[#faf6ee] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateCustomerMutation.isPending}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-bold rounded-xl shadow-md shadow-amber-900/20 transition cursor-pointer disabled:opacity-50"
                >
                  {updateCustomerMutation.isPending ? 'Saving Changes...' : 'Save All Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
