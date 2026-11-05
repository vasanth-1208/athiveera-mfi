import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Coins,
  HandCoins,
  Users,
  Menu,
  FolderTree,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';

export const MobileBottomNav: React.FC = () => {
  const { user } = useAuth();
  const { toggleMobile } = useSidebar();
  const location = useLocation();

  const isStaff = user?.role === 'COLLECTION_STAFF';

  const baseTabClass =
    'flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl text-[10px] font-bold transition select-none cursor-pointer';

  const getTabClass = (path: string) => {
    const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
    return `${baseTabClass} ${
      isActive
        ? 'text-amber-500 dark:text-amber-400 bg-amber-500/10'
        : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
    }`;
  };

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#fffdfa]/95 dark:bg-[#18120e]/95 backdrop-blur-md border-t border-[#ece3d4] dark:border-[#382d24] px-2 py-1 flex items-center justify-around shadow-lg no-print pb-safe"
    >
      {isStaff ? (
        <>
          <NavLink to="/collections" className={getTabClass('/collections')}>
            <Coins className="w-5 h-5 mb-0.5 shrink-0" />
            <span>Collections</span>
          </NavLink>
          <NavLink to="/groups" className={getTabClass('/groups')}>
            <FolderTree className="w-5 h-5 mb-0.5 shrink-0" />
            <span>Routes</span>
          </NavLink>
          <NavLink to="/pending" className={getTabClass('/pending')}>
            <AlertCircle className="w-5 h-5 mb-0.5 shrink-0" />
            <span>Overdue</span>
          </NavLink>
          <NavLink to="/loans" className={getTabClass('/loans')}>
            <HandCoins className="w-5 h-5 mb-0.5 shrink-0" />
            <span>Loans</span>
          </NavLink>
          <button
            type="button"
            onClick={toggleMobile}
            className={`${baseTabClass} text-stone-500 dark:text-stone-400 hover:text-amber-600`}
            title="Open Menu"
          >
            <Menu className="w-5 h-5 mb-0.5 shrink-0" />
            <span>More</span>
          </button>
        </>
      ) : (
        <>
          <NavLink to="/" className={getTabClass('/')}>
            <LayoutDashboard className="w-5 h-5 mb-0.5 shrink-0" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/collections" className={getTabClass('/collections')}>
            <Coins className="w-5 h-5 mb-0.5 shrink-0" />
            <span>Collections</span>
          </NavLink>
          <NavLink to="/loans" className={getTabClass('/loans')}>
            <HandCoins className="w-5 h-5 mb-0.5 shrink-0" />
            <span>Loans</span>
          </NavLink>
          <NavLink to="/customers" className={getTabClass('/customers')}>
            <Users className="w-5 h-5 mb-0.5 shrink-0" />
            <span>Borrowers</span>
          </NavLink>
          <button
            type="button"
            onClick={toggleMobile}
            className={`${baseTabClass} text-stone-500 dark:text-stone-400 hover:text-amber-600`}
            title="Open Menu"
          >
            <Menu className="w-5 h-5 mb-0.5 shrink-0" />
            <span>Menu</span>
          </button>
        </>
      )}
    </nav>
  );
};

