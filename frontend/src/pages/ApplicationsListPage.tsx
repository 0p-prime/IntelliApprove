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
  ShieldAlert,
  MapPin,
  Layers,
  X,
  SlidersHorizontal
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

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedStage, setSelectedStage] = useState<string>('ALL');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedAge, setSelectedAge] = useState<string>('ALL');
  const [institutionQuery, setInstitutionQuery] = useState<string>('');
  const [escalatedOnly, setEscalatedOnly] = useState<boolean>(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedStatus !== 'ALL') {
        params.append('status', selectedStatus);
      }
      if (selectedStage !== 'ALL') {
        params.append('stage', selectedStage);
      }
      if (selectedRegion !== 'ALL') {
        params.append('region', selectedRegion);
      }
      if (institutionQuery.trim()) {
        params.append('institution', institutionQuery.trim());
      }
      if (escalatedOnly) {
        params.append('escalated_only', 'true');
      }
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      // Age calculation
      if (selectedAge === 'UNDER_7') {
        params.append('max_age', '7');
      } else if (selectedAge === '7_TO_14') {
        params.append('min_age', '7');
        params.append('max_age', '14');
      } else if (selectedAge === '15_TO_30') {
        params.append('min_age', '15');
        params.append('max_age', '30');
      } else if (selectedAge === 'OVER_30') {
        params.append('min_age', '30');
      }

      const qStr = params.toString();
      const query = qStr ? `?${qStr}` : '';

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
  }, [selectedStatus, selectedStage, selectedRegion, selectedAge, escalatedOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchApplications();
  };

  const handleResetFilters = () => {
    setSelectedStatus('ALL');
    setSelectedStage('ALL');
    setSelectedRegion('ALL');
    setSelectedAge('ALL');
    setInstitutionQuery('');
    setSearchTerm('');
    setEscalatedOnly(false);
  };

  const aicteRegions = [
    'Northern',
    'Southern',
    'Western',
    'Eastern',
    'Central',
    'South-Western',
    'North-Western',
    'South-Central'
  ];

  const stages = [
    { key: 'SUBMITTED', label: '1. Submitted' },
    { key: 'SCRUTINY', label: '2. Scrutiny' },
    { key: 'EVC', label: '3. EVC Inspection' },
    { key: 'SAC_SHC', label: '4. SAC / SHC Appellate' },
    { key: 'BUREAU_DECISION', label: '5. Bureau Decision' },
    { key: 'APPROVED', label: '6. Approved (EoA)' },
    { key: 'REJECTED', label: '7. Rejected' }
  ];

  const hasActiveFilters =
    selectedStatus !== 'ALL' ||
    selectedStage !== 'ALL' ||
    selectedRegion !== 'ALL' ||
    selectedAge !== 'ALL' ||
    institutionQuery.trim() !== '' ||
    searchTerm.trim() !== '' ||
    escalatedOnly;

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Institutional Applications</h2>
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold border border-slate-200">
              {applications.length} Records
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            AICTE multi-stage approval queue, automated route tracking, and compliance governance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
              showAdvancedFilters || hasActiveFilters
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
          {(user?.role === 'INSTITUTION' || user?.role === 'ADMIN') && (
            <Link
              to="/applications/new"
              className="px-3.5 py-1.5 bg-[#0B2240] hover:bg-[#12335C] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-amber-400" />
              New Application
            </Link>
          )}
        </div>
      </div>

      {/* Main Search & Quick Status Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search application ref no (e.g. AICTE/2026-27/RO-SO-0001) or institution name..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#0B2240] transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-[#0B2240] hover:bg-[#12335C] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Search
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              title="Reset all filters"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </form>

        {/* Multi-attribute Filter Grid (Region, Stage, Status, Age, Institution) */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 animate-in fade-in duration-150">
            {/* Region Filter */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                AICTE Region
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0B2240]"
              >
                <option value="ALL">All Regions (Nationwide)</option>
                {aicteRegions.map((r) => (
                  <option key={r} value={r}>
                    {r} Region
                  </option>
                ))}
              </select>
            </div>

            {/* Stage Filter */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-400" />
                Workflow Stage
              </label>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0B2240]"
              >
                <option value="ALL">All Route Stages</option>
                {stages.map((st) => (
                  <option key={st.key} value={st.key}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" />
                Current Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0B2240]"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="UNDER_SCRUTINY">UNDER_SCRUTINY</option>
                <option value="UNDER_EVC">UNDER_EVC</option>
                <option value="UNDER_SAC_SHC">UNDER_SAC_SHC</option>
                <option value="PENDING_DECISION">PENDING_DECISION</option>
                <option value="RETURNED">RETURNED</option>
                <option value="APPROVED">APPROVED (EoA)</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>

            {/* Age Filter */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Application Age
              </label>
              <select
                value={selectedAge}
                onChange={(e) => setSelectedAge(e.target.value)}
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0B2240]"
              >
                <option value="ALL">All Durations</option>
                <option value="UNDER_7">&lt; 7 Days Old</option>
                <option value="7_TO_14">7 to 14 Days Old</option>
                <option value="15_TO_30">15 to 30 Days Old</option>
                <option value="OVER_30">&gt; 30 Days Old</option>
              </select>
            </div>

            {/* Institution Search Filter */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-400" />
                Institution Name
              </label>
              <input
                type="text"
                value={institutionQuery}
                onChange={(e) => setInstitutionQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchApplications(); }}
                placeholder="Filter institution..."
                className="w-full py-1.5 px-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0B2240]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Applications Table */}
      {loading ? (
        <LoadingState message="Loading applications under your jurisdiction..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchApplications} />
      ) : applications.length === 0 ? (
        <EmptyState
          title="No applications match criteria"
          description="Try resetting search filters or selecting nationwide jurisdiction."
          action={{ label: 'Reset All Filters', onClick: handleResetFilters }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Ref Number</th>
                  <th className="py-3 px-4">Institution & Region</th>
                  <th className="py-3 px-4">Approval Type</th>
                  <th className="py-3 px-4">Stage & Status</th>
                  <th className="py-3 px-4">Risk Profile</th>
                  <th className="py-3 px-4">SLA Due Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      <Link to={`/applications/${app.id}`} className="hover:underline text-[#0B2240]">
                        {app.ref_no || app.application_number}
                      </Link>
                      <div className="text-[10px] font-sans text-slate-400 font-normal">
                        Entered: {new Date(app.stage_entered_at).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {app.institution?.name || `Institution #${app.institution_id}`}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {app.institution?.state} • {app.institution?.region} Region
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700">
                      <span className="font-medium">{app.application_type}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {app.current_stage?.name || app.current_stage || 'SUBMITTED'}
                        </span>
                        <StatusPill status={app.status} isEscalated={app.is_escalated} />
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (app.risk_score || 0) < 0.3
                                ? 'bg-emerald-500'
                                : (app.risk_score || 0) < 0.6
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(10, ((app.risk_score || 0) * 100)))}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-800">
                          {((app.risk_score || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {app.due_date || app.sla_deadline ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Clock className={`w-3.5 h-3.5 ${app.is_escalated ? 'text-red-600' : 'text-slate-400'}`} />
                          <span className={app.is_escalated ? 'text-red-700 font-bold' : ''}>
                            {new Date(app.due_date || app.sla_deadline!).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/applications/${app.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-[#0B2240] hover:text-white rounded text-slate-700 text-xs font-semibold transition-colors"
                      >
                        Inspect Route
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
