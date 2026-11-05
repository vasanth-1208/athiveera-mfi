import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { authStorage, isPwa } from '../utils/authStorage';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User, isPwaClient?: boolean) => void;
  logout: () => void;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  isPwaApp: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const normalizeUser = (rawUser: any): User | null => {
    if (!rawUser) return null;
    const u = { ...rawUser };
    if (u.branchId && typeof u.branchId === 'object') {
      u.branch = u.branch || u.branchId;
      u.branchId = u.branchId._id ? String(u.branchId._id) : null;
    } else if (u.branchId) {
      const bStr = String(u.branchId).trim();
      u.branchId = (bStr === '[object Object]' || bStr === 'undefined' || bStr === 'null') ? null : bStr;
    }
    return u as User;
  };

  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = authStorage.getUser();
      return saved ? normalizeUser(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => authStorage.getToken());
  const [loading, setLoading] = useState<boolean>(true);
  const isPwaApp = isPwa();

  useEffect(() => {
    if (token) {
      api.getMe()
        .then((res: any) => {
          if (res.success && res.user) {
            const cleanUser = normalizeUser(res.user);
            setUser(cleanUser);
            if (cleanUser) {
              authStorage.updateUser(cleanUser);
            }
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (newToken: string, newUser: User, isPwaClient?: boolean) => {
    const cleanUser = normalizeUser(newUser) || newUser;
    setToken(newToken);
    setUser(cleanUser);
    authStorage.saveAuth(newToken, cleanUser, isPwaClient);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    authStorage.clearAuth();
    window.location.href = '/login';
  };

  const isAdmin = user?.role === 'MAIN_ADMIN';
  const isManager = user?.role === 'BRANCH_MANAGER';
  const isStaff = user?.role === 'COLLECTION_STAFF';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isManager, isStaff, isPwaApp }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
