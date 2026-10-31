import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FolderTree, 
  HandCoins, 
  Coins, 
  AlertCircle, 
  BookOpen, 
  TrendingDown, 
  ArrowLeftRight, 
  FileSpreadsheet, 
  Building2, 
  UserCheck, 
  UploadCloud, 
  LogOut, 
  ClipboardList, 
  Sliders, 
  Database,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';

export const Sidebar: React.FC = () => {
  const { user, isAdmin, isManager, logout } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const location = useLocation();

  // Accordion state: expanded by default so finance, ledger, and master db are readily visible
  const isFinanceActive = ['/cashbook', '/expenses', '/transfers', '/reports'].some(p => location.pathname.startsWith(p));
  const isAdminActive = ['/master-data', '/branches', '/users', '/import'].some(p => location.pathname.startsWith(p));

  const [isFinanceOpen, setIsFinanceOpen] = useState(true);
  const [isAdminOpen, setIsAdminOpen] = useState(true);

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
      isActive
        ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-stone-950 font-bold shadow-md shadow-amber-900/30'
        : 'text-stone-300 hover:text-amber-200 hover:bg-[#251b14]'
    }`;

  return (
    <aside
      className={`${
        isCollapsed ? 'w-18' : 'w-64'
      } bg-[#18120e] border-r border-amber-950/60 flex flex-col h-screen select-none no-print transition-all duration-300 ease-in-out shrink-0`}
    >
      {/* Brand Header */}
      <div
        className={`h-16 flex items-center ${
          isCollapsed ? 'justify-center py-2 px-1' : 'px-4'
        } border-b border-amber-950/80 bg-[#140e0a] transition-all`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            onClick={isCollapsed ? toggleSidebar : undefined}
            className={`h-9 w-9 flex items-center justify-center p-1 bg-[#251b14] rounded-xl border border-amber-800/40 shadow-inner shrink-0 ${
              isCollapsed ? 'cursor-pointer hover:border-amber-500/60 transition' : ''
            }`}
            title={isCollapsed ? 'Click to expand sidebar' : 'Athiveera MFI'}
          >
            <img src="/logo.png" alt="Athiveera Logo" className="h-7 w-auto object-contain" />
          </div>

          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="text-amber-50 font-black text-sm tracking-tight leading-none truncate">Athiveera MFI</h1>
              <p className="text-[10px] text-amber-400/80 font-medium mt-0.5 uppercase tracking-wider">Core Banking</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
        {user?.role === 'COLLECTION_STAFF' ? (
          <div>
            {!isCollapsed ? (
              <p className="px-3 text-[10px] font-bold text-amber-500/70 uppercase tracking-wider mb-2">Field Staff Portal</p>
            ) : (
              <div className="h-px bg-amber-950/70 my-2 mx-1" />
            )}
            <nav className="space-y-1">
              <NavLink to="/groups" className={navItemClass} title="Groups & Routes">
                <FolderTree className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Groups & Routes</span>}
              </NavLink>
              <NavLink to="/enquiries" className={navItemClass} title="Loan Enquiry">
                <ClipboardList className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Loan Enquiry</span>}
              </NavLink>
              <NavLink to="/collections" className={navItemClass} title="Daily Collections">
                <Coins className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Daily Collections</span>}
              </NavLink>
            </nav>
          </div>
        ) : (
          <>
            <div>
              {!isCollapsed ? (
                <p className="px-3 text-[10px] font-bold text-amber-500/70 uppercase tracking-wider mb-2">Operations</p>
              ) : (
                <div className="h-px bg-amber-950/70 my-2 mx-1" />
              )}
              <nav className="space-y-1">
                <NavLink to="/" className={navItemClass} title="Dashboard">
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>Dashboard</span>}
                </NavLink>
                <NavLink to="/customers" className={navItemClass} title="Customers">
                  <Users className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>Customers</span>}
                </NavLink>
                <NavLink to="/groups" className={navItemClass} title="Groups & Routes">
                  <FolderTree className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>Groups & Routes</span>}
                </NavLink>
                <NavLink to="/enquiries" className={navItemClass} title="Loan Enquiry">
                  <ClipboardList className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>Loan Enquiry</span>}
                </NavLink>
                <NavLink to="/loans" className={navItemClass} title="Loans & Applications">
                  <HandCoins className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>Loans & Applications</span>}
                </NavLink>
                <NavLink to="/loan-tiers" className={navItemClass} title="Loan Tiers & Slabs">
                  <Sliders className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>Loan Tiers & Slabs</span>}
                </NavLink>
                <NavLink to="/collections" className={navItemClass} title="Collections">
                  <Coins className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>Collections</span>}
                </NavLink>
                <NavLink to="/pending" className={navItemClass} title="Overdue & Bad Debts">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>Overdue & Bad Debts</span>}
                </NavLink>
              </nav>
            </div>

            <div>
              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => setIsFinanceOpen(!isFinanceOpen)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-amber-500/70 hover:text-amber-300 uppercase tracking-wider mb-1 cursor-pointer transition rounded-lg hover:bg-[#221812]"
                >
                  <span>Finance & Ledger</span>
                  {isFinanceOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
                  )}
                </button>
              ) : (
                <div className="h-px bg-amber-950/70 my-2 mx-1" />
              )}
              {(!isCollapsed ? isFinanceOpen : true) && (
                <nav className="space-y-1">
                  <NavLink to="/cashbook" className={navItemClass} title="Cashbook Ledger">
                    <BookOpen className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span>Cashbook Ledger</span>}
                  </NavLink>
                  <NavLink to="/expenses" className={navItemClass} title="Expenses & Petrol KM">
                    <TrendingDown className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span>Expenses & Petrol KM</span>}
                  </NavLink>
                  <NavLink to="/transfers" className={navItemClass} title="Branch Transfers">
                    <ArrowLeftRight className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span>Branch Transfers</span>}
                  </NavLink>
                  <NavLink to="/reports" className={navItemClass} title="Reports & Exports">
                    <FileSpreadsheet className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span>Reports & Exports</span>}
                  </NavLink>
                </nav>
              )}
            </div>

            <div>
              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => setIsAdminOpen(!isAdminOpen)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-amber-500/70 uppercase tracking-wider mb-1 cursor-pointer transition rounded-lg hover:bg-[#221812] hover:text-amber-300"
                >
                  <span>Administration</span>
                  {isAdminOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
                  )}
                </button>
              ) : (
                <div className="h-px bg-amber-950/70 my-2 mx-1" />
              )}
              {(!isCollapsed ? isAdminOpen : true) && (
                <nav className="space-y-1">
                  {(isAdmin || isManager) && (
                    <NavLink to="/master-data" className={navItemClass} title="Master DB & Ledger">
                      <Database className="w-4 h-4 shrink-0 text-amber-400" />
                      {!isCollapsed && <span>Master DB & Ledger</span>}
                    </NavLink>
                  )}
                  {isAdmin && (
                    <NavLink to="/branches" className={navItemClass} title="Branches">
                      <Building2 className="w-4 h-4 shrink-0" />
                      {!isCollapsed && <span>Branches</span>}
                    </NavLink>
                  )}
                  <NavLink to="/users" className={navItemClass} title="User Management">
                    <UserCheck className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span>User Management</span>}
                  </NavLink>
                </nav>
              )}
            </div>
          </>
        )}
      </div>

      {/* User Footer Profile */}
      <div className="p-2 border-t border-amber-950/80 bg-[#140e0a]">
        {!isCollapsed ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#221812] border border-amber-900/30">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-yellow-500 flex items-center justify-center text-stone-950 font-black text-xs shrink-0 shadow-sm">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-amber-50 truncate">{user?.name}</p>
                <p className="text-[10px] text-amber-400/80 uppercase font-mono tracking-tight">
                  {user?.role?.replace('_', ' ')}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Log Out"
              className="p-1.5 text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <div
              title={`${user?.name || 'User'} (${user?.role?.replace('_', ' ')})`}
              className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-yellow-500 flex items-center justify-center text-stone-950 font-black text-xs shrink-0 shadow-sm"
            >
              {user?.name?.charAt(0) || 'U'}
            </div>
            <button
              onClick={logout}
              title="Log Out"
              className="p-1.5 text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
