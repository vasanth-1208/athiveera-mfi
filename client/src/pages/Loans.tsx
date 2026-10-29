import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  HandCoins, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  Calculator,
  ShieldCheck,
  UserCheck,
  FileCheck2,
  AlertCircle,
  CreditCard,
  User,
  Check,
  X,
  FileText,
  Calendar,
  Layers,
  ChevronRight,
  IndianRupee,
  Phone,
  ArrowRightLeft,
  ArrowUpDown,
  CheckSquare,
  Square,
  RotateCcw,
  Filter,
  Edit3,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Coins
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { LoanProductPreset, WeekAmortization, AmortizationSlab } from '../types';

function expandSlabsToSchedule(slabs: AmortizationSlab[]): WeekAmortization[] {
  const schedule: WeekAmortization[] = [];
  for (const slab of slabs) {
    for (let w = slab.fromWeek; w <= slab.toWeek; w++) {
      schedule.push({
        week: w,
        principal: slab.principal,
        interest: slab.interest,
        savings: slab.savings,
        total: slab.total
      });
    }
  }
  return schedule;
}

export const Loans: React.FC = () => {
  const { user } = useAuth();
  const { selectedBranchId, selectedBranch } = useBranch();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const isStaff = user?.role === 'COLLECTION_STAFF';
  const isManagerOrAdmin = user?.role === 'MAIN_ADMIN' || user?.role === 'BRANCH_MANAGER';
  const isAdmin = user?.role === 'MAIN_ADMIN';

  // Edit Loan Modal States (Manager & Admin - All Fields)
  const [editingLoan, setEditingLoan] = useState<any | null>(null);
  const [editLoanForm, setEditLoanForm] = useState({
    loanNumber: '',
    customerId: '',
    principal: 0,
    interestAmount: 0,
    docCharges: 0,
    savingsAmount: 0,
    totalPayable: 0,
    outstandingTotal: 0,
    totalPaid: 0,
    tenureWeeks: 0,
    status: 'ACTIVE',
    collectionDay: 'MONDAY',
    assignedStaffName: '',
    customerName: '',
    customerPhone: '',
    spouseName: '',
    nomineeName: '',
    nomineePhone: '',
    repaymentFrequency: 'WEEKLY',
    notes: ''
  });
  const [editLoanError, setEditLoanError] = useState('');

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showClosed, setShowClosed] = useState(false);
  const [search, setSearch] = useState('');
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

  // Verification modal states (for Collection Staff or Manager)
  const [verifyingLoan, setVerifyingLoan] = useState<any | null>(null);
  const [verificationForm, setVerificationForm] = useState({
    smartCardNumber: '',
    aadharNumber: '',
    voterIdNumber: '',
    panNumber: '',
    remarks: ''
  });
  const [verificationError, setVerificationError] = useState('');

  // Manager Review / Approval modal state
  const [reviewLoan, setReviewLoan] = useState<any | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState('');

  // Day Filter & Sorting States
  const [selectedDayFilter, setSelectedDayFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');

  // Multi-select & Bulk Transfer States
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTargetLoanIds, setTransferTargetLoanIds] = useState<string[]>([]);
  const [transferStaffId, setTransferStaffId] = useState('');
  const [transferType, setTransferType] = useState<'PERMANENT' | 'TEMPORARY'>('PERMANENT');
  const [transferRemarks, setTransferRemarks] = useState('');
  const [selectionMode, setSelectionMode] = useState<'CUSTOMER' | 'GROUP'>('CUSTOMER');
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);

  // Assign staff modal state (legacy / single loan shortcut)
  const [assignModalLoan, setAssignModalLoan] = useState<any | null>(null);
  const [selectedStaffToAssign, setSelectedStaffToAssign] = useState('');

  // Repayment Collections Quick Modal State
  const [viewingLoanCollectionsId, setViewingLoanCollectionsId] = useState<string | null>(null);

  const { data: modalLoanData, isLoading: isModalLoanLoading } = useQuery({
    queryKey: ['loanCollectionsModal', viewingLoanCollectionsId],
    queryFn: () => api.getLoan(viewingLoanCollectionsId!),
    enabled: !!viewingLoanCollectionsId
  });

  // Slabs schedule state for loan creation
  const [slabs, setSlabs] = useState<AmortizationSlab[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  const [isGroupSearchOpen, setIsGroupSearchOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');

  // Manager Formal Loan Creation Form State
  const [managerLoanForm, setManagerLoanForm] = useState({
    customerId: '',
    customCustomerId: '',
    customerName: '',
    customerPhone: '',
    spouseName: '',
    area: '',
    nomineeName: '',
    nomineeRelationship: 'Spouse',
    nomineePhone: '',
    smartCardNumber: '',
    aadharNumber: '',
    voterIdNumber: '',
    panNumber: '',
    groupNo: '1',
    groupName: '',
    collectionDay: 'MONDAY',
    loanNumber: '',
    loanCategory: 'REGULAR' as 'REGULAR' | 'SPECIAL',
    frequency: 'WEEKLY' as 'WEEKLY' | 'MONTHLY',
    year: new Date().getFullYear(),
    month: new Date().toLocaleString('default', { month: 'long' }),
    loanDate: new Date().toISOString().split('T')[0],
    selectedPresetCode: 'TIER_20K_32W',
    loanAmount: 20000,
    interest: 3800,
    documentCharge: 1200,
    savingsAmount: 1200,
    noOfWeeks: 32,
    weeksAmountSplit: [] as WeekAmortization[],
    enquiryId: ''
  });

  // Queries
  const { data: loansData, isLoading } = useQuery({
    queryKey: ['loans', selectedBranchId, statusFilter, search, user?.role, user?._id],
    queryFn: () => api.getLoans({
      branchId: selectedBranchId,
      status: statusFilter !== 'ALL' ? statusFilter : undefined,
      search: search || undefined,
      limit: 1000
    })
  });

  const { data: customersData } = useQuery({
    queryKey: ['customersList', selectedBranchId],
    queryFn: () => api.getCustomers({ branchId: selectedBranchId, limit: 1000 })
  });

  const { data: groupsData } = useQuery({
    queryKey: ['groupsList', selectedBranchId],
    queryFn: () => api.getGroups({ branchId: selectedBranchId })
  });

  const { data: staffUsersData } = useQuery({
    queryKey: ['staffUsersList', selectedBranchId],
    queryFn: () => api.getUsers({ role: 'COLLECTION_STAFF', branchId: selectedBranchId }),
    enabled: isManagerOrAdmin
  });

  const { data: presetsData } = useQuery({
    queryKey: ['loanPresets'],
    queryFn: () => api.getLoanPresets()
  });

  const rawLoans = loansData?.loans || [];
  const customers = customersData?.customers || [];
  const groups = groupsData?.groups || [];
  const staffUsers = (staffUsersData?.users || []).filter((u: any) => u.status !== 'INACTIVE');
  const presets: LoanProductPreset[] = presetsData?.presets || [];

  // Filtered and Sorted Loans: Closed loans ALWAYS at bottom
  const visibleLoans = React.useMemo(() => {
    let list = [...rawLoans];

    if (selectedDayFilter !== 'ALL') {
      list = list.filter((l: any) => {
        const d = (l.groupId?.collectionDay || l.collectionDay || '').toUpperCase();
        return d === selectedDayFilter;
      });
    }

    if (!showClosed && statusFilter === 'ALL') {
      list = list.filter((l: any) => l.status !== 'CLOSED' && l.status !== 'SETTLED');
    }

    return list.sort((a: any, b: any) => {
      const isClosedA = a.status === 'CLOSED' || a.status === 'SETTLED';
      const isClosedB = b.status === 'CLOSED' || b.status === 'SETTLED';
      if (showClosed) {
        if (isClosedA && !isClosedB) return -1; // Closed at top
        if (!isClosedA && isClosedB) return 1;  // Live below
      } else {
        if (isClosedA && !isClosedB) return 1;
        if (!isClosedA && isClosedB) return -1;
      }

      switch (sortBy) {
        case 'oldest':
          return new Date(a.loanDate || a.createdAt).getTime() - new Date(b.loanDate || b.createdAt).getTime();
        case 'name_asc':
          return (a.customerId?.name || a.customerName || '').localeCompare(b.customerId?.name || b.customerName || '');
        case 'name_desc':
          return (b.customerId?.name || b.customerName || '').localeCompare(a.customerId?.name || a.customerName || '');
        case 'amount_desc':
          return (b.principal || 0) - (a.principal || 0);
        case 'amount_asc':
          return (a.principal || 0) - (b.principal || 0);
        case 'balance_desc':
          return (b.outstandingTotal || 0) - (a.outstandingTotal || 0);
        case 'balance_asc':
          return (a.outstandingTotal || 0) - (b.outstandingTotal || 0);
        case 'newest':
        default:
          return new Date(b.loanDate || b.createdAt).getTime() - new Date(a.loanDate || a.createdAt).getTime();
      }
    });
  }, [rawLoans, selectedDayFilter, sortBy]);

  const loans = visibleLoans;

  // Grouped loans representation for Group-Wise Selection & Bulk Transfer
  const groupedLoans = React.useMemo(() => {
    const map = new Map<string, {
      groupId: string;
      groupCode: number | string;
      groupName: string;
      collectionDay: string;
      area: string;
      staffName: string;
      loans: any[];
      totalPrincipal: number;
      totalOutstanding: number;
    }>();

    for (const l of loans) {
      const gId = l.groupId?._id ? String(l.groupId._id) : (l.groupId ? String(l.groupId) : 'unassigned-group');
      const gCode = l.groupId?.groupCode ?? l.groupNo ?? '-';
      const gName = l.groupId?.name || l.groupName || 'Unassigned Group';
      const gDay = (l.groupId?.collectionDay || l.collectionDay || '-').toUpperCase();
      const gArea = l.groupId?.area || l.area || '-';
      const gStaff = l.assignedStaffName || l.assignedStaffId?.name || 'Branch Manager';

      if (!map.has(gId)) {
        map.set(gId, {
          groupId: gId,
          groupCode: gCode,
          groupName: gName,
          collectionDay: gDay,
          area: gArea,
          staffName: gStaff,
          loans: [],
          totalPrincipal: 0,
          totalOutstanding: 0
        });
      }

      const item = map.get(gId)!;
      item.loans.push(l);
      item.totalPrincipal += (l.principal || 0);
      item.totalOutstanding += (l.outstandingTotal || 0);
    }

    return Array.from(map.values());
  }, [loans]);

  const isGroupFullySelected = (grp: any) => grp.loans.length > 0 && grp.loans.every((l: any) => selectedLoanIds.includes(l._id));
  const isGroupPartiallySelected = (grp: any) => grp.loans.some((l: any) => selectedLoanIds.includes(l._id)) && !isGroupFullySelected(grp);

  const handleToggleGroupSelect = (grp: any) => {
    const grpLoanIds = grp.loans.map((l: any) => l._id);
    const allSelected = grpLoanIds.every((id: string) => selectedLoanIds.includes(id));
    if (allSelected) {
      setSelectedLoanIds(prev => prev.filter(id => !grpLoanIds.includes(id)));
    } else {
      setSelectedLoanIds(prev => Array.from(new Set([...prev, ...grpLoanIds])));
    }
  };

  const handleToggleAllGroups = () => {
    const allVisibleLoanIds = loans.map((l: any) => l._id);
    const allSelected = allVisibleLoanIds.length > 0 && allVisibleLoanIds.every(id => selectedLoanIds.includes(id));
    if (allSelected) {
      setSelectedLoanIds([]);
    } else {
      setSelectedLoanIds(allVisibleLoanIds);
    }
  };

  // Distinct groups selected count
  const selectedGroupCount = React.useMemo(() => {
    const grpIds = new Set<string>();
    for (const grp of groupedLoans) {
      if (grp.loans.some((l: any) => selectedLoanIds.includes(l._id))) {
        grpIds.add(grp.groupId);
      }
    }
    return grpIds.size;
  }, [groupedLoans, selectedLoanIds]);

  // Next sequential Customer ID (calculated from max in existing database)
  const nextCustomerId = React.useMemo(() => {
    let maxNum = 0;
    if (customers && customers.length > 0) {
      for (const c of customers) {
        if (c.customerId) {
          const matches = c.customerId.match(/\d+/g);
          if (matches && matches.length > 0) {
            const num = parseInt(matches[matches.length - 1], 10);
            if (!isNaN(num) && num > maxNum) {
              maxNum = num;
            }
          }
        }
      }
    }
    const nextVal = maxNum + 1;
    const bCode = selectedBranch?.code === 'MDKM' ? 'MDKM' : 'PL';
    return `ATH-${bCode}-CUST-${String(nextVal).padStart(4, '0')}`;
  }, [customers, selectedBranch]);

  // Next sequential Group No (calculated from max in existing database)
  const nextGroupNo = React.useMemo(() => {
    let maxCode = 0;
    if (groups && groups.length > 0) {
      for (const g of groups) {
        const code = typeof g.groupCode === 'number' ? g.groupCode : parseInt(String(g.groupCode).replace(/\D/g, ''), 10);
        if (!isNaN(code) && code > maxCode) {
          maxCode = code;
        }
      }
    }
    return maxCode > 0 ? maxCode + 1 : 1;
  }, [groups]);

  // Filtered customers for search bar
  const filteredCustomers = React.useMemo(() => {
    if (!customerSearchTerm.trim()) return [];
    const term = customerSearchTerm.toLowerCase().trim();
    return customers.filter((c: any) =>
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.customerId && c.customerId.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term)) ||
      (c.area && c.area.toLowerCase().includes(term))
    ).slice(0, 10);
  }, [customers, customerSearchTerm]);

  // Filtered groups for search bar
  const filteredGroups = React.useMemo(() => {
    if (!groupSearchTerm.trim()) return groups.slice(0, 10);
    const term = groupSearchTerm.toLowerCase().trim();
    return groups.filter((g: any) =>
      String(g.groupCode).includes(term) ||
      (g.name && g.name.toLowerCase().includes(term)) ||
      (g.area && g.area.toLowerCase().includes(term)) ||
      (g.collectionDay && g.collectionDay.toLowerCase().includes(term))
    ).slice(0, 10);
  }, [groups, groupSearchTerm]);

  // Sync default customerId & groupNo if empty
  useEffect(() => {
    if (!managerLoanForm.customCustomerId && nextCustomerId) {
      setManagerLoanForm(prev => ({
        ...prev,
        customCustomerId: nextCustomerId
      }));
    }
  }, [nextCustomerId]);

  useEffect(() => {
    if ((!managerLoanForm.groupNo || managerLoanForm.groupNo === '1') && nextGroupNo > 1) {
      setManagerLoanForm(prev => ({
        ...prev,
        groupNo: String(nextGroupNo),
        groupName: prev.groupName || `GROUP - ${nextGroupNo}`
      }));
    }
  }, [nextGroupNo]);

  // Initialize default preset schedule and slabs
  useEffect(() => {
    if (presets.length > 0 && slabs.length === 0) {
      const defPreset = presets.find(p => p.code === 'TIER_20K_32W') || presets[0];
      if (defPreset && defPreset.slabs && defPreset.slabs.length > 0) {
        const clonedSlabs = defPreset.slabs.map(s => ({ ...s }));
        setSlabs(clonedSlabs);
        setManagerLoanForm(prev => ({
          ...prev,
          selectedPresetCode: defPreset.code,
          loanCategory: defPreset.category,
          frequency: defPreset.frequency,
          loanAmount: defPreset.principal,
          interest: defPreset.interestAmount,
          documentCharge: defPreset.docCharges,
          savingsAmount: defPreset.savingsAmount,
          noOfWeeks: defPreset.tenureWeeks,
          weeksAmountSplit: expandSlabsToSchedule(clonedSlabs)
        }));
      }
    }
  }, [presets]);

  // Handle URL params from Loan Enquiry navigation
  useEffect(() => {
    const action = searchParams.get('action');
    const enquiryId = searchParams.get('enquiryId');
    const name = searchParams.get('name');
    const place = searchParams.get('place');
    const phone = searchParams.get('phone');
    const amount = searchParams.get('amount');
    const smartCard = searchParams.get('smartCard');
    const aadhar = searchParams.get('aadhar');
    const voterId = searchParams.get('voterId');
    const pan = searchParams.get('pan');
    const spouse = searchParams.get('spouse');
    const nominee = searchParams.get('nominee');
    const nomineeRel = searchParams.get('nomineeRel');

    if (action === 'new' || enquiryId) {
      setIsApplyModalOpen(true);
      if (name || place || amount || enquiryId || smartCard || aadhar || voterId || pan || spouse || nominee) {
        setManagerLoanForm(prev => ({
          ...prev,
          enquiryId: enquiryId || '',
          customerName: name || prev.customerName,
          spouseName: spouse || prev.spouseName,
          nomineeName: nominee || prev.nomineeName,
          nomineeRelationship: nomineeRel || prev.nomineeRelationship,
          area: place || prev.area,
          customerPhone: phone || prev.customerPhone,
          loanAmount: amount ? parseFloat(amount) : prev.loanAmount,
          smartCardNumber: smartCard || prev.smartCardNumber,
          aadharNumber: aadhar || prev.aadharNumber,
          voterIdNumber: voterId || prev.voterIdNumber,
          panNumber: pan || prev.panNumber
        }));
      }
    }
  }, [searchParams]);

  const handleOpenNewLoanModal = () => {
    const defPreset = presets.find(p => p.code === 'TIER_20K_32W') || presets[0];
    const initialSlabs = defPreset?.slabs && defPreset.slabs.length > 0
      ? defPreset.slabs.map(s => ({ ...s }))
      : [{ fromWeek: 1, toWeek: 32, principal: 625, interest: 125, savings: 50, total: 800 }];
    const initialSchedule = expandSlabsToSchedule(initialSlabs);

    setSlabs(initialSlabs);
    setManagerLoanForm(prev => ({
      ...prev,
      customerId: '',
      customCustomerId: nextCustomerId,
      customerName: '',
      customerPhone: '',
      spouseName: '',
      area: '',
      nomineeName: '',
      nomineeRelationship: 'Spouse',
      nomineePhone: '',
      smartCardNumber: '',
      aadharNumber: '',
      voterIdNumber: '',
      panNumber: '',
      groupNo: String(nextGroupNo),
      groupName: `GROUP - ${nextGroupNo}`,
      collectionDay: 'MONDAY',
      loanNumber: '',
      selectedPresetCode: defPreset ? defPreset.code : 'TIER_20K_32W',
      loanCategory: defPreset ? defPreset.category : 'REGULAR',
      frequency: defPreset ? defPreset.frequency : 'WEEKLY',
      loanAmount: defPreset ? defPreset.principal : 20000,
      interest: defPreset ? defPreset.interestAmount : 3800,
      documentCharge: defPreset ? defPreset.docCharges : 1200,
      savingsAmount: defPreset ? defPreset.savingsAmount : 1200,
      noOfWeeks: defPreset ? defPreset.tenureWeeks : 32,
      weeksAmountSplit: initialSchedule,
      enquiryId: ''
    }));
    setCustomerSearchTerm('');
    setIsCustomerSearchOpen(false);
    setIsApplyModalOpen(true);
  };

  const handleSelectPreset = (presetCode: string) => {
    if (presetCode === 'CUSTOM') {
      setManagerLoanForm(prev => ({
        ...prev,
        selectedPresetCode: 'CUSTOM'
      }));
      return;
    }
    const p = presets.find(item => item.code === presetCode);
    if (!p) return;
    const pSlabs = p.slabs && p.slabs.length > 0 ? p.slabs.map(s => ({ ...s })) : [];
    setSlabs(pSlabs);
    const pSchedule = expandSlabsToSchedule(pSlabs);
    setManagerLoanForm(prev => ({
      ...prev,
      selectedPresetCode: presetCode,
      loanCategory: p.category,
      frequency: p.frequency,
      loanAmount: p.principal,
      interest: p.interestAmount,
      documentCharge: p.docCharges,
      savingsAmount: p.savingsAmount,
      noOfWeeks: p.tenureWeeks,
      weeksAmountSplit: pSchedule
    }));
  };

  const handleSlabChange = (index: number, field: keyof AmortizationSlab, value: number) => {
    setSlabs(prevSlabs => {
      const newSlabs = prevSlabs.map((s, i) => {
        if (i !== index) return s;
        const updated = { ...s, [field]: value };
        if (field === 'principal' || field === 'interest' || field === 'savings') {
          updated.total = (field === 'principal' ? value : updated.principal) +
                          (field === 'interest' ? value : updated.interest) +
                          (field === 'savings' ? value : updated.savings);
        }
        return updated;
      });

      const expanded = expandSlabsToSchedule(newSlabs);
      const totalPrincipal = newSlabs.reduce((sum, s) => sum + (s.principal * (s.toWeek - s.fromWeek + 1)), 0);
      const totalInterest = newSlabs.reduce((sum, s) => sum + (s.interest * (s.toWeek - s.fromWeek + 1)), 0);
      const totalSavings = newSlabs.reduce((sum, s) => sum + (s.savings * (s.toWeek - s.fromWeek + 1)), 0);
      const totalWeeks = newSlabs.reduce((sum, s) => sum + (s.toWeek - s.fromWeek + 1), 0);

      setManagerLoanForm(prev => ({
        ...prev,
        selectedPresetCode: 'CUSTOM',
        noOfWeeks: totalWeeks,
        loanAmount: totalPrincipal,
        interest: totalInterest,
        savingsAmount: totalSavings,
        weeksAmountSplit: expanded
      }));

      return newSlabs;
    });
  };

  const handleAddSlab = () => {
    setSlabs(prevSlabs => {
      const lastSlab = prevSlabs[prevSlabs.length - 1];
      const fromWeek = lastSlab ? lastSlab.toWeek + 1 : 1;
      const toWeek = fromWeek + 9;
      const newSlab: AmortizationSlab = {
        fromWeek,
        toWeek,
        principal: 600,
        interest: 50,
        savings: 50,
        total: 700
      };
      const updated = [...prevSlabs, newSlab];
      const expanded = expandSlabsToSchedule(updated);
      const totalPrincipal = updated.reduce((sum, s) => sum + (s.principal * (s.toWeek - s.fromWeek + 1)), 0);
      const totalInterest = updated.reduce((sum, s) => sum + (s.interest * (s.toWeek - s.fromWeek + 1)), 0);
      const totalSavings = updated.reduce((sum, s) => sum + (s.savings * (s.toWeek - s.fromWeek + 1)), 0);
      const totalWeeks = updated.reduce((sum, s) => sum + (s.toWeek - s.fromWeek + 1), 0);

      setManagerLoanForm(prev => ({
        ...prev,
        selectedPresetCode: 'CUSTOM',
        noOfWeeks: totalWeeks,
        loanAmount: totalPrincipal,
        interest: totalInterest,
        savingsAmount: totalSavings,
        weeksAmountSplit: expanded
      }));
      return updated;
    });
  };

  const handleRemoveSlab = (index: number) => {
    setSlabs(prevSlabs => {
      if (prevSlabs.length <= 1) return prevSlabs;
      const updated = prevSlabs.filter((_, i) => i !== index);
      const expanded = expandSlabsToSchedule(updated);
      const totalPrincipal = updated.reduce((sum, s) => sum + (s.principal * (s.toWeek - s.fromWeek + 1)), 0);
      const totalInterest = updated.reduce((sum, s) => sum + (s.interest * (s.toWeek - s.fromWeek + 1)), 0);
      const totalSavings = updated.reduce((sum, s) => sum + (s.savings * (s.toWeek - s.fromWeek + 1)), 0);
      const totalWeeks = updated.reduce((sum, s) => sum + (s.toWeek - s.fromWeek + 1), 0);

      setManagerLoanForm(prev => ({
        ...prev,
        selectedPresetCode: 'CUSTOM',
        noOfWeeks: totalWeeks,
        loanAmount: totalPrincipal,
        interest: totalInterest,
        savingsAmount: totalSavings,
        weeksAmountSplit: expanded
      }));
      return updated;
    });
  };

  const handleCustomerSelect = (custId: string) => {
    const cust = customers.find((c: any) => c._id === custId);
    if (cust) {
      setManagerLoanForm(prev => ({
        ...prev,
        customerId: cust._id,
        customCustomerId: cust.customerId,
        customerName: cust.name,
        customerPhone: cust.phone || '',
        spouseName: cust.spouseName || '',
        area: cust.area || prev.area,
        nomineeName: cust.nomineeName || '',
        nomineeRelationship: cust.nomineeRelationship || 'Spouse',
        nomineePhone: cust.nomineePhone || '',
        smartCardNumber: cust.smartCardNumber || prev.smartCardNumber,
        aadharNumber: cust.aadharNumber || prev.aadharNumber,
        voterIdNumber: cust.voterIdNumber || prev.voterIdNumber,
        panNumber: cust.panNumber || prev.panNumber
      }));
      setCustomerSearchTerm('');
      setIsCustomerSearchOpen(false);
    }
  };

  const handleClearSelectedCustomer = () => {
    setManagerLoanForm(prev => ({
      ...prev,
      customerId: '',
      customCustomerId: nextCustomerId,
      customerName: '',
      customerPhone: '',
      spouseName: '',
      nomineeName: '',
      nomineePhone: '',
      smartCardNumber: '',
      aadharNumber: '',
      voterIdNumber: '',
      panNumber: ''
    }));
    setCustomerSearchTerm('');
    setIsCustomerSearchOpen(false);
  };

  const handleGroupSelect = (grpId: string) => {
    const grp = groups.find((g: any) => g._id === grpId);
    if (grp) {
      setSelectedGroupId(grp._id);
      setManagerLoanForm(prev => ({
        ...prev,
        groupNo: String(grp.groupCode || grp.name.replace(/[^0-9]/g, '')),
        groupName: grp.name,
        collectionDay: grp.collectionDay || prev.collectionDay,
        area: grp.area || prev.area
      }));
      setGroupSearchTerm('');
      setIsGroupSearchOpen(false);
    }
  };

  const handleClearSelectedGroup = () => {
    setSelectedGroupId('');
    setManagerLoanForm(prev => ({
      ...prev,
      groupNo: String(nextGroupNo),
      groupName: `GROUP - ${nextGroupNo}`,
      collectionDay: 'MONDAY'
    }));
    setGroupSearchTerm('');
    setIsGroupSearchOpen(false);
  };

  // Manager Formal Loan Creation Mutation
  const createManagerLoanMutation = useMutation({
    mutationFn: (payload: any) => api.createManagerLoan(payload),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customersList'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groupsList'] });
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      setIsApplyModalOpen(false);
      alert(res?.message || 'Loan created successfully and entered into the ledger!');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to create loan');
    }
  });

  const handleManagerLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerLoanForm.customerName || !managerLoanForm.area || !managerLoanForm.loanAmount || !managerLoanForm.noOfWeeks) {
      alert('Customer Name, Area, Loan Amount, and Tenure Weeks are mandatory.');
      return;
    }
    const expandedSchedule = expandSlabsToSchedule(slabs);
    createManagerLoanMutation.mutate({
      ...managerLoanForm,
      weeksAmountSplit: expandedSchedule,
      branchId: selectedBranchId
    });
  };

  const verifyLoanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.verifyLoan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setVerifyingLoan(null);
      setVerificationForm({ smartCardNumber: '', aadharNumber: '', voterIdNumber: '', panNumber: '', remarks: '' });
      setVerificationError('');
    },
    onError: (err: any) => {
      setVerificationError(err.message || 'Failed to submit verification');
    }
  });

  const assignStaffMutation = useMutation({
    mutationFn: ({ id, staffId }: { id: string; staffId: string }) => api.assignLoanStaff(id, staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setAssignModalLoan(null);
      setSelectedStaffToAssign('');
    }
  });

  const bulkTransferMutation = useMutation({
    mutationFn: (payload: { loanIds: string[]; staffId: string; transferType: 'PERMANENT' | 'TEMPORARY'; remarks?: string }) =>
      api.transferLoanBulk(payload),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['dailySheet'] });
      queryClient.invalidateQueries({ queryKey: ['weeklySheet'] });
      queryClient.invalidateQueries({ queryKey: ['staffCollections'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setIsTransferModalOpen(false);
      setSelectedLoanIds([]);
      setTransferTargetLoanIds([]);
      setTransferRemarks('');
      alert(res?.message || 'Loans successfully transferred!');
    },
    onError: (err: any) => {
      alert(err?.message || 'Failed to transfer loans');
    }
  });

  const approveLoanMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) => api.approveLoan(id, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setReviewLoan(null);
      setApprovalRemarks('');
    }
  });

  const rejectLoanMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) => api.rejectLoan(id, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      setReviewLoan(null);
      setApprovalRemarks('');
    }
  });

  const updateLoanMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateLoan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      setEditingLoan(null);
      setEditLoanError('');
    },
    onError: (err: any) => {
      setEditLoanError(err.message || 'Failed to update loan');
    }
  });

  const deleteLoanMutation = useMutation({
    mutationFn: (id: string) => api.deleteLoan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to delete loan');
    }
  });

  const handleOpenEditLoan = (l: any) => {
    setEditingLoan(l);
    setEditLoanForm({
      loanNumber: l.loanNumber || '',
      customerId: l.customerId?.customerId || (typeof l.customerId === 'string' ? l.customerId : ''),
      principal: l.principal || 0,
      interestAmount: l.interestAmount || 0,
      docCharges: l.docCharges || 0,
      savingsAmount: l.savingsAmount || 0,
      totalPayable: l.totalPayable || 0,
      outstandingTotal: l.outstandingTotal !== undefined ? l.outstandingTotal : ((l.totalPayable || 0) - (l.totalPaid || 0)),
      totalPaid: l.totalPaid || 0,
      tenureWeeks: l.tenureWeeks || 0,
      status: l.status || 'ACTIVE',
      collectionDay: l.collectionDay || l.groupId?.collectionDay || 'MONDAY',
      assignedStaffName: l.assignedStaffName || l.assignedStaffId?.name || '',
      customerName: l.customerName || l.customerId?.name || '',
      customerPhone: l.customerPhone || l.customerId?.phone || '',
      spouseName: l.spouseName || l.customerId?.spouseName || '',
      nomineeName: l.nomineeName || l.customerId?.nomineeName || '',
      nomineePhone: l.nomineePhone || l.customerId?.nomineePhone || '',
      repaymentFrequency: l.repaymentFrequency || 'WEEKLY',
      notes: l.notes || ''
    });
    setEditLoanError('');
  };

  const handleEditLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateLoanMutation.mutate({
      id: editingLoan._id,
      data: editLoanForm
    });
  };

  const handleDeleteLoan = (l: any) => {
    if (window.confirm(`Are you sure you want to permanently delete loan account "${l.loanNumber}" (${l.customerName || l.customerId?.name || 'Borrower'})? All associated installments and repayment records will be deleted. This action cannot be undone.`)) {
      deleteLoanMutation.mutate(l._id);
    }
  };

  const handleOpenVerifyModal = (loan: any) => {
    setVerifyingLoan(loan);
    setVerificationForm({
      smartCardNumber: loan.verification?.smartCardNumber || loan.customerId?.smartCardNumber || '',
      aadharNumber: loan.verification?.aadharNumber || loan.customerId?.aadharNumber || '',
      voterIdNumber: loan.verification?.voterIdNumber || loan.customerId?.voterIdNumber || '',
      panNumber: loan.verification?.panNumber || loan.customerId?.panNumber || '',
      remarks: loan.verification?.remarks || ''
    });
    setVerificationError('');
  };

  const handleVerificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationForm.smartCardNumber || !verificationForm.aadharNumber || !verificationForm.voterIdNumber || !verificationForm.panNumber) {
      setVerificationError('All 4 identification documents are strictly required: Smart Card No, Aadhaar No, Voter ID No, and PAN No.');
      return;
    }
    verifyLoanMutation.mutate({
      id: verifyingLoan._id,
      data: verificationForm
    });
  };

  const filterTabs = ['ALL', 'ACTIVE', 'OVERDUE', 'CLOSED', 'SETTLED'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">
            {isStaff ? 'My Assigned Loans & Field Verifications' : 'Loan Portfolio & Applications'}
          </h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            {isStaff
              ? 'Create new loan applications, perform borrower KYC field verification, and submit for manager sanction'
              : 'Review applications, assign verification staff, inspect borrower KYC documentation, and authorize disbursements'}
          </p>
        </div>

        {/* Action Buttons: Closed Loans Toggle + New Loan Application */}
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
              title={showClosed ? "Hide closed loans (Closed shown at top)" : "Show closed loans (Closed currently hidden)"}
            >
              {showClosed ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5 text-stone-500" />}
              <span>{showClosed ? 'Closed Loans (Shown)' : 'Closed Loans (Hidden)'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                showClosed ? 'bg-amber-400 text-stone-950' : 'bg-[#ece3d4] text-stone-700'
              }`}>
                {(loansData?.loans || []).filter((l: any) => l.status === 'CLOSED' || l.status === 'SETTLED').length}
              </span>
            </button>
          )}

          {/* New Loan Application Button - Shown for EVERYONE */}
          <button
            onClick={handleOpenNewLoanModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 rounded-xl text-xs font-bold shadow-md shadow-amber-900/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Loan Application</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {filterTabs.map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
                    : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
                }`}
              >
                {st === 'PENDING_VERIFICATION' ? 'Pending KYC Verification' :
                 st === 'VERIFIED' ? 'KYC Verified' : st}
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search account #, borrower, group..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#ded3be] rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-amber-600 shadow-xs"
            />
          </div>
        </div>

        {/* Day-Wise Route Filters & Sorting Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#f6f0e4] p-2.5 rounded-2xl border border-[#ded3be]">
          {/* Day Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="text-[10px] font-black uppercase text-amber-950 px-1 shrink-0 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-700" />
              <span>Route Day:</span>
            </span>
            {['ALL', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'].map((df) => (
              <button
                key={df}
                onClick={() => setSelectedDayFilter(df)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  selectedDayFilter === df
                    ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
                    : 'bg-white border border-[#ded3be] text-stone-700 hover:bg-[#faf6ee]'
                }`}
              >
                {df === 'ALL' ? 'All Days' : `${df} Route`}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mode Switcher: Customer-Wise vs Group-Wise (Manager & Admin) */}
            {isManagerOrAdmin && (
              <div className="flex items-center bg-[#ece3d4] p-1 rounded-2xl border border-[#ded3be] shadow-xs">
                <button
                  type="button"
                  onClick={() => setSelectionMode('CUSTOMER')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectionMode === 'CUSTOMER'
                      ? 'bg-[#251b14] text-amber-300 shadow-xs'
                      : 'text-stone-700 hover:text-stone-900'
                  }`}
                  title="Customer-wise loan view and selection"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Customer-Wise</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMode('GROUP')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectionMode === 'GROUP'
                      ? 'bg-[#251b14] text-amber-300 shadow-xs'
                      : 'text-stone-700 hover:text-stone-900'
                  }`}
                  title="Group-wise view and selection for transfer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Group-Wise</span>
                </button>
              </div>
            )}

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-black uppercase text-amber-950 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-amber-700" />
                <span>Sort:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-[#ded3be] rounded-xl px-3 py-1 text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-600 shadow-2xs cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name_asc">Borrower Name (A → Z)</option>
                <option value="name_desc">Borrower Name (Z → A)</option>
                <option value="amount_desc">Principal: High to Low</option>
                <option value="amount_asc">Principal: Low to High</option>
                <option value="balance_desc">Outstanding: High to Low</option>
                <option value="balance_asc">Outstanding: Low to High</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Customer-Wise Loans Table */}
      {selectionMode === 'CUSTOMER' && (
      <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f6f0e4] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
              <tr>
                {isManagerOrAdmin && (
                  <th className="px-3 py-3 w-9 text-center">
                    <input
                      type="checkbox"
                      checked={loans.length > 0 && selectedLoanIds.length === loans.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLoanIds(loans.map((l: any) => l._id));
                        } else {
                          setSelectedLoanIds([]);
                        }
                      }}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                      title="Select All Visible Loans"
                    />
                  </th>
                )}
                <th className="px-4 py-3">Loan Account #</th>
                <th className="px-4 py-3">Borrower / Group</th>
                <th className="px-4 py-3">Principal Amount</th>
                <th className="px-4 py-3">Total Contractual</th>
                <th className="px-4 py-3">Assigned Staff</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ece3d4]">
              {isLoading ? (
                <tr>
                  <td colSpan={isManagerOrAdmin ? 8 : 7} className="text-center py-12 text-stone-400 font-medium">
                    Loading loan applications and assigned records...
                  </td>
                </tr>
              ) : loans.length > 0 ? (
                loans.map((l: any) => {
                  return (
                    <tr key={l._id} className="hover:bg-[#fbf7f0] transition">
                      {/* Row Checkbox (Manager & Admin) */}
                      {isManagerOrAdmin && (
                        <td className="px-3 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedLoanIds.includes(l._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLoanIds(prev => [...prev, l._id]);
                              } else {
                                setSelectedLoanIds(prev => prev.filter(id => id !== l._id));
                              }
                            }}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                          />
                        </td>
                      )}

                      {/* Loan Account */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-stone-800 block">{l.loanNumber}</span>
                        <span className="text-[10px] text-stone-500 font-semibold uppercase">{l.productType?.replace(/_/g, ' ')}</span>
                      </td>

                      {/* Borrower & Group */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-stone-900">{l.customerId?.name || l.customerName}</span>
                          {l.customerId?.customerId && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300" title="Canonical Customer ID">
                              {l.customerId.customerId}
                            </span>
                          )}
                          {l.cycle && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                              Cycle {l.cycle}
                            </span>
                          )}
                        </div>
                        {l.customerId?.phone && l.customerId.phone !== '-' && (
                          <a
                            href={`tel:${l.customerId.phone.replace(/[^0-9+]/g, '')}`}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-800 hover:text-emerald-950 font-bold hover:underline cursor-pointer"
                            title={`Click to call ${l.customerId.name} (${l.customerId.phone})`}
                          >
                            <Phone className="w-2.5 h-2.5 text-emerald-600" />
                            <span>{l.customerId.phone}</span>
                          </a>
                        )}
                        <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-0.5 font-medium">
                          <span className="text-amber-800 font-semibold">{l.groupId?.name}</span>
                          <span>•</span>
                          <span className="uppercase text-amber-700 font-bold">{l.groupId?.collectionDay}</span>
                        </div>
                      </td>

                      {/* Principal */}
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-stone-900 text-sm">₹{l.principal?.toLocaleString('en-IN')}</span>
                        <span className="text-[10px] text-stone-500 block">{l.tenureWeeks} Weeks</span>
                      </td>

                      {/* Total Contractual */}
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-amber-900 text-sm">₹{l.totalPayable?.toLocaleString('en-IN')}</span>
                        {l.status === 'ACTIVE' && (
                          <span className="text-[10px] text-emerald-700 block font-semibold">
                            Paid: ₹{l.totalPaid?.toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>

                      {/* Assigned Staff */}
                      <td className="px-4 py-3.5">
                        {l.assignedStaffName || l.assignedStaffId?.name ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                              <span className="font-bold text-stone-800 text-xs">
                                {l.assignedStaffName || l.assignedStaffId?.name}
                              </span>
                            </div>
                            {l.isTemporaryTransfer && (
                              <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                                One-Time Transfer
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-stone-400 italic">Branch Manager</span>
                        )}
                        {isManagerOrAdmin && (
                          <button
                            onClick={() => {
                              setTransferTargetLoanIds([l._id]);
                              setTransferStaffId(l.assignedStaffId?._id || l.assignedStaffId || 'MANAGER');
                              setTransferType(l.transferType || 'PERMANENT');
                              setTransferRemarks(l.transferRemarks || '');
                              setIsTransferModalOpen(true);
                            }}
                            className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline block mt-1 cursor-pointer flex items-center gap-1"
                          >
                            <ArrowRightLeft className="w-2.5 h-2.5" />
                            <span>Transfer Staff</span>
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          l.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          l.status === 'CLOSED' || l.status === 'SETTLED' ? 'bg-stone-200 text-stone-800 border border-stone-300' :
                          l.status === 'OVERDUE' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                          'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {l.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Manager Review / Approve Button (for submitted loans) */}
                          {isManagerOrAdmin && l.status === 'SUBMITTED' && (
                            <button
                              onClick={() => setReviewLoan(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg text-xs shadow-xs transition cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Decide</span>
                            </button>
                          )}

                          <button
                            onClick={() => setViewingLoanCollectionsId(l._id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold rounded-lg text-xs border border-emerald-300 transition cursor-pointer"
                            title="View Repayment Collections History"
                          >
                            <Coins className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Collections</span>
                          </button>

                          <Link
                            to={`/loans/${l._id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#f6f0e4] hover:bg-[#ede3d0] text-amber-950 font-bold rounded-lg text-xs border border-[#ded3be] transition cursor-pointer"
                            title="View Loan Details & Ledger"
                          >
                            <span>Details</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />
                          </Link>

                          {isManagerOrAdmin && (
                            <button
                              onClick={() => handleOpenEditLoan(l)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-lg text-xs border border-amber-300 transition cursor-pointer"
                              title="Edit Loan (All Fields)"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                              <span>Edit</span>
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteLoan(l)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs border border-rose-300 transition cursor-pointer"
                              title="Delete Loan & Installments (Admin Only)"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-stone-400 font-medium">
                    {isStaff
                      ? 'No field loan verifications currently assigned to you.'
                      : 'No loan applications found matching this filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Group-Wise Selection Table (Manager & Admin) */}
      {selectionMode === 'GROUP' && (
        <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f6f0e4] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                <tr>
                  {isManagerOrAdmin && (
                    <th className="px-3 py-3 w-9 text-center">
                      <input
                        type="checkbox"
                        checked={loans.length > 0 && selectedLoanIds.length === loans.length}
                        onChange={handleToggleAllGroups}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                        title="Select All Visible Groups & Loans"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3">Group Code & Name</th>
                  <th className="px-4 py-3">Route Day</th>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3">Assigned Staff</th>
                  <th className="px-4 py-3">Active Loans</th>
                  <th className="px-4 py-3">Total Portfolio</th>
                  <th className="px-4 py-3">Balance Outstanding</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece3d4]">
                {isLoading ? (
                  <tr>
                    <td colSpan={isManagerOrAdmin ? 9 : 8} className="text-center py-12 text-stone-400 font-medium">
                      Loading groups and route assignments...
                    </td>
                  </tr>
                ) : groupedLoans.length > 0 ? (
                  groupedLoans.map((grp: any) => {
                    const isFullySel = isGroupFullySelected(grp);
                    const isPartSel = isGroupPartiallySelected(grp);
                    const isExpanded = expandedGroupIds.includes(grp.groupId);

                    return (
                      <React.Fragment key={grp.groupId}>
                        <tr className="hover:bg-[#fbf7f0] transition">
                          {/* Group Checkbox */}
                          {isManagerOrAdmin && (
                            <td className="px-3 py-3.5 text-center">
                              <input
                                type="checkbox"
                                checked={isFullySel}
                                ref={(el) => {
                                  if (el) el.indeterminate = isPartSel;
                                }}
                                onChange={() => handleToggleGroupSelect(grp)}
                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                              />
                            </td>
                          )}

                          {/* Group Code & Name */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedGroupIds(prev =>
                                    prev.includes(grp.groupId)
                                      ? prev.filter(id => id !== grp.groupId)
                                      : [...prev, grp.groupId]
                                  );
                                }}
                                className="p-1 hover:bg-[#ede3d0] rounded-lg transition text-stone-600 cursor-pointer"
                                title={isExpanded ? 'Hide members' : 'View members'}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                              <div>
                                <span className="font-bold text-stone-900 block">{grp.groupName}</span>
                                <span className="font-mono text-[10px] text-stone-500 font-semibold">
                                  Group #{grp.groupCode}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Route Day */}
                          <td className="px-4 py-3.5">
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-2xs">
                              {grp.collectionDay || '-'}
                            </span>
                          </td>

                          {/* Area */}
                          <td className="px-4 py-3.5 font-medium text-stone-700">
                            {grp.area || '-'}
                          </td>

                          {/* Assigned Staff */}
                          <td className="px-4 py-3.5 font-bold text-amber-950">
                            {grp.staffName}
                          </td>

                          {/* Active Loans */}
                          <td className="px-4 py-3.5">
                            <span className="font-bold text-stone-900">{grp.loans.length} Borrowers</span>
                          </td>

                          {/* Portfolio Total */}
                          <td className="px-4 py-3.5 font-bold text-stone-900">
                            ₹{grp.totalPrincipal.toLocaleString('en-IN')}
                          </td>

                          {/* Balance Outstanding */}
                          <td className="px-4 py-3.5 font-bold text-rose-700">
                            ₹{grp.totalOutstanding.toLocaleString('en-IN')}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right">
                            {isManagerOrAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  const gLoanIds = grp.loans.map((l: any) => l._id);
                                  setTransferTargetLoanIds(gLoanIds);
                                  setTransferStaffId('MANAGER');
                                  setTransferType('PERMANENT');
                                  setTransferRemarks(`Transfer for ${grp.groupName}`);
                                  setIsTransferModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#f6f0e4] hover:bg-[#ede3d0] text-amber-950 font-bold rounded-xl border border-[#ded3be] text-xs shadow-2xs transition cursor-pointer"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700" />
                                <span>Transfer Group</span>
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Expanded Group Members Rows */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={isManagerOrAdmin ? 9 : 8} className="p-0 bg-[#fbf9f4]">
                              <div className="p-3 pl-12 border-y border-[#ded3be]">
                                <table className="w-full text-left text-xs bg-white rounded-xl border border-[#ded3be] overflow-hidden">
                                  <thead className="bg-[#f6f0e4] text-amber-950 font-bold uppercase tracking-wider text-[10px]">
                                    <tr>
                                      <th className="px-3 py-2 w-9 text-center">Select</th>
                                      <th className="px-3 py-2">Loan Account #</th>
                                      <th className="px-3 py-2">Borrower Name</th>
                                      <th className="px-3 py-2">Phone</th>
                                      <th className="px-3 py-2">Principal</th>
                                      <th className="px-3 py-2">Outstanding</th>
                                      <th className="px-3 py-2">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#ece3d4]">
                                    {grp.loans.map((ml: any) => (
                                      <tr key={ml._id} className="hover:bg-[#faf6ee] transition">
                                        <td className="px-3 py-2 text-center">
                                          <input
                                            type="checkbox"
                                            checked={selectedLoanIds.includes(ml._id)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedLoanIds(prev => [...prev, ml._id]);
                                              } else {
                                                setSelectedLoanIds(prev => prev.filter(id => id !== ml._id));
                                              }
                                            }}
                                            className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                                          />
                                        </td>
                                        <td className="px-3 py-2 font-mono font-bold text-stone-800">
                                          {ml.loanNumber}
                                        </td>
                                        <td className="px-3 py-2">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-bold text-stone-900">{ml.customerId?.name || ml.customerName}</span>
                                            {ml.customerId?.customerId && (
                                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                {ml.customerId.customerId}
                                              </span>
                                            )}
                                            {ml.cycle && (
                                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                                                Cycle {ml.cycle}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 font-mono text-stone-600">
                                          {ml.customerId?.phone || '-'}
                                        </td>
                                        <td className="px-3 py-2 font-bold text-stone-900">
                                          ₹{ml.principal?.toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-3 py-2 font-bold text-rose-700">
                                          ₹{ml.outstandingTotal?.toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-3 py-2">
                                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            {ml.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isManagerOrAdmin ? 9 : 8} className="text-center py-12 text-stone-400 font-medium">
                      No groups found matching this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Field Verification Modal (Collection Staff / Manager) */}
      {verifyingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-amber-700" />
                  <span>Borrower Field KYC Verification</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Capture all 4 mandatory ID proofs during on-site visit for credit verification
                </p>
              </div>
              <button
                onClick={() => setVerifyingLoan(null)}
                className="text-stone-400 hover:text-stone-700 text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Borrower Snapshot */}
            <div className="bg-[#f6f0e4] p-3.5 rounded-xl border border-[#ded3be] flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-stone-900">{verifyingLoan.customerId?.name}</p>
                <p className="text-[11px] text-stone-600 font-medium">
                  {verifyingLoan.groupId?.name} • Loan #{verifyingLoan.loanNumber}
                </p>
                <p className="text-[11px] text-stone-500">{verifyingLoan.customerId?.area || 'Tamil Nadu'}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-stone-500 font-bold uppercase">Requested Loan</p>
                <p className="font-black text-amber-900 text-base">₹{verifyingLoan.principal?.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {verificationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{verificationError}</span>
              </div>
            )}

            <form onSubmit={handleVerificationSubmit} className="space-y-3.5 text-xs">
              {/* Smart Card Number */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  1. Smart Card Number (Ration Card) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 33/089/0123456"
                  value={verificationForm.smartCardNumber}
                  onChange={(e) => setVerificationForm({ ...verificationForm, smartCardNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600 shadow-xs"
                />
              </div>

              {/* Aadhaar Number */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  2. Aadhaar Number (12 Digits) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={14}
                  placeholder="e.g. 1234 5678 9012"
                  value={verificationForm.aadharNumber}
                  onChange={(e) => setVerificationForm({ ...verificationForm, aadharNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600 shadow-xs"
                />
              </div>

              {/* Voter ID Number */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  3. Voter ID Number (EPIC No.) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TN/12/345/678901 or WXZ1234567"
                  value={verificationForm.voterIdNumber}
                  onChange={(e) => setVerificationForm({ ...verificationForm, voterIdNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600 shadow-xs"
                />
              </div>

              {/* PAN Number */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  4. PAN Number <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="e.g. ABCDE1234F"
                  value={verificationForm.panNumber}
                  onChange={(e) => setVerificationForm({ ...verificationForm, panNumber: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 uppercase focus:outline-none focus:border-amber-600 shadow-xs"
                />
              </div>

              {/* Verification Remarks */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  Field Verification Remarks & On-site Observations <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. House physically inspected, business verified running in market, neighbor confirmed residence for 5 years, good credit standing."
                  value={verificationForm.remarks}
                  onChange={(e) => setVerificationForm({ ...verificationForm, remarks: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#ded3be] rounded-xl text-stone-800 font-medium focus:outline-none focus:border-amber-600 shadow-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setVerifyingLoan(null)}
                  className="px-4 py-2.5 border border-[#ded3be] rounded-xl text-stone-700 font-bold hover:bg-[#f6f0e4] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyLoanMutation.isPending}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-bold rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {verifyLoanMutation.isPending ? 'Submitting Verification...' : 'Submit Verification to Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manager Review / Decision Modal */}
      {reviewLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-700" />
                  <span>Manager Loan Approval Review</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Inspect submitted field KYC verification details and make final credit sanction decision
                </p>
              </div>
              <button
                onClick={() => setReviewLoan(null)}
                className="text-stone-400 hover:text-stone-700 text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Borrower & Loan Snapshot */}
            <div className="grid grid-cols-2 gap-3 bg-[#f6f0e4] p-3.5 rounded-xl border border-[#ded3be] text-xs">
              <div>
                <p className="text-stone-500 text-[10px] font-bold uppercase">Borrower</p>
                <p className="font-bold text-stone-900 text-sm">{reviewLoan.customerId?.name}</p>
                <p className="text-stone-600 font-mono">{reviewLoan.customerId?.phone}</p>
                <p className="text-amber-800 font-semibold mt-1">{reviewLoan.groupId?.name}</p>
              </div>
              <div className="text-right">
                <p className="text-stone-500 text-[10px] font-bold uppercase">Sanction Amount</p>
                <p className="font-black text-amber-900 text-lg">₹{reviewLoan.principal?.toLocaleString('en-IN')}</p>
                <p className="text-stone-600 font-bold">Total Due: ₹{reviewLoan.totalPayable?.toLocaleString('en-IN')}</p>
                <p className="text-stone-500 text-[10px]">{reviewLoan.tenureWeeks} Weeks Weekly Schedule</p>
              </div>
            </div>

            {/* Submitted Field KYC Documents */}
            <div className="border border-[#ded3be] rounded-xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <span className="font-black text-xs text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-amber-700" />
                  Verified KYC Credentials
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  Verified by {reviewLoan.verification?.verifiedByName || reviewLoan.assignedStaffName || 'Staff'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#fbf7f0] p-2.5 rounded-lg border border-[#ece3d4]">
                  <p className="text-[10px] text-stone-500 font-bold uppercase">1. Smart Card Number</p>
                  <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
                    {reviewLoan.verification?.smartCardNumber || reviewLoan.customerId?.smartCardNumber || 'Not Provided'}
                  </p>
                </div>
                <div className="bg-[#fbf7f0] p-2.5 rounded-lg border border-[#ece3d4]">
                  <p className="text-[10px] text-stone-500 font-bold uppercase">2. Aadhaar Number</p>
                  <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
                    {reviewLoan.verification?.aadharNumber || reviewLoan.customerId?.aadharNumber || 'Not Provided'}
                  </p>
                </div>
                <div className="bg-[#fbf7f0] p-2.5 rounded-lg border border-[#ece3d4]">
                  <p className="text-[10px] text-stone-500 font-bold uppercase">3. Voter ID Number</p>
                  <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
                    {reviewLoan.verification?.voterIdNumber || reviewLoan.customerId?.voterIdNumber || 'Not Provided'}
                  </p>
                </div>
                <div className="bg-[#fbf7f0] p-2.5 rounded-lg border border-[#ece3d4]">
                  <p className="text-[10px] text-stone-500 font-bold uppercase">4. PAN Number</p>
                  <p className="font-mono font-bold text-stone-900 text-sm mt-0.5">
                    {reviewLoan.verification?.panNumber || reviewLoan.customerId?.panNumber || 'Not Provided'}
                  </p>
                </div>
              </div>

              {reviewLoan.verification?.remarks && (
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 text-xs">
                  <p className="text-[10px] font-bold text-amber-900 uppercase">Field Staff Remarks:</p>
                  <p className="text-stone-800 font-medium mt-0.5 italic">"{reviewLoan.verification.remarks}"</p>
                </div>
              )}
            </div>

            {/* Manager Decision Input */}
            <div className="text-xs space-y-1">
              <label className="block font-bold text-stone-800">Approval / Rejection Decision Remarks</label>
              <input
                type="text"
                placeholder="e.g. Approved with standard terms, verified documentation satisfactory."
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-[#ded3be] rounded-xl text-stone-900 font-medium focus:outline-none focus:border-amber-600 shadow-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#ded3be]">
              <button
                type="button"
                onClick={() => setReviewLoan(null)}
                className="px-4 py-2 border border-[#ded3be] rounded-xl text-stone-600 font-bold hover:bg-[#f6f0e4] cursor-pointer"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={rejectLoanMutation.isPending}
                  onClick={() => rejectLoanMutation.mutate({ id: reviewLoan._id, remarks: approvalRemarks })}
                  className="px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>Reject Loan</span>
                </button>
                <button
                  type="button"
                  disabled={approveLoanMutation.isPending}
                  onClick={() => approveLoanMutation.mutate({ id: reviewLoan._id, remarks: approvalRemarks })}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-900/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve & Authorize</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Select Floating Action Bar (Manager & Admin) */}
      {isManagerOrAdmin && selectedLoanIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#251b14] text-amber-200 border border-amber-800/80 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-black text-amber-100">
              {selectedLoanIds.length} loan{selectedLoanIds.length > 1 ? 's' : ''} selected
              {selectedGroupCount > 0 && ` (${selectedGroupCount} group${selectedGroupCount > 1 ? 's' : ''})`}
            </span>
          </div>

          <div className="h-5 w-px bg-amber-800/60" />

          <button
            onClick={() => {
              setTransferTargetLoanIds(selectedLoanIds);
              setTransferStaffId('MANAGER');
              setTransferType('PERMANENT');
              setTransferRemarks('');
              setIsTransferModalOpen(true);
            }}
            className="px-4 py-1.5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 rounded-xl text-xs font-black shadow-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{selectionMode === 'GROUP' ? 'Transfer Selected Groups & Loans' : 'Transfer Selected Loans'}</span>
          </button>

          <button
            onClick={() => setSelectedLoanIds([])}
            className="text-xs text-stone-400 hover:text-stone-200 font-bold cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Loan Transfer Modal (Single & Multiple Loans, Until Changed vs One-Time) */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-900/30">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-700" />
                <span>Transfer Loan Servicing & Collections</span>
              </h3>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="text-xs space-y-4">
              <div className="bg-[#f6f0e4] p-3.5 rounded-xl border border-[#ded3be]">
                <p className="font-bold text-stone-900 text-sm">
                  {transferTargetLoanIds.length === 1 ? 'Transferring 1 Loan' : `Transferring ${transferTargetLoanIds.length} Selected Loans`}
                </p>
                <p className="text-stone-600 mt-0.5">
                  Reassign the field servicing officer and collection route responsibilities for the selected account(s).
                </p>
              </div>

              {/* Staff Dropdown */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">Target Field Collection Staff *</label>
                <select
                  value={transferStaffId}
                  onChange={(e) => setTransferStaffId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#ded3be] rounded-xl text-stone-900 font-bold focus:outline-none focus:border-amber-600 shadow-xs cursor-pointer"
                >
                  <option value="MANAGER">-- Assign to Branch Manager (Self) --</option>
                  {staffUsers.map((st: any) => (
                    <option key={st._id} value={st._id}>
                      {st.name} ({st.phone || st.username})
                    </option>
                  ))}
                </select>
              </div>

              {/* Transfer Mode: Until Changed vs One-Time */}
              <div>
                <label className="block font-bold text-stone-800 mb-2">Transfer Duration & Scope *</label>
                <div className="space-y-2">
                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                    transferType === 'PERMANENT'
                      ? 'bg-[#f6f0e4] border-amber-800 text-amber-950 font-bold'
                      : 'bg-white border-[#ded3be] text-stone-700 hover:bg-[#faf6ee]'
                  }`}>
                    <input
                      type="radio"
                      name="transferType"
                      value="PERMANENT"
                      checked={transferType === 'PERMANENT'}
                      onChange={() => setTransferType('PERMANENT')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500 accent-amber-600"
                    />
                    <div>
                      <span className="block font-black text-xs text-stone-900">Until I Change (Permanent)</span>
                      <span className="text-[11px] text-stone-500 font-normal">
                        Permanently transfers loan and route servicing to this staff officer until manually reassigned.
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                    transferType === 'TEMPORARY'
                      ? 'bg-[#f6f0e4] border-amber-800 text-amber-950 font-bold'
                      : 'bg-white border-[#ded3be] text-stone-700 hover:bg-[#faf6ee]'
                  }`}>
                    <input
                      type="radio"
                      name="transferType"
                      value="TEMPORARY"
                      checked={transferType === 'TEMPORARY'}
                      onChange={() => setTransferType('TEMPORARY')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500 accent-amber-600"
                    />
                    <div>
                      <span className="block font-black text-xs text-stone-900">One-Time (Temporary Relief)</span>
                      <span className="text-[11px] text-stone-500 font-normal">
                        Temporary transfer for this week / immediate relief without altering permanent group routes.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-bold text-stone-800 mb-1">Transfer Note / Reason (Optional)</label>
                <input
                  type="text"
                  value={transferRemarks}
                  onChange={(e) => setTransferRemarks(e.target.value)}
                  placeholder="e.g. Route relief / borrower relocation / leave cover"
                  className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl text-stone-800 font-medium focus:outline-none focus:border-amber-600 shadow-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-3 py-2 border border-[#ded3be] rounded-xl text-stone-700 font-bold hover:bg-[#f6f0e4] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkTransferMutation.isPending || !transferStaffId}
                  onClick={() => bulkTransferMutation.mutate({
                    loanIds: transferTargetLoanIds,
                    staffId: transferStaffId,
                    transferType,
                    remarks: transferRemarks
                  })}
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {bulkTransferMutation.isPending ? 'Transferring...' : `Confirm Transfer (${transferTargetLoanIds.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manager Formal Loan Creation Modal */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-[#18120e] rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl border border-amber-800/60 max-h-[92vh] overflow-y-auto text-amber-50">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-amber-950/80 pb-3">
              <div>
                <h3 className="text-base font-black text-amber-100 flex items-center gap-2">
                  <HandCoins className="w-5 h-5 text-amber-400" />
                  <span>Manager Formal Loan Creation</span>
                </h3>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Complete loan structure with customizable week-by-week amortization split from NEW LOAN INT templates.
                </p>
              </div>
              <button
                onClick={() => setIsApplyModalOpen(false)}
                className="text-stone-400 hover:text-amber-200 text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Standard Template Selector Bar */}
            <div className="bg-[#140e0a] p-3.5 rounded-xl border border-amber-950/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Configured Loan Tiers (NEW LOAN INT)</span>
                </span>
                <Link to="/loan-tiers" target="_blank" className="text-[10px] text-amber-300 hover:text-amber-200 hover:underline flex items-center gap-1 font-bold">
                  <span>Manage Tiers & Slabs</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => handleSelectPreset(p.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      managerLoanForm.selectedPresetCode === p.code
                        ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-stone-950 shadow-md font-black'
                        : 'bg-[#1e1610] text-stone-300 hover:text-amber-200 border border-amber-950/60'
                    }`}
                  >
                    {p.name.replace(' Loan', '').replace('Regular', '')}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleSelectPreset('CUSTOM')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    managerLoanForm.selectedPresetCode === 'CUSTOM'
                      ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-stone-950 shadow-md font-black'
                      : 'bg-[#1e1610] text-stone-300 hover:text-amber-200 border border-amber-950/60'
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>

            <form onSubmit={handleManagerLoanSubmit} className="space-y-5 text-xs">
              {/* SECTION 1: Customer & Nominee Information */}
              <div className="space-y-3 p-4 bg-[#140e0a] rounded-xl border border-amber-950/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-950/40 pb-2">
                  <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                    <User className="w-4 h-4 text-amber-400" />
                    <span>Borrower & Nominee Information</span>
                  </span>

                  {/* Search Bar for Existing Borrowers */}
                  <div className="relative w-full sm:w-80">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search existing borrower (name, phone, area, cus id)..."
                        value={customerSearchTerm}
                        onChange={(e) => {
                          setCustomerSearchTerm(e.target.value);
                          setIsCustomerSearchOpen(true);
                        }}
                        onFocus={() => setIsCustomerSearchOpen(true)}
                        className="w-full bg-[#1e1610] border border-amber-950/80 rounded-lg pl-8 pr-7 py-1 text-[11px] text-amber-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                      />
                      {customerSearchTerm && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerSearchTerm('');
                            setIsCustomerSearchOpen(false);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-amber-200 text-xs cursor-pointer"
                        >
                          &times;
                        </button>
                      )}
                    </div>

                    {/* Dropdown Results */}
                    {isCustomerSearchOpen && customerSearchTerm.trim().length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 z-50 bg-[#1e1610] border border-amber-700/60 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-amber-950/60">
                        {filteredCustomers.length > 0 ? (
                          filteredCustomers.map((c: any) => (
                            <div
                              key={c._id}
                              onClick={() => handleCustomerSelect(c._id)}
                              className="p-2.5 hover:bg-amber-950/40 cursor-pointer flex items-center justify-between text-left transition"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-amber-200 text-xs">{c.name}</span>
                                  <span className="font-mono text-[10px] bg-amber-950/80 text-amber-400 px-1.5 py-0.5 rounded border border-amber-900/60">
                                    {c.customerId}
                                  </span>
                                </div>
                                <div className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-2">
                                  <span>📞 {c.phone || 'No phone'}</span>
                                  <span>📍 {c.area || 'No area'}</span>
                                </div>
                              </div>
                              <span className="text-[11px] font-bold text-amber-400">Select &rarr;</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-center text-[11px] text-stone-400">
                            No matching borrowers found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Linked Existing Customer Indicator */}
                {managerLoanForm.customerId && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-amber-950/40 border border-amber-800/40 text-[11px]">
                    <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Linked Existing Borrower: <strong>{managerLoanForm.customerName}</strong> ({managerLoanForm.customCustomerId}) - {managerLoanForm.area}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleClearSelectedCustomer}
                      className="text-[10px] text-amber-400 hover:text-amber-200 underline cursor-pointer font-bold"
                    >
                      Clear / New Borrower
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Customer ID (cus id)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ATH-CUST-0170"
                      value={managerLoanForm.customCustomerId}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, customCustomerId: e.target.value })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Customer Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Full Name"
                      value={managerLoanForm.customerName}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, customerName: e.target.value })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Customer Phone No
                    </label>
                    <input
                      type="tel"
                      placeholder="10-digit mobile"
                      value={managerLoanForm.customerPhone}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, customerPhone: e.target.value })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder-stone-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Area / Place <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pollachi Town"
                      value={managerLoanForm.area}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, area: e.target.value })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder-stone-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Nominee Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Murugan, Sekar..."
                      value={managerLoanForm.nomineeName}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, nomineeName: e.target.value })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder-stone-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Nominee Relationship
                    </label>
                    <select
                      value={managerLoanForm.nomineeRelationship}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, nomineeRelationship: e.target.value })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="Spouse">Spouse (Husband / Wife)</option>
                      <option value="Mother">Mother</option>
                      <option value="Father">Father</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Nominee Phone No
                    </label>
                    <input
                      type="tel"
                      placeholder="10-digit mobile"
                      value={managerLoanForm.nomineePhone}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, nomineePhone: e.target.value })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder-stone-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Verified KYC Documents (Pre-filled from Staff Enquiry Verification) */}
                <div className="pt-2 border-t border-amber-950/40">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Verified KYC Credentials (Smart Card, Aadhaar, Voter ID, PAN)</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                        Smart Card Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 33/G/1234567"
                        value={managerLoanForm.smartCardNumber}
                        onChange={(e) => setManagerLoanForm({ ...managerLoanForm, smartCardNumber: e.target.value })}
                        className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                        Aadhaar Number
                      </label>
                      <input
                        type="text"
                        maxLength={14}
                        placeholder="12-digit Aadhaar"
                        value={managerLoanForm.aadharNumber}
                        onChange={(e) => setManagerLoanForm({ ...managerLoanForm, aadharNumber: e.target.value })}
                        className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                        Voter ID Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. TN/12/345/678901"
                        value={managerLoanForm.voterIdNumber}
                        onChange={(e) => setManagerLoanForm({ ...managerLoanForm, voterIdNumber: e.target.value })}
                        className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono font-bold uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                        PAN Card Number
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="e.g. ABCDE1234F"
                        value={managerLoanForm.panNumber}
                        onChange={(e) => setManagerLoanForm({ ...managerLoanForm, panNumber: e.target.value.toUpperCase() })}
                        className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono font-bold uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Group Route & Schedule */}
              <div className="space-y-3 p-4 bg-[#140e0a] rounded-xl border border-amber-950/60">
                <div className="border-b border-amber-950/40 pb-2">
                  <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span>Group Route & Collection Day</span>
                  </span>
                </div>

                {/* Search Existing Group */}
                <div>
                  <div className="relative">
                    <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">
                      Search Existing Group (or enter new group below)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by group number, name, area, or collection day..."
                        value={groupSearchTerm}
                        onChange={(e) => {
                          setGroupSearchTerm(e.target.value);
                          setIsGroupSearchOpen(true);
                        }}
                        onFocus={() => setIsGroupSearchOpen(true)}
                        className="w-full bg-[#1e1610] border border-amber-700/60 rounded-xl px-3 py-2 pl-9 text-xs text-amber-100 placeholder-stone-500 focus:outline-none focus:border-amber-400 shadow-inner font-semibold"
                      />
                      <Search className="w-4 h-4 text-amber-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      {groupSearchTerm && (
                        <button
                          type="button"
                          onClick={() => {
                            setGroupSearchTerm('');
                            setIsGroupSearchOpen(false);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-amber-200 text-xs cursor-pointer"
                        >
                          &times;
                        </button>
                      )}
                    </div>

                    {/* Group Search Dropdown */}
                    {isGroupSearchOpen && groupSearchTerm.trim().length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 z-50 bg-[#1e1610] border border-amber-700/60 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-amber-950/60">
                        {filteredGroups.length > 0 ? (
                          filteredGroups.map((g: any) => (
                            <div
                              key={g._id}
                              onClick={() => handleGroupSelect(g._id)}
                              className="p-2.5 hover:bg-amber-950/40 cursor-pointer flex items-center justify-between text-left transition"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-amber-200 text-xs">{g.name}</span>
                                  <span className="font-mono text-[10px] bg-amber-950/80 text-amber-400 px-1.5 py-0.5 rounded border border-amber-900/60">
                                    Group #{g.groupCode}
                                  </span>
                                </div>
                                <div className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-2">
                                  <span>📅 {g.collectionDay}</span>
                                  <span>📍 {g.area || 'No area specified'}</span>
                                  <span>👥 {g.totalMembers || 0} members</span>
                                </div>
                              </div>
                              <span className="text-[11px] font-bold text-amber-400">Select &rarr;</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-center text-[11px] text-stone-400">
                            No matching groups found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Linked Group Indicator */}
                {selectedGroupId && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-amber-950/40 border border-amber-800/40 text-[11px]">
                    <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Linked Existing Group: <strong>{managerLoanForm.groupName}</strong> (Group #{managerLoanForm.groupNo}) • {managerLoanForm.collectionDay}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleClearSelectedGroup}
                      className="text-[10px] text-amber-400 hover:text-amber-200 underline cursor-pointer font-bold"
                    >
                      Clear / New Group
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Group No (group no) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 97"
                      value={managerLoanForm.groupNo}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, groupNo: e.target.value })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Group Name (group name) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. GROUP - 97"
                      value={managerLoanForm.groupName}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, groupName: e.target.value })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Collection Day (collection day) <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={managerLoanForm.collectionDay}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, collectionDay: e.target.value })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 focus:outline-none focus:border-amber-500 font-bold"
                    >
                      <option value="MONDAY">MONDAY</option>
                      <option value="TUESDAY">TUESDAY</option>
                      <option value="WEDNESDAY">WEDNESDAY</option>
                      <option value="THURSDAY">THURSDAY</option>
                      <option value="FRIDAY">FRIDAY</option>
                      <option value="SATURDAY">SATURDAY</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Loan Identifiers & Parameters */}
              <div className="space-y-3 p-4 bg-[#140e0a] rounded-xl border border-amber-950/60">
                <div className="border-b border-amber-950/40 pb-2">
                  <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Loan Classification, Frequency & Dates</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Loan No (loan no)
                    </label>
                    <input
                      type="text"
                      placeholder="Auto-generated if empty"
                      value={managerLoanForm.loanNumber}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, loanNumber: e.target.value })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Type (spcieal / regular)
                    </label>
                    <select
                      value={managerLoanForm.loanCategory}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, loanCategory: e.target.value as any })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 focus:outline-none focus:border-amber-500 font-bold"
                    >
                      <option value="REGULAR">REGULAR</option>
                      <option value="SPECIAL">SPECIAL</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Frequency (week / month)
                    </label>
                    <select
                      value={managerLoanForm.frequency}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, frequency: e.target.value as any })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 focus:outline-none focus:border-amber-500 font-bold"
                    >
                      <option value="WEEKLY">WEEKLY</option>
                      <option value="MONTHLY">MONTHLY</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Year / Month
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={managerLoanForm.year}
                        onChange={(e) => setManagerLoanForm({ ...managerLoanForm, year: parseInt(e.target.value) || 2026 })}
                        className="w-16 bg-[#1e1610] border border-amber-950/80 rounded-xl px-2 py-2 text-xs text-amber-100 focus:outline-none font-bold"
                      />
                      <input
                        type="text"
                        placeholder="Month"
                        value={managerLoanForm.month}
                        onChange={(e) => setManagerLoanForm({ ...managerLoanForm, month: e.target.value })}
                        className="flex-1 bg-[#1e1610] border border-amber-950/80 rounded-xl px-2 py-2 text-xs text-amber-100 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Loan Date (loan date)
                    </label>
                    <input
                      type="date"
                      value={managerLoanForm.loanDate}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, loanDate: e.target.value })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-2 py-2 text-xs text-amber-100 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: Financial Details */}
              <div className="space-y-3 p-4 bg-[#140e0a] rounded-xl border border-amber-950/60">
                <div className="border-b border-amber-950/40 pb-2">
                  <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                    <IndianRupee className="w-4 h-4 text-amber-400" />
                    <span>Financial Terms, Interest & Charges</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Loan Amount (loan amount) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={managerLoanForm.loanAmount}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, loanAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-300 font-black text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Interest (interst)
                    </label>
                    <input
                      type="number"
                      value={managerLoanForm.interest}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, interest: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      Document Charge (document charge)
                    </label>
                    <input
                      type="number"
                      value={managerLoanForm.documentCharge}
                      onChange={(e) => setManagerLoanForm({ ...managerLoanForm, documentCharge: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-200 uppercase tracking-wider mb-1">
                      No of Weeks (no of weeks) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="104"
                      value={managerLoanForm.noOfWeeks}
                      onChange={(e) => {
                        const wks = parseInt(e.target.value) || 1;
                        setManagerLoanForm(prev => ({
                          ...prev,
                          noOfWeeks: wks
                        }));
                      }}
                      className="w-full bg-[#1e1610] border border-amber-950/80 rounded-xl px-3 py-2 text-xs text-amber-100 font-black focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: Weeks Amount Split (Customizable Column-wise Amortization Table) */}
              <div className="space-y-3 p-4 bg-[#140e0a] rounded-xl border border-amber-950/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-950/40 pb-2">
                  <div>
                    <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-amber-400" />
                      <span>Weeks Amount Split (Amortization Schedule)</span>
                    </span>
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      Prefixed week slabs (e.g. Weeks 1 to 10). Typing any slab amount updates all weeks in that range automatically.
                    </p>
                  </div>

                  {/* Financial Comparison Summary */}
                  <div className="flex flex-wrap items-center gap-3 bg-[#1e1610] px-3 py-1.5 rounded-lg border border-amber-950/80 text-[11px]">
                    <div>
                      <span className="text-stone-400">Split Sum: </span>
                      <strong className="text-amber-300 font-bold font-mono">
                        ₹{slabs.reduce((acc, curr) => acc + ((curr.toWeek - curr.fromWeek + 1) * (parseFloat(String(curr.total)) || 0)), 0).toLocaleString('en-IN')}
                      </strong>
                    </div>
                    <div>
                      <span className="text-stone-400">Target Total: </span>
                      <strong className="text-amber-100 font-bold font-mono">
                        ₹{((parseFloat(String(managerLoanForm.loanAmount)) || 0) + (parseFloat(String(managerLoanForm.interest)) || 0) + (parseFloat(String(managerLoanForm.savingsAmount)) || 0)).toLocaleString('en-IN')}
                      </strong>
                    </div>
                    {slabs.reduce((acc, curr) => acc + ((curr.toWeek - curr.fromWeek + 1) * (parseFloat(String(curr.total)) || 0)), 0) === ((parseFloat(String(managerLoanForm.loanAmount)) || 0) + (parseFloat(String(managerLoanForm.interest)) || 0) + (parseFloat(String(managerLoanForm.savingsAmount)) || 0)) ? (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400" /> Exact Match ✓
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                        Diff: ₹{Math.abs(slabs.reduce((acc, curr) => acc + ((curr.toWeek - curr.fromWeek + 1) * (parseFloat(String(curr.total)) || 0)), 0) - ((parseFloat(String(managerLoanForm.loanAmount)) || 0) + (parseFloat(String(managerLoanForm.interest)) || 0) + (parseFloat(String(managerLoanForm.savingsAmount)) || 0))).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Column-wise Slabs Table */}
                <div className="overflow-x-auto rounded-xl border border-amber-950/70 bg-[#160f0b]">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#1e1610] text-[10px] font-bold text-amber-300 uppercase tracking-wider border-b border-amber-950/80">
                        <th className="py-2.5 px-3">Week Range</th>
                        <th className="py-2.5 px-2 text-center">Weeks</th>
                        <th className="py-2.5 px-2 text-right">Principal (₹/wk)</th>
                        <th className="py-2.5 px-2 text-right">Interest (₹/wk)</th>
                        <th className="py-2.5 px-2 text-right">Savings (₹/wk)</th>
                        <th className="py-2.5 px-2 text-right">Weekly Due (₹/wk)</th>
                        <th className="py-2.5 px-3 text-right">Range Total (₹)</th>
                        <th className="py-2.5 px-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-950/50">
                      {slabs.map((slab, idx) => {
                        const weeksCount = Math.max(1, slab.toWeek - slab.fromWeek + 1);
                        const rangeTotal = weeksCount * slab.total;
                        return (
                          <tr key={idx} className="hover:bg-amber-950/20 transition">
                            <td className="py-2 px-3 font-semibold text-amber-200">
                              <div className="flex items-center gap-1 font-mono text-xs">
                                <span>Week</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={slab.fromWeek}
                                  onChange={(e) => handleSlabChange(idx, 'fromWeek', parseInt(e.target.value) || 1)}
                                  className="w-12 bg-[#1e1610] border border-amber-950/80 rounded px-1 py-0.5 text-center text-xs font-bold text-amber-100 focus:outline-none focus:border-amber-500"
                                />
                                <span>to</span>
                                <input
                                  type="number"
                                  min={slab.fromWeek}
                                  value={slab.toWeek}
                                  onChange={(e) => handleSlabChange(idx, 'toWeek', parseInt(e.target.value) || slab.fromWeek)}
                                  className="w-12 bg-[#1e1610] border border-amber-950/80 rounded px-1 py-0.5 text-center text-xs font-bold text-amber-100 focus:outline-none focus:border-amber-500"
                                />
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-stone-300">
                              {weeksCount} wks
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                value={slab.principal}
                                onChange={(e) => handleSlabChange(idx, 'principal', parseFloat(e.target.value) || 0)}
                                className="w-20 bg-[#1e1610] border border-amber-950/80 rounded px-2 py-1 text-right text-xs font-mono font-bold text-amber-100 focus:outline-none focus:border-amber-500"
                              />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                value={slab.interest}
                                onChange={(e) => handleSlabChange(idx, 'interest', parseFloat(e.target.value) || 0)}
                                className="w-18 bg-[#1e1610] border border-amber-950/80 rounded px-2 py-1 text-right text-xs font-mono font-bold text-amber-100 focus:outline-none focus:border-amber-500"
                              />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                value={slab.savings}
                                onChange={(e) => handleSlabChange(idx, 'savings', parseFloat(e.target.value) || 0)}
                                className="w-18 bg-[#1e1610] border border-amber-950/80 rounded px-2 py-1 text-right text-xs font-mono font-bold text-amber-100 focus:outline-none focus:border-amber-500"
                              />
                            </td>
                            <td className="py-2 px-2 text-right">
                              <input
                                type="number"
                                value={slab.total}
                                onChange={(e) => handleSlabChange(idx, 'total', parseFloat(e.target.value) || 0)}
                                className="w-20 bg-[#140e0a] border border-amber-600/70 rounded px-2 py-1 text-right text-xs font-mono font-black text-amber-300 focus:outline-none focus:border-amber-400"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-amber-200">
                              ₹{rangeTotal.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2 px-2 text-center">
                              {slabs.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSlab(idx)}
                                  className="text-stone-500 hover:text-rose-400 p-1 cursor-pointer transition"
                                  title="Remove slab"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#1e1610] border-t-2 border-amber-800/80 font-bold text-xs text-amber-200">
                        <td className="py-2.5 px-3 uppercase tracking-wider text-amber-400">Total</td>
                        <td className="py-2.5 px-2 text-center font-mono">
                          {slabs.reduce((sum, s) => sum + (s.toWeek - s.fromWeek + 1), 0)} wks
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono">
                          ₹{slabs.reduce((sum, s) => sum + (s.principal * (s.toWeek - s.fromWeek + 1)), 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono">
                          ₹{slabs.reduce((sum, s) => sum + (s.interest * (s.toWeek - s.fromWeek + 1)), 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono">
                          ₹{slabs.reduce((sum, s) => sum + (s.savings * (s.toWeek - s.fromWeek + 1)), 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-amber-300 font-black">
                          -
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-amber-300 text-sm">
                          ₹{slabs.reduce((sum, s) => sum + ((s.toWeek - s.fromWeek + 1) * s.total), 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 text-center"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleAddSlab}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1e1610] hover:bg-amber-950/60 text-amber-300 border border-amber-950/80 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Slab Range</span>
                  </button>
                  <span className="text-[10px] text-stone-400 font-medium">
                    Total tenure: {managerLoanForm.noOfWeeks} weeks • Installments will be automatically expanded for collection ledger.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-amber-950/80">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-400 hover:text-amber-200 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={createManagerLoanMutation.isPending}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:brightness-110 text-stone-950 font-black rounded-xl text-xs shadow-lg shadow-amber-900/40 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {createManagerLoanMutation.isPending
                      ? 'Creating Loan in Database...'
                      : 'Create Formal Loan & Disburse'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Loan Modal (Manager & Admin - All Fields) */}
      {editingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#fffdfa] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-700" />
                  <span>Edit Loan Account: {editingLoan.loanNumber}</span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  Update financial amounts, ledger totals, borrower contact, route schedule, and assigned staff collector.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingLoan(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-[#f6f0e4] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editLoanError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl font-medium">
                {editLoanError}
              </p>
            )}

            <form onSubmit={handleEditLoanSubmit} className="space-y-4 text-xs">
              {/* Section 1: Account & Schedule */}
              <div className="space-y-3">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-[#ece3d4] pb-1">
                  1. Loan Identification & Routing
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-stone-800 mb-1">
                      Loan Account # *
                      <span className="text-[10px] text-amber-700 ml-1 font-normal">(Embeds Customer ID)</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editLoanForm.loanNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = val.match(/ATH-[A-Z]+-CUST-\d+/i) || val.match(/CUST-\d+/i);
                        setEditLoanForm({
                          ...editLoanForm,
                          loanNumber: val,
                          customerId: match ? match[0].toUpperCase() : editLoanForm.customerId
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">
                      Mapped Customer ID
                      <span className="text-[10px] text-stone-500 ml-1 font-normal">(Auto-sync)</span>
                    </label>
                    <input
                      type="text"
                      value={editLoanForm.customerId || ''}
                      onChange={(e) => {
                        const newCid = e.target.value.toUpperCase();
                        let updatedLoanNum = editLoanForm.loanNumber;
                        if (newCid && /ATH-[A-Z]+-CUST-\d+/i.test(updatedLoanNum)) {
                          updatedLoanNum = updatedLoanNum.replace(/ATH-[A-Z]+-CUST-\d+/i, newCid);
                        }
                        setEditLoanForm({
                          ...editLoanForm,
                          customerId: newCid,
                          loanNumber: updatedLoanNum
                        });
                      }}
                      placeholder="e.g. ATH-PL-CUST-0341"
                      className="w-full px-3 py-2 bg-amber-50/50 border border-[#ded3be] rounded-xl font-mono font-bold text-amber-950 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Loan Status *</label>
                    <select
                      value={editLoanForm.status}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, status: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="OVERDUE">OVERDUE</option>
                      <option value="CLOSED">CLOSED</option>
                      <option value="SETTLED">SETTLED</option>
                      <option value="SUBMITTED">SUBMITTED</option>
                      <option value="PENDING_VERIFICATION">PENDING VERIFICATION</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Repayment Route Day *</label>
                    <select
                      value={editLoanForm.collectionDay}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, collectionDay: e.target.value })}
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

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-stone-800 mb-1">Assigned Staff Collector</label>
                    <input
                      type="text"
                      value={editLoanForm.assignedStaffName}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, assignedStaffName: e.target.value })}
                      placeholder="e.g. Chandra Sekar"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Tenure (Weeks) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={editLoanForm.tenureWeeks}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, tenureWeeks: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Financial Amounts & Balances */}
              <div className="space-y-3">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-[#ece3d4] pb-1">
                  2. Financial Amounts & Balance Totals
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Principal (₹) *</label>
                    <input
                      type="number"
                      required
                      value={editLoanForm.principal}
                      onChange={(e) => {
                        const p = parseFloat(e.target.value) || 0;
                        const i = editLoanForm.interestAmount;
                        setEditLoanForm({
                          ...editLoanForm,
                          principal: p,
                          totalPayable: p + i,
                          outstandingTotal: (p + i) - editLoanForm.totalPaid
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Interest Due (₹) *</label>
                    <input
                      type="number"
                      required
                      value={editLoanForm.interestAmount}
                      onChange={(e) => {
                        const i = parseFloat(e.target.value) || 0;
                        const p = editLoanForm.principal;
                        setEditLoanForm({
                          ...editLoanForm,
                          interestAmount: i,
                          totalPayable: p + i,
                          outstandingTotal: (p + i) - editLoanForm.totalPaid
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Doc Charges (₹)</label>
                    <input
                      type="number"
                      value={editLoanForm.docCharges}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, docCharges: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Savings Deposit (₹)</label>
                    <input
                      type="number"
                      value={editLoanForm.savingsAmount}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, savingsAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Total Payable (₹) *</label>
                    <input
                      type="number"
                      required
                      value={editLoanForm.totalPayable}
                      onChange={(e) => {
                        const tp = parseFloat(e.target.value) || 0;
                        setEditLoanForm({
                          ...editLoanForm,
                          totalPayable: tp,
                          outstandingTotal: tp - editLoanForm.totalPaid
                        });
                      }}
                      className="w-full px-3 py-2 bg-[#fcf9f2] border border-[#ded3be] rounded-xl font-mono font-black text-amber-950 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Total Paid So Far (₹)</label>
                    <input
                      type="number"
                      value={editLoanForm.totalPaid}
                      onChange={(e) => {
                        const paid = parseFloat(e.target.value) || 0;
                        setEditLoanForm({
                          ...editLoanForm,
                          totalPaid: paid,
                          outstandingTotal: editLoanForm.totalPayable - paid
                        });
                      }}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono font-bold text-emerald-700 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-stone-800 mb-1">Remaining Balance / Outstanding (₹)</label>
                    <input
                      type="number"
                      value={editLoanForm.outstandingTotal}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, outstandingTotal: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-[#fcf9f2] border border-[#ded3be] rounded-xl font-mono font-black text-rose-800 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Borrower & Family Contact */}
              <div className="space-y-3">
                <h4 className="font-bold text-amber-950 uppercase tracking-wider text-[11px] border-b border-[#ece3d4] pb-1">
                  3. Borrower & Nominee Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Borrower Full Name</label>
                    <input
                      type="text"
                      value={editLoanForm.customerName}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, customerName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Borrower Primary Phone</label>
                    <input
                      type="text"
                      value={editLoanForm.customerPhone}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, customerPhone: e.target.value })}
                      placeholder="10-digit number"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Spouse Name</label>
                    <input
                      type="text"
                      value={editLoanForm.spouseName}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, spouseName: e.target.value })}
                      placeholder="Spouse / Husband Name"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Nominee Name</label>
                    <input
                      type="text"
                      value={editLoanForm.nomineeName}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, nomineeName: e.target.value })}
                      placeholder="Nominee full name"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Nominee Phone</label>
                    <input
                      type="text"
                      value={editLoanForm.nomineePhone}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, nomineePhone: e.target.value })}
                      placeholder="Nominee contact number"
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-800 mb-1">Internal Notes & Remarks</label>
                    <input
                      type="text"
                      value={editLoanForm.notes}
                      onChange={(e) => setEditLoanForm({ ...editLoanForm, notes: e.target.value })}
                      placeholder="Any account notes..."
                      className="w-full px-3 py-2 bg-white border border-[#ded3be] rounded-xl font-medium text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#ded3be]">
                <button
                  type="button"
                  onClick={() => setEditingLoan(null)}
                  className="px-4 py-2 border border-[#ded3be] rounded-xl font-bold text-stone-700 hover:bg-[#faf6ee] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateLoanMutation.isPending}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-bold rounded-xl shadow-md shadow-amber-900/20 transition cursor-pointer disabled:opacity-50"
                >
                  {updateLoanMutation.isPending ? 'Saving...' : 'Save Loan Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repayment Collections Quick Modal */}
      {viewingLoanCollectionsId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs">
          <div className="bg-[#fffdfa] rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-amber-900/30 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#ded3be] pb-3">
              <div>
                <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                  <span>
                    Repayment Collections — Cycle {modalLoanData?.loan?.cycle || 1} ({modalLoanData?.payments?.length || 0})
                  </span>
                </h3>
                <p className="text-xs text-stone-500 font-medium mt-0.5">
                  {modalLoanData?.loan?.loanNumber} &bull; {modalLoanData?.loan?.customerId?.name || modalLoanData?.loan?.customerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingLoanCollectionsId(null)}
                className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Loan Quick Summary */}
            {modalLoanData?.loan && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f6f0e4] p-3 rounded-xl border border-[#ded3be] text-xs">
                <div>
                  <span className="text-[10px] text-stone-500 font-bold uppercase block">Principal</span>
                  <span className="font-black text-stone-900">₹{modalLoanData.loan.principal?.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 font-bold uppercase block">Total Payable</span>
                  <span className="font-black text-amber-900">₹{modalLoanData.loan.totalPayable?.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 font-bold uppercase block">Total Paid</span>
                  <span className="font-black text-emerald-700">₹{(modalLoanData.loan.totalPaid || 0).toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 font-bold uppercase block">Balance</span>
                  <span className="font-black text-rose-600">₹{(modalLoanData.loan.outstandingTotal || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            {/* Repayment Collections Table */}
            <div className="overflow-x-auto rounded-xl border border-[#ded3be]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                  <tr>
                    <th className="px-4 py-2.5">Date & Time</th>
                    <th className="px-4 py-2.5">Amount Collected</th>
                    <th className="px-4 py-2.5">Method</th>
                    <th className="px-4 py-2.5">Receipt #</th>
                    <th className="px-4 py-2.5">Collector</th>
                    <th className="px-4 py-2.5">Notes / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece3d4]">
                  {isModalLoanLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-stone-400">Loading repayment receipts...</td>
                    </tr>
                  ) : modalLoanData?.payments?.length > 0 ? (
                    modalLoanData.payments.map((p: any) => (
                      <tr key={p._id} className="hover:bg-[#fbf7f0] transition">
                        <td className="px-4 py-2.5 text-stone-700 font-mono font-medium">
                          {new Date(p.paymentDate || p.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-emerald-700">₹{p.amount?.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f6f0e4] text-amber-950 border border-[#ded3be]">
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-stone-600 font-medium">{p.receiptNumber || '-'}</td>
                        <td className="px-4 py-2.5 text-stone-700 font-medium">{p.collectorId?.name || p.collectorName || 'Branch Staff'}</td>
                        <td className="px-4 py-2.5 text-stone-600 italic">
                          {p.isReversed ? (
                            <span className="text-rose-600 font-bold not-italic">REVERSED</span>
                          ) : (
                            p.remarks || 'Regular Installment Repayment'
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-stone-400">
                        No collection receipts recorded for this loan yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#ded3be]">
              {modalLoanData?.loan && (
                <Link
                  to={`/loans/${modalLoanData.loan._id}`}
                  className="text-xs font-bold text-brand-600 hover:underline flex items-center gap-1"
                >
                  <span>Open Full Amortization Ledger & Manage Loan</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              )}
              <button
                type="button"
                onClick={() => setViewingLoanCollectionsId(null)}
                className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold cursor-pointer transition ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Loans;
