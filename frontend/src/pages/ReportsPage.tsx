import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Download, CheckCircle2, AlertTriangle, FileText, Building2 } from 'lucide-react';
import { apiRequest } from '../api/client';
import { DashboardMetrics } from '../types';
import { LoadingState, ErrorState } from '../components/States';

export const ReportsPage: React.FC = () => {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<DashboardMetrics>('/analytics/dashboard')
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Generating AICTE compliance and approval reports..." />;
  if (error || !data) return <ErrorState message={error || 'No report data'} />;

  const { summary, stage_breakdown, regional_breakdown } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            AICTE National Compliance & Analytics Reports
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Official executive metrics, regional performance rankings, and SLA breach summaries for AY 2026-2027.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-[#0B2240] hover:bg-[#07172C] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer self-start sm:self-auto transition-colors"
        >
          <Download className="w-4 h-4 text-amber-400" />
          Export Report Summary
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <span className="text-[11px] text-slate-500 mt-1 block">Across all technical programs</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block">SLA Escalation Incidents</span>
          <span className="text-2xl font-bold text-red-600 mt-1 block">{summary.sla_breaches}</span>
          <span className="text-[11px] text-red-600 font-medium mt-1 block">Escalated to Directorate</span>
        </div>
      </div>

      {/* Breakdown Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900">Regional Performance Distribution</h3>
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

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900">Stage SLA Adherence Breakdown</h3>
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
  );
};
