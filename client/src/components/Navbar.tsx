import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Calendar, ShieldCheck, User as UserIcon, Coins, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranch } from '../context/BranchContext';
import { useSidebar } from '../context/SidebarContext';

export const Navbar: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { branches, selectedBranchId, setSelectedBranchId, selectedBranch } = useBranch();
  const { isCollapsed, toggleSidebar } = useSidebar();

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const todayWeekday = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date().getDay()];

  return (
    <header className="h-16 bg-[#fffdfa] border-b border-[#ece3d4] px-6 flex items-center justify-between no-print z-10 sticky top-0 shadow-xs">
      <div className="flex items-center gap-3">
        {/* Sidebar Toggle Button */}
        <button
          type="button"
          onClick={toggleSidebar}
          title={isCollapsed ? 'Expand sidebar' : 'Close / Collapse sidebar'}
          className="p-2 rounded-xl bg-[#f6f0e4] hover:bg-[#ebdcc4] text-stone-700 hover:text-amber-900 border border-[#ded3be] transition cursor-pointer flex items-center justify-center shrink-0"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Close sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-amber-700" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-stone-600" />
          )}
        </button>

        {/* Branch Selector */}
        <div className="flex items-center gap-2 bg-[#f6f0e4] rounded-xl p-1.5 px-3 border border-[#ded3be]">
          <Building2 className="w-4 h-4 text-amber-700" />
          <span className="text-xs font-bold text-amber-900/80 uppercase tracking-wider">Branch:</span>

          {isAdmin ? (
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-xs font-bold text-stone-800 focus:outline-none cursor-pointer"
            >
              <option value="">All Branches (Consolidated)</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-bold text-stone-800">
              {selectedBranch?.name || user?.branch?.name || 'Assigned Branch'}
            </span>
          )}
        </div>

        {/* Date Display */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-stone-600 bg-[#f9f5ed] px-3 py-1.5 rounded-xl border border-[#e5dcce]">
          <Calendar className="w-3.5 h-3.5 text-amber-600" />
          <span>{todayStr}</span>
        </div>

        {/* Today's Working Route Quick Shortcut */}
        <Link
          to="/collections"
          className="hidden md:flex items-center gap-2 text-xs font-black bg-[#251b14] text-amber-300 px-3.5 py-1.5 rounded-xl border border-amber-800/60 shadow-xs hover:bg-[#34271e] transition cursor-pointer"
          title="Open Today's Collection Register"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-amber-400/80 uppercase tracking-wider font-bold">Today Working:</span>
          <span>{todayWeekday} ROUTE</span>
        </Link>
      </div>

      {/* Right User Bar */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-stone-900">{user?.name}</p>
            <div className="flex items-center gap-1.5 justify-end">
              <ShieldCheck className="w-3 h-3 text-amber-600" />
              <span className="text-[11px] text-amber-800/80 font-semibold">
                {user?.role === 'MAIN_ADMIN' ? 'Main Administrator' : user?.role === 'BRANCH_MANAGER' ? 'Branch Manager' : 'Collection Staff'}
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-500 flex items-center justify-center text-stone-950 text-sm font-black shadow-sm border border-amber-400/40">
            {user?.name?.charAt(0) || <UserIcon className="w-4 h-4" />}
          </div>
        </div>
      </div>
    </header>
  );
};
