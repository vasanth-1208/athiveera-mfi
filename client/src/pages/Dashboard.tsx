import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  FolderTree, 
  HandCoins, 
  Wallet, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  CheckCircle2,
  Coins,
  ArrowUpRight,
  Calendar,
  ArrowRight
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { api } from '../services/api';
import { useBranch } from '../context/BranchContext';
import { StatCard } from '../components/StatCard';
import { Link } from 'react-router-dom';

const COLORS = ['#d97706', '#ea580c', '#ca8a04', '#9a3412', '#78350f'];

export const Dashboard: React.FC = () => {
  const { selectedBranchId, selectedBranch } = useBranch();

  const { data: metricsData, isLoading: loadingMetrics } = useQuery({
    queryKey: ['dashboardMetrics', selectedBranchId],
    queryFn: () => api.getDashboardMetrics({ branchId: selectedBranchId }),
    refetchInterval: 30000
  });

  const { data: chartsData, isLoading: loadingCharts } = useQuery({
    queryKey: ['dashboardCharts', selectedBranchId],
    queryFn: () => api.getDashboardCharts({ branchId: selectedBranchId }),
    refetchInterval: 30000
  });

  const metrics = metricsData?.metrics;
  const charts = chartsData?.charts;

  if (loadingMetrics || loadingCharts) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-amber-900 font-semibold">Loading executive financial dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight">Executive Financial Dashboard</h2>
          <p className="text-xs text-stone-500 font-medium">
            Real-time portfolio metrics, collections, vault balances, and risk monitoring for{' '}
            <span className="font-bold text-amber-900">{selectedBranch?.name || 'All Branches'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/collections"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-stone-950 font-bold rounded-xl text-xs shadow-md shadow-amber-900/20 transition cursor-pointer"
          >
            <Coins className="w-4 h-4" />
            <span>Daily Collections</span>
          </Link>
          <Link
            to="/loans"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-[#251b14] hover:bg-[#34271e] text-amber-200 border border-amber-800/40 rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <HandCoins className="w-4 h-4 text-amber-400" />
            <span>New Loan Application</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Loan Amount Given"
          value={`₹${(metrics?.totalLoanAmountGiven || 0).toLocaleString('en-IN')}`}
          icon={<HandCoins className="w-5 h-5" />}
          color="brand"
        />
        <StatCard
          title="Total Collected Amount"
          value={`₹${(metrics?.totalCollectedAmount || 0).toLocaleString('en-IN')}`}
          icon={<Coins className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          title="Total Balance Collection"
          value={`₹${(metrics?.totalRepaymentOutstanding || 0).toLocaleString('en-IN')}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="rose"
        />
        <StatCard
          title="Principal Outstanding"
          value={`₹${(metrics?.totalPrincipalOutstanding || 0).toLocaleString('en-IN')}`}
          icon={<Wallet className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Active Portfolio"
          value={`${metrics?.activeLoans || 0} Loans`}
          icon={<Users className="w-5 h-5" />}
          color="slate"
        />
      </div>

      {/* Secondary Operational Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Today's Collections"
          value={`₹${(metrics?.todayActual || 0).toLocaleString('en-IN')}`}
          subtitle={`Expected: ₹${(metrics?.todayExpected || 0).toLocaleString('en-IN')}`}
          icon={<Coins className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          title="Today's Shortfall"
          value={`₹${(metrics?.todayShortfall || 0).toLocaleString('en-IN')}`}
          subtitle="Uncollected today"
          icon={<AlertTriangle className="w-5 h-5" />}
          color={metrics?.todayShortfall > 0 ? 'rose' : 'emerald'}
        />
        <StatCard
          title="Total Overdue"
          value={`₹${(metrics?.totalOverdue || 0).toLocaleString('en-IN')}`}
          subtitle="Pending follow-ups"
          icon={<Clock className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          title="Branch Cash Balance"
          value={`₹${(metrics?.totalCashBalance || 0).toLocaleString('en-IN')}`}
          icon={<Wallet className="w-5 h-5" />}
          color="blue"
        />
      </div>

      {/* Today's Working Operations Card */}
      <div className="bg-[#f6f0e4] border border-[#ded3be] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#251b14] text-amber-300 flex items-center justify-center font-black shrink-0 border border-amber-800/60 shadow-xs">
            <Calendar className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm font-black text-stone-900 uppercase tracking-wide">
                Today's Working Route: {['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date().getDay()]}
              </h3>
            </div>
            <p className="text-xs text-stone-600 font-medium mt-0.5">
              Active field collection register, installment collections, and route sheet for today ({new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            to="/collections"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#251b14] text-amber-300 hover:bg-[#34271e] font-black rounded-xl text-xs border border-amber-800/60 shadow-xs transition cursor-pointer"
          >
            <span>Open Today's Route Register</span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
          </Link>
          <Link
            to="/groups"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-stone-800 hover:bg-[#faf6ee] font-bold rounded-xl text-xs border border-[#ded3be] shadow-2xs transition cursor-pointer"
          >
            <span>Today's Groups</span>
          </Link>
        </div>
      </div>

      {/* Bottom Operational Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Overdue Follow-ups */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-800">Priority Overdue Follow-ups</h3>
            </div>
            <Link to="/pending" className="text-xs font-semibold text-brand-600 hover:underline">
              View All ({metrics?.totalOverdue ? 'Overdue' : '0'})
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Group</th>
                  <th className="px-4 py-2.5">Overdue</th>
                  <th className="px-4 py-2.5">Collector</th>
                  <th className="px-4 py-2.5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {charts?.priorityFollowups?.length > 0 ? (
                  charts.priorityFollowups.map((f: any) => (
                    <tr key={f._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {f.customerName}
                        <p className="text-[10px] text-slate-400 font-mono">{f.customerPhone}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {f.groupName}
                        <span className="block text-[10px] text-slate-400">{f.collectionDay}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-rose-600">
                        ₹{f.actualPending?.toLocaleString('en-IN')}
                        <span className="block text-[10px] font-normal text-slate-500">
                          {f.overdueWeeks} {f.overdueWeeks === 1 ? 'week' : 'weeks'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{f.staffName || 'Staff'}</td>
                      <td className="px-4 py-3 text-slate-500 italic max-w-xs truncate">{f.remarks || 'No notes'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400">
                      No overdue collections pending
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Collections */}
        <div className="bg-[#fffdfa] rounded-2xl border border-[#ded3be] shadow-xs overflow-hidden">
          <div className="p-4 bg-[#f6f0e4] border-b border-[#ded3be] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HandCoins className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-black text-stone-900">Recent Collections</h3>
            </div>
            <Link to="/collections" className="text-xs font-bold text-amber-800 hover:text-amber-950 hover:underline">
              View Register
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fbf7f0] text-amber-950 font-bold uppercase tracking-wider border-b border-[#ded3be]">
                <tr>
                  <th className="px-4 py-2.5">Customer / Group</th>
                  <th className="px-4 py-2.5">Amount Collected</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Method</th>
                  <th className="px-4 py-2.5 text-right">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece3d4]">
                {charts?.recentPayments?.length > 0 ? (
                  charts.recentPayments.map((p: any) => {
                    const instNum = p.allocations?.[0]?.installmentNumber;
                    return (
                      <tr key={p._id} className="hover:bg-[#fbf7f0] transition">
                        <td className="px-4 py-3 text-stone-900 font-bold">
                          {p.customerId?.name}
                          <span className="block text-[10px] text-amber-800 font-semibold">{p.groupId?.name}</span>
                        </td>
                        <td className="px-4 py-3 font-black text-emerald-800 text-sm">
                          ₹{p.amount?.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{instNum ? `Week ${instNum} Paid` : 'Paid'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-[#f6f0e4] border border-[#ded3be] text-stone-800 text-[10px] font-mono font-bold uppercase">
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-stone-500 font-medium">
                          {new Date(p.createdAt || p.paymentDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-stone-400 font-medium">
                      No recent collection transactions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
