import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  MapPin, 
  Users, 
  Phone, 
  IndianRupee, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  ArrowLeft,
  Eye, 
  Filter,
  UserCheck,
  CreditCard,
  ShieldCheck,
  FileCheck2,
  User,
  Heart,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Enquiry, EnquiryMemberKYC } from '../types';

export const LoanEnquiries: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [reviewModalEnquiry, setReviewModalEnquiry] = useState<Enquiry | null>(null);

  // Multi-Member KYC modal state for the enquiry creator / staff
  const [kycModalEnquiry, setKycModalEnquiry] = useState<Enquiry | null>(null);
  const [kycMembers, setKycMembers] = useState<EnquiryMemberKYC[]>([]);
  const [activeMemberTab, setActiveMemberTab] = useState(0);
  const [kycRemarks, setKycRemarks] = useState('');
  const [kycError, setKycError] = useState('');
  const [memberSuccessMsg, setMemberSuccessMsg] = useState('');
  const [savingMemberIndex, setSavingMemberIndex] = useState<number | null>(null);
  const [expandedEnquiryKycId, setExpandedEnquiryKycId] = useState<string | null>(null);

  // New enquiry form state
  const [formData, setFormData] = useState({
    place: '',
    membersCount: 5,
    name: '',
    phone: '',
    amount: 20000,
    remarks: ''
  });

  // Review form state
  const [reviewData, setReviewData] = useState<{
    status: 'APPROVED' | 'REJECTED';
    managerRemarks: string;
  }>({
    status: 'APPROVED',
    managerRemarks: ''
  });

  const isManagerOrAdmin = user?.role === 'MAIN_ADMIN' || user?.role === 'BRANCH_MANAGER';

  // Fetch enquiries
  const { data, isLoading } = useQuery({
    queryKey: ['enquiries', statusFilter, searchTerm],
    queryFn: () => api.getEnquiries({ status: statusFilter, search: searchTerm })
  });

  const enquiries: Enquiry[] = data?.enquiries || [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (payload: any) => api.createEnquiry(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      setIsCreateModalOpen(false);
      setFormData({
        place: '',
        membersCount: 5,
        name: '',
        phone: '',
        amount: 20000,
        remarks: ''
      });
    }
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.reviewEnquiry(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      setReviewModalEnquiry(null);
      setReviewData({ status: 'APPROVED', managerRemarks: '' });
    }
  });

  // Save an individual member during field visit
  const saveMemberMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.submitEnquiryMemberKyc(id, payload),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      setKycError('');
      setSavingMemberIndex(null);

      if (data.enquiry) {
        setKycModalEnquiry(data.enquiry);
        if (data.enquiry.kyc?.members) {
          setKycMembers(prev => {
            const count = Math.max(data.enquiry.membersCount || 1, prev.length);
            const merged: EnquiryMemberKYC[] = [];
            for (let i = 0; i < count; i++) {
              const existingSaved = data.enquiry.kyc.members.find((sm: any) => sm.memberIndex === i + 1);
              if (existingSaved) {
                merged.push({ ...existingSaved });
              } else if (prev[i]) {
                merged.push({ ...prev[i], memberIndex: i + 1 });
              } else {
                merged.push({
                  memberIndex: i + 1,
                  memberName: '',
                  spouseName: '',
                  nomineeName: '',
                  nomineeRelationship: 'Spouse',
                  phone: '',
                  smartCardNumber: '',
                  aadharNumber: '',
                  voterIdNumber: '',
                  panNumber: ''
                });
              }
            }
            return merged;
          });
        }
      }

      if (data.isAllCompleted) {
        setMemberSuccessMsg(`✓ All ${data.targetCount} members verified! Group KYC completed.`);
      } else {
        setMemberSuccessMsg(data.message || `✓ Member #${data.savedMemberIndex} verified and saved!`);
        // Navigate to the next pending member
        setKycMembers(currentList => {
          const nextPendingIdx = currentList.findIndex((m, idx) =>
            idx !== activeMemberTab && !(m.memberName && m.smartCardNumber && m.aadharNumber && m.voterIdNumber && m.panNumber)
          );
          if (nextPendingIdx !== -1) {
            setActiveMemberTab(nextPendingIdx);
          } else if (activeMemberTab < currentList.length - 1) {
            setActiveMemberTab(activeMemberTab + 1);
          }
          return currentList;
        });
      }
    },
    onError: (err: any) => {
      setSavingMemberIndex(null);
      setKycError(err.message || 'Failed to save member KYC');
    }
  });

  // Bulk KYC submission mutation for logger/creator staff
  const submitKycMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.submitEnquiryKyc(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      setKycModalEnquiry(null);
      setKycMembers([]);
      setKycRemarks('');
      setKycError('');
      setMemberSuccessMsg('');
    },
    onError: (err: any) => {
      setKycError(err.message || 'Failed to submit group KYC details');
    }
  });

  // Delete a member from group KYC
  const deleteMemberMutation = useMutation({
    mutationFn: ({ enquiryId, memberIndex }: { enquiryId: string; memberIndex: number }) =>
      api.deleteEnquiryMember(enquiryId, memberIndex),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      if (data.enquiry) {
        setKycModalEnquiry(data.enquiry);
      }
      if (data.isAllCompleted) {
        setMemberSuccessMsg(`✓ Member removed. All remaining ${data.remainingCount} members are verified! Group KYC completed.`);
      } else {
        setMemberSuccessMsg(data.message || `Member removed. Group now has ${data.remainingCount} member(s).`);
      }
    },
    onError: (err: any) => {
      setKycError(err.message || 'Failed to remove member from group');
    }
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.place || !formData.name || !formData.amount || !formData.membersCount) return;
    createMutation.mutate(formData);
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalEnquiry || !reviewData.managerRemarks) return;
    reviewMutation.mutate({
      id: reviewModalEnquiry._id,
      payload: reviewData
    });
  };

  // Open KYC Modal initialized with all members from enquiry.membersCount
  const handleOpenKycModal = (enquiry: Enquiry) => {
    setKycModalEnquiry(enquiry);
    setKycError('');
    setMemberSuccessMsg('');
    setSavingMemberIndex(null);
    setKycRemarks(enquiry.kyc?.remarks || '');

    const targetCount = Math.max(enquiry.membersCount || 1, 1);
    const initial: EnquiryMemberKYC[] = [];
    const existingMembers = enquiry.kyc?.members || [];

    for (let i = 0; i < Math.max(targetCount, existingMembers.length); i++) {
      const saved = existingMembers.find(m => m.memberIndex === i + 1) || existingMembers[i];
      if (saved) {
        initial.push({ ...saved, memberIndex: i + 1 });
      } else {
        initial.push({
          memberIndex: i + 1,
          memberName: i === 0 ? enquiry.name : '',
          spouseName: '',
          nomineeName: '',
          nomineeRelationship: 'Spouse',
          phone: i === 0 ? (enquiry.phone || '') : '',
          smartCardNumber: i === 0 ? (enquiry.kyc?.smartCardNumber || '') : '',
          aadharNumber: i === 0 ? (enquiry.kyc?.aadharNumber || '') : '',
          voterIdNumber: i === 0 ? (enquiry.kyc?.voterIdNumber || '') : '',
          panNumber: i === 0 ? (enquiry.kyc?.panNumber || '') : ''
        });
      }
    }
    setKycMembers(initial);

    // Pick first unverified member tab, or 0
    const firstUnsaved = initial.findIndex(m => !(m.memberName && m.smartCardNumber && m.aadharNumber && m.voterIdNumber && m.panNumber));
    setActiveMemberTab(firstUnsaved >= 0 ? firstUnsaved : 0);
  };

  const handleSaveCurrentMember = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!kycModalEnquiry) return;
    const cur = kycMembers[activeMemberTab];
    if (!cur) return;

    if (!cur.memberName || !cur.memberName.trim()) {
      setKycError(`Member #${activeMemberTab + 1}: Member Full Name is required.`);
      return;
    }
    if (!cur.spouseName || !cur.spouseName.trim()) {
      setKycError(`Member #${activeMemberTab + 1} (${cur.memberName}): Spouse / Husband / Father Name is required.`);
      return;
    }
    if (!cur.nomineeName || !cur.nomineeName.trim()) {
      setKycError(`Member #${activeMemberTab + 1} (${cur.memberName}): Nominee Name is required.`);
      return;
    }
    if (!cur.smartCardNumber || !cur.smartCardNumber.trim()) {
      setKycError(`Member #${activeMemberTab + 1} (${cur.memberName}): Smart Card Number is required.`);
      return;
    }
    if (!cur.aadharNumber || !cur.aadharNumber.trim()) {
      setKycError(`Member #${activeMemberTab + 1} (${cur.memberName}): Aadhaar Number is required.`);
      return;
    }
    if (!cur.voterIdNumber || !cur.voterIdNumber.trim()) {
      setKycError(`Member #${activeMemberTab + 1} (${cur.memberName}): Voter ID Number is required.`);
      return;
    }
    if (!cur.panNumber || !cur.panNumber.trim()) {
      setKycError(`Member #${activeMemberTab + 1} (${cur.memberName}): PAN Card Number is required.`);
      return;
    }

    setKycError('');
    setMemberSuccessMsg('');
    const targetIdx = cur.memberIndex || (activeMemberTab + 1);
    setSavingMemberIndex(targetIdx);

    saveMemberMutation.mutate({
      id: kycModalEnquiry._id,
      payload: {
        ...cur,
        memberIndex: targetIdx,
        totalGroupMembers: kycMembers.length,
        remarks: kycRemarks
      }
    });
  };

  const updateCurrentMember = (field: keyof EnquiryMemberKYC, value: any) => {
    setKycMembers(prev => {
      const copy = [...prev];
      if (copy[activeMemberTab]) {
        copy[activeMemberTab] = {
          ...copy[activeMemberTab],
          [field]: value
        };
      }
      return copy;
    });
  };

  const handleAddMember = () => {
    setKycMembers(prev => [
      ...prev,
      {
        memberIndex: prev.length + 1,
        memberName: '',
        spouseName: '',
        nomineeName: '',
        nomineeRelationship: 'Spouse',
        phone: '',
        smartCardNumber: '',
        aadharNumber: '',
        voterIdNumber: '',
        panNumber: ''
      }
    ]);
    setActiveMemberTab(kycMembers.length);
  };

  const handleRemoveMember = (idxToRemove: number) => {
    if (kycMembers.length <= 1) {
      alert('A loan group must have at least 1 member.');
      return;
    }
    const memberToRemove = kycMembers[idxToRemove];
    const memberIndexNumber = memberToRemove?.memberIndex || (idxToRemove + 1);

    const filtered = kycMembers.filter((_, idx) => idx !== idxToRemove);
    const updated = filtered.map((m, idx) => ({ ...m, memberIndex: idx + 1 }));
    setKycMembers(updated);
    if (activeMemberTab >= updated.length) {
      setActiveMemberTab(Math.max(0, updated.length - 1));
    }

    if (kycModalEnquiry) {
      deleteMemberMutation.mutate({
        enquiryId: kycModalEnquiry._id,
        memberIndex: memberIndexNumber
      });
    }
  };

  const handleKycSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycModalEnquiry) return;

    for (let i = 0; i < kycMembers.length; i++) {
      const m = kycMembers[i];
      if (!m.memberName || !m.memberName.trim()) {
        setKycError(`Member #${i + 1}: Member Full Name is required.`);
        setActiveMemberTab(i);
        return;
      }
      if (!m.spouseName || !m.spouseName.trim()) {
        setKycError(`Member #${i + 1} (${m.memberName}): Spouse / Husband / Father Name is required.`);
        setActiveMemberTab(i);
        return;
      }
      if (!m.nomineeName || !m.nomineeName.trim()) {
        setKycError(`Member #${i + 1} (${m.memberName}): Nominee Name is required.`);
        setActiveMemberTab(i);
        return;
      }
      if (!m.smartCardNumber || !m.smartCardNumber.trim()) {
        setKycError(`Member #${i + 1} (${m.memberName}): Smart Card Number is required.`);
        setActiveMemberTab(i);
        return;
      }
      if (!m.aadharNumber || !m.aadharNumber.trim()) {
        setKycError(`Member #${i + 1} (${m.memberName}): Aadhaar Number is required.`);
        setActiveMemberTab(i);
        return;
      }
      if (!m.voterIdNumber || !m.voterIdNumber.trim()) {
        setKycError(`Member #${i + 1} (${m.memberName}): Voter ID Number is required.`);
        setActiveMemberTab(i);
        return;
      }
      if (!m.panNumber || !m.panNumber.trim()) {
        setKycError(`Member #${i + 1} (${m.memberName}): PAN Card Number is required.`);
        setActiveMemberTab(i);
        return;
      }
    }

    submitKycMutation.mutate({
      id: kycModalEnquiry._id,
      payload: {
        members: kycMembers,
        remarks: kycRemarks
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">Loan Enquiries & Field Leads</h2>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Field staff register prospective borrower enquiries. Branch managers visit the location to inspect and approve/reject with remarks.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 rounded-xl text-xs font-bold shadow-md shadow-amber-900/20 transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Loan Enquiry</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'ALL', label: 'All Enquiries' },
            { id: 'PENDING', label: 'Pending Visit' },
            { id: 'APPROVED', label: 'Visit Approved' },
            { id: 'KYC_SUBMITTED', label: 'KYC Submitted' },
            { id: 'REJECTED', label: 'Rejected' }
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === st.id
                  ? 'bg-[#251b14] text-amber-300 border border-amber-800/60 shadow-xs'
                  : 'bg-white border border-[#ded3be] text-stone-600 hover:bg-[#faf6ee]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search by name, place, phone, enquiry #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-[#ded3be] rounded-xl pl-9 pr-3 py-2 text-xs text-stone-800 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 shadow-xs"
          />
        </div>
      </div>

      {/* Enquiries Grid / Table */}
      {isLoading ? (
        <div className="flex justify-center py-16 text-amber-800 text-xs font-semibold">
          Loading loan enquiries...
        </div>
      ) : enquiries.length === 0 ? (
        <div className="bg-[#fffdfa] border border-[#ded3be] rounded-2xl p-12 text-center shadow-xs">
          <ClipboardList className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="text-stone-800 font-bold text-sm">No Loan Enquiries Found</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto font-medium">
            {statusFilter !== 'ALL' 
              ? `No enquiries matching status "${statusFilter}".` 
              : 'Collection staff can record a new loan enquiry using the button above.'}
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-stone-950 hover:from-amber-500 hover:to-yellow-500 transition cursor-pointer shadow-xs"
          >
            Create New Loan Enquiry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {enquiries.map((enquiry) => (
            <div
              key={enquiry._id}
              className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] p-5 shadow-xs flex flex-col justify-between hover:border-amber-600/50 hover:shadow-md transition group"
            >
              <div>
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2 border-b border-[#ece3d4] pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider bg-[#251b14] px-2 py-0.5 rounded border border-amber-800/60 shadow-xs">
                      {enquiry.enquiryNo}
                    </span>
                    <h3 className="text-sm font-bold text-stone-900 mt-1.5">{enquiry.name}</h3>
                  </div>

                  {(() => {
                    const verifiedCount = enquiry.kyc?.members?.filter(m => m.memberName && m.smartCardNumber && m.aadharNumber && m.voterIdNumber && m.panNumber)?.length || 0;
                    const totalTarget = enquiry.membersCount || 1;

                    if (enquiry.status === 'KYC_SUBMITTED') {
                      return (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-700" />
                          <span>KYC Verified ✓</span>
                        </span>
                      );
                    }

                    if (enquiry.status === 'APPROVED') {
                      if (verifiedCount > 0 && verifiedCount < totalTarget) {
                        return (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border bg-amber-100 text-amber-900 border-amber-300 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-700" />
                            <span>KYC In Progress ({verifiedCount}/{totalTarget})</span>
                          </span>
                        );
                      }
                      return (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border bg-blue-100 text-blue-800 border-blue-300">
                          Visit Approved
                        </span>
                      );
                    }

                    if (enquiry.status === 'REJECTED') {
                      return (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border bg-rose-100 text-rose-800 border-rose-300">
                          Rejected
                        </span>
                      );
                    }

                    return (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border bg-amber-50 text-amber-800 border-amber-200">
                        Pending Visit
                      </span>
                    );
                  })()}
                </div>

                {/* Details */}
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-stone-700">
                    <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="font-semibold text-stone-800">{enquiry.place}</span>
                  </div>

                  <div className="flex items-center gap-2 text-stone-700">
                    <Users className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Members Count: <strong className="text-stone-900">{enquiry.membersCount}</strong></span>
                  </div>

                  <div className="flex items-center gap-2 text-stone-700">
                    <IndianRupee className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Requested Amount: <strong className="text-stone-900 font-bold text-sm">₹{enquiry.amount.toLocaleString('en-IN')}</strong></span>
                  </div>

                  {enquiry.phone && (
                    <div className="flex items-center gap-2 pt-0.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <div className="flex flex-wrap items-center gap-1.5">
                        {enquiry.phone.split(/[/,]/).map((num: string, idx: number) => {
                          const cleanNum = num.trim();
                          if (!cleanNum) return null;
                          return (
                            <a
                              key={idx}
                              href={`tel:${cleanNum.replace(/[^0-9+]/g, '')}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#f6f0e4] hover:bg-emerald-50 text-stone-800 hover:text-emerald-700 font-bold rounded-lg border border-[#ded3be] hover:border-emerald-300 text-xs transition cursor-pointer"
                              title={`Click to call ${enquiry.name} (${cleanNum})`}
                            >
                              <span>{cleanNum}</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {enquiry.remarks && (
                    <div className="p-2.5 rounded-xl bg-[#faf6ee] border border-[#e8decb] text-[11px] text-stone-700 italic">
                      "{enquiry.remarks}"
                    </div>
                  )}

                  <div className="pt-2 text-[10px] text-stone-500 flex items-center justify-between border-t border-[#ece3d4]">
                    <span>Logged by: <strong className="text-stone-700">{enquiry.staffName}</strong></span>
                    <span>{new Date(enquiry.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Manager Review Box */}
                  {enquiry.managerRemarks && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs">
                      <div className="flex items-center justify-between text-[10px] font-bold text-amber-900 mb-1">
                        <span>Manager Visit Decision ({enquiry.reviewedByName || 'Manager'}):</span>
                        {enquiry.reviewedAt && (
                          <span className="text-stone-500 font-normal">{new Date(enquiry.reviewedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-800 leading-relaxed font-medium">{enquiry.managerRemarks}</p>
                    </div>
                  )}

                  {/* Borrower KYC Card (Submitted by Logger / Staff) */}
                  {(enquiry.kyc?.smartCardNumber || (enquiry.kyc?.members && enquiry.kyc.members.length > 0)) && (
                    <div className="mt-2.5 p-3 rounded-xl bg-[#f5f8f5] border border-emerald-200 text-xs">
                      <div className="flex items-center justify-between text-[10px] font-bold text-emerald-900 mb-1.5">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Field KYC Progress ({enquiry.kyc.submittedByName || 'Staff'}):</span>
                        </span>
                        {(() => {
                          const verifiedCount = enquiry.kyc.members?.filter(m => m.memberName && m.smartCardNumber && m.aadharNumber && m.voterIdNumber && m.panNumber).length || 0;
                          const totalTarget = enquiry.membersCount || 1;
                          const isFullyVerified = enquiry.status === 'KYC_SUBMITTED' || verifiedCount >= totalTarget;

                          return (
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                              isFullyVerified
                                ? 'text-emerald-800 bg-emerald-100 border-emerald-300'
                                : 'text-amber-800 bg-amber-100 border-amber-300'
                            }`}>
                              {verifiedCount} of {totalTarget} Members Verified {isFullyVerified ? '✓' : `(${totalTarget - verifiedCount} Pending)`}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Members Display */}
                      {(() => {
                        const members = (enquiry.kyc.members && enquiry.kyc.members.length > 0)
                          ? enquiry.kyc.members
                          : [
                              {
                                memberIndex: 1,
                                memberName: enquiry.name,
                                spouseName: '',
                                nomineeName: '',
                                nomineeRelationship: 'Spouse',
                                smartCardNumber: enquiry.kyc.smartCardNumber,
                                aadharNumber: enquiry.kyc.aadharNumber,
                                voterIdNumber: enquiry.kyc.voterIdNumber,
                                panNumber: enquiry.kyc.panNumber
                              }
                            ];
                        const isExpanded = expandedEnquiryKycId === enquiry._id;

                        return (
                          <div className="space-y-2 mt-2">
                            {/* Toggle button if more than 1 member */}
                            {members.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setExpandedEnquiryKycId(isExpanded ? null : enquiry._id)}
                                className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer my-1"
                              >
                                <span>{isExpanded ? 'Hide Member List' : `View All ${members.length} Members KYC Details`}</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            )}

                            {/* Render members (either first only or all if expanded or 1) */}
                            {(isExpanded ? members : members.slice(0, 1)).map((m: any, mIdx: number) => (
                              <div key={mIdx} className="bg-white p-2.5 rounded-lg border border-stone-200 space-y-1.5 shadow-xs">
                                <div className="flex items-center justify-between border-b border-stone-100 pb-1 text-[11px]">
                                  <span className="font-bold text-stone-900">
                                    #{m.memberIndex || mIdx + 1}. {m.memberName}
                                  </span>
                                  {m.spouseName && (
                                    <span className="text-[10px] text-stone-500">
                                      Spouse: <strong className="text-stone-700">{m.spouseName}</strong>
                                    </span>
                                  )}
                                </div>
                                {m.nomineeName && (
                                  <div className="text-[10px] text-stone-600">
                                    Nominee: <strong className="text-stone-800">{m.nomineeName}</strong> ({m.nomineeRelationship || 'Spouse'})
                                  </div>
                                )}
                                {m.phone && m.phone !== '-' && (
                                  <div className="text-[10px] text-stone-600 flex items-center gap-1">
                                    <span>Phone:</span>
                                    <a
                                      href={`tel:${m.phone.replace(/[^0-9+]/g, '')}`}
                                      className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:text-emerald-900"
                                      title={`Click to call ${m.memberName} (${m.phone})`}
                                    >
                                      <Phone className="w-2.5 h-2.5 text-emerald-600" />
                                      <span>{m.phone}</span>
                                    </a>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-1 text-[10px] text-stone-600 font-mono">
                                  <div>Smart Card: <strong className="text-stone-900">{m.smartCardNumber || '—'}</strong></div>
                                  <div>Aadhaar: <strong className="text-stone-900">{m.aadharNumber || '—'}</strong></div>
                                  <div>Voter ID: <strong className="text-stone-900">{m.voterIdNumber || '—'}</strong></div>
                                  <div>PAN: <strong className="text-stone-900">{m.panNumber || '—'}</strong></div>
                                </div>
                              </div>
                            ))}

                            {enquiry.kyc.remarks && (
                              <p className="text-[10px] text-stone-500 italic mt-1 font-sans">"{enquiry.kyc.remarks}"</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-[#ece3d4] flex flex-col gap-2">
                {(() => {
                  const currentUserId = user?._id || user?.id;
                  const creatorId = (enquiry.staffId as any)?._id || (enquiry.staffId as any)?.id || enquiry.staffId;
                  const isLogger = String(creatorId) === String(currentUserId);

                  return (
                    <>
                      {/* 1. Manager records site visit decision when PENDING */}
                      {isManagerOrAdmin && enquiry.status === 'PENDING' && (
                        <button
                          onClick={() => {
                            setReviewModalEnquiry(enquiry);
                            setReviewData({ status: 'APPROVED', managerRemarks: '' });
                          }}
                          className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#f6f0e4] text-amber-950 border border-[#ded3be] hover:bg-[#ede3d0] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-amber-800" />
                          <span>Record Visit Decision (Approve / Reject)</span>
                        </button>
                      )}

                      {/* Staff waiting for visit */}
                      {!isManagerOrAdmin && enquiry.status === 'PENDING' && (
                        <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-center">
                          <span className="text-[11px] text-amber-800 italic flex items-center justify-center gap-1.5 font-medium">
                            <Clock className="w-3.5 h-3.5 text-amber-700" />
                            <span>Awaiting Manager Site Visit Decision</span>
                          </span>
                        </div>
                      )}

                      {/* 2. After visit is APPROVED, logger creator enters KYC details (individual field visits) */}
                      {enquiry.status === 'APPROVED' && (isLogger || isManagerOrAdmin) && (() => {
                        const verifiedCount = enquiry.kyc?.members?.filter(m => m.memberName && m.smartCardNumber && m.aadharNumber && m.voterIdNumber && m.panNumber).length || 0;
                        const totalTarget = enquiry.membersCount || 1;
                        const remaining = Math.max(0, totalTarget - verifiedCount);

                        return (
                          <button
                            onClick={() => handleOpenKycModal(enquiry)}
                            className="w-full py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-stone-950 hover:from-amber-500 hover:to-yellow-500 shadow-md shadow-amber-900/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CreditCard className="w-4 h-4 text-stone-950" />
                            {verifiedCount === 0 ? (
                              <span>Start Field Visit KYC ({totalTarget} Members)</span>
                            ) : (
                              <span>Continue Field Visit KYC ({verifiedCount}/{totalTarget} Saved, {remaining} Pending)</span>
                            )}
                          </button>
                        );
                      })()}

                      {/* If approved, but current staff is not the logger */}
                      {enquiry.status === 'APPROVED' && !isLogger && !isManagerOrAdmin && (
                        <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                          <span className="text-[11px] text-emerald-800 font-bold flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Visit Approved! KYC in progress by {enquiry.staffName}</span>
                          </span>
                        </div>
                      )}

                      {/* Once KYC is submitted: Show verified completion status */}
                      {enquiry.status === 'KYC_SUBMITTED' && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                          <span className="text-xs text-emerald-800 font-bold flex items-center justify-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Group KYC Verified & Completed ({enquiry.kyc?.members?.length || enquiry.membersCount} Members) ✓</span>
                          </span>
                        </div>
                      )}

                      {/* Edit/update KYC option if logger or manager needs to make edits */}
                      {enquiry.status === 'KYC_SUBMITTED' && (isLogger || isManagerOrAdmin) && (
                        <button
                          onClick={() => handleOpenKycModal(enquiry)}
                          className="w-full py-1.5 rounded-lg text-[11px] font-bold text-stone-700 hover:text-stone-900 bg-[#f6f0e4] hover:bg-[#ede3d0] border border-[#ded3be] transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CreditCard className="w-3 h-3 text-stone-600" />
                          <span>Update / Edit Verified KYC Details ({enquiry.kyc?.members?.length || enquiry.membersCount} Members)</span>
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE LOAN ENQUIRY MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-[#fffdfa] border border-[#ded3be] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h2 className="text-base font-black text-stone-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-700" />
              <span>New Loan Enquiry Form</span>
            </h2>
            <p className="text-xs text-stone-500 mt-1 font-medium">
              Field lead inquiry. Fill the location and prospect details for manager visit.
            </p>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Place / Area / Village <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pollachi Town, Annamalai, Kottur..."
                  value={formData.place}
                  onChange={(e) => setFormData({ ...formData, place: e.target.value })}
                  className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Members Count <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={formData.membersCount}
                    onChange={(e) => setFormData({ ...formData, membersCount: parseInt(e.target.value) || 1 })}
                    className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-hidden focus:border-amber-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Requested Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-hidden focus:border-amber-600 font-medium font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Contact / Borrower Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Selvi, Murugan, Lakshmi..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Contact Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Staff Notes / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Field notes about the group or requirement..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#ece3d4]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-stone-950 hover:from-amber-500 hover:to-yellow-500 shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Submitting...' : 'Submit Loan Enquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGER VISIT DECISION MODAL */}
      {reviewModalEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-[#fffdfa] border border-[#ded3be] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h2 className="text-base font-black text-stone-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-700" />
              <span>Record Manager Visit Decision</span>
            </h2>
            <p className="text-xs text-stone-500 mt-1 font-medium">
              Reviewing enquiry <strong className="text-stone-800">{reviewModalEnquiry.enquiryNo}</strong> for <strong className="text-stone-800">{reviewModalEnquiry.name}</strong> ({reviewModalEnquiry.place}).
            </p>

            <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Visit Decision Status <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewData({ ...reviewData, status: 'APPROVED' })}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer ${
                      reviewData.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-500 shadow-sm'
                        : 'bg-white text-stone-600 border-[#ded3be] hover:bg-[#faf6ee]'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Approve Enquiry</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewData({ ...reviewData, status: 'REJECTED' })}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer ${
                      reviewData.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-900 border-rose-500 shadow-sm'
                        : 'bg-white text-stone-600 border-[#ded3be] hover:bg-[#faf6ee]'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Reject Enquiry</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Manager Remarks on Visit <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Visited the premises in Pollachi. Verified borrower home and business stability. 5 members confirmed..."
                  value={reviewData.managerRemarks}
                  onChange={(e) => setReviewData({ ...reviewData, managerRemarks: e.target.value })}
                  className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#ece3d4]">
                <button
                  type="button"
                  onClick={() => setReviewModalEnquiry(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewMutation.isPending || !reviewData.managerRemarks}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-stone-950 hover:from-amber-500 hover:to-yellow-500 shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {reviewMutation.isPending ? 'Saving...' : 'Save Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FIELD STAFF MULTI-MEMBER KYC ENTRY MODAL */}
      {kycModalEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#fffdfa] border border-[#ded3be] rounded-2xl w-full max-w-3xl p-6 shadow-2xl relative my-6 max-h-[90vh] flex flex-col text-stone-900">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#ded3be] pb-3 shrink-0">
              <div>
                <h2 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-700" />
                  <span>Borrower Group KYC Verification ({kycMembers.length} Members)</span>
                </h2>
                <p className="text-xs text-stone-500 mt-1 font-medium">
                  Visit approved by manager for <strong className="text-stone-800">{kycModalEnquiry.name}</strong> ({kycModalEnquiry.place}). Please enter verified KYC documents for all <strong className="text-stone-800">{kycMembers.length} group members</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKycModalEnquiry(null)}
                className="text-stone-400 hover:text-stone-700 text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Error banner */}
            {kycError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs shrink-0 flex items-center justify-between font-medium">
                <span>{kycError}</span>
                <button
                  type="button"
                  onClick={() => setKycError('')}
                  className="text-stone-400 hover:text-rose-900 text-sm font-bold ml-2 cursor-pointer"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Success message banner */}
            {memberSuccessMsg && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold shrink-0 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{memberSuccessMsg}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setMemberSuccessMsg('')}
                  className="text-stone-400 hover:text-emerald-950 text-sm font-bold cursor-pointer"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Member Selector Tabs */}
            <div className="mt-3 p-2.5 bg-[#f6f0e4] rounded-xl border border-[#ded3be] shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>Group Members Checklist ({kycMembers.filter(m => m.memberName && m.spouseName && m.nomineeName && m.smartCardNumber && m.aadharNumber && m.voterIdNumber && m.panNumber).length} of {kycMembers.length} Saved)</span>
                </span>
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#fffdfa] text-amber-900 border border-[#ded3be] hover:bg-[#faf6ee] transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Member</span>
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {kycMembers.map((m, idx) => {
                  const isFilled = m.memberName && m.spouseName && m.nomineeName && m.smartCardNumber && m.aadharNumber && m.voterIdNumber && m.panNumber;
                  const isActive = activeMemberTab === idx;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveMemberTab(idx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-[#251b14] text-amber-300 font-bold border border-amber-800/60 shadow-xs'
                          : isFilled
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-white text-stone-600 border border-[#ded3be] hover:bg-[#faf6ee]'
                      }`}
                    >
                      <span>Member #{idx + 1}{m.memberName ? `: ${m.memberName.split(' ')[0]}` : ''}</span>
                      {isFilled ? (
                        <span className="text-[10px] font-black text-emerald-700">✓ Saved</span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Form Body for Active Member */}
            <form onSubmit={handleKycSubmit} className="mt-4 space-y-4 text-xs overflow-y-auto pr-1 flex-1">
              {kycMembers[activeMemberTab] && (() => {
                const cur = kycMembers[activeMemberTab];

                return (
                  <div className="space-y-4 bg-[#fcf9f2] p-4 rounded-xl border border-[#ded3be]">
                    {/* Active member card banner */}
                    <div className="flex items-center justify-between border-b border-[#ece3d4] pb-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#251b14] text-amber-300 border border-amber-800/60 uppercase shadow-xs">
                          Member #{activeMemberTab + 1} of {kycMembers.length}
                        </span>
                        <span className="font-bold text-stone-900 text-xs">
                          {cur.memberName || 'New Member'}
                        </span>
                      </div>

                      {kycMembers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(activeMemberTab)}
                          className="text-rose-600 hover:text-rose-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    {/* Member & Spouse Details */}
                    <div>
                      <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-2 flex items-center gap-1">
                        <User className="w-3 h-3 text-amber-700" />
                        <span>Member & Family Information</span>
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                            Member Full Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Selvi, Murugammal..."
                            value={cur.memberName}
                            onChange={(e) => updateCurrentMember('memberName', e.target.value)}
                            className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                            Spouse / Husband / Father Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Murugan, Ramasamy..."
                            value={cur.spouseName}
                            onChange={(e) => updateCurrentMember('spouseName', e.target.value)}
                            className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                            Contact Phone No
                          </label>
                          <input
                            type="tel"
                            placeholder="10-digit mobile"
                            value={cur.phone || ''}
                            onChange={(e) => updateCurrentMember('phone', e.target.value)}
                            className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Nominee Details */}
                    <div>
                      <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-2 flex items-center gap-1">
                        <Heart className="w-3 h-3 text-rose-600" />
                        <span>Nominee Details</span>
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                            Nominee Full Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Sangeetha, Prakash..."
                            value={cur.nomineeName}
                            onChange={(e) => updateCurrentMember('nomineeName', e.target.value)}
                            className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 font-medium"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                            Nominee Relationship
                          </label>
                          <select
                            value={cur.nomineeRelationship || 'Spouse'}
                            onChange={(e) => updateCurrentMember('nomineeRelationship', e.target.value)}
                            className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-hidden focus:border-amber-600 font-medium"
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
                      </div>
                    </div>

                    {/* KYC Identification */}
                    <div>
                      <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block mb-2 flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-amber-700" />
                        <span>Mandatory Government KYC Identification</span>
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                            1. Smart Card Number <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 33/G/1234567"
                            value={cur.smartCardNumber}
                            onChange={(e) => updateCurrentMember('smartCardNumber', e.target.value)}
                            className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 font-mono font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                            2. Aadhaar Number <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={14}
                            placeholder="12-digit Aadhaar"
                            value={cur.aadharNumber}
                            onChange={(e) => updateCurrentMember('aadharNumber', e.target.value)}
                            className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 font-mono font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                            3. Voter ID Number <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. TN/12/345/678901"
                            value={cur.voterIdNumber}
                            onChange={(e) => updateCurrentMember('voterIdNumber', e.target.value)}
                            className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 font-mono font-bold uppercase"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                            4. PAN Card Number <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={10}
                            placeholder="e.g. ABCDE1234F"
                            value={cur.panNumber}
                            onChange={(e) => updateCurrentMember('panNumber', e.target.value.toUpperCase())}
                            className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 font-mono font-bold uppercase"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Dedicated Save Button for this Member's Field Visit */}
                    <div className="mt-4 p-3.5 bg-[#f6f0e4] border border-[#ded3be] rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                      <div className="text-left">
                        <p className="text-xs font-black text-stone-900 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>Field Visit Verification for Member #{activeMemberTab + 1}: {cur.memberName || 'Prospect'}</span>
                        </p>
                        <p className="text-[11px] text-stone-600 mt-0.5 font-medium">
                          Save this member's verified details directly during their home visit. You can return later for other members.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={savingMemberIndex !== null}
                        onClick={handleSaveCurrentMember}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 text-white hover:brightness-105 shadow-md transition flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {savingMemberIndex === (cur.memberIndex || activeMemberTab + 1) ? (
                          <span>Saving Member #{activeMemberTab + 1}...</span>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-white" />
                            <span>Save Member #{activeMemberTab + 1} KYC</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Step Navigation buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#ece3d4]">
                      <button
                        type="button"
                        disabled={activeMemberTab === 0}
                        onClick={() => setActiveMemberTab(prev => Math.max(0, prev - 1))}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold border border-[#ded3be] bg-white text-stone-700 hover:bg-[#faf6ee] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Previous Member</span>
                      </button>

                      <span className="text-[10px] text-stone-500 font-mono font-bold">
                        Member {activeMemberTab + 1} of {kycMembers.length}
                      </span>

                      <button
                        type="button"
                        disabled={activeMemberTab === kycMembers.length - 1}
                        onClick={() => setActiveMemberTab(prev => Math.min(kycMembers.length - 1, prev + 1))}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#f6f0e4] text-amber-950 border border-[#ded3be] hover:bg-[#ede3d0] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                      >
                        <span>Next Member</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Group Remarks */}
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Field Verification Remarks / Notes for the Group
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes from group borrower verification at site..."
                  value={kycRemarks}
                  onChange={(e) => setKycRemarks(e.target.value)}
                  className="w-full bg-white border border-[#ded3be] rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-hidden focus:border-amber-600 font-medium"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#ece3d4] shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setKycModalEnquiry(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 border border-[#ded3be] bg-white hover:bg-stone-50 cursor-pointer"
                  >
                    Close / Done for Now
                  </button>
                  <span className="text-[10px] text-stone-500 italic hidden sm:inline">
                    Saved members are safely preserved in database.
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={submitKycMutation.isPending}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-stone-950 hover:from-amber-500 hover:to-yellow-500 shadow-md shadow-amber-900/20 transition cursor-pointer font-black"
                >
                  {submitKycMutation.isPending ? 'Saving All Members...' : `Save All & Submit Group KYC (${kycMembers.length} Members)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoanEnquiries;
