import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  Printer,
  ShieldCheck,
  Search,
  RefreshCw,
  Copy,
  Check,
  TrendingUp,
  Layers,
  MapPin,
  Calendar,
  AlertOctagon,
  PieChart as PieChartIcon,
  ChevronRight,
  Filter,
  FileSpreadsheet,
  Clock,
  Award
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { apiRequest } from '../api/client';
import {
  StatutoryReportData,
  ReportMetadataItem,
  CaseSummaryData,
  DeficiencyReportData,
  DashboardMetrics
} from '../types';
import { LoadingState, ErrorState, EmptyState } from '../components/States';

const STATUTORY_REPORTS: Array<{
  id: string;
  title: string;
  category: string;
  description: string;
  icon: any;
}> = [
  {
    id: 'application-pendency',
    title: '1. Application Pendency & Ageing',
    category: 'WORKFLOW',
    description: 'Pipeline dwell time cohorts (<7d, 7-15d, 15-30d, >30d) and stage pendency.',
    icon: Clock
  },
  {
    id: 'evc-status',
    title: '2. EVC Inspection Status',
    category: 'INSPECTION',
    description: 'Committee appointments, visit timelines, new campus priority, and overdue visits.',
    icon: Building2
  },
  {
    id: 'undertaking-compliance',
    title: '3. Undertaking Compliance',
    category: 'COMPLIANCE',
    description: 'Post-approval legal conditions, evidence submissions, and institutional scores.',
    icon: CheckCircle2
  },
  {
    id: 'document-validity',
    title: '4. Document & Lease Validity',
    category: 'VIGILANCE',
    description: 'Land lease deeds, building safety approvals, fire NOCs, and 30/60/90d expiries.',
    icon: FileText
  },
  {
    id: 'overdue-escalations',
    title: '5. Overdue Cases & Escalations',
    category: 'ESCALATION',
    description: 'Multi-tier SLA ladder incidents (Regional Officer → Regional Head → Bureau).',
    icon: AlertTriangle
  },
  {
    id: 'region-performance',
    title: '6. Regional Benchmarking',
    category: 'EXECUTIVE',
    description: 'Turnaround speed, approval rates, and SLA compliance across all 8 AICTE regions.',
    icon: TrendingUp
  }
];

const AICTE_REGIONS = [
  { id: '', name: 'All 8 AICTE Regions' },
  { id: '1', name: 'Northern Region' },
  { id: '2', name: 'Southern Region' },
  { id: '3', name: 'Western Region' },
  { id: '4', name: 'Eastern Region' },
  { id: '5', name: 'Central Region' },
  { id: '6', name: 'South-Western Region' },
  { id: '7', name: 'North-Western Region' },
  { id: '8', name: 'South-Central Region' }
];

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#0B2240', '#8B5CF6'];

export const ReportsPage: React.FC = () => {
  const [mainView, setMainView] = useState<'statutory' | 'ecs' | 'deficiencies'>('statutory');
  const [selectedReportId, setSelectedReportId] = useState<string>('application-pendency');
  const [reportData, setReportData] = useState<StatutoryReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [exportingCsv, setExportingCsv] = useState<boolean>(false);

  // Secondary Tools: ECS & Deficiency Data
  const [appIdInput, setAppIdInput] = useState<string>('1');
  const [caseSummary, setCaseSummary] = useState<CaseSummaryData | null>(null);
  const [loadingEcs, setLoadingEcs] = useState<boolean>(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState<boolean>(false);
  const [deficiencyData, setDeficiencyData] = useState<DeficiencyReportData | null>(null);

  const fetchCurrentReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (regionFilter) params.append('region_id', regionFilter);
      if (statusFilter) params.append('status_filter', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const data = await apiRequest<StatutoryReportData>(
        `/reports/${selectedReportId}?${params.toString()}`
      );
      setReportData(data);
    } catch (err: any) {
      setError(err.message || `Failed to generate statutory report: ${selectedReportId}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchCaseSummary = async (appId: string) => {
    if (!appId.trim()) return;
    setLoadingEcs(true);
    try {
      const summary = await apiRequest<CaseSummaryData>(`/applications/${appId}/case-summary`);
      setCaseSummary(summary);
    } catch (err: any) {
      alert(`Failed to load case summary: ${err.message}`);
    } finally {
      setLoadingEcs(false);
    }
  };

  const fetchDeficiencies = async () => {
    try {
      const defRes = await apiRequest<DeficiencyReportData>('/analytics/deficiency-report');
      setDeficiencyData(defRes);
    } catch (err) {
      console.error('Failed to load deficiency report', err);
    }
  };

  const handleExportCSV = async () => {
    setExportingCsv(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (regionFilter) params.append('region_id', regionFilter);
      if (statusFilter) params.append('status_filter', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      let response = await fetch(`/api/v1/reports/${selectedReportId}/export-csv?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        response = await fetch(`/reports/${selectedReportId}/export-csv?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }

      if (!response.ok) throw new Error('Failed to generate official CSV export');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AICTE_${selectedReportId.toUpperCase()}_REPORT_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExportingCsv(false);
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const handleCopyEcsMarkdown = () => {
    if (!caseSummary) return;
    navigator.clipboard.writeText(caseSummary.markdown_summary);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  useEffect(() => {
    if (mainView === 'statutory') {
      fetchCurrentReport();
    } else if (mainView === 'ecs') {
      if (!caseSummary) fetchCaseSummary(appIdInput);
    } else if (mainView === 'deficiencies') {
      if (!deficiencyData) fetchDeficiencies();
    }
  }, [selectedReportId, regionFilter, statusFilter, mainView]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCurrentReport();
  };

  const handleResetFilters = () => {
    setRegionFilter('');
    setStatusFilter('');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner (Hidden in print) */}
      <div className="p-5 gov-header-gradient text-white rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-300 flex items-center justify-center text-amber-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              AICTE Statutory Reporting & Analytics Engine
            </h2>
          </div>
          <p className="text-xs text-blue-100/90 mt-1 max-w-2xl leading-relaxed">
            Mandated national governance reports, pipeline ageing cohorts, EVC inspection timelines, legal undertakings,
            and regional benchmarking for AY 2026-2027.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 border border-emerald-400 text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              Non-Negotiable Rule #1: Every report generation is cryptographically audit-logged
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={exportingCsv || loading}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
            title="Download official government CSV file"
          >
            <Download className={`w-3.5 h-3.5 text-amber-300 ${exportingCsv ? 'animate-bounce' : ''}`} />
            {exportingCsv ? 'Exporting...' : 'Export to Excel (CSV)'}
          </button>
          <button
            onClick={handlePrintPDF}
            className="px-3.5 py-2 bg-[#0B2240] hover:bg-[#07172C] border border-blue-400/30 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5 text-blue-200" />
            Print / PDF Report
          </button>
        </div>
      </div>

      {/* Main View Mode Selector (Print Hidden) */}
      <div className="flex border-b border-slate-200 text-xs font-medium text-slate-600 gap-2 overflow-x-auto print:hidden">
        <button
          onClick={() => setMainView('statutory')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 font-semibold transition-colors cursor-pointer ${
            mainView === 'statutory'
              ? 'border-[#0B2240] text-[#0B2240]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-blue-800" />
          Statutory AICTE Reports (6 Mandated)
        </button>

        <button
          onClick={() => setMainView('ecs')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 font-semibold transition-colors cursor-pointer ${
            mainView === 'ecs'
              ? 'border-[#0B2240] text-[#0B2240]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 text-indigo-700" />
          Electronic Case Summary (ECS) Viewer
        </button>

        <button
          onClick={() => setMainView('deficiencies')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 font-semibold transition-colors cursor-pointer ${
            mainView === 'deficiencies'
              ? 'border-[#0B2240] text-[#0B2240]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertOctagon className="w-4 h-4 text-amber-600" />
          APH Norms Deficiency Audit
        </button>
      </div>

      {/* VIEW 1: STATUTORY AICTE REPORTS */}
      {mainView === 'statutory' && (
        <div className="space-y-6">
          {/* Statutory Reports Selector Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 print:hidden">
            {STATUTORY_REPORTS.map((rep) => {
              const Icon = rep.icon;
              const isSelected = selectedReportId === rep.id;
              return (
                <button
                  key={rep.id}
                  onClick={() => setSelectedReportId(rep.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-[#0B2240] text-white border-[#0B2240] shadow-sm'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#0B2240]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold ${
                        isSelected ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {rep.category}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs leading-snug line-clamp-2">{rep.title}</h4>
                    <p
                      className={`text-[10px] mt-1 line-clamp-2 leading-relaxed ${
                        isSelected ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {rep.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  AICTE Region:
                </label>
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-medium"
                >
                  {AICTE_REGIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Filter by Status:
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-medium"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">PENDING</option>
                  <option value="QUEUED">QUEUED</option>
                  <option value="SCHEDULED">SCHEDULED</option>
                  <option value="OVERDUE">OVERDUE</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="VALID">VALID</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="RESOLVED">RESOLVED</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Search Within Report:
                </label>
                <form onSubmit={handleSearchSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search ref no, institution, condition text, or keyword..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-[#0B2240] text-white text-xs font-semibold rounded hover:bg-[#07172C] cursor-pointer"
                  >
                    Apply
                  </button>
                  {(regionFilter || statusFilter || searchQuery) && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="px-2.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded hover:bg-slate-100 cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </form>
              </div>
            </div>
          </div>

          {/* Active Report Container */}
          {loading ? (
            <LoadingState message={`Generating ${selectedReportId} statutory datasets...`} />
          ) : error || !reportData ? (
            <ErrorState message={error || 'No report data returned'} onRetry={fetchCurrentReport} />
          ) : (
            <div className="space-y-6">
              {/* Printable Header Banner */}
              <div className="hidden print:block border-b-2 border-slate-800 pb-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">
                      All India Council for Technical Education (AICTE)
                    </h1>
                    <h2 className="text-base font-semibold text-slate-700 mt-1">
                      {reportData.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">{reportData.subtitle}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500 font-mono">
                    <div>Generated: {new Date(reportData.generated_at).toLocaleString()}</div>
                    <div className="font-bold text-slate-800">AY 2026-2027 Official Record</div>
                  </div>
                </div>
              </div>

              {/* Title & Subtitle in Web View */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    {reportData.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{reportData.subtitle}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono self-start sm:self-auto">
                  <span>As of {new Date(reportData.generated_at).toLocaleString()}</span>
                  <button
                    onClick={fetchCurrentReport}
                    className="p-1 hover:text-slate-700 cursor-pointer"
                    title="Refresh report"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Executive Summary KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {reportData.summary_kpis.map((kpi, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between"
                  >
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                      {kpi.label}
                    </span>
                    <span className="text-2xl font-bold text-slate-900 mt-2 block font-mono">
                      {kpi.value}
                    </span>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          kpi.color === 'red'
                            ? 'bg-red-500'
                            : kpi.color === 'amber'
                            ? 'bg-amber-500'
                            : kpi.color === 'emerald'
                            ? 'bg-emerald-500'
                            : kpi.color === 'purple'
                            ? 'bg-purple-500'
                            : 'bg-blue-600'
                        }`}
                      ></span>
                      <span className="text-[10px] text-slate-400 font-medium">Statutory Metric</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Visual Chart Card */}
              {reportData.chart_data && reportData.chart_data.length > 0 && (
                <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-700" />
                      Visual Distribution & Statistical Breakdown
                    </h4>
                    <span className="text-[10px] font-mono text-slate-400">
                      Chart Model: {reportData.chart_type.toUpperCase()}
                    </span>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {reportData.chart_type === 'pie' ? (
                        <PieChart>
                          <Pie
                            data={reportData.chart_data}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, percent }: any) =>
                              `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                            }
                          >
                            {reportData.chart_data.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      ) : (
                        <BarChart
                          data={reportData.chart_data}
                          margin={{ top: 10, right: 20, left: -10, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis
                            dataKey={
                              reportData.chart_config?.xKey ||
                              (reportData.chart_data[0]?.label ? 'label' : 'region')
                            }
                            tick={{ fontSize: 11, fill: '#64748b' }}
                          />
                          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                          <Tooltip />
                          <Legend />
                          {reportData.chart_config?.bars?.map((b: any, bIdx: number) => (
                            <Bar
                              key={bIdx}
                              dataKey={b.key}
                              name={b.label || b.key}
                              fill={b.color || '#0B2240'}
                              radius={[4, 4, 0, 0]}
                            />
                          )) || (
                            <Bar
                              dataKey={
                                Object.keys(reportData.chart_data[0] || {}).find(
                                  (k) =>
                                    k !== 'label' &&
                                    k !== 'region' &&
                                    k !== 'color' &&
                                    k !== 'cohort'
                                ) || 'count'
                              }
                              fill="#0B2240"
                              radius={[4, 4, 0, 0]}
                            />
                          )}
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Data Table Preview */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-2">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Tabular Data Preview ({reportData.table_data.length} Records)
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600">
                      Statutory View
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={handleExportCSV}
                      disabled={exportingCsv}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-700" />
                      Save CSV
                    </button>
                  </div>
                </div>

                {reportData.table_data.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No matching records found for the selected filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                        <tr>
                          {reportData.table_columns.map((col) => (
                            <th key={col.key} className="py-2.5 px-3 whitespace-nowrap">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.table_data.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50/70">
                            {reportData.table_columns.map((col) => {
                              const val = row[col.key];

                              if (col.type === 'mono') {
                                return (
                                  <td
                                    key={col.key}
                                    className="py-2.5 px-3 font-mono font-bold text-slate-900 text-[11px]"
                                  >
                                    {val || '—'}
                                  </td>
                                );
                              }

                              if (col.type === 'status') {
                                const st = String(val || '').toUpperCase();
                                let bg = 'bg-blue-50 text-blue-800 border-blue-200';
                                if (st === 'VERIFIED' || st === 'VALID' || st === 'COMPLETED' || st === 'APPROVED') {
                                  bg = 'bg-emerald-50 text-emerald-800 border-emerald-300';
                                } else if (st === 'OVERDUE' || st === 'EXPIRED' || st === 'REJECTED' || st === 'ACTIVE') {
                                  bg = 'bg-rose-50 text-rose-800 border-rose-300';
                                } else if (st === 'CRITICAL' || st === 'DUE_SOON' || st === 'EXPIRING_SOON') {
                                  bg = 'bg-amber-50 text-amber-800 border-amber-300';
                                }
                                return (
                                  <td key={col.key} className="py-2.5 px-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${bg}`}
                                    >
                                      {val || '—'}
                                    </span>
                                  </td>
                                );
                              }

                              if (col.type === 'badge') {
                                return (
                                  <td key={col.key} className="py-2.5 px-3">
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
                                      {val || '—'}
                                    </span>
                                  </td>
                                );
                              }

                              if (col.type === 'score' || col.type === 'percentage') {
                                const num = typeof val === 'number' ? val : parseFloat(val) || 0;
                                return (
                                  <td key={col.key} className="py-2.5 px-3 font-mono">
                                    <span
                                      className={`font-bold ${
                                        num >= 80
                                          ? 'text-emerald-700'
                                          : num >= 50
                                          ? 'text-amber-700'
                                          : 'text-rose-700'
                                      }`}
                                    >
                                      {num}%
                                    </span>
                                  </td>
                                );
                              }

                              if (col.type === 'boolean') {
                                return (
                                  <td key={col.key} className="py-2.5 px-3">
                                    {val ? (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                        YES
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px]">
                                        NO
                                      </span>
                                    )}
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={col.key}
                                  className="py-2.5 px-3 text-slate-700 max-w-xs truncate"
                                  title={typeof val === 'string' ? val : ''}
                                >
                                  {val !== undefined && val !== null ? String(val) : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: ELECTRONIC CASE SUMMARY (ECS) INSPECTOR */}
      {mainView === 'ecs' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-700" />
                  Auto-Generated Electronic Case Summary (ECS)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Template-based digital summary containing institution profile, workflow route, timeline, observations, and risk assessment.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={appIdInput}
                  onChange={(e) => setAppIdInput(e.target.value)}
                  placeholder="App ID (e.g. 1)"
                  className="w-28 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono"
                />
                <button
                  onClick={() => fetchCaseSummary(appIdInput)}
                  disabled={loadingEcs}
                  className="px-3 py-1.5 bg-[#0B2240] text-white rounded text-xs font-semibold hover:bg-[#07172C] disabled:opacity-50 cursor-pointer"
                >
                  {loadingEcs ? 'Generating...' : 'Load Case'}
                </button>
              </div>
            </div>

            {caseSummary ? (
              <div className="space-y-4 pt-2">
                {/* Watermark Banner */}
                <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-700" />
                    <strong>{caseSummary.watermark}</strong> • Application Ref:{' '}
                    <span className="font-mono font-bold">{caseSummary.ref_no}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyEcsMarkdown}
                      className="px-2.5 py-1 bg-white border border-amber-300 rounded text-[11px] font-semibold text-amber-800 hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedMarkdown ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {copiedMarkdown ? 'Copied' : 'Copy Markdown'}
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="px-2.5 py-1 bg-[#0B2240] text-white rounded text-[11px] font-semibold hover:bg-[#07172C] flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3 h-3" />
                      Print Summary
                    </button>
                  </div>
                </div>

                {/* Profile Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Institution</span>
                    <strong className="text-slate-900 text-sm block">{caseSummary.institution.name}</strong>
                    <div className="text-slate-600">AICTE ID: {caseSummary.institution.aicte_id}</div>
                    <div className="text-slate-500">
                      {caseSummary.institution.type} • {caseSummary.institution.state} ({caseSummary.institution.region})
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Workflow Route</span>
                    <strong className="text-blue-900 text-sm block font-mono">
                      {caseSummary.workflow_route.template_name}
                    </strong>
                    <div className="text-slate-600">
                      Current Stage: <span className="font-bold text-slate-800">{caseSummary.workflow_route.current_stage}</span>
                    </div>
                    <div className="text-slate-500">Status: {caseSummary.workflow_route.status}</div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Risk & Compliance</span>
                    <strong className="text-emerald-700 text-sm block font-mono">
                      Risk Score: {caseSummary.risk_assessment.risk_score} / 100
                    </strong>
                    <div className="text-slate-600">
                      Pending Undertakings: {caseSummary.pending_items.undertakings_pending} of {caseSummary.pending_items.undertakings_total}
                    </div>
                    <div className="text-slate-500">
                      Pending Documents: {caseSummary.pending_items.documents_pending} of {caseSummary.pending_items.documents_total}
                    </div>
                  </div>
                </div>

                {/* Stage Timeline */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">Stage Audit Progression</h4>
                  <div className="space-y-2">
                    {caseSummary.stage_timeline.map((st, i) => (
                      <div key={i} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs flex justify-between">
                        <div>
                          <span className="font-bold text-slate-900">{st.stage}</span> •{' '}
                          <span className="text-blue-800 font-semibold">{st.action}</span>
                          <p className="text-slate-600 text-[11px] mt-0.5">{st.remarks}</p>
                        </div>
                        <div className="text-right text-[11px] text-slate-400 font-mono">
                          <div>by {st.officer}</div>
                          <div>{st.completed_at ? new Date(st.completed_at).toLocaleDateString() : 'Active'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Markdown View */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-1">
                    Markdown Statutory Dossier
                  </h4>
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto max-h-72 leading-relaxed">
                    {caseSummary.markdown_summary}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                Enter an application ID to generate its electronic case summary.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: APH NORMS DEFICIENCIES AUDIT */}
      {mainView === 'deficiencies' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {!deficiencyData ? (
            <LoadingState message="Loading AICTE approval process handbook deficiency audit..." />
          ) : (
            <div className="space-y-6">
              {/* Deficiencies KPI */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 block">Total Handbook Norms</span>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block">
                    {deficiencyData.summary.total_deficiencies}
                  </span>
                  <span className="text-[10px] text-slate-400">AY 2026-27 APH</span>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 block">Pending Rectifications</span>
                  <span className="text-2xl font-bold text-red-600 mt-1 block">
                    {deficiencyData.summary.pending_count}
                  </span>
                  <span className="text-[10px] text-red-700 font-semibold">Under observation</span>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 block">Rectified Proofs</span>
                  <span className="text-2xl font-bold text-emerald-600 mt-1 block">
                    {deficiencyData.summary.rectified_count}
                  </span>
                  <span className="text-[10px] text-emerald-700">Satisfactory submissions</span>
                </div>
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-xs text-slate-500 block">National Rectification Rate</span>
                  <span className="text-2xl font-bold text-blue-700 mt-1 block">
                    {deficiencyData.summary.rectification_rate}%
                  </span>
                  <span className="text-[10px] text-blue-800">Compliance turnaround</span>
                </div>
              </div>

              {/* Top Deficient Rules Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Highest Frequency Regulatory Norm Deficiencies
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Rule Code</th>
                        <th className="py-2.5 px-3">Handbook Norm Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Severity</th>
                        <th className="py-2.5 px-3 text-right">Deficiency Violations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deficiencyData.rule_rankings.map((r) => (
                        <tr key={r.rule_code} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{r.rule_code}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{r.name}</td>
                          <td className="py-2.5 px-3 text-slate-600">{r.category}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                r.severity === 'CRITICAL'
                                  ? 'bg-red-100 text-red-900 border border-red-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                            >
                              {r.severity}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-right text-rose-700 font-mono">
                            {r.deficiency_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
