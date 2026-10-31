import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  color?: 'brand' | 'blue' | 'amber' | 'emerald' | 'rose' | 'slate';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'brand'
}) => {
  const colorStyles = {
    brand: 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 shadow-xs shadow-amber-600/10',
    blue: 'bg-orange-50 text-orange-800 border-orange-200/80 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60',
    amber: 'bg-yellow-50 text-yellow-800 border-yellow-200/80 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800/60',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    rose: 'bg-rose-50 text-rose-800 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
    slate: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-[#2c1c12] dark:text-stone-300 dark:border-[#442a1b]'
  };

  return (
    <div className="bg-[#fffdfa] dark:bg-[#23160e] p-5 rounded-2xl border border-[#eae0d0] dark:border-[#442a1b] shadow-xs hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-300 mb-1">{title}</p>
          <p className="text-2xl font-black text-stone-900 dark:text-white tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 font-medium">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl border ${colorStyles[color]}`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-3 pt-3 border-t border-[#f4ede1] dark:border-[#442a1b] flex items-center text-xs text-stone-500 dark:text-stone-400 font-medium">
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
};
