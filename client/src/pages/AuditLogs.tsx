import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Search, Clock, User, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

export const AuditLogs: React.FC = () => {
  const [entityType, setEntityType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs', entityType],
    queryFn: () => api.getAuditLogs({ entityType: entityType || undefined })
  });

  const logs = data?.logs || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">System Audit Trail & Security Logs</h2>
        <p className="text-xs text-slate-500">
          Non-repudiation audit logging: monitor administrative actions, loan approvals, receipt reversals, and migration events
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand-500"
        >
          <option value="">All Audit Categories</option>
          <option value="MIGRATION">Excel Migration Events</option>
          <option value="LOAN">Loan Approvals & Changes</option>
          <option value="PAYMENT">Collections & Reversals</option>
          <option value="USER">User Account Changes</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400 font-sans">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log: any) => (
                  <tr key={log._id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-bold font-sans">
                      {log.userName || log.userId?.name || 'System'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans font-medium text-slate-700">{log.entityType}</td>
                    <td className="px-4 py-3 text-slate-500 text-[11px] max-w-md truncate">
                      {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400 font-sans">
                    No audit events recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
