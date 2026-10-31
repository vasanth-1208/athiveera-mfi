import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BranchProvider } from './context/BranchContext';
import { SidebarProvider } from './context/SidebarContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { CustomerDetail } from './pages/CustomerDetail';
import { Groups } from './pages/Groups';
import { GroupDetail } from './pages/GroupDetail';
import { Loans } from './pages/Loans';
import { LoanApprovals } from './pages/LoanApprovals';
import { LoanDetail } from './pages/LoanDetail';
import { LoanEnquiries } from './pages/LoanEnquiries';
import { LoanTiers } from './pages/LoanTiers';
import { MasterData } from './pages/MasterData';
import { Collections } from './pages/Collections';
import { Pending } from './pages/Pending';
import { Cashbook } from './pages/Cashbook';
import { Expenses } from './pages/Expenses';
import { Transfers } from './pages/Transfers';
import { Reports } from './pages/Reports';
import { Branches } from './pages/Branches';
import { Staff } from './pages/Staff';
import { ImportMigration } from './pages/ImportMigration';
import { AuditLogs } from './pages/AuditLogs';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000, // 30s cache - instant 0ms tab switches!
      gcTime: 5 * 60 * 1000,
      retry: 1
    }
  }
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-950 text-amber-200 text-xs">
        Loading Athiveera MFI system...
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const RoleRoute: React.FC<{
  allowedRoles: Array<'MAIN_ADMIN' | 'BRANCH_MANAGER' | 'COLLECTION_STAFF'>;
  children: React.ReactNode;
}> = ({ allowedRoles, children }) => {
  const { user } = useAuth();
  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'COLLECTION_STAFF' ? '/enquiries' : '/'} replace />;
  }
  return <>{children}</>;
};

const HomeOrRedirect: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'COLLECTION_STAFF') {
    return <Navigate to="/enquiries" replace />;
  }
  return <Dashboard />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BranchProvider>
            <SidebarProvider>
              <BrowserRouter>
              <Routes>
              <Route path="/login" element={<Login />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<HomeOrRedirect />} />
                <Route path="customers" element={<RoleRoute allowedRoles={['MAIN_ADMIN', 'BRANCH_MANAGER']}><Customers /></RoleRoute>} />
                <Route path="customers/:id" element={<RoleRoute allowedRoles={['MAIN_ADMIN', 'BRANCH_MANAGER']}><CustomerDetail /></RoleRoute>} />
                <Route path="groups" element={<Groups />} />
                <Route path="groups/:id" element={<GroupDetail />} />
                <Route path="enquiries" element={<LoanEnquiries />} />
                <Route path="loans" element={<RoleRoute allowedRoles={['MAIN_ADMIN', 'BRANCH_MANAGER']}><Loans /></RoleRoute>} />
                <Route path="loans/:id" element={<RoleRoute allowedRoles={['MAIN_ADMIN', 'BRANCH_MANAGER']}><LoanDetail /></RoleRoute>} />
                <Route path="loan-tiers" element={<RoleRoute allowedRoles={['MAIN_ADMIN', 'BRANCH_MANAGER']}><LoanTiers /></RoleRoute>} />
                <Route path="master-data" element={<RoleRoute allowedRoles={['MAIN_ADMIN', 'BRANCH_MANAGER']}><MasterData /></RoleRoute>} />
                <Route path="approvals" element={<Navigate to="/loans" replace />} />
                <Route path="collections" element={<Collections />} />
                <Route path="pending" element={<RoleRoute allowedRoles={['MAIN_ADMIN', 'BRANCH_MANAGER']}><Pending /></RoleRoute>} />
                <Route path="cashbook" element={<RoleRoute allowedRoles={['MAIN_ADMIN', 'BRANCH_MANAGER']}><Cashbook /></RoleRoute>} />
                <Route path="expenses" element={<RoleRoute allowedRoles={['MAIN_ADMIN', 'BRANCH_MANAGER']}><Expenses /></RoleRoute>} />
                <Route path="transfers" element={<RoleRoute allowedRoles={['MAIN_ADMIN', 'BRANCH_MANAGER']}><Transfers /></RoleRoute>} />
                <Route path="reports" element={<RoleRoute allowedRoles={['MAIN_ADMIN', 'BRANCH_MANAGER']}><Reports /></RoleRoute>} />
                <Route path="branches" element={<RoleRoute allowedRoles={['MAIN_ADMIN']}><Branches /></RoleRoute>} />
                <Route path="staff" element={<RoleRoute allowedRoles={['MAIN_ADMIN', 'BRANCH_MANAGER']}><Staff /></RoleRoute>} />
                <Route path="users" element={<RoleRoute allowedRoles={['MAIN_ADMIN', 'BRANCH_MANAGER']}><Staff /></RoleRoute>} />
                <Route path="import" element={<RoleRoute allowedRoles={['MAIN_ADMIN']}><ImportMigration /></RoleRoute>} />
                <Route path="audit" element={<Navigate to="/" replace />} />
                <Route path="settings" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
          </SidebarProvider>
        </BranchProvider>
      </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};


export default App;
