import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  Users,
  HandCoins,
  Calendar,
  Layers,
  Search,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  GitMerge,
  Filter,
  X,
  Phone,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Check,
  CalendarDays,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

type MasterTab = 'CUSTOMERS' | 'LOANS' | 'INSTALLMENTS' | 'GROUPS';

// ==============================================================
// REUSABLE INLINE EDITABLE CELL COMPONENTS
// ==============================================================

interface InlineTextCellProps {
  value: string | number;
  onSave: (val: string) => Promise<any> | void;
  type?: 'text' | 'number';
  placeholder?: string;
  className?: string;
  prefix?: string;
  suffix?: string;
  badge?: boolean;
  badgeClassName?: string;
  disabled?: boolean;
  title?: string;
}

const InlineTextCell: React.FC<InlineTextCellProps> = ({
  value,
  onSave,
  type = 'text',
  placeholder = '-',
  className = '',
  prefix = '',
  suffix = '',
  badge = false,
  badgeClassName = '',
  disabled = false,
  title = 'Click to edit inline'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentVal, setCurrentVal] = useState(String(value ?? ''));
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isEditing) {
      setCurrentVal(String(value ?? ''));
    }
  }, [value, isEditing]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCommit = async () => {
    if (disabled || isSaving) return;
    const trimmed = currentVal.trim();
    if (trimmed === String(value ?? '').trim()) {
      setIsEditing(false);
      return;
    }
    try {
      setIsSaving(true);
      await onSave(trimmed);
      setIsEditing(false);
    } catch {
      setCurrentVal(String(value ?? ''));
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      setCurrentVal(String(value ?? ''));
      setIsEditing(false);
    }
  };

  if (disabled) {
    return (
      <span className={className}>
        {prefix}{value ?? placeholder}{suffix}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-1 relative z-10" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type={type}
          value={currentVal}
          onChange={(e) => setCurrentVal(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="px-2 py-0.5 bg-white border-2 border-amber-600 rounded-lg text-xs font-bold text-stone-900 shadow-md outline-none min-w-[70px] max-w-[140px]"
        />
        {isSaving && <Loader2 className="w-3 h-3 text-amber-700 animate-spin shrink-0" />}
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      title={title}
      className={`group/inline inline-flex items-center gap-1 cursor-pointer hover:bg-amber-100/70 hover:text-amber-950 px-1.5 py-0.5 -mx-1.5 rounded-md transition border border-transparent hover:border-amber-300/80 ${className}`}
    >
      {badge ? (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeClassName}`}>
          {prefix}{value !== undefined && value !== null && value !== '' ? value : placeholder}{suffix}
        </span>
      ) : (
        <span>
          {prefix}{value !== undefined && value !== null && value !== '' ? (typeof value === 'number' ? value.toLocaleString('en-IN') : value) : placeholder}{suffix}
        </span>
      )}
      <Edit3 className="w-2.5 h-2.5 text-stone-300 group-hover/inline:text-amber-700 opacity-0 group-hover/inline:opacity-100 transition shrink-0" />
    </div>
  );
};

interface InlineSelectCellProps {
  value: string;
  options: { label: string; value: string }[];
  onSave: (val: string) => Promise<any> | void;
  badgeClassName?: (val: string) => string;
  disabled?: boolean;
}

const InlineSelectCell: React.FC<InlineSelectCellProps> = ({
  value,
  options,
  onSave,
  badgeClassName,
  disabled = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const selectRef = React.useRef<HTMLSelectElement>(null);

  React.useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  const handleChange = async (newVal: string) => {
    if (disabled || isSaving) return;
    if (newVal === value) {
      setIsEditing(false);
      return;
    }
    try {
      setIsSaving(true);
      await onSave(newVal);
      setIsEditing(false);
    } catch {
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (disabled) {
    const badgeStyle = badgeClassName ? badgeClassName(value) : '';
    return <span className={badgeStyle}>{value}</span>;
  }

  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-1 relative z-10" onClick={(e) => e.stopPropagation()}>
        <select
          ref={selectRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setIsEditing(false)}
          disabled={isSaving}
          className="px-2 py-0.5 bg-white border-2 border-amber-600 rounded-lg text-xs font-bold text-stone-900 shadow-md outline-none"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {isSaving && <Loader2 className="w-3 h-3 text-amber-700 animate-spin shrink-0" />}
      </div>
    );
  }

  const badgeStyle = badgeClassName
    ? badgeClassName(value)
    : 'px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200';

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      title="Click to change"
      className="group/inline inline-flex items-center gap-1 cursor-pointer hover:opacity-85 transition"
    >
      <span className={badgeStyle}>{value}</span>
      <Edit3 className="w-2.5 h-2.5 text-stone-300 group-hover/inline:text-amber-700 opacity-0 group-hover/inline:opacity-100 transition shrink-0" />
    </div>
  );
};

interface InlineDateCellProps {
  value: string | Date;
  onSave: (val: string) => Promise<any> | void;
  disabled?: boolean;
}

const InlineDateCell: React.FC<InlineDateCellProps> = ({
  value,
  onSave,
  disabled = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const getIsoDate = (d: any) => {
    if (!d) return '';
    try {
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return '';
      return dateObj.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const [dateStr, setDateStr] = useState(getIsoDate(value));

  React.useEffect(() => {
    if (!isEditing) {
      setDateStr(getIsoDate(value));
    }
  }, [value, isEditing]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleCommit = async (valToSave?: string) => {
    const val = valToSave !== undefined ? valToSave : dateStr;
    if (disabled || isSaving) return;
    const origIso = getIsoDate(value);
    if (val === origIso || !val) {
      setIsEditing(false);
      return;
    }
    try {
      setIsSaving(true);
      await onSave(val);
      setIsEditing(false);
    } catch {
      setDateStr(origIso);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  if (disabled) {
    return (
      <span className="font-mono font-bold text-stone-800">
        {value ? new Date(value).toLocaleDateString('en-GB') : '-'}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-1 relative z-10" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="date"
          value={dateStr}
          onChange={(e) => {
            setDateStr(e.target.value);
            handleCommit(e.target.value);
          }}
          onBlur={() => handleCommit()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCommit();
            } else if (e.key === 'Escape') {
              setDateStr(getIsoDate(value));
              setIsEditing(false);
            }
          }}
          disabled={isSaving}
          className="px-2 py-0.5 bg-white border-2 border-amber-600 rounded-lg text-xs font-bold text-stone-900 shadow-md outline-none"
        />
        {isSaving && <Loader2 className="w-3 h-3 text-amber-700 animate-spin shrink-0" />}
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      title="Click to edit due date"
      className="group/inline inline-flex items-center gap-1 cursor-pointer hover:bg-amber-100/70 hover:text-amber-950 px-1.5 py-0.5 -mx-1.5 rounded-md transition border border-transparent hover:border-amber-300/80 font-mono font-bold text-stone-800"
    >
      <span>{value ? new Date(value).toLocaleDateString('en-GB') : '-'}</span>
      <CalendarDays className="w-2.5 h-2.5 text-stone-300 group-hover/inline:text-amber-700 opacity-0 group-hover/inline:opacity-100 transition shrink-0" />
    </div>
  );
};

// ==============================================================
// MAIN COMPONENT
// ==============================================================

export const MasterData: React.FC = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MasterTab>('GROUPS');

  // Overall Stats
  const { data: statsData } = useQuery({
    queryKey: ['masterDataStats'],
    queryFn: () => api.getMasterDataStats()
  });
  const stats = statsData?.stats;

  // ================= TAB 1: CUSTOMERS STATE =================
  const [custSearch, setCustSearch] = useState('');
  const [custArea, setCustArea] = useState('');
  const [custPage, setCustPage] = useState(1);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [custForm, setCustForm] = useState<any>({});
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');

  const { data: custData, isLoading: isCustLoading } = useQuery({
    queryKey: ['masterCustomers', custSearch, custArea, custPage],
    queryFn: () => api.getMasterCustomers({ search: custSearch, area: custArea, page: custPage, limit: 50 })
  });
  const customers = custData?.customers || [];
  const custPagination = custData?.pagination || { page: 1, limit: 50, total: 0, pages: 1 };

  const updateCustMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateMasterCustomer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masterCustomers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (editingCustomer) {
        setEditingCustomer(null);
        alert('Customer updated successfully in master database!');
      }
    },
    onError: (err: any) => alert(err.message || 'Failed to update customer')
  });

  const mergeCustMutation = useMutation({
    mutationFn: (data: any) => api.mergeCustomers(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['masterCustomers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['masterDataStats'] });
      setIsMergeModalOpen(false);
      setMergeSourceId('');
      setMergeTargetId('');
      alert(res?.message || 'Customers merged successfully!');
    },
    onError: (err: any) => alert(err.message || 'Failed to merge customers')
  });

  const autoDeduplicateMutation = useMutation({
    mutationFn: () => api.autoDeduplicateCustomers(),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['masterCustomers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['masterDataStats'] });
      alert(res?.message || 'Auto-deduplication complete!');
    },
    onError: (err: any) => alert(err.message || 'Failed to run deduplication')
  });

  // ================= TAB 2: LOANS STATE =================
  const [loanSearch, setLoanSearch] = useState('');
  const [loanStatus, setLoanStatus] = useState('ALL');
  const [loanRouteDay, setLoanRouteDay] = useState('ALL');
  const [loanPage, setLoanPage] = useState(1);
  const [editingLoan, setEditingLoan] = useState<any | null>(null);
  const [loanForm, setLoanForm] = useState<any>({});

  const { data: loansData, isLoading: isLoansLoading } = useQuery({
    queryKey: ['masterLoans', loanSearch, loanStatus, loanRouteDay, loanPage],
    queryFn: () => api.getMasterLoans({ search: loanSearch, status: loanStatus, routeDay: loanRouteDay, page: loanPage, limit: 50 })
  });
  const loans = loansData?.loans || [];
  const loanPagination = loansData?.pagination || { page: 1, limit: 50, total: 0, pages: 1 };

  const updateLoanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateMasterLoan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masterLoans'] });
      queryClient.invalidateQueries({ queryKey: ['masterAllLoans'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['masterDataStats'] });
      if (editingLoan) {
        setEditingLoan(null);
        alert('Loan updated successfully in master database!');
      }
    },
    onError: (err: any) => alert(err.message || 'Failed to update loan')
  });

  // ================= TAB 3: INSTALLMENTS & SCHEDULE EDITOR STATE =================
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [instSearch, setInstSearch] = useState('');
  const [instRouteFilter, setInstRouteFilter] = useState('ALL');
  const [instGroupFilter, setInstGroupFilter] = useState('ALL');
  const [editingInstallment, setEditingInstallment] = useState<any | null>(null);
  const [instForm, setInstForm] = useState<any>({});

  // Query ALL loans across the database for full selector access (all 351 loans)
  const { data: allLoansData, isLoading: isAllLoansLoading } = useQuery({
    queryKey: ['masterAllLoans'],
    queryFn: () => api.getMasterLoans({ limit: 'all' })
  });
  const allLoans: any[] = allLoansData?.loans || [];

  const { data: instData, isLoading: isInstLoading } = useQuery({
    queryKey: ['masterLoanInstallments', selectedLoanId],
    queryFn: () => api.getMasterLoanInstallments(selectedLoanId),
    enabled: !!selectedLoanId
  });
  const scheduleLoan = instData?.loan;
  const installments = instData?.installments || [];

  const updateInstMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateMasterInstallment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masterLoanInstallments', selectedLoanId] });
      queryClient.invalidateQueries({ queryKey: ['masterLoans'] });
      queryClient.invalidateQueries({ queryKey: ['masterAllLoans'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['dailyCollections'] });
      if (editingInstallment) {
        setEditingInstallment(null);
        alert('Installment updated successfully!');
      }
    },
    onError: (err: any) => alert(err.message || 'Failed to update installment')
  });

  const realignDatesMutation = useMutation({
    mutationFn: (loanId: string) => api.realignLoanScheduleDates(loanId),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['masterLoanInstallments', selectedLoanId] });
      alert(res?.message || 'Schedule dates realigned successfully!');
    },
    onError: (err: any) => alert(err.message || 'Failed to realign schedule dates')
  });

  // ================= TAB 4: GROUPS STATE =================
  const [grpSearch, setGrpSearch] = useState('');
  const [grpDay, setGrpDay] = useState('ALL');
  const [grpSortBy, setGrpSortBy] = useState<
    'activeLoans_desc' | 'activeLoans_asc' | 'outstanding_desc' | 'outstanding_asc' | 'code_asc' | 'code_desc' | 'name_asc' | 'name_desc' | 'day_asc'
  >('activeLoans_desc');
  const [editingGroup, setEditingGroup] = useState<any | null>(null);
  const [grpForm, setGrpForm] = useState<any>({});

  const { data: grpData, isLoading: isGrpLoading } = useQuery({
    queryKey: ['masterGroups', grpSearch, grpDay],
    queryFn: () => api.getMasterGroups({ search: grpSearch, collectionDay: grpDay })
  });
  const groups: any[] = grpData?.groups || [];

  const sortedGroups = React.useMemo(() => {
    const list = [...groups];
    list.sort((a: any, b: any) => {
      switch (grpSortBy) {
        case 'activeLoans_desc':
          return (b.activeLoans || 0) - (a.activeLoans || 0) || (b.totalOutstanding || 0) - (a.totalOutstanding || 0);
        case 'activeLoans_asc':
          return (a.activeLoans || 0) - (b.activeLoans || 0);
        case 'outstanding_desc':
          return (b.totalOutstanding || 0) - (a.totalOutstanding || 0);
        case 'outstanding_asc':
          return (a.totalOutstanding || 0) - (b.totalOutstanding || 0);
        case 'code_asc':
          return (a.groupCode || 0) - (b.groupCode || 0);
        case 'code_desc':
          return (b.groupCode || 0) - (a.groupCode || 0);
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'name_desc':
          return (b.name || '').localeCompare(a.name || '');
        case 'day_asc': {
          const order: Record<string, number> = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 7 };
          return (order[a.collectionDay] || 99) - (order[b.collectionDay] || 99);
        }
        default:
          return 0;
      }
    });
    return list;
  }, [groups, grpSortBy]);

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateMasterGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['masterGroups'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      if (editingGroup) {
        setEditingGroup(null);
        alert('Group updated successfully!');
      }
    },
    onError: (err: any) => alert(err.message || 'Failed to update group')
  });

  // Filtered loans for Tab 3 Schedule Selector
  const filteredScheduleLoans = React.useMemo(() => {
    return allLoans.filter((l: any) => {
      if (instRouteFilter !== 'ALL' && l.collectionDay !== instRouteFilter) return false;
      if (instGroupFilter !== 'ALL' && String(l.groupId?._id || l.groupId) !== instGroupFilter) return false;
      if (instSearch.trim()) {
        const s = instSearch.toLowerCase();
        const matchCust = (l.customerName || l.customerId?.name || '').toLowerCase().includes(s);
        const matchNum = (l.loanNumber || '').toLowerCase().includes(s);
        const matchGrp = (l.groupId?.name || '').toLowerCase().includes(s);
        const matchPhone = (l.customerPhone || l.customerId?.phone || '').includes(s);
        return matchCust || matchNum || matchGrp || matchPhone;
      }
      return true;
    });
  }, [allLoans, instRouteFilter, instGroupFilter, instSearch]);

  const handleOpenEditCust = (c: any) => {
    setEditingCustomer(c);
    setCustForm({
      name: c.name || '',
      phone: c.phone || '',
      spouseName: c.spouseName || '',
      nomineeName: c.nomineeName || '',
      nomineeRelationship: c.nomineeRelationship || '',
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
  };

  const handleOpenEditLoan = (l: any) => {
    setEditingLoan(l);
    setLoanForm({
      loanNumber: l.loanNumber || '',
      principal: l.principal || 0,
      interestAmount: l.interestAmount || 0,
      docCharges: l.docCharges || 0,
      savingsAmount: l.savingsAmount || 0,
      totalPayable: l.totalPayable || 0,
      totalPaid: l.totalPaid || 0,
      outstandingTotal: l.outstandingTotal || 0,
      tenureWeeks: l.tenureWeeks || 32,
      cycle: l.cycle || 1,
      status: l.status || 'ACTIVE',
      collectionDay: l.collectionDay || 'MONDAY',
      assignedStaffName: l.assignedStaffName || '',
      notes: l.notes || ''
    });
  };

  const handleOpenEditInst = (ins: any) => {
    setEditingInstallment(ins);
    const dStr = ins.dueDate ? new Date(ins.dueDate).toISOString().split('T')[0] : '';
    setInstForm({
      dueDate: dStr,
      expectedAmount: ins.expectedAmount || 0,
      allocatedPrincipal: ins.allocatedPrincipal || 0,
      allocatedInterest: ins.allocatedInterest || 0,
      allocatedSavings: ins.allocatedSavings || 0,
      paidAmount: ins.paidAmount || 0,
      balanceAmount: ins.balanceAmount || 0,
      status: ins.status || 'PENDING',
      remarks: ins.remarks || ''
    });
  };

  const handleOpenEditGroup = (g: any) => {
    setEditingGroup(g);
    setGrpForm({
      name: g.name || '',
      groupCode: g.groupCode || 0,
      collectionDay: g.collectionDay || 'MONDAY',
      area: g.area || '',
      assignedStaffName: g.assignedStaffName || g.staffName || '',
      status: g.status || 'ACTIVE',
      notes: g.notes || ''
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
            <Database className="w-6 h-6 text-amber-700" />
            <span>Master Database & Ledger Management</span>
          </h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Live administrative inspection, direct inline cell editing, customer consolidation, and installment schedule editor across the entire Athiveera database.
          </p>
        </div>

        {/* Global Admin Tools */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm('Run auto-deduplication to consolidate borrower profiles with matching phone numbers or identities into unified customer profiles? All loan cycles and repayment histories will be preserved.')) {
                  autoDeduplicateMutation.mutate();
                }
              }}
              disabled={autoDeduplicateMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold border border-amber-300 shadow-2xs transition cursor-pointer disabled:opacity-50"
              title="Automatically merge profiles with identical phone or credentials"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-amber-700 ${autoDeduplicateMutation.isPending ? 'animate-spin' : ''}`} />
              <span>{autoDeduplicateMutation.isPending ? 'Consolidating...' : 'Auto-Consolidate Duplicates'}</span>
            </button>

            <button
              onClick={() => setIsMergeModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#251b14] hover:bg-black text-amber-300 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
              title="Manually merge two customer accounts"
            >
              <GitMerge className="w-3.5 h-3.5 text-amber-400" />
              <span>Manual Merge Tool</span>
            </button>
          </div>
        )}
      </div>

      {/* Database KPI Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-800 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Unique Borrowers</p>
            <p className="text-xl font-black text-stone-900 mt-0.5">{stats?.customers?.total || 243}</p>
            <p className="text-[10px] text-stone-500 font-medium">{stats?.customers?.active || 243} Active in Master Directory</p>
          </div>
        </div>

        <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-700 shrink-0">
            <HandCoins className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Total Loans</p>
            <p className="text-xl font-black text-emerald-800 mt-0.5">{stats?.loans?.total || 351}</p>
            <p className="text-[10px] text-stone-500 font-medium">{stats?.loans?.active || 198} Live • {stats?.loans?.closed || 153} Closed</p>
          </div>
        </div>

        <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-700/15 flex items-center justify-center text-amber-900 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">Total Contractual</p>
            <p className="text-xl font-black text-amber-900 mt-0.5">₹{(stats?.loans?.totalContractual || 9801300).toLocaleString('en-IN')}</p>
            <p className="text-[10px] text-stone-500 font-medium">₹{(stats?.loans?.totalPaid || 5939200).toLocaleString('en-IN')} Paid</p>
          </div>
        </div>

        <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-500/15 flex items-center justify-center text-stone-700 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Groups & Schedules</p>
            <p className="text-xl font-black text-stone-900 mt-0.5">{stats?.groups || 99} Groups</p>
            <p className="text-[10px] text-stone-500 font-medium">{stats?.installments || 12446} Weekly Installments</p>
          </div>
        </div>
      </div>

      {/* Master Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#ded3be] pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('GROUPS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'GROUPS'
              ? 'bg-[#251b14] text-amber-300 shadow-xs'
              : 'bg-white text-stone-700 border border-[#ded3be] hover:bg-[#faf6ee]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Groups Master ({stats?.groups || 99})</span>
        </button>

        <button
          onClick={() => setActiveTab('INSTALLMENTS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'INSTALLMENTS'
              ? 'bg-[#251b14] text-amber-300 shadow-xs'
              : 'bg-white text-stone-700 border border-[#ded3be] hover:bg-[#faf6ee]'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Installments & Schedules Editor ({stats?.loans?.total || 351} Loans)</span>
        </button>

        <button
          onClick={() => setActiveTab('CUSTOMERS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'CUSTOMERS'
              ? 'bg-[#251b14] text-amber-300 shadow-xs'
              : 'bg-white text-stone-700 border border-[#ded3be] hover:bg-[#faf6ee]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customers Master ({stats?.customers?.total || 243})</span>
        </button>

        <button
          onClick={() => setActiveTab('LOANS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            activeTab === 'LOANS'
              ? 'bg-[#251b14] text-amber-300 shadow-xs'
              : 'bg-white text-stone-700 border border-[#ded3be] hover:bg-[#faf6ee]'
          }`}
        >
          <HandCoins className="w-3.5 h-3.5" />
          <span>Loans Master ({stats?.loans?.total || 351})</span>
        </button>
      </div>

      {/* Helpful Hint */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-900">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong className="font-bold">Direct Inline Editing Active:</strong> Click directly on any table cell (dates, amounts, group names, collectors, phone numbers, or statuses) to edit inline without opening modals! Press <kbd className="px-1 py-0.5 bg-amber-200/60 rounded text-[10px] font-mono">Enter</kbd> or click outside to save instantly.
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 4: GROUPS MASTER */}
      {/* ============================================================== */}
      {activeTab === 'GROUPS' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-[#fffdfa] p-3 rounded-2xl border border-[#ded3be] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={grpSearch}
                  onChange={(e) => setGrpSearch(e.target.value)}
                  placeholder="Search group code #, name, area, or collector..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-amber-600 shadow-xs"
                />
              </div>

              <select
                value={grpDay}
                onChange={(e) => setGrpDay(e.target.value)}
                className="px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-600"
              >
                <option value="ALL">All Collection Days</option>
                <option value="MONDAY">MONDAY Route</option>
                <option value="TUESDAY">TUESDAY Route</option>
                <option value="WEDNESDAY">WEDNESDAY Route</option>
                <option value="THURSDAY">THURSDAY Route</option>
              </select>

              {/* Sorting Selector */}
              <div className="flex items-center gap-1.5 bg-white border border-[#ded3be] rounded-xl px-2 py-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="text-[11px] font-bold text-stone-500 whitespace-nowrap">Sort:</span>
                <select
                  value={grpSortBy}
                  onChange={(e: any) => setGrpSortBy(e.target.value)}
                  className="bg-transparent text-xs font-bold text-stone-900 outline-none cursor-pointer"
                >
                  <option value="activeLoans_desc">Active Loans (High to Low)</option>
                  <option value="activeLoans_asc">Active Loans (Low to High)</option>
                  <option value="outstanding_desc">Outstanding Due (High to Low)</option>
                  <option value="outstanding_asc">Outstanding Due (Low to High)</option>
                  <option value="code_asc">Group Code (1 to 99)</option>
                  <option value="code_desc">Group Code (99 to 1)</option>
                  <option value="name_asc">Group Name (A - Z)</option>
                  <option value="name_desc">Group Name (Z - A)</option>
                  <option value="day_asc">Route Day (Mon - Thu)</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-stone-500 font-bold self-end md:self-center">
              Showing {sortedGroups.length} Groups
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f6f0e4] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                  <tr>
                    <th
                      onClick={() => setGrpSortBy(s => s === 'code_asc' ? 'code_desc' : 'code_asc')}
                      className="px-4 py-3 cursor-pointer hover:bg-[#ebdcc4] select-none transition"
                      title="Click to sort by Group Code"
                    >
                      <div className="flex items-center gap-1">
                        <span>Group #</span>
                        {grpSortBy === 'code_asc' && <ArrowUp className="w-3 h-3 text-amber-800" />}
                        {grpSortBy === 'code_desc' && <ArrowDown className="w-3 h-3 text-amber-800" />}
                      </div>
                    </th>
                    <th
                      onClick={() => setGrpSortBy(s => s === 'name_asc' ? 'name_desc' : 'name_asc')}
                      className="px-4 py-3 cursor-pointer hover:bg-[#ebdcc4] select-none transition"
                      title="Click to sort by Group Name"
                    >
                      <div className="flex items-center gap-1">
                        <span>Group Name</span>
                        {grpSortBy === 'name_asc' && <ArrowUp className="w-3 h-3 text-amber-800" />}
                        {grpSortBy === 'name_desc' && <ArrowDown className="w-3 h-3 text-amber-800" />}
                      </div>
                    </th>
                    <th
                      onClick={() => setGrpSortBy('day_asc')}
                      className="px-4 py-3 cursor-pointer hover:bg-[#ebdcc4] select-none transition"
                      title="Click to sort by Route Day"
                    >
                      <div className="flex items-center gap-1">
                        <span>Route Day</span>
                        {grpSortBy === 'day_asc' && <ArrowUp className="w-3 h-3 text-amber-800" />}
                      </div>
                    </th>
                    <th className="px-4 py-3">Operational Area</th>
                    <th className="px-4 py-3">Collector Officer</th>
                    <th
                      onClick={() => setGrpSortBy(s => s === 'activeLoans_desc' ? 'activeLoans_asc' : 'activeLoans_desc')}
                      className="px-4 py-3 cursor-pointer hover:bg-[#ebdcc4] select-none transition bg-amber-200/40"
                      title="Click to toggle sort by Active Loans"
                    >
                      <div className="flex items-center gap-1 font-black text-amber-950">
                        <span>Active Loans</span>
                        {grpSortBy === 'activeLoans_desc' && <ArrowDown className="w-3.5 h-3.5 text-amber-900" />}
                        {grpSortBy === 'activeLoans_asc' && <ArrowUp className="w-3.5 h-3.5 text-amber-900" />}
                      </div>
                    </th>
                    <th
                      onClick={() => setGrpSortBy(s => s === 'outstanding_desc' ? 'outstanding_asc' : 'outstanding_desc')}
                      className="px-4 py-3 cursor-pointer hover:bg-[#ebdcc4] select-none transition"
                      title="Click to toggle sort by Outstanding Balance"
                    >
                      <div className="flex items-center gap-1">
                        <span>Total Outstanding</span>
                        {grpSortBy === 'outstanding_desc' && <ArrowDown className="w-3 h-3 text-amber-800" />}
                        {grpSortBy === 'outstanding_asc' && <ArrowUp className="w-3 h-3 text-amber-800" />}
                      </div>
                    </th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Modal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece3d4]">
                  {isGrpLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-stone-400 font-medium">
                        Loading master groups...
                      </td>
                    </tr>
                  ) : sortedGroups.length > 0 ? (
                    sortedGroups.map((g: any) => (
                      <tr key={g._id} className="hover:bg-[#fbf7f0] transition">
                        <td className="px-4 py-3 font-mono font-bold text-stone-900">
                          <InlineTextCell
                            value={g.groupCode}
                            type="number"
                            prefix="#"
                            className="font-mono font-bold text-stone-900"
                            onSave={async (val) => {
                              await updateGroupMutation.mutateAsync({
                                id: g._id,
                                data: { groupCode: parseInt(val) || g.groupCode }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 font-bold text-stone-900">
                          <InlineTextCell
                            value={g.name}
                            className="font-bold text-stone-900"
                            onSave={async (val) => {
                              await updateGroupMutation.mutateAsync({
                                id: g._id,
                                data: { name: val }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <InlineSelectCell
                            value={g.collectionDay}
                            options={[
                              { label: 'MONDAY', value: 'MONDAY' },
                              { label: 'TUESDAY', value: 'TUESDAY' },
                              { label: 'WEDNESDAY', value: 'WEDNESDAY' },
                              { label: 'THURSDAY', value: 'THURSDAY' },
                              { label: 'FRIDAY', value: 'FRIDAY' },
                              { label: 'SATURDAY', value: 'SATURDAY' }
                            ]}
                            badgeClassName={() =>
                              'px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-2xs'
                            }
                            onSave={async (val) => {
                              await updateGroupMutation.mutateAsync({
                                id: g._id,
                                data: { collectionDay: val }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-stone-700">
                          <InlineTextCell
                            value={g.area || ''}
                            placeholder="Set area..."
                            className="font-medium text-stone-700"
                            onSave={async (val) => {
                              await updateGroupMutation.mutateAsync({
                                id: g._id,
                                data: { area: val }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 font-bold text-stone-800">
                          <InlineTextCell
                            value={g.assignedStaffName || g.staffName || ''}
                            placeholder="Assign collector..."
                            className="font-bold text-stone-800"
                            onSave={async (val) => {
                              await updateGroupMutation.mutateAsync({
                                id: g._id,
                                data: { assignedStaffName: val, collectorName: val, staffName: val }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-black text-xs px-2 py-0.5 rounded-md ${
                            (g.activeLoans || 0) > 0 ? 'bg-amber-100 text-amber-950 border border-amber-300' : 'text-stone-400'
                          }`}>
                            {g.activeLoans || 0} Active
                          </span>
                          <span className="text-stone-400 ml-1.5 text-[11px]">({g.totalLoans || 0} total)</span>
                        </td>
                        <td className="px-4 py-3 font-mono font-black text-rose-800">
                          ₹{(g.totalOutstanding || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <InlineSelectCell
                            value={g.status || 'ACTIVE'}
                            options={[
                              { label: 'ACTIVE', value: 'ACTIVE' },
                              { label: 'INACTIVE', value: 'INACTIVE' },
                              { label: 'CLOSED', value: 'CLOSED' }
                            ]}
                            badgeClassName={(v) =>
                              v === 'ACTIVE'
                                ? 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-300'
                            }
                            onSave={async (val) => {
                              await updateGroupMutation.mutateAsync({
                                id: g._id,
                                data: { status: val }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleOpenEditGroup(g)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-lg text-xs border border-amber-300 transition cursor-pointer"
                            title="Open full edit modal"
                          >
                            <Edit3 className="w-3 h-3 text-amber-700" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-stone-400 font-medium">
                        No groups found matching filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: INSTALLMENTS & SCHEDULE EDITOR */}
      {/* ============================================================== */}
      {activeTab === 'INSTALLMENTS' && (
        <div className="space-y-4">
          {/* Loan Picker / Search */}
          <div className="bg-[#fffdfa] p-4 rounded-2xl border border-[#ded3be] shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-amber-700" />
                  <span>Weekly Installment Schedule & Ledger Editor</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Select ANY borrower across all 351 loans in the database. Edit dates, dues, paid sums, and statuses inline with immediate live saving.
                </p>
              </div>

              {/* Realignment tool */}
              {selectedLoanId && scheduleLoan && (
                <button
                  onClick={() => {
                    if (window.confirm(`Re-align all ${installments.length} installment dates for loan ${scheduleLoan.loanNumber} based on its collection route day (${scheduleLoan.collectionDay}) on exact 7-day intervals starting from week 1? This will fix any ledger sheet typos or discrepancies.`)) {
                      realignDatesMutation.mutate(selectedLoanId);
                    }
                  }}
                  disabled={realignDatesMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold border border-amber-300 shadow-2xs transition cursor-pointer disabled:opacity-50"
                  title="Align all weekly dates on a strict 7-day cadence"
                >
                  <RotateCcw className={`w-3.5 h-3.5 text-amber-700 ${realignDatesMutation.isPending ? 'animate-spin' : ''}`} />
                  <span>{realignDatesMutation.isPending ? 'Re-aligning Dates...' : 'Auto-Align Weekly Dates'}</span>
                </button>
              )}
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={instSearch}
                  onChange={(e) => setInstSearch(e.target.value)}
                  placeholder="Filter by borrower name, loan #, or phone..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-amber-600 shadow-xs"
                />
              </div>

              <select
                value={instRouteFilter}
                onChange={(e) => setInstRouteFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-600"
              >
                <option value="ALL">All Route Days ({allLoans.length} Loans)</option>
                <option value="MONDAY">MONDAY Route</option>
                <option value="TUESDAY">TUESDAY Route</option>
                <option value="WEDNESDAY">WEDNESDAY Route</option>
                <option value="THURSDAY">THURSDAY Route</option>
              </select>

              <select
                value={instGroupFilter}
                onChange={(e) => setInstGroupFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-600 truncate"
              >
                <option value="ALL">All Groups ({groups.length} Groups)</option>
                {groups.map((g: any) => (
                  <option key={g._id} value={g._id}>
                    #{g.groupCode} - {g.name} ({g.collectionDay})
                  </option>
                ))}
              </select>
            </div>

            {/* Direct Loan Selector Dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-stone-600 flex items-center justify-between">
                <span>Select Loan Account ({filteredScheduleLoans.length} available):</span>
                {selectedLoanId && (
                  <button
                    onClick={() => setSelectedLoanId('')}
                    className="text-amber-800 hover:underline text-[10px] cursor-pointer"
                  >
                    Clear Selection
                  </button>
                )}
              </label>
              <select
                value={selectedLoanId}
                onChange={(e) => setSelectedLoanId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border-2 border-amber-500/60 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-700 shadow-xs"
              >
                <option value="">-- Click to choose borrower / loan account --</option>
                {filteredScheduleLoans.map((l: any) => (
                  <option key={l._id} value={l._id}>
                    [{l.collectionDay} • GRP #{l.groupId?.groupCode || '?'}] {l.customerName || l.customerId?.name} — {l.loanNumber} (₹{l.principal?.toLocaleString('en-IN')} | Bal: ₹{(l.outstandingTotal || 0).toLocaleString('en-IN')}) [{l.status}]
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Loan Selection Chips (Scrollable list of all matching loans) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-h-28 overflow-y-auto flex-wrap border-t border-[#ece3d4] pt-2">
              {isAllLoansLoading ? (
                <span className="text-xs text-stone-400 py-1">Loading loans...</span>
              ) : filteredScheduleLoans.length > 0 ? (
                filteredScheduleLoans.map((l: any) => (
                  <button
                    key={l._id}
                    onClick={() => setSelectedLoanId(l._id)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-1.5 ${
                      selectedLoanId === l._id
                        ? 'bg-[#251b14] text-amber-300 border-amber-800/60 shadow-xs ring-2 ring-amber-400/50'
                        : 'bg-white text-stone-700 border-[#ded3be] hover:bg-[#faf6ee]'
                    }`}
                  >
                    <span>{l.customerName || l.customerId?.name}</span>
                    <span className="font-mono text-[10px] opacity-75">({l.loanNumber})</span>
                    <span className={`text-[9px] px-1 py-0.2 rounded font-black ${
                      (l.outstandingTotal || 0) > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      ₹{(l.outstandingTotal || 0).toLocaleString('en-IN')}
                    </span>
                  </button>
                ))
              ) : (
                <span className="text-xs text-stone-400 py-1">No loans matching current filter.</span>
              )}
            </div>
          </div>

          {/* Schedule Detail Table */}
          {selectedLoanId ? (
            scheduleLoan ? (
              <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden space-y-3">
                {/* Header Summary */}
                <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-stone-900 text-sm">
                        {scheduleLoan.customerName || scheduleLoan.customerId?.name}
                      </h4>
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-[#ded3be]">
                        {scheduleLoan.loanNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                        {scheduleLoan.collectionDay} ROUTE
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 mt-0.5 font-medium">
                      Group: {scheduleLoan.groupId?.name} &bull; Principal: ₹{scheduleLoan.principal?.toLocaleString('en-IN')} &bull; Tenure: {scheduleLoan.tenureWeeks} Weeks
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-bold">
                    <div>
                      <span className="text-stone-500 text-[10px] uppercase block">Total Paid</span>
                      <span className="text-emerald-700 font-mono text-sm">₹{scheduleLoan.totalPaid?.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-stone-500 text-[10px] uppercase block">Outstanding</span>
                      <span className="text-rose-800 font-mono text-sm">₹{scheduleLoan.outstandingTotal?.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Installments Table with Direct Inline Editing */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#fcf9f2] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ece3d4]">
                      <tr>
                        <th className="px-4 py-2.5">Week #</th>
                        <th className="px-4 py-2.5">Due Date (Click to Edit)</th>
                        <th className="px-4 py-2.5">Expected Due</th>
                        <th className="px-4 py-2.5">Principal</th>
                        <th className="px-4 py-2.5">Interest</th>
                        <th className="px-4 py-2.5">Savings</th>
                        <th className="px-4 py-2.5">Paid Amount</th>
                        <th className="px-4 py-2.5">Remaining Bal</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">Remarks</th>
                        <th className="px-4 py-2.5 text-right">Modal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#ece3d4]">
                      {isInstLoading ? (
                        <tr>
                          <td colSpan={11} className="py-12 text-center text-stone-400 font-medium">
                            Loading schedule installments...
                          </td>
                        </tr>
                      ) : installments.length > 0 ? (
                        installments.map((ins: any) => (
                          <tr key={ins._id} className="hover:bg-[#faf6ee] transition">
                            <td className="px-4 py-2.5 font-mono font-bold text-stone-900">
                              W{ins.installmentNumber}
                            </td>
                            <td className="px-4 py-2.5">
                              <InlineDateCell
                                value={ins.dueDate}
                                onSave={async (val) => {
                                  await updateInstMutation.mutateAsync({
                                    id: ins._id,
                                    data: { dueDate: val }
                                  });
                                }}
                              />
                            </td>
                            <td className="px-4 py-2.5 font-mono font-black text-stone-900">
                              <InlineTextCell
                                value={ins.expectedAmount}
                                type="number"
                                prefix="₹"
                                className="font-mono font-black text-stone-900"
                                onSave={async (val) => {
                                  const exp = parseFloat(val) || 0;
                                  await updateInstMutation.mutateAsync({
                                    id: ins._id,
                                    data: {
                                      expectedAmount: exp,
                                      balanceAmount: Math.max(0, exp - (ins.paidAmount || 0))
                                    }
                                  });
                                }}
                              />
                            </td>
                            <td className="px-4 py-2.5 font-mono text-stone-600">
                              <InlineTextCell
                                value={ins.allocatedPrincipal || 0}
                                type="number"
                                prefix="₹"
                                className="font-mono text-stone-600"
                                onSave={async (val) => {
                                  await updateInstMutation.mutateAsync({
                                    id: ins._id,
                                    data: { allocatedPrincipal: parseFloat(val) || 0 }
                                  });
                                }}
                              />
                            </td>
                            <td className="px-4 py-2.5 font-mono text-stone-600">
                              <InlineTextCell
                                value={ins.allocatedInterest || 0}
                                type="number"
                                prefix="₹"
                                className="font-mono text-stone-600"
                                onSave={async (val) => {
                                  await updateInstMutation.mutateAsync({
                                    id: ins._id,
                                    data: { allocatedInterest: parseFloat(val) || 0 }
                                  });
                                }}
                              />
                            </td>
                            <td className="px-4 py-2.5 font-mono text-stone-600">
                              <InlineTextCell
                                value={ins.allocatedSavings || 0}
                                type="number"
                                prefix="₹"
                                className="font-mono text-stone-600"
                                onSave={async (val) => {
                                  await updateInstMutation.mutateAsync({
                                    id: ins._id,
                                    data: { allocatedSavings: parseFloat(val) || 0 }
                                  });
                                }}
                              />
                            </td>
                            <td className="px-4 py-2.5 font-mono font-bold text-emerald-700">
                              <InlineTextCell
                                value={ins.paidAmount || 0}
                                type="number"
                                prefix="₹"
                                className="font-mono font-bold text-emerald-700"
                                onSave={async (val) => {
                                  const paid = parseFloat(val) || 0;
                                  const exp = ins.expectedAmount || 0;
                                  await updateInstMutation.mutateAsync({
                                    id: ins._id,
                                    data: {
                                      paidAmount: paid,
                                      balanceAmount: Math.max(0, exp - paid),
                                      status: paid >= exp && exp > 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'PENDING')
                                    }
                                  });
                                }}
                              />
                            </td>
                            <td className="px-4 py-2.5 font-mono font-bold text-rose-700">
                              <InlineTextCell
                                value={ins.balanceAmount || 0}
                                type="number"
                                prefix="₹"
                                className="font-mono font-bold text-rose-700"
                                onSave={async (val) => {
                                  await updateInstMutation.mutateAsync({
                                    id: ins._id,
                                    data: { balanceAmount: parseFloat(val) || 0 }
                                  });
                                }}
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <InlineSelectCell
                                value={ins.status || 'PENDING'}
                                options={[
                                  { label: 'PAID', value: 'PAID' },
                                  { label: 'PENDING', value: 'PENDING' },
                                  { label: 'OVERDUE', value: 'OVERDUE' },
                                  { label: 'PARTIAL', value: 'PARTIAL' }
                                ]}
                                badgeClassName={(v) =>
                                  v === 'PAID'
                                    ? 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : v === 'OVERDUE'
                                    ? 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300'
                                    : 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300'
                                }
                                onSave={async (val) => {
                                  await updateInstMutation.mutateAsync({
                                    id: ins._id,
                                    data: { status: val }
                                  });
                                }}
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <InlineTextCell
                                value={ins.remarks || ''}
                                placeholder="Add note..."
                                className="font-medium text-stone-500 italic max-w-[120px] truncate"
                                onSave={async (val) => {
                                  await updateInstMutation.mutateAsync({
                                    id: ins._id,
                                    data: { remarks: val }
                                  });
                                }}
                              />
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                onClick={() => handleOpenEditInst(ins)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-lg text-xs border border-amber-300 transition cursor-pointer"
                                title="Open week edit modal"
                              >
                                <Edit3 className="w-3 h-3 text-amber-700" />
                                <span>Edit</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={11} className="py-12 text-center text-stone-400 font-medium">
                            No installments found for this loan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-[#fffdfa] p-12 text-center text-xs text-stone-400 font-medium rounded-2xl border border-[#ded3be]">
                Loading selected loan details...
              </div>
            )
          ) : (
            <div className="bg-[#fffdfa] p-12 text-center text-stone-400 font-medium rounded-2xl border border-[#ded3be] text-xs space-y-2">
              <CalendarDays className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="font-bold text-stone-700 text-sm">Select a Loan Account Above</p>
              <p>Click on any borrower chip or dropdown above to view and edit its entire weekly repayment schedule.</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: CUSTOMERS MASTER */}
      {/* ============================================================== */}
      {activeTab === 'CUSTOMERS' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-[#fffdfa] p-3 rounded-2xl border border-[#ded3be] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={custSearch}
                  onChange={(e) => { setCustSearch(e.target.value); setCustPage(1); }}
                  placeholder="Search by customer name, phone, customer ID..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-amber-600 shadow-xs"
                />
              </div>
              <div className="relative sm:w-48">
                <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={custArea}
                  onChange={(e) => { setCustArea(e.target.value); setCustPage(1); }}
                  placeholder="Filter area..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-amber-600 shadow-xs"
                />
              </div>
            </div>

            <div className="text-xs text-stone-500 font-bold self-end sm:self-center">
              Page {custPagination.page} of {custPagination.pages || 1} • Total {custPagination.total} Borrowers
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f6f0e4] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                  <tr>
                    <th className="px-4 py-3">Customer ID</th>
                    <th className="px-4 py-3">Borrower Name (Inline)</th>
                    <th className="px-4 py-3">Contact Number</th>
                    <th className="px-4 py-3">Nominee Phone</th>
                    <th className="px-4 py-3">Operational Area</th>
                    <th className="px-4 py-3">Active Group</th>
                    <th className="px-4 py-3">Loan Cycles</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Modal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece3d4]">
                  {isCustLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-stone-400 font-medium">
                        Loading master customers...
                      </td>
                    </tr>
                  ) : customers.length > 0 ? (
                    customers.map((c: any) => (
                      <tr key={c._id} className="hover:bg-[#fbf7f0] transition">
                        <td className="px-4 py-3 font-mono font-bold text-stone-900">{c.customerId}</td>
                        <td className="px-4 py-3 font-bold text-stone-900">
                          <InlineTextCell
                            value={c.name}
                            className="font-bold text-stone-900"
                            onSave={async (val) => {
                              await updateCustMutation.mutateAsync({
                                id: c._id,
                                data: { name: val }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-stone-700">
                          <InlineTextCell
                            value={c.phone || ''}
                            placeholder="Set phone..."
                            className="font-mono text-stone-700"
                            onSave={async (val) => {
                              await updateCustMutation.mutateAsync({
                                id: c._id,
                                data: { phone: val }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-stone-500">
                          <InlineTextCell
                            value={c.nomineePhone || ''}
                            placeholder="Set phone..."
                            className="font-mono text-stone-500"
                            onSave={async (val) => {
                              await updateCustMutation.mutateAsync({
                                id: c._id,
                                data: { nomineePhone: val }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-stone-700">
                          <InlineTextCell
                            value={c.area || ''}
                            placeholder="Set area..."
                            className="font-medium text-stone-700"
                            onSave={async (val) => {
                              await updateCustMutation.mutateAsync({
                                id: c._id,
                                data: { area: val }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          {c.activeGroupId ? (
                            <div>
                              <span className="font-bold text-stone-900 block">{c.activeGroupId.name}</span>
                              <span className="text-[10px] text-amber-800 font-bold uppercase">{c.activeGroupId.collectionDay}</span>
                            </div>
                          ) : (
                            <span className="text-stone-400 italic text-[11px]">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {c.loans?.length > 0 ? (
                              c.loans.map((ln: any, idx: number) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    setSelectedLoanId(ln._id);
                                    setActiveTab('INSTALLMENTS');
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition hover:opacity-80 ${
                                    ln.status === 'ACTIVE' || ln.status === 'OVERDUE'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : 'bg-stone-100 text-stone-600 border border-stone-200'
                                  }`}
                                  title={`${ln.loanNumber} (Cycle ${ln.cycle || idx + 1}) - ₹${ln.principal?.toLocaleString()} (${ln.status}) - Click to open schedule`}
                                >
                                  C{ln.cycle || idx + 1}: ₹{(ln.principal / 1000)}k
                                </button>
                              ))
                            ) : (
                              <span className="text-stone-400 italic text-[10px]">No loans</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <InlineSelectCell
                            value={c.status || 'ACTIVE'}
                            options={[
                              { label: 'ACTIVE', value: 'ACTIVE' },
                              { label: 'INACTIVE', value: 'INACTIVE' },
                              { label: 'BLOCKED', value: 'BLOCKED' }
                            ]}
                            badgeClassName={(v) =>
                              v === 'ACTIVE'
                                ? 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200'
                            }
                            onSave={async (val) => {
                              await updateCustMutation.mutateAsync({
                                id: c._id,
                                data: { status: val }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleOpenEditCust(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-lg text-xs border border-amber-300 transition cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3 text-amber-700" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-stone-400 font-medium">
                        No customers found matching filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-4 py-3 bg-[#fbf7f0] border-t border-[#ded3be] flex items-center justify-between text-xs">
              <span className="text-stone-600 font-medium">
                Showing {customers.length} of {custPagination.total} customers
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCustPage(p => Math.max(1, p - 1))}
                  disabled={custPage <= 1}
                  className="px-3 py-1 bg-white border border-[#ded3be] rounded-lg font-bold text-stone-700 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="px-2 font-bold text-stone-900">
                  {custPage} / {custPagination.pages || 1}
                </span>
                <button
                  onClick={() => setCustPage(p => Math.min(custPagination.pages || 1, p + 1))}
                  disabled={custPage >= (custPagination.pages || 1)}
                  className="px-3 py-1 bg-white border border-[#ded3be] rounded-lg font-bold text-stone-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: LOANS MASTER */}
      {/* ============================================================== */}
      {activeTab === 'LOANS' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-[#fffdfa] p-3 rounded-2xl border border-[#ded3be] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={loanSearch}
                  onChange={(e) => { setLoanSearch(e.target.value); setLoanPage(1); }}
                  placeholder="Search loan #, borrower name, phone, area..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-amber-600 shadow-xs"
                />
              </div>

              <select
                value={loanRouteDay}
                onChange={(e) => { setLoanRouteDay(e.target.value); setLoanPage(1); }}
                className="px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-600"
              >
                <option value="ALL">All Route Days</option>
                <option value="MONDAY">MONDAY Route</option>
                <option value="TUESDAY">TUESDAY Route</option>
                <option value="WEDNESDAY">WEDNESDAY Route</option>
                <option value="THURSDAY">THURSDAY Route</option>
              </select>

              <select
                value={loanStatus}
                onChange={(e) => { setLoanStatus(e.target.value); setLoanPage(1); }}
                className="px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-600"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="OVERDUE">OVERDUE</option>
                <option value="CLOSED">CLOSED</option>
                <option value="SETTLED">SETTLED</option>
              </select>
            </div>

            <div className="text-xs text-stone-500 font-bold self-end md:self-center">
              Page {loanPagination.page} of {loanPagination.pages || 1} • Total {loanPagination.total} Loans
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f6f0e4] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                  <tr>
                    <th className="px-4 py-3">Loan Account #</th>
                    <th className="px-4 py-3">Borrower / Member</th>
                    <th className="px-4 py-3">Group & Route</th>
                    <th className="px-4 py-3">Principal (Inline)</th>
                    <th className="px-4 py-3">Contractual Due</th>
                    <th className="px-4 py-3">Paid Amount</th>
                    <th className="px-4 py-3">Outstanding Balance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece3d4]">
                  {isLoansLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-stone-400 font-medium">
                        Loading master loans...
                      </td>
                    </tr>
                  ) : loans.length > 0 ? (
                    loans.map((l: any) => (
                      <tr key={l._id} className="hover:bg-[#fbf7f0] transition">
                        <td className="px-4 py-3 font-mono font-bold text-stone-900">
                          <div>
                            <span>{l.loanNumber}</span>
                            <span className="block text-[10px] text-amber-800 font-semibold">Cycle {l.cycle || 1}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-stone-900 block">{l.customerName || l.customerId?.name}</span>
                          <span className="font-mono text-stone-500 text-[11px]">{l.customerPhone || l.customerId?.phone}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-stone-900 block">{l.groupId?.name || 'Group'}</span>
                          <InlineSelectCell
                            value={l.collectionDay}
                            options={[
                              { label: 'MONDAY', value: 'MONDAY' },
                              { label: 'TUESDAY', value: 'TUESDAY' },
                              { label: 'WEDNESDAY', value: 'WEDNESDAY' },
                              { label: 'THURSDAY', value: 'THURSDAY' }
                            ]}
                            badgeClassName={() => 'text-[10px] font-bold text-amber-900 uppercase'}
                            onSave={async (val) => {
                              await updateLoanMutation.mutateAsync({
                                id: l._id,
                                data: { collectionDay: val }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-stone-900">
                          <InlineTextCell
                            value={l.principal}
                            type="number"
                            prefix="₹"
                            className="font-mono font-bold text-stone-900"
                            onSave={async (val) => {
                              await updateLoanMutation.mutateAsync({
                                id: l._id,
                                data: { principal: parseFloat(val) || 0 }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-stone-700">
                          <InlineTextCell
                            value={l.totalPayable}
                            type="number"
                            prefix="₹"
                            className="font-mono text-stone-700"
                            onSave={async (val) => {
                              const tp = parseFloat(val) || 0;
                              await updateLoanMutation.mutateAsync({
                                id: l._id,
                                data: {
                                  totalPayable: tp,
                                  outstandingTotal: Math.max(0, tp - (l.totalPaid || 0))
                                }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-emerald-700">₹{l.totalPaid?.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 font-mono font-black text-rose-800">₹{l.outstandingTotal?.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <InlineSelectCell
                            value={l.status || 'ACTIVE'}
                            options={[
                              { label: 'ACTIVE', value: 'ACTIVE' },
                              { label: 'OVERDUE', value: 'OVERDUE' },
                              { label: 'CLOSED', value: 'CLOSED' },
                              { label: 'SETTLED', value: 'SETTLED' }
                            ]}
                            badgeClassName={(v) =>
                              v === 'ACTIVE'
                                ? 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : v === 'OVERDUE'
                                ? 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300'
                                : 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-300'
                            }
                            onSave={async (val) => {
                              await updateLoanMutation.mutateAsync({
                                id: l._id,
                                data: { status: val }
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedLoanId(l._id);
                                setActiveTab('INSTALLMENTS');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#f6f0e4] hover:bg-[#ede3d0] text-amber-950 font-bold rounded-lg text-xs border border-[#ded3be] transition cursor-pointer"
                              title="Inspect and edit weekly installments"
                            >
                              <CalendarDays className="w-3 h-3 text-amber-700" />
                              <span>Schedule</span>
                            </button>

                            <button
                              onClick={() => handleOpenEditLoan(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-lg text-xs border border-amber-300 transition cursor-pointer"
                              title="Edit all fields of loan"
                            >
                              <Edit3 className="w-3 h-3 text-amber-700" />
                              <span>Edit</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-stone-400 font-medium">
                        No loans found matching filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-4 py-3 bg-[#fbf7f0] border-t border-[#ded3be] flex items-center justify-between text-xs">
              <span className="text-stone-600 font-medium">
                Showing {loans.length} of {loanPagination.total} loans
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setLoanPage(p => Math.max(1, p - 1))}
                  disabled={loanPage <= 1}
                  className="px-3 py-1 bg-white border border-[#ded3be] rounded-lg font-bold text-stone-700 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="px-2 font-bold text-stone-900">
                  {loanPage} / {loanPagination.pages || 1}
                </span>
                <button
                  onClick={() => setLoanPage(p => Math.min(loanPagination.pages || 1, p + 1))}
                  disabled={loanPage >= (loanPagination.pages || 1)}
                  className="px-3 py-1 bg-white border border-[#ded3be] rounded-lg font-bold text-stone-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* EDIT CUSTOMER MODAL */}
      {/* ============================================================== */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#fffdfa] rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 my-8 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-700" />
                  <span>Edit Borrower: {editingCustomer.name}</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Update customer contact information, operational area, and permanent identity credentials.
                </p>
              </div>
              <button onClick={() => setEditingCustomer(null)} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateCustMutation.mutate({ id: editingCustomer._id, data: custForm });
              }}
              className="space-y-3.5"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={custForm.name || ''}
                    onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Primary Mobile Phone</label>
                  <input
                    type="text"
                    value={custForm.phone || ''}
                    onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Nominee Contact Phone</label>
                  <input
                    type="text"
                    value={custForm.nomineePhone || ''}
                    onChange={(e) => setCustForm({ ...custForm, nomineePhone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Nominee Full Name</label>
                  <input
                    type="text"
                    value={custForm.nomineeName || ''}
                    onChange={(e) => setCustForm({ ...custForm, nomineeName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Operational Area</label>
                  <input
                    type="text"
                    value={custForm.area || ''}
                    onChange={(e) => setCustForm({ ...custForm, area: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Account Status</label>
                  <select
                    value={custForm.status || 'ACTIVE'}
                    onChange={(e) => setCustForm({ ...custForm, status: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="BLOCKED">BLOCKED</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-stone-800">Residential Address</label>
                <input
                  type="text"
                  value={custForm.address || ''}
                  onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#ece3d4]">
                <div>
                  <label className="block font-bold text-stone-700 mb-1 text-[10px]">Smart Card #</label>
                  <input
                    type="text"
                    value={custForm.smartCardNumber || ''}
                    onChange={(e) => setCustForm({ ...custForm, smartCardNumber: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border border-[#ded3be] rounded-lg font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1 text-[10px]">Aadhaar #</label>
                  <input
                    type="text"
                    value={custForm.aadharNumber || ''}
                    onChange={(e) => setCustForm({ ...custForm, aadharNumber: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border border-[#ded3be] rounded-lg font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1 text-[10px]">Voter ID #</label>
                  <input
                    type="text"
                    value={custForm.voterIdNumber || ''}
                    onChange={(e) => setCustForm({ ...custForm, voterIdNumber: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border border-[#ded3be] rounded-lg font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1 text-[10px]">PAN #</label>
                  <input
                    type="text"
                    value={custForm.panNumber || ''}
                    onChange={(e) => setCustForm({ ...custForm, panNumber: e.target.value })}
                    className="w-full px-2 py-1.5 bg-white border border-[#ded3be] rounded-lg font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 border border-[#ded3be] rounded-xl font-bold text-stone-700 hover:bg-[#faf6ee] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateCustMutation.isPending}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 text-stone-950 font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {updateCustMutation.isPending ? 'Saving...' : 'Save Customer Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* EDIT LOAN MODAL */}
      {/* ============================================================== */}
      {editingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#fffdfa] rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 my-8 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-700" />
                  <span>Edit Loan: {editingLoan.loanNumber}</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Update contractual terms, principal, interest, paid sums, status, and route scheduling.
                </p>
              </div>
              <button onClick={() => setEditingLoan(null)} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateLoanMutation.mutate({ id: editingLoan._id, data: loanForm });
              }}
              className="space-y-3.5"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Loan Account # *</label>
                  <input
                    type="text"
                    required
                    value={loanForm.loanNumber || ''}
                    onChange={(e) => setLoanForm({ ...loanForm, loanNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Loan Status *</label>
                  <select
                    value={loanForm.status || 'ACTIVE'}
                    onChange={(e) => setLoanForm({ ...loanForm, status: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="OVERDUE">OVERDUE</option>
                    <option value="CLOSED">CLOSED</option>
                    <option value="SETTLED">SETTLED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Route Day *</label>
                  <select
                    value={loanForm.collectionDay || 'MONDAY'}
                    onChange={(e) => setLoanForm({ ...loanForm, collectionDay: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900"
                  >
                    <option value="MONDAY">MONDAY</option>
                    <option value="TUESDAY">TUESDAY</option>
                    <option value="WEDNESDAY">WEDNESDAY</option>
                    <option value="THURSDAY">THURSDAY</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Principal (₹) *</label>
                  <input
                    type="number"
                    required
                    value={loanForm.principal || 0}
                    onChange={(e) => {
                      const p = parseFloat(e.target.value) || 0;
                      setLoanForm({ ...loanForm, principal: p });
                    }}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Interest (₹) *</label>
                  <input
                    type="number"
                    value={loanForm.interestAmount || 0}
                    onChange={(e) => setLoanForm({ ...loanForm, interestAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Total Payable (₹) *</label>
                  <input
                    type="number"
                    value={loanForm.totalPayable || 0}
                    onChange={(e) => {
                      const tp = parseFloat(e.target.value) || 0;
                      setLoanForm({
                        ...loanForm,
                        totalPayable: tp,
                        outstandingTotal: Math.max(0, tp - (loanForm.totalPaid || 0))
                      });
                    }}
                    className="w-full px-3 py-2 bg-[#fcf9f2] border border-[#ded3be] rounded-xl font-mono font-black text-amber-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Total Paid (₹)</label>
                  <input
                    type="number"
                    value={loanForm.totalPaid || 0}
                    onChange={(e) => {
                      const paid = parseFloat(e.target.value) || 0;
                      setLoanForm({
                        ...loanForm,
                        totalPaid: paid,
                        outstandingTotal: Math.max(0, (loanForm.totalPayable || 0) - paid)
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Outstanding Balance (₹) *</label>
                  <input
                    type="number"
                    value={loanForm.outstandingTotal || 0}
                    onChange={(e) => setLoanForm({ ...loanForm, outstandingTotal: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#fcf9f2] border border-[#ded3be] rounded-xl font-mono font-black text-rose-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Loan Cycle (e.g. 1, 2, 3)</label>
                  <input
                    type="number"
                    value={loanForm.cycle || 1}
                    onChange={(e) => setLoanForm({ ...loanForm, cycle: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setEditingLoan(null)}
                  className="px-4 py-2 border border-[#ded3be] rounded-xl font-bold text-stone-700 hover:bg-[#faf6ee] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateLoanMutation.isPending}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 text-stone-950 font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {updateLoanMutation.isPending ? 'Saving...' : 'Save Loan Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* EDIT INSTALLMENT MODAL */}
      {/* ============================================================== */}
      {editingInstallment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 text-xs">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-700" />
                  <span>Edit Week {editingInstallment.installmentNumber} Installment</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Adjust schedule due date, expected collection amount, or payment status.
                </p>
              </div>
              <button onClick={() => setEditingInstallment(null)} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateInstMutation.mutate({ id: editingInstallment._id, data: instForm });
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block font-bold text-stone-800 mb-1">Installment Due Date *</label>
                <input
                  type="date"
                  required
                  value={instForm.dueDate || ''}
                  onChange={(e) => setInstForm({ ...instForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Expected Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={instForm.expectedAmount || 0}
                    onChange={(e) => {
                      const exp = parseFloat(e.target.value) || 0;
                      setInstForm({
                        ...instForm,
                        expectedAmount: exp,
                        balanceAmount: Math.max(0, exp - (instForm.paidAmount || 0))
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Paid Amount (₹)</label>
                  <input
                    type="number"
                    value={instForm.paidAmount || 0}
                    onChange={(e) => {
                      const paid = parseFloat(e.target.value) || 0;
                      const exp = instForm.expectedAmount || 0;
                      setInstForm({
                        ...instForm,
                        paidAmount: paid,
                        balanceAmount: Math.max(0, exp - paid),
                        status: paid >= exp ? 'PAID' : (paid > 0 ? 'PENDING' : instForm.status)
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Status *</label>
                  <select
                    value={instForm.status || 'PENDING'}
                    onChange={(e) => setInstForm({ ...instForm, status: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900"
                  >
                    <option value="PAID">PAID</option>
                    <option value="PENDING">PENDING</option>
                    <option value="OVERDUE">OVERDUE</option>
                    <option value="PARTIAL">PARTIAL</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Remaining Balance (₹)</label>
                  <input
                    type="number"
                    value={instForm.balanceAmount || 0}
                    onChange={(e) => setInstForm({ ...instForm, balanceAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[#fcf9f2] border border-[#ded3be] rounded-xl font-mono font-black text-rose-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">Internal Notes / Remarks</label>
                <input
                  type="text"
                  value={instForm.remarks || ''}
                  onChange={(e) => setInstForm({ ...instForm, remarks: e.target.value })}
                  placeholder="e.g. Account closure early payment"
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setEditingInstallment(null)}
                  className="px-4 py-2 border border-[#ded3be] rounded-xl font-bold text-stone-700 hover:bg-[#faf6ee] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateInstMutation.isPending}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 text-stone-950 font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {updateInstMutation.isPending ? 'Saving...' : 'Save Week Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* EDIT GROUP MODAL */}
      {/* ============================================================== */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 text-xs">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-700" />
                  <span>Edit Group #{editingGroup.groupCode}</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Update group collection day, name, operational area, or collector officer.
                </p>
              </div>
              <button onClick={() => setEditingGroup(null)} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateGroupMutation.mutate({ id: editingGroup._id, data: grpForm });
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block font-bold text-stone-800 mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  value={grpForm.name || ''}
                  onChange={(e) => setGrpForm({ ...grpForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Group Code # *</label>
                  <input
                    type="number"
                    required
                    value={grpForm.groupCode || 0}
                    onChange={(e) => setGrpForm({ ...grpForm, groupCode: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Route Day *</label>
                  <select
                    value={grpForm.collectionDay || 'MONDAY'}
                    onChange={(e) => setGrpForm({ ...grpForm, collectionDay: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900"
                  >
                    <option value="MONDAY">MONDAY</option>
                    <option value="TUESDAY">TUESDAY</option>
                    <option value="WEDNESDAY">WEDNESDAY</option>
                    <option value="THURSDAY">THURSDAY</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Operational Area</label>
                  <input
                    type="text"
                    value={grpForm.area || ''}
                    onChange={(e) => setGrpForm({ ...grpForm, area: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-800 mb-1">Collector Staff</label>
                  <input
                    type="text"
                    value={grpForm.assignedStaffName || ''}
                    onChange={(e) => setGrpForm({ ...grpForm, assignedStaffName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2 border border-[#ded3be] rounded-xl font-bold text-stone-700 hover:bg-[#faf6ee] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateGroupMutation.isPending}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 text-stone-950 font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {updateGroupMutation.isPending ? 'Saving...' : 'Save Group Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MANUAL MERGE PROFILES MODAL */}
      {/* ============================================================== */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 text-xs">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <GitMerge className="w-5 h-5 text-amber-700" />
                  <span>Manual Customer Profile Merge Tool</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Consolidate a duplicate borrower account into an existing primary borrower profile.
                </p>
              </div>
              <button onClick={() => setIsMergeModalOpen(false)} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  1. Duplicate Customer to Merge (Source - will be removed) *
                </label>
                <select
                  value={mergeSourceId}
                  onChange={(e) => setMergeSourceId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900"
                >
                  <option value="">-- Select Duplicate Customer --</option>
                  {customers.map((c: any) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.customerId} • {c.phone || 'no phone'} • {c.area})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  2. Primary Customer Profile to Keep (Target - will inherit all loans) *
                </label>
                <select
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900"
                >
                  <option value="">-- Select Target Primary Customer --</option>
                  {customers.map((c: any) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.customerId} • {c.phone || 'no phone'} • {c.area})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-stone-700 space-y-1">
                <p className="font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Merge Behavior:</span>
                </p>
                <p>• All past and active loans under the source customer will be safely transferred to the target profile.</p>
                <p>• Loan cycles will be chronologically sequenced (Cycle 1, Cycle 2, etc.).</p>
                <p>• The source customer ID will be closed and removed from the active registry.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setIsMergeModalOpen(false)}
                  className="px-4 py-2 border border-[#ded3be] rounded-xl font-bold text-stone-700 hover:bg-[#faf6ee] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={mergeCustMutation.isPending || !mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId}
                  onClick={() => {
                    mergeCustMutation.mutate({
                      sourceCustomerId: mergeSourceId,
                      targetCustomerId: mergeTargetId
                    });
                  }}
                  className="px-5 py-2 bg-[#251b14] hover:bg-black text-amber-300 font-bold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {mergeCustMutation.isPending ? 'Merging...' : 'Confirm & Consolidate Profiles'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MasterData;
