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
    brand: 'bg-amber-50 text-amber-800 border-amber-200/80 shadow-xs shadow-amber-600/10',
    blue: 'bg-orange-50 text-orange-800 border-orange-200/80',
    amber: 'bg-yellow-50 text-yellow-800 border-yellow-200/80',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    rose: 'bg-rose-50 text-rose-800 border-rose-200/80',
    slate: 'bg-stone-100 text-stone-700 border-stone-200'
  };

  return (
    <div className="bg-[#fffdfa] p-5 rounded-2xl border border-[#eae0d0] shadow-xs hover:border-amber-400 hover:shadow-md hover:shadow-amber-950/5 transition">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">{title}</p>
          <p className="text-2xl font-black text-stone-900 tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-stone-500 mt-1 font-medium">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl border ${colorStyles[color]}`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-3 pt-3 border-t border-[#f4ede1] flex items-center text-xs text-stone-500 font-medium">
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
};
