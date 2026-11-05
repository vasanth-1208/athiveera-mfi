import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Calendar, ShieldCheck, User as UserIcon, Coins, PanelLeftClose, PanelLeftOpen, Sun, Moon, Menu, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { useSidebar } from '../context/SidebarContext';
import { useTheme } from '../context/ThemeContext';

export const Navbar: React.FC = () => {
  const { user, isAdmin, logout } = useAuth();
  const { branches, selectedBranchId, setSelectedBranchId, selectedBranch } = useBranch();
  const { isCollapsed, toggleSidebar, toggleMobile } = useSidebar();
  const { isDark, toggleTheme } = useTheme();

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const todayWeekday = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date().getDay()];

  return (
    <header className="h-16 bg-[#fffdfa] dark:bg-[#18120e] border-b border-[#ece3d4] dark:border-[#382d24] px-2.5 sm:px-6 flex items-center justify-between no-print z-10 sticky top-0 shadow-xs transition-colors duration-200">
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Drawer Button */}
        <button
          type="button"
          onClick={toggleMobile}
          title="Open menu"
          className="md:hidden p-2 rounded-xl bg-[#f6f0e4] hover:bg-[#ebdcc4] dark:bg-[#251b14] dark:hover:bg-[#34271e] text-stone-700 dark:text-amber-300 border border-[#ded3be] dark:border-amber-900/50 transition cursor-pointer flex items-center justify-center shrink-0"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5 text-amber-800 dark:text-amber-400" />
        </button>

        {/* Desktop Sidebar Toggle Button */}
        <button
          type="button"
          onClick={toggleSidebar}
          title={isCollapsed ? 'Expand sidebar' : 'Close / Collapse sidebar'}
          className="hidden md:flex p-2 rounded-xl bg-[#f6f0e4] hover:bg-[#ebdcc4] dark:bg-[#251b14] dark:hover:bg-[#34271e] text-stone-700 dark:text-amber-300 border border-[#ded3be] dark:border-amber-900/50 transition cursor-pointer items-center justify-center shrink-0"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Close sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-stone-600 dark:text-stone-300" />
          )}
        </button>

        {/* Branch Selector */}
        <div className="flex items-center gap-1 sm:gap-2 bg-[#f6f0e4] dark:bg-[#251b14] rounded-xl p-1.5 px-2 sm:px-3 border border-[#ded3be] dark:border-amber-900/40 min-w-0">
          <Building2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-amber-700 dark:text-amber-400 shrink-0" />
          <span className="hidden xs:inline text-xs font-bold text-amber-900/80 dark:text-amber-300/80 uppercase tracking-wider shrink-0">Branch:</span>

          {isAdmin ? (
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-[11px] sm:text-xs font-bold text-stone-800 dark:text-stone-100 focus:outline-none cursor-pointer truncate max-w-[110px] sm:max-w-none"
            >
              <option value="" className="dark:bg-[#1f1610] dark:text-stone-100">All Branches</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id} className="dark:bg-[#1f1610] dark:text-stone-100">
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[11px] sm:text-xs font-bold text-stone-800 dark:text-stone-100 truncate max-w-[110px] sm:max-w-none">
              {selectedBranch?.name || user?.branch?.name || 'Assigned Branch'}
            </span>
          )}
        </div>

        {/* Date Display */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-stone-600 dark:text-stone-300 bg-[#f9f5ed] dark:bg-[#201813] px-3 py-1.5 rounded-xl border border-[#e5dcce] dark:border-[#382d24]">
          <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>{todayStr}</span>
        </div>

        {/* Today's Working Route Quick Shortcut */}
        <Link
          to="/collections"
          className="hidden lg:flex items-center gap-2 text-xs font-black bg-[#251b14] text-amber-300 px-3.5 py-1.5 rounded-xl border border-amber-800/60 shadow-xs hover:bg-[#34271e] transition cursor-pointer"
          title="Open Today's Collection Register"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-amber-400/80 uppercase tracking-wider font-bold">Today Working:</span>
          <span>{todayWeekday} ROUTE</span>
        </Link>
      </div>

      {/* Right User Bar */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Dark Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          aria-label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="p-2 rounded-xl bg-[#f6f0e4] hover:bg-[#ebdcc4] dark:bg-[#251b14] dark:hover:bg-[#34271e] text-stone-700 dark:text-amber-300 border border-[#ded3be] dark:border-amber-800/60 shadow-xs transition cursor-pointer flex items-center justify-center shrink-0"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
          ) : (
            <Moon className="w-4 h-4 text-stone-700 hover:text-amber-900" />
          )}
        </button>

        {/* Log Out Button (Left of user name / between theme changer and user) */}
        <button
          type="button"
          onClick={logout}
          title="Log Out"
          className="p-2 rounded-xl bg-[#f6f0e4] hover:bg-rose-500/10 hover:text-rose-600 dark:bg-[#251b14] dark:hover:bg-rose-500/15 text-stone-600 dark:text-stone-300 border border-[#ded3be] dark:border-amber-900/50 shadow-xs transition cursor-pointer flex items-center justify-center shrink-0"
          aria-label="Log Out"
        >
          <LogOut className="w-4 h-4 text-stone-600 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400" />
        </button>

        {/* User Info (Name, Role, Avatar) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-stone-900 dark:text-stone-100">{user?.name}</p>
            <div className="flex items-center gap-1.5 justify-end">
              <ShieldCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span className="text-[11px] text-amber-800/80 dark:text-amber-300 font-semibold">
                {user?.role === 'MAIN_ADMIN' ? 'Main Administrator' : user?.role === 'BRANCH_MANAGER' ? 'Branch Manager' : 'Collection Staff'}
              </span>
            </div>
          </div>
          <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-500 flex items-center justify-center text-stone-950 text-xs sm:text-sm font-black shadow-sm border border-amber-400/40 shrink-0">
            {user?.name?.charAt(0) || <UserIcon className="w-4 h-4" />}
          </div>
        </div>
      </div>
    </header>
  );
};
