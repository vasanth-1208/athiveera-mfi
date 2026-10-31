import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  HandCoins, 
  Wallet, 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  Coins,
  Receipt,
  FileText,
  Landmark,
  AlertCircle,
  PiggyBank
} from 'lucide-react';
import { api } from '../services/api';
import { useBranch } from '../context/BranchContext';
import { StatCard } from '../components/StatCard';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { selectedBranchId, selectedBranch } = useBranch();

  const { data: metricsData, isLoading: loadingMetrics } = useQuery({
    queryKey: ['dashboardMetrics', selectedBranchId],
    queryFn: () => api.getDashboardMetrics({ branchId: selectedBranchId }),
    refetchInterval: 30000
  });

  const metrics = metricsData?.metrics;

  if (loadingMetrics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-amber-900 font-semibold">Loading executive financial dashboard...</p>
        </div>
      </div>
    );
  }

  const totalLoanAmountGiven = metrics?.totalLoanAmountGiven || 0;
  const totalMembersGiven = metrics?.totalMembersGiven || 0;
  const totalDocCharges = metrics?.totalDocCharges || 0;
  const totalInterest = metrics?.totalInterest || 0;

  // Dynamic formula: Closed loans minus savings, live loans with savings until closed
  const totalCollectedAmount = metrics?.totalCollectedAmount || 0;
  const totalBalanceCollection = metrics?.totalBalanceCollection || 0;

  const totalCashBalance = metrics?.totalCashBalance || 0;
  const totalOutstanding = metrics?.totalOutstanding ?? (totalCashBalance + totalBalanceCollection);

  const activeLoans = metrics?.activeLoans || 0;
  const todayActual = metrics?.todayActual || 0;
  const todayExpected = metrics?.todayExpected || 0;
  const todayShortfall = metrics?.todayShortfall || 0;
  const totalOverdue = metrics?.totalOverdue || 0;

  return (
    <div className="space-y-6">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-stone-900 dark:text-white tracking-tight">Executive Financial Dashboard</h2>
          <p className="text-xs text-stone-500 dark:text-stone-300 font-medium">
            Real-time portfolio metrics, collections, vault balances, and risk monitoring for{' '}
            <span className="font-bold text-amber-900 dark:text-amber-400">{selectedBranch?.name || 'Pollachi Branch'}</span>
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

      {/* Row 1: Core Capital & Outstanding Metrics */}
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 mb-2.5 flex items-center gap-1.5">
          <HandCoins className="w-3.5 h-3.5 text-amber-600" />
          <span>Core Portfolio & Total Outstanding</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Loan Amount Given"
            value={`₹${totalLoanAmountGiven.toLocaleString('en-IN')}`}
            subtitle={`${totalMembersGiven} Members Disbursed`}
            icon={<HandCoins className="w-5 h-5" />}
            color="brand"
          />
          <StatCard
            title="Document Charges (All Loans)"
            value={`₹${totalDocCharges.toLocaleString('en-IN')}`}
            subtitle="Upfront Processing Fee Collected"
            icon={<FileText className="w-5 h-5" />}
            color="blue"
          />
          <StatCard
            title="Total Interest in All Loans"
            value={`₹${totalInterest.toLocaleString('en-IN')}`}
            subtitle="Contractual Portfolio Interest"
            icon={<TrendingUp className="w-5 h-5" />}
            color="emerald"
          />
          <StatCard
            title="Total Outstanding (O/S)"
            value={`₹${totalOutstanding.toLocaleString('en-IN')}`}
            subtitle={`Vault Cash ₹${totalCashBalance.toLocaleString('en-IN')} + Balance Collection`}
            icon={<Wallet className="w-5 h-5" />}
            color="brand"
          />
        </div>
      </div>

      {/* Row 2: Collections, Balance & Branch Vault Cash */}
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 mb-2.5 flex items-center gap-1.5">
          <PiggyBank className="w-3.5 h-3.5 text-emerald-600" />
          <span>Collections, Balance & Branch Vault Cash</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Collected Amount"
            value={`₹${totalCollectedAmount.toLocaleString('en-IN')}`}
            subtitle="Closed: Minus Savings • Live: With Savings"
            icon={<Coins className="w-5 h-5" />}
            color="emerald"
          />
          <StatCard
            title="Total Balance Collection"
            value={`₹${totalBalanceCollection.toLocaleString('en-IN')}`}
            subtitle="Net Contract Balance Remaining"
            icon={<TrendingUp className="w-5 h-5" />}
            color="rose"
          />
          <StatCard
            title="Active Loans"
            value={`${activeLoans} Loans`}
            subtitle="Active Weekly Cycles"
            icon={<Users className="w-5 h-5" />}
            color="slate"
          />
          <StatCard
            title="Branch Cash Balance"
            value={`₹${totalCashBalance.toLocaleString('en-IN')}`}
            subtitle="Physical Vault Safe Balance"
            icon={<Landmark className="w-5 h-5" />}
            color="blue"
          />
        </div>
      </div>

      {/* Row 3: Daily Operations & Overdue Monitoring */}
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 mb-2.5 flex items-center gap-1.5">
          <Coins className="w-3.5 h-3.5 text-blue-600" />
          <span>Daily Operations & Overdue Monitoring</span>
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Today's Collections"
            value={`₹${todayActual.toLocaleString('en-IN')}`}
            subtitle={`Expected: ₹${todayExpected.toLocaleString('en-IN')}`}
            icon={<Coins className="w-5 h-5" />}
            color="emerald"
          />
          <StatCard
            title="Today's Shortfall"
            value={`₹${todayShortfall.toLocaleString('en-IN')}`}
            subtitle="Uncollected today"
            icon={<AlertTriangle className="w-5 h-5" />}
            color={todayShortfall > 0 ? 'rose' : 'emerald'}
          />
          <StatCard
            title="Total Overdue"
            value={`₹${totalOverdue.toLocaleString('en-IN')}`}
            subtitle="Pending follow-ups"
            icon={<AlertCircle className="w-5 h-5" />}
            color="amber"
          />
        </div>
      </div>
    </div>
  );
};
