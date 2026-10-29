import React, { createContext, useContext, useState, useEffect } from 'react';
import { Branch } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface BranchContextType {
  branches: Branch[];
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  selectedBranch: Branch | null;
  refreshBranches: () => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

function extractBranchId(val: any): string {
  if (!val) return '';
  if (typeof val === 'object') {
    const id = val._id || val.id;
    return id ? String(id).trim() : '';
  }
  const str = String(val).trim();
  if (str === '[object Object]' || str === 'undefined' || str === 'null') {
    return '';
  }
  return str;
}

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    const raw = localStorage.getItem('athiveera_selected_branch');
    const cleaned = extractBranchId(raw);
    if (raw && !cleaned) {
      localStorage.removeItem('athiveera_selected_branch');
    }
    return cleaned;
  });

  const loadBranches = () => {
    if (!user) return;
    api.getBranches()
      .then((res: any) => {
        if (res.success && res.branches && res.branches.length > 0) {
          setBranches(res.branches);

          // Find primary operating branch (Pollachi) where active records reside
          const pollachi = res.branches.find((b: Branch) => b.code === 'POLLACHI');
          const defaultBranch = pollachi || res.branches[0];

          // If non-admin, lock to assigned branch
          const staffBranchId = extractBranchId(user.branchId) || extractBranchId(user.branch);
          if (!isAdmin && staffBranchId) {
            setSelectedBranchId(staffBranchId);
            localStorage.setItem('athiveera_selected_branch', staffBranchId);
          } else if (!isAdmin) {
            setSelectedBranchId('');
          } else {
            // Admin logic:
            const rawStored = localStorage.getItem('athiveera_selected_branch');
            const storedId = extractBranchId(rawStored);
            const isExplicit = localStorage.getItem('athiveera_branch_explicit') === 'true';
            const existsInDb = res.branches.some((b: Branch) => b._id === storedId);

            if (isExplicit && rawStored === '') {
              // User explicitly chose Consolidated (All Branches)
              setSelectedBranchId('');
            } else if (isExplicit && existsInDb && storedId) {
              // User explicitly chose an existing branch
              setSelectedBranchId(storedId);
            } else {
              // Stale ID, non-existent ID, or uninitialized: default to Pollachi
              const chosenId = defaultBranch ? defaultBranch._id : '';
              setSelectedBranchId(chosenId);
              localStorage.setItem('athiveera_selected_branch', chosenId);
            }
          }
        }
      })
      .catch((err) => console.error('Failed to load branches:', err));
  };

  useEffect(() => {
    loadBranches();
  }, [user, isAdmin]);

  const handleSetSelectedBranch = (id: string) => {
    const cleanId = extractBranchId(id);
    setSelectedBranchId(cleanId);
    if (cleanId) {
      localStorage.setItem('athiveera_selected_branch', cleanId);
    } else {
      localStorage.setItem('athiveera_selected_branch', '');
    }
    localStorage.setItem('athiveera_branch_explicit', 'true');
  };

  const selectedBranch = branches.find(b => b._id === selectedBranchId) || 
    (!isAdmin && user?.branch && typeof user.branch === 'object' ? (user.branch as any) : null);

  return (
    <BranchContext.Provider value={{
      branches,
      selectedBranchId,
      setSelectedBranchId: handleSetSelectedBranch,
      selectedBranch,
      refreshBranches: loadBranches
    }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranch must be used within a BranchProvider');
  return ctx;
};
