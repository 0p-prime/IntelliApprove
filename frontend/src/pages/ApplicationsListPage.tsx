import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  Building2,
  Calendar,
  ShieldAlert
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { Application } from '../types';
import { StatusPill } from '../components/StatusPill';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { useAuth } from '../context/AuthContext';

export const ApplicationsListPage: React.FC = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [escalatedOnly, setEscalatedOnly] = useState<boolean>(false);

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = '';
      const params = new URLSearchParams();
      if (selectedStatus !== 'ALL') {
        params.append('status', selectedStatus);
      }
      if (escalatedOnly) {
        params.append('escalated_only', 'true');
      }
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      const qStr = params.toString();
      query = qStr ? `?${qStr}` : '';

      const res = await apiRequest<Application[]>(`/applications${query}`);
      setApplications(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [selectedStatus, escalatedOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchApplications();
  };

  const statusTabs = [
    { key: 'ALL', label: 'All Applications' },
    { key: 'UNDER_SCRUTINY', label: 'Under Scrutiny' },
    { key: 'EVC_SCHEDULED', label: 'EVC Inspection' },
    { key: 'PENDING_AUTHORITY_DECISION', label: 'Authority Decision Panel' },
    { key: 'APPROVED', label: 'Approved (EoA)' },
    { key: 'REJECTED', label: 'Rejected' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Institutional Applications</h2>
          <p className="text-xs text-slate-500 mt-1">
            Browse AICTE approval requests, monitor SLA countdowns, and verify compliance audits.
          </p>
        </div>
        {(user?.role === 'INSTITUTION' || user?.role === 'ADMIN') && (
          <Link
            to="/applications/new"
            className="px-4 py-2 bg-[#0B2240] hover:bg-[#07172C] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-2 self-start sm:self-auto transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-amber-400" />
            New Approval Application
          </Link>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedStatus(tab.key)}
            className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              selectedStatus === tab.key
                ? 'border-[#0B2240] text-[#0B2240] font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => setEscalatedOnly(!escalatedOnly)}
          className={`ml-auto px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
            escalatedOnly
              ? 'bg-red-600 text-white border-red-700 shadow-xs'
              : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {escalatedOnly ? 'Showing SLA Escalated Only' : 'Filter SLA Escalated'}
        </button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Application No, Institute Name, or AICTE ID (e.g. 1-1029384751)..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-[#0B2240]/20 focus:border-[#0B2240]"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-[#0B2240] text-white text-xs font-medium rounded-lg hover:bg-[#07172C] transition-colors cursor-pointer"
        >
          Search
        </button>
      </form>

      {/* Applications Table */}
      {loading ? (
        <LoadingState message="Loading applications..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchApplications} />
      ) : applications.length === 0 ? (
        <EmptyState
          title="No applications match criteria"
          description="Try clearing search filters or checking another status tab."
          action={{ label: 'Reset Filters', onClick: () => { setSelectedStatus('ALL'); setEscalatedOnly(false); setSearchTerm(''); } }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Application ID</th>
                  <th className="py-3 px-4">Institution & Region</th>
                  <th className="py-3 px-4">Approval Type</th>
                  <th className="py-3 px-4">Current Stage & Status</th>
                  <th className="py-3 px-4">Compliance Score</th>
                  <th className="py-3 px-4">SLA Deadline</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      <Link to={`/applications/${app.id}`} className="hover:underline text-[#0B2240]">
                        {app.application_number}
                      </Link>
                      <div className="text-[10px] font-sans text-slate-400 font-normal">
                        AY {app.academic_year}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {app.institution?.name || `Institution #${app.institution_id}`}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {app.institution?.state} • {app.institution?.region} Directorate (AICTE ID: {app.institution?.aicte_id})
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700">
                      <span className="font-medium">{app.application_type}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <StatusPill status={app.status} isEscalated={app.is_escalated} />
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              app.compliance_score >= 90
                                ? 'bg-emerald-500'
                                : app.compliance_score >= 75
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${app.compliance_score}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-800">{app.compliance_score}%</span>
                      </div>
                      {app.deficiency_count > 0 && (
                        <span className="text-[10px] text-red-600 font-medium">
                          {app.deficiency_count} deficiency flagged
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {app.sla_deadline ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Clock className={`w-3.5 h-3.5 ${app.is_escalated ? 'text-red-600' : 'text-slate-400'}`} />
                          <span className={app.is_escalated ? 'text-red-700 font-bold' : ''}>
                            {new Date(app.sla_deadline).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">N/A (Closed)</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/applications/${app.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-[#0B2240] hover:text-white rounded text-slate-700 text-xs font-semibold transition-colors"
                      >
                        Inspect Portal
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
