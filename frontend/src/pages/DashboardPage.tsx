import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  Flame,
  CheckSquare,
  Users,
  RefreshCw,
  Pause,
  Play,
  RotateCcw,
  Calendar,
  Award,
  FileCheck2,
  MapPin,
  ChevronRight,
  Briefcase,
  AlertCircle,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';
import { apiRequest } from '../api/client';
import {
  DashboardSummaryData,
  StageFunnelItem,
  AgeingItem,
  RegionPerformanceItem,
  OfficerWorkloadItem,
  BottleneckItem,
  UpcomingDeadlineItem
} from '../types';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { ErrorState } from '../components/States';
import { HumanOversightBadge } from '../components/HumanOversightBadge';
import { useAuth } from '../context/AuthContext';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [summaryData, setSummaryData] = useState<DashboardSummaryData | null>(null);
  const [funnelData, setFunnelData] = useState<StageFunnelItem[]>([]);
  const [ageingData, setAgeingData] = useState<AgeingItem[]>([]);
  const [regionData, setRegionData] = useState<RegionPerformanceItem[]>([]);
  const [workloadData, setWorkloadData] = useState<OfficerWorkloadItem[]>([]);
  const [bottleneckData, setBottleneckData] = useState<BottleneckItem[]>([]);
  const [deadlinesData, setDeadlinesData] = useState<UpcomingDeadlineItem[]>([]);

  // State flags
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-refresh states
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(30);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Filters
  const [dateRange, setDateRange] = useState<string>('ALL');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('ALL');
  const [selectedStage, setSelectedStage] = useState<string>('ALL');

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedRegionId !== 'ALL') params.append('region_id', selectedRegionId);
      if (selectedStage !== 'ALL') params.append('stage', selectedStage);

      if (dateRange === '7D') {
        const d = new Date(Date.now() - 7 * 86400000);
        params.append('date_from', d.toISOString());
      } else if (dateRange === '30D') {
        const d = new Date(Date.now() - 30 * 86400000);
        params.append('date_from', d.toISOString());
      } else if (dateRange === 'AY') {
        params.append('date_from', '2026-04-01T00:00:00');
      }

      const qStr = params.toString() ? `?${params.toString()}` : '';

      const [
        summaryRes,
        funnelRes,
        ageingRes,
        regionRes,
        workloadRes,
        bottleneckRes,
        deadlinesRes
      ] = await Promise.all([
        apiRequest<DashboardSummaryData>(`/dashboard/summary${qStr}`),
        apiRequest<StageFunnelItem[]>(`/dashboard/stage-funnel${qStr}`),
        apiRequest<AgeingItem[]>(`/dashboard/ageing${qStr}`),
        apiRequest<RegionPerformanceItem[]>(`/dashboard/region-performance${qStr}`),
        apiRequest<OfficerWorkloadItem[]>(`/dashboard/officer-workload${qStr}`),
        apiRequest<BottleneckItem[]>(`/dashboard/bottlenecks${qStr}`),
        apiRequest<UpcomingDeadlineItem[]>(`/dashboard/upcoming-deadlines?days=14`)
      ]);

      setSummaryData(summaryRes);
      setFunnelData(funnelRes);
      setAgeingData(ageingRes);
      setRegionData(regionRes);
      setWorkloadData(workloadRes);
      setBottleneckData(bottleneckRes);
      setDeadlinesData(deadlinesRes);
      setLastUpdated(new Date());
      setCountdown(30);
    } catch (err: any) {
      setError(err.message || 'Failed to aggregate real-time metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, selectedRegionId, selectedStage]);

  // Initial fetch and on filter change
  useEffect(() => {
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  // 30-Second Auto-refresh Timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchDashboardData(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboardData]);

  if (loading && !summaryData) {
    return <DashboardSkeleton />;
  }

  if (error && !summaryData) {
    return <ErrorState message={error} onRetry={() => fetchDashboardData(false)} />;
  }

  const summary = summaryData?.summary || {
    total: 0,
    in_progress: 0,
    returned: 0,
    completed: 0,
    approved: 0,
    rejected: 0,
    overdue: 0,
    sla_breach_count: 0,
    approaching_deadline_count: 0,
    average_risk_score: 0,
    timestamp: new Date().toISOString()
  };

  const isNationalOfficer =
    user?.role === 'BUREAU_OFFICER' ||
    user?.role === 'ADMIN' ||
    user?.role === 'COMPETENT_AUTHORITY';

  const isRegionalOfficer =
    user?.role === 'REGIONAL_OFFICER' ||
    user?.role === 'REGIONAL_HEAD' ||
    user?.role === 'SCRUTINY_OFFICER';

  const isEvcMember =
    user?.role === 'EVC_MEMBER' ||
    user?.role === 'EVC_INSPECTOR';

  const isInstitution = user?.role === 'INSTITUTION';

  const roleContext = summaryData?.role_context || {};
  const hasActiveFilters = dateRange !== 'ALL' || selectedRegionId !== 'ALL' || selectedStage !== 'ALL';

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Live Status */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {isNationalOfficer && 'AICTE National Approval & Governance Intelligence'}
                {isRegionalOfficer && `AICTE Regional Operations — ${summaryData?.jurisdiction || 'Regional Directorate'}`}
                {isEvcMember && 'Expert Visit Committee (EVC) Inspection Portal'}
                {isInstitution && `Institutional Approval Portal — ${roleContext.institution_name || 'My Campus'}`}
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-[#0B2240] border border-blue-200">
                AY 2026-2027
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                Role: <strong>{user?.role}</strong>
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Real-time monitoring across 8 AICTE regions, APH compliance audits, stage dwell times, and statutory SLA escalation ladders.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {/* Live Auto-Refresh Telemetry */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${autoRefresh ? 'bg-emerald-400' : 'bg-slate-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${autoRefresh ? 'bg-emerald-600' : 'bg-slate-500'}`}></span>
              </span>
              <span className="text-slate-600 font-medium">
                {autoRefresh ? `Sync in ${countdown}s` : 'Paused'}
              </span>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                title={autoRefresh ? 'Pause auto-refresh' : 'Resume 30s auto-refresh'}
              >
                {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-600" />}
              </button>
              <button
                onClick={() => fetchDashboardData(true)}
                disabled={refreshing}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="Refresh telemetry now"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-900' : ''}`} />
              </button>
            </div>

            <HumanOversightBadge size="sm" showSubtitle={false} />
          </div>
        </div>

        {/* Filters Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-semibold flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" /> Filters:
            </span>

            {/* Date Range Selector */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-700"
            >
              <option value="ALL">All Time</option>
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
              <option value="AY">AY 2026-27 (Current)</option>
            </select>

            {/* Region Selector (National Only) */}
            {isNationalOfficer && (
              <select
                value={selectedRegionId}
                onChange={(e) => setSelectedRegionId(e.target.value)}
                className="p-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All 8 AICTE Regions</option>
                {regionData.map((r) => (
                  <option key={r.region_id} value={r.region_id}>
                    {r.region_name} Region
                  </option>
                ))}
              </select>
            )}

            {/* Stage Selector */}
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-700"
            >
              <option value="ALL">All Route Stages</option>
              <option value="SUBMITTED">1. Submission</option>
              <option value="SCRUTINY">2. Scrutiny</option>
              <option value="EVC">3. EVC Inspection</option>
              <option value="SAC_SHC">4. SAC / SHC Hearing</option>
              <option value="BUREAU_DECISION">5. Bureau Decision</option>
              <option value="APPROVED">Approved (EoA)</option>
              <option value="REJECTED">Refused / Rejected</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setDateRange('ALL');
                  setSelectedRegionId('ALL');
                  setSelectedStage('ALL');
                }}
                className="px-2 py-1 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded text-xs transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400">
            Last synced: {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* 2. Top KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* KPI 1: Total Applications */}
        <Link
          to="/applications"
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-[#0B2240] hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEvcMember ? 'Assigned Visits' : 'Total Applications'}
            </span>
            <FileText className="w-4 h-4 text-blue-900 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {isEvcMember ? (roleContext.assigned_visits || summary.total) : summary.total}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{isNationalOfficer ? 'Nationwide portfolio' : 'In your scope'}</span>
            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* KPI 2: In-Progress */}
        <Link
          to="/applications?status=IN_PROGRESS"
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-700 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">In-Progress</span>
            <Clock className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-blue-700 font-mono">{summary.in_progress}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Active Desk Review</span>
            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* KPI 3: Returned for Clarification */}
        <Link
          to="/applications?status=RETURNED"
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-amber-400 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Returned</span>
            <RotateCcw className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-amber-700 font-mono">{summary.returned}</div>
          <div className="text-[11px] text-amber-800 mt-1 flex items-center justify-between">
            <span>Deficiency Revert</span>
            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* KPI 4: Approvals Granted */}
        <Link
          to="/applications?status=APPROVED"
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Approved (EoA)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">{summary.approved}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>EoA Orders Granted</span>
            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* KPI 5: Red SLA Breach Counter (Prominent Requirement) */}
        <Link
          to="/applications?escalated_only=true"
          className="bg-rose-50/80 p-4 rounded-xl border-2 border-rose-300 shadow-2xs hover:border-rose-500 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-rose-800 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-900">SLA Breaches</span>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
            </span>
          </div>
          <div className="text-2xl font-black text-rose-700 group-hover:scale-105 transition-transform font-mono">
            {summary.sla_breach_count}
          </div>
          <div className="text-[11px] text-rose-700 mt-1 flex items-center justify-between font-semibold">
            <span>Escalation Ladder</span>
            <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>

        {/* KPI 6: Amber Approaching Deadline Counter (Prominent Requirement) */}
        <Link
          to="/applications?status=IN_PROGRESS"
          className="bg-amber-50/80 p-4 rounded-xl border-2 border-amber-300 shadow-2xs hover:border-amber-500 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-amber-900 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Due in ≤ 3 Days</span>
            <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-amber-900 group-hover:scale-105 transition-transform font-mono">
            {summary.approaching_deadline_count}
          </div>
          <div className="text-[11px] text-amber-800 mt-1 flex items-center justify-between font-semibold">
            <span>Urgent SLA Window</span>
            <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </div>
        </Link>
      </div>

      {/* 3. Role-Customized Visual Dashboard Body */}

      {/* =========================================================================
          VIEW A: BUREAU_OFFICER / ADMIN (NATIONAL VIEW)
         ========================================================================= */}
      {isNationalOfficer && (
        <div className="space-y-6">
          {/* Charts Row 1: Funnel & Ageing */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stage Funnel Chart */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Approval Stage Funnel & Pipeline</h3>
                  <p className="text-xs text-slate-500">Applications distributed across canonical workflow sequence</p>
                </div>
                <span className="text-[11px] text-blue-900 font-semibold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Click bar to filter
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <XAxis
                      dataKey="stage_name"
                      angle={-15}
                      textAnchor="end"
                      interval={0}
                      tick={{ fontSize: 10, fill: '#475569' }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload as StageFunnelItem;
                          return (
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-md text-xs space-y-1">
                              <div className="font-bold text-slate-900">{item.stage_name}</div>
                              <div className="text-slate-600">Active Cases: <strong className="text-blue-900">{item.count}</strong> ({item.percentage}%)</div>
                              <div className="text-slate-500 text-[10px]">Standard SLA: {item.sla_hours}h</div>
                              <div className="text-blue-600 font-semibold text-[10px] pt-1 border-t border-slate-100">Click to inspect stage list →</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      onClick={(entry: any) => navigate(`/applications?stage=${entry.stage}`)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {funnelData.map((entry, idx) => (
                        <Cell key={`funnel-${idx}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ageing Chart */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Application Ageing Distribution</h3>
                  <p className="text-xs text-slate-500">Standard audit brackets for pending active cases</p>
                </div>
                <span className="text-[11px] text-blue-900 font-semibold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Click bar to filter
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageingData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                    <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload as AgeingItem;
                          return (
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-md text-xs space-y-1">
                              <div className="font-bold text-slate-900">{item.bucket}</div>
                              <div className="text-slate-600">Active Cases: <strong>{item.count}</strong> ({item.percentage}%)</div>
                              <div className="text-rose-600 font-semibold">Overdue in bracket: <strong>{item.overdue_count}</strong></div>
                              <div className="text-blue-600 font-semibold text-[10px] pt-1 border-t border-slate-100">Click to filter applications by age →</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      onClick={(entry: any) => navigate(`/applications?age=${entry.range}`)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {ageingData.map((entry, idx) => (
                        <Cell key={`age-${idx}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2: Region Performance & Officer Workload */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Region Performance */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Regional Pendency & Processing Heatmap</h3>
                  <p className="text-xs text-slate-500">Active case volume and processing pace across 8 AICTE regions</p>
                </div>
                <span className="text-[11px] text-blue-900 font-semibold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Click bar to filter
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <XAxis
                      dataKey="region_name"
                      angle={-15}
                      textAnchor="end"
                      interval={0}
                      tick={{ fontSize: 10, fill: '#475569' }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload as RegionPerformanceItem;
                          return (
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-md text-xs space-y-1">
                              <div className="font-bold text-slate-900">{item.region_name} Directorate</div>
                              <div>Active Pendency: <strong className="text-blue-900">{item.pendency}</strong> / {item.total_applications}</div>
                              <div>Overdue Cases: <strong className="text-rose-600">{item.overdue}</strong></div>
                              <div>Avg Processing Days: <strong className="text-slate-800">{item.avg_processing_days} d</strong></div>
                              <div>SLA Compliance: <strong className="text-emerald-700">{item.sla_compliance_rate}%</strong></div>
                              <div className="text-blue-600 font-semibold text-[10px] pt-1 border-t border-slate-100">Click to filter regional applications →</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="pendency"
                      fill="#0B2240"
                      radius={[4, 4, 0, 0]}
                      onClick={(entry: any) => navigate(`/applications?region=${entry.region_name}`)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Officer Workload Chart */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Officer Workload & Overdue Allocation</h3>
                  <p className="text-xs text-slate-500">Active cases and overdue load assigned per officer</p>
                </div>
                <span className="text-[11px] text-slate-400">Top 8 Active Desks</span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workloadData.slice(0, 8)} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <XAxis
                      dataKey="officer_name"
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                      tick={{ fontSize: 9.5, fill: '#475569' }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload as OfficerWorkloadItem;
                          return (
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-md text-xs space-y-1">
                              <div className="font-bold text-slate-900">{item.officer_name}</div>
                              <div className="text-[10px] text-slate-500">{item.officer_role} • {item.region_name}</div>
                              <div>Active Cases: <strong className="text-blue-900">{item.active_cases}</strong></div>
                              <div>Overdue Cases: <strong className="text-rose-600">{item.overdue_cases}</strong></div>
                              <div>Desk Capacity: <strong className="text-indigo-700">{item.utilization_pct}%</strong></div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    <Bar dataKey="active_cases" name="Active Cases" fill="#0B2240" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="overdue_cases" name="Overdue Cases" fill="#DC2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tables Row 3: Bottlenecks & Top Overdue Cases */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bottlenecks Table */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-600" />
                    Stage Dwell Time & Bottleneck Analysis
                  </h3>
                  <p className="text-xs text-slate-500">Stages exceeding standard Approval Process Handbook SLA limits</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-100 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Stage</th>
                      <th className="py-2.5 px-3 text-right">Avg Dwell</th>
                      <th className="py-2.5 px-3 text-right">APH Norm</th>
                      <th className="py-2.5 px-3 text-right">Pending</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Max Lag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bottleneckData.map((b) => (
                      <tr key={b.stage} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{b.stage_name}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">{b.avg_dwell_days}d</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">{b.sla_standard_days}d</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-900">{b.current_pending_cases}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              b.bottleneck_severity === 'HIGH'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : b.bottleneck_severity === 'MEDIUM'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {b.bottleneck_severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] truncate max-w-[120px]">
                          {b.longest_dwell_ref !== 'None' ? (
                            <Link to={`/applications?search=${b.longest_dwell_ref}`} className="text-blue-700 hover:underline">
                              {b.longest_dwell_ref} ({b.longest_dwell_days}d)
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Overdue Cases */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-rose-600" />
                    Top Overdue Priority Cases
                  </h3>
                  <p className="text-xs text-slate-500">Applications currently escalated past final statutory deadlines</p>
                </div>
                <Link to="/applications?overdue=true" className="text-xs text-rose-700 hover:text-rose-900 font-semibold">
                  View All ({summary.overdue}) →
                </Link>
              </div>

              <div className="space-y-2.5">
                {summaryData?.top_overdue_cases?.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                    No overdue cases in current filter scope. All applications within SLA window.
                  </div>
                ) : (
                  summaryData?.top_overdue_cases?.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-rose-50/50 border border-rose-200 rounded-lg flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Link to={`/applications/${item.id}`} className="font-mono font-bold text-rose-950 hover:underline">
                            {item.ref_no}
                          </Link>
                          <span className="px-1.5 py-0.5 rounded bg-rose-200 text-rose-900 font-bold text-[10px]">
                            {item.days_overdue}d Overdue
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">[{item.current_stage}]</span>
                        </div>
                        <div className="text-slate-700 font-medium mt-0.5">{item.institution_name}</div>
                        <div className="text-[10px] text-slate-400">
                          Region: {item.region_name} • Officer: {item.assigned_officer_name}
                        </div>
                      </div>

                      <Link
                        to={`/applications/${item.id}`}
                        className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shrink-0 transition-colors shadow-2xs"
                      >
                        Inspect Case
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Row 4: Upcoming Deadlines (Next 14 Days across all 4 Modules) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-900" />
                  Upcoming Deadlines (Next 14 Days Across All Modules)
                </h3>
                <p className="text-xs text-slate-500">
                  Aggregated statutory calendar: Applications, EVC Physical Inspections, Undertakings, and Document Expiries
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-50 text-blue-900 rounded-full border border-blue-200">
                {deadlinesData.length} Action Items
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-100 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Module</th>
                    <th className="py-2.5 px-3">Subject / Obligation</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Institution & Region</th>
                    <th className="py-2.5 px-3">Deadline</th>
                    <th className="py-2.5 px-3 text-right">Window</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deadlinesData.slice(0, 10).map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.module === 'APPLICATION'
                              ? 'bg-blue-100 text-blue-800'
                              : d.module === 'EVC'
                              ? 'bg-indigo-100 text-indigo-800'
                              : d.module === 'UNDERTAKING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {d.module}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{d.title}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">{d.ref_no}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {d.institution_name} <span className="text-slate-400 font-normal">({d.region_name})</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                        {new Date(d.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.is_overdue
                              ? 'bg-rose-100 text-rose-800'
                              : d.days_remaining <= 3
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {d.is_overdue ? `${Math.abs(d.days_remaining)}d Overdue` : `${d.days_remaining}d Left`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          to={d.link}
                          className="text-xs text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-1"
                        >
                          Open <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW B: REGIONAL_OFFICER / REGIONAL_HEAD (REGION-ONLY VIEW)
         ========================================================================= */}
      {isRegionalOfficer && (
        <div className="space-y-6">
          {/* Regional Header Card */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0B2240] text-white flex items-center justify-center font-bold">
                <MapPin className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#0B2240]">
                  {summaryData?.jurisdiction || 'Regional Directorate'} Jurisdictional Console
                </h3>
                <p className="text-xs text-slate-600">
                  Restricted operational view showing institutions, scrutiny committees, and active applications in your region.
                </p>
              </div>
            </div>
            <div className="text-right text-xs">
              <span className="text-slate-400 block">Regional Team Size</span>
              <span className="font-bold text-slate-900 text-sm font-mono">{roleContext.team_size || 8} Officers</span>
            </div>
          </div>

          {/* Regional Pipeline & Ageing */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900">Regional Stage Funnel</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <XAxis dataKey="stage_name" angle={-15} textAnchor="end" interval={0} tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      onClick={(entry: any) => navigate(`/applications?stage=${entry.stage}`)}
                      className="cursor-pointer"
                    >
                      {funnelData.map((entry, idx) => (
                        <Cell key={`funnel-reg-${idx}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900">Regional Ageing Breakdown</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageingData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      radius={[4, 4, 0, 0]}
                      onClick={(entry: any) => navigate(`/applications?age=${entry.range}`)}
                      className="cursor-pointer"
                    >
                      {ageingData.map((entry, idx) => (
                        <Cell key={`age-reg-${idx}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Regional Team Workload */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Own Team Officer Allocation & Desk Capacity</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-100 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Officer Name</th>
                    <th className="py-2.5 px-3">Designation / Role</th>
                    <th className="py-2.5 px-3 text-right">Active Cases</th>
                    <th className="py-2.5 px-3 text-right">Overdue</th>
                    <th className="py-2.5 px-3 text-right">Completed</th>
                    <th className="py-2.5 px-3">Desk Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workloadData.map((off) => (
                    <tr key={off.officer_id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{off.officer_name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{off.officer_role}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-900 font-mono">{off.active_cases}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-600 font-mono">{off.overdue_cases}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-mono">{off.completed_cases}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                off.utilization_pct > 80 ? 'bg-rose-500' : 'bg-[#0B2240]'
                              }`}
                              style={{ width: `${Math.min(100, off.utilization_pct)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-slate-500">{off.utilization_pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW C: EVC_MEMBER (INSPECTION SPECIALIST VIEW)
         ========================================================================= */}
      {isEvcMember && (
        <div className="space-y-6">
          <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-900 text-white flex items-center justify-center font-bold">
                <Users className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-indigo-950">Expert Visit Committee (EVC) Assigned Workspace</h3>
                <p className="text-xs text-indigo-800">
                  Authorized for physical infrastructure verification, computer lab inspection, and faculty cadre audits.
                </p>
              </div>
            </div>
            <Link
              to="/applications"
              className="px-3.5 py-2 bg-indigo-800 hover:bg-indigo-900 text-white text-xs font-semibold rounded-lg shadow-2xs"
            >
              View My Assigned Applications
            </Link>
          </div>

          {/* Assigned EVC Deadlines & Visits */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-700" />
              My Upcoming EVC Physical Inspections
            </h3>

            <div className="space-y-3">
              {deadlinesData.filter((d) => d.module === 'EVC' || d.module === 'APPLICATION').length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
                  No upcoming inspections scheduled in the next 14 days.
                </div>
              ) : (
                deadlinesData
                  .filter((d) => d.module === 'EVC' || d.module === 'APPLICATION')
                  .slice(0, 6)
                  .map((evc) => (
                    <div
                      key={evc.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{evc.institution_name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-900">
                            {evc.title}
                          </span>
                        </div>
                        <div className="text-slate-600 mt-1 flex items-center gap-3">
                          <span>Ref: <strong className="font-mono">{evc.ref_no}</strong></span>
                          <span>•</span>
                          <span>Region: <strong>{evc.region_name}</strong></span>
                          <span>•</span>
                          <span>Inspection Due: <strong>{new Date(evc.due_date).toLocaleDateString()}</strong></span>
                        </div>
                      </div>

                      <Link
                        to={evc.link}
                        className="px-4 py-2 bg-[#0B2240] hover:bg-[#07172C] text-white rounded-lg text-xs font-bold shadow-2xs shrink-0 flex items-center gap-1.5"
                      >
                        Open Workspace <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW D: INSTITUTION (APPLICANT VIEW)
         ========================================================================= */}
      {isInstitution && (
        <div className="space-y-6">
          {/* Action Required Banner if returns exist */}
          {summary.returned > 0 && (
            <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl flex items-center justify-between text-xs text-amber-900">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Urgent Rectification Required</h4>
                  <p>
                    {summary.returned} application(s) have been returned by AICTE regional desk with deficiency notices. Please resubmit promptly to avoid SLA forfeiture.
                  </p>
                </div>
              </div>
              <Link
                to="/applications?status=RETURNED"
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold shrink-0"
              >
                Respond Now
              </Link>
            </div>
          )}

          {/* Institutional Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">AICTE APH Norms Compliance</span>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                {roleContext.compliance_score || 88.5}%
              </div>
              <span className="text-[11px] text-slate-500">Automated norm verification index</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Documents Nearing Expiry</span>
              <div className="text-2xl font-black text-amber-600 mt-1">
                {roleContext.documents_nearing_expiry || 1}
              </div>
              <span className="text-[11px] text-slate-500">Lease or NOC expiring in ≤ 30 days</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Undertakings</span>
              <div className="text-2xl font-black text-blue-900 mt-1">
                {roleContext.active_undertakings || 2}
              </div>
              <span className="text-[11px] text-slate-500">Time-bound post-approval obligations</span>
            </div>
          </div>

          {/* Institutional Deadlines */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-900" />
              Statutory Deadlines & Compliance Commitments
            </h3>

            <div className="space-y-2.5">
              {deadlinesData.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900">{item.title}</span>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono">Ref: {item.ref_no}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[10px]">
                      Due: {new Date(item.due_date).toLocaleDateString()}
                    </span>
                    <Link to={item.link} className="text-xs text-blue-700 font-semibold hover:underline">
                      Open →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
