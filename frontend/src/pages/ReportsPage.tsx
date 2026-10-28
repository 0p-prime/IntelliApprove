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
  AlertOctagon
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { DashboardMetrics, DeficiencyReportData, CaseSummaryData } from '../types';
import { LoadingState, ErrorState } from '../components/States';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'executive' | 'deficiencies' | 'ecs'>('executive');
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [deficiencyData, setDeficiencyData] = useState<DeficiencyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Electronic Case Summary State
  const [appIdInput, setAppIdInput] = useState<string>('1');
  const [caseSummary, setCaseSummary] = useState<CaseSummaryData | null>(null);
  const [loadingEcs, setLoadingEcs] = useState<boolean>(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState<boolean>(false);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, defRes] = await Promise.all([
        apiRequest<DashboardMetrics>('/analytics/dashboard'),
        apiRequest<DeficiencyReportData>('/analytics/deficiency-report'),
      ]);
      setData(dashRes);
      setDeficiencyData(defRes);
    } catch (err: any) {
      setError(err.message || 'Failed to generate AICTE compliance reports');
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

  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/analytics/export-csv', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to download CSV export');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AICTE_IntelliApprove_Applications_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    }
  };

  const handleCopyEcsMarkdown = () => {
    if (!caseSummary) return;
    navigator.clipboard.writeText(caseSummary.markdown_summary);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  useEffect(() => {
    fetchReports();
    fetchCaseSummary('1');
  }, []);

  if (loading) return <LoadingState message="Generating AICTE compliance and approval reports..." />;
  if (error || !data) return <ErrorState message={error || 'No report data'} onRetry={fetchReports} />;

  const { summary, stage_breakdown, regional_breakdown } = data;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="p-5 gov-header-gradient text-white rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-300 flex items-center justify-center text-amber-300">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              AICTE National Statutory Reports & Analytics
            </h2>
          </div>
          <p className="text-xs text-blue-100/90 mt-1 max-w-2xl">
            Official executive metrics, handbook deficiency rankings, regional benchmarks, and printable case summaries for AY 2026-2027.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-amber-300" />
            Export CSV Dump
          </button>
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-[#0B2240] hover:bg-[#07172C] border border-blue-400/30 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-blue-200" />
            Print Report
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-medium text-slate-600 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('executive')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 font-semibold transition-colors cursor-pointer ${
            activeTab === 'executive'
              ? 'border-[#0B2240] text-[#0B2240]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Executive Overview & Regional Benchmarks
        </button>

        <button
          onClick={() => setActiveTab('deficiencies')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 font-semibold transition-colors cursor-pointer ${
            activeTab === 'deficiencies'
              ? 'border-[#0B2240] text-[#0B2240]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertOctagon className="w-4 h-4 text-amber-600" />
          APH Norms Deficiency Audit Report
          {deficiencyData && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
              {deficiencyData.summary.pending_count} Pending
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ecs')}
          className={`pb-3 px-4 flex items-center gap-2 border-b-2 font-semibold transition-colors cursor-pointer ${
            activeTab === 'ecs'
              ? 'border-[#0B2240] text-[#0B2240]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 text-blue-700" />
          Electronic Case Summary (ECS) Inspection
        </button>
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === 'executive' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block">Total Application Volume</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">{summary.total_applications}</span>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">100% Digital Pipeline</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block">Approval Conversion Rate</span>
              <span className="text-2xl font-bold text-emerald-600 mt-1 block">
                {Math.round((summary.approved / Math.max(summary.total_applications, 1)) * 100)}%
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">{summary.approved} Approved EoAs</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block">Avg Handbook Compliance Score</span>
              <span className="text-2xl font-bold text-blue-800 mt-1 block">{summary.average_compliance_score}%</span>
              <span className="text-[11px] text-slate-500 mt-1 block">Evaluated across all programs</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block">SLA Escalation Incidents</span>
              <span className="text-2xl font-bold text-red-600 mt-1 block">{summary.sla_breaches}</span>
              <span className="text-[11px] text-red-600 font-medium mt-1 block">Active Regional Escalations</span>
            </div>
          </div>

          {/* Breakdown Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-700" />
                  Regional Performance Distribution
                </h3>
                <span className="text-xs text-slate-400">8 Official Regions</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Regional Directorate</th>
                      <th className="py-2.5 px-3">Applications</th>
                      <th className="py-2.5 px-3">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {regional_breakdown.map((r) => (
                      <tr key={r.region}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{r.region}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-900">{r.count}</td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {Math.round((r.count / Math.max(summary.total_applications, 1)) * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-700" />
                  Stage SLA Adherence Breakdown
                </h3>
                <span className="text-xs text-slate-400">Prescribed SLA Windows</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Workflow Stage</th>
                      <th className="py-2.5 px-3">Configured SLA</th>
                      <th className="py-2.5 px-3">Active Load</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stage_breakdown.map((s) => (
                      <tr key={s.stage_id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{s.stage_name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{s.sla_hours} hours</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{s.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEFICIENCY AUDIT REPORT */}
      {activeTab === 'deficiencies' && deficiencyData && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Deficiency KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block">Total Flagged Deficiencies</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">
                {deficiencyData.summary.total_deficiencies}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">Across all technical campuses</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block">Rectification Velocity</span>
              <span className="text-2xl font-bold text-emerald-600 mt-1 block">
                {deficiencyData.summary.rectification_rate}%
              </span>
              <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                {deficiencyData.summary.rectified_count} Rectifications Verified
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block">Critical Unresolved Norms</span>
              <span className="text-2xl font-bold text-red-600 mt-1 block">
                {deficiencyData.summary.critical_unresolved}
              </span>
              <span className="text-[11px] text-red-600 font-medium mt-1 block">FSR & Land shortfalls</span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block">Major Unresolved Norms</span>
              <span className="text-2xl font-bold text-amber-600 mt-1 block">
                {deficiencyData.summary.major_unresolved}
              </span>
              <span className="text-[11px] text-amber-700 font-medium mt-1 block">Builtup & Committees</span>
            </div>
          </div>

          {/* Rule Frequency Table & Regional Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-red-600" />
                  AICTE APH Regulatory Norm Deficiency Frequency
                </h3>
                <span className="text-xs text-slate-400">Ranked by Incidents</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Rule Code</th>
                      <th className="py-2.5 px-3">Regulatory Norm</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3 text-right">Incidents</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deficiencyData.rule_rankings.map((r) => (
                      <tr key={r.rule_code} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{r.rule_code}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{r.name}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                            {r.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.severity === 'CRITICAL'
                                ? 'bg-red-100 text-red-900 border border-red-200'
                                : r.severity === 'MAJOR'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-blue-100 text-blue-900 border border-blue-200'
                            }`}
                          >
                            {r.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {r.deficiency_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Regional Deficiency Counts */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-700" />
                Deficiencies by Region
              </h3>
              <div className="divide-y divide-slate-100 text-xs">
                {deficiencyData.regional_deficiencies.map((reg) => (
                  <div key={reg.region} className="py-2.5 flex items-center justify-between">
                    <span className="font-medium text-slate-800">{reg.region}</span>
                    <span className="font-mono font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                      {reg.deficiency_count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Deficient Institutions */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-700" />
              Institutions Requiring Enhanced Scrutiny & EVC Inspection
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Application Ref</th>
                    <th className="py-2.5 px-3">Institution Name</th>
                    <th className="py-2.5 px-3">State & Region</th>
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-3">Compliance Score</th>
                    <th className="py-2.5 px-3 text-right">Deficiencies</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deficiencyData.top_deficient_institutions.map((inst) => (
                    <tr key={inst.application_id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-900">
                        {inst.ref_no}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{inst.institution_name}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {inst.state} ({inst.region})
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[10px]">
                          {inst.current_stage}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold font-mono">
                        <span
                          className={
                            inst.compliance_score < 75 ? 'text-red-600' : 'text-amber-600'
                          }
                        >
                          {inst.compliance_score}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600">
                        {inst.deficiency_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ELECTRONIC CASE SUMMARY INSPECTOR */}
      {activeTab === 'ecs' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Lookup Input */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Inspect Application #:
              </span>
              <input
                type="number"
                value={appIdInput}
                onChange={(e) => setAppIdInput(e.target.value)}
                className="w-24 p-1.5 border border-slate-300 rounded text-xs font-mono font-bold"
              />
              <button
                onClick={() => fetchCaseSummary(appIdInput)}
                disabled={loadingEcs}
                className="px-3 py-1.5 bg-[#0B2240] hover:bg-[#07172C] text-white rounded text-xs font-semibold cursor-pointer shrink-0"
              >
                {loadingEcs ? 'Loading...' : 'Generate Case Summary'}
              </button>
            </div>

            {caseSummary && (
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={handleCopyEcsMarkdown}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedMarkdown ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy Markdown
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Case Summary
                </button>
              </div>
            )}
          </div>

          {/* Formatted ECS Document */}
          {caseSummary ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 sm:p-8 space-y-6 print:border-none print:shadow-none">
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-bold tracking-widest uppercase text-slate-500">
                    Government of India • Ministry of Education
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                    ALL INDIA COUNCIL FOR TECHNICAL EDUCATION
                  </h2>
                  <div className="text-xs font-bold text-blue-900 mt-0.5">
                    ELECTRONIC CASE SUMMARY (ECS) • AY 2026-2027
                  </div>
                </div>

                <div className="text-right">
                  <span className="px-3 py-1 rounded bg-amber-400 text-amber-950 font-bold font-mono text-xs uppercase tracking-wider">
                    {caseSummary.watermark}
                  </span>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    Ref: {caseSummary.ref_no}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Generated: {new Date(caseSummary.generated_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Strict Rule #2 Banner */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-900 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <strong className="text-blue-950 block font-bold">
                    Statutory Rule #2: Mandatory Human Oversight Gate
                  </strong>
                  <p className="text-blue-900 text-[11px] mt-0.5">
                    Automated engines calculate compliance and highlight deficiencies. Final approval or refusal is
                    strictly reserved for designated competent authority officers.
                  </p>
                </div>
              </div>

              {/* Institution Particulars Grid */}
              <div className="space-y-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-900" />
                  1. Institution Particulars
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Institution Name</span>
                    <strong className="text-slate-900">{caseSummary.institution.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Permanent AICTE ID</span>
                    <span className="font-mono text-slate-900 font-bold">{caseSummary.institution.aicte_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Category & Type</span>
                    <span className="text-slate-800">{caseSummary.institution.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Jurisdiction</span>
                    <span className="text-slate-800">{caseSummary.institution.state} ({caseSummary.institution.region} Region)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Campus Status</span>
                    <span className="text-slate-800">
                      {caseSummary.institution.is_new ? 'New Technical Institution' : 'Existing Campus'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Contact Email</span>
                    <span className="font-mono text-slate-800">{caseSummary.institution.contact_email}</span>
                  </div>
                </div>
              </div>

              {/* Route & Workflow */}
              <div className="space-y-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-700" />
                  2. Prescribed Approval Route & Workflow Status
                </h3>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-slate-500 font-medium">Approval Template:</span>{' '}
                      <strong className="text-slate-900">{caseSummary.workflow_route.template_name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Current Stage:</span>{' '}
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold font-mono text-[11px]">
                        {caseSummary.workflow_route.current_stage}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <strong>Route Sequence:</strong>{' '}
                    {caseSummary.workflow_route.stages?.join(' → ') || 'Standard AICTE Route'}
                  </div>
                </div>
              </div>

              {/* Stage History Timeline */}
              <div className="space-y-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-900" />
                  3. Stage Progression Timeline & Committee Actions
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Stage</th>
                        <th className="py-2 px-3">Action Recorded</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Handling Officer</th>
                        <th className="py-2 px-3">Remarks / Findings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {caseSummary.stage_timeline?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="py-2 px-3 font-bold font-mono text-slate-900">{item.stage}</td>
                          <td className="py-2 px-3 font-semibold text-blue-900">{item.action}</td>
                          <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                            {item.entered_at ? new Date(item.entered_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-800">{item.officer}</td>
                          <td className="py-2 px-3 text-slate-600">{item.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Official Decision Gate Clearance */}
              <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-amber-400">Statutory Sign-Off & Vigilance Clearance</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Electronic speaking order generated by IntelliApprove per AICTE Approval Process Handbook (APH) 2026-27.
                  </div>
                </div>
                <div className="font-mono text-xs text-blue-300 font-semibold bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 shrink-0">
                  Status: {caseSummary.watermark}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
              Enter an application number above to generate the official Electronic Case Summary.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
