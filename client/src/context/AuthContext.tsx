import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
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
      const saved = localStorage.getItem('athiveera_user');
      return saved ? normalizeUser(JSON.parse(saved)) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('athiveera_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (token) {
      api.getMe()
        .then((res: any) => {
          if (res.success && res.user) {
            const cleanUser = normalizeUser(res.user);
            setUser(cleanUser);
            localStorage.setItem('athiveera_user', JSON.stringify(cleanUser));
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

  const login = (newToken: string, newUser: User) => {
    const cleanUser = normalizeUser(newUser) || newUser;
    setToken(newToken);
    setUser(cleanUser);
    localStorage.setItem('athiveera_token', newToken);
    localStorage.setItem('athiveera_user', JSON.stringify(cleanUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('athiveera_token');
    localStorage.removeItem('athiveera_user');
    window.location.href = '/login';
  };

  const isAdmin = user?.role === 'MAIN_ADMIN';
  const isManager = user?.role === 'BRANCH_MANAGER';
  const isStaff = user?.role === 'COLLECTION_STAFF';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isManager, isStaff }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
