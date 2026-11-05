import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { MobileBottomNav } from './MobileBottomNav';

export const Layout: React.FC = () => {
  return (
    <div className="flex h-screen bg-[#fbf9f5] dark:bg-[#120e0b] text-stone-900 dark:text-stone-100 overflow-hidden font-sans transition-colors duration-200">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 pb-20 md:pb-6">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
            <Outlet />
          </div>
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
};
