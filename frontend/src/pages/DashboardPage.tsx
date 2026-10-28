import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  Flame,
  CheckSquare,
  Users
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { apiRequest } from '../api/client';
import { DashboardMetrics } from '../types';
import { LoadingState, ErrorState } from '../components/States';
import { HumanOversightBadge } from '../components/HumanOversightBadge';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#0B2240', '#163E70', '#E05A1B', '#138808', '#9333EA', '#0284C7'];

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<DashboardMetrics>('/analytics/dashboard');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) return <LoadingState message="Aggregating AICTE approval analytics..." />;
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={fetchDashboard} />;

  const { summary, stage_breakdown, regional_breakdown, recent_escalations } = data;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              AICTE National Approval & Compliance Dashboard
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800">
              AY 2026-2027
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Real-time tracking of institutional approvals, automated APH norms verification, and SLA escalation ladders.
          </p>
        </div>
        <div>
          <HumanOversightBadge size="sm" showSubtitle={false} />
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Applications</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{summary.total_applications}</div>
          <div className="text-[11px] text-slate-500 mt-1">Institutes enrolled</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Under Scrutiny</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">{summary.under_scrutiny}</div>
          <div className="text-[11px] text-slate-500 mt-1">Legal & doc checks</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">EVC Inspection</span>
            <Users className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-bold text-cyan-600">{summary.under_evc}</div>
          <div className="text-[11px] text-slate-500 mt-1">Physical / Virtual visit</div>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-300 shadow-2xs">
          <div className="flex items-center justify-between text-amber-800 mb-2">
            <span className="text-xs font-bold uppercase">Pending Authority</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-900">{summary.pending_authority_decision}</div>
          <div className="text-[11px] text-amber-800 mt-1 font-medium">Requires human sign-off</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Approvals Granted</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{summary.approved}</div>
          <div className="text-[11px] text-slate-500 mt-1">EoA orders issued</div>
        </div>

        <div className="bg-red-50/60 p-4 rounded-xl border border-red-200 shadow-2xs">
          <div className="flex items-center justify-between text-red-800 mb-2">
            <span className="text-xs font-bold uppercase">SLA Breaches</span>
            <Flame className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-600">{summary.sla_breaches}</div>
          <div className="text-[11px] text-red-700 mt-1 font-medium">Escalated to Director</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stage Funnel Bar Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Application Stage Pipeline & SLAs</h3>
              <p className="text-xs text-slate-500">Distribution of applications across configurable workflow stages</p>
            </div>
            <Link
              to="/config/workflow"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
            >
              Config Routes <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stage_breakdown} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                <XAxis
                  dataKey="stage_name"
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  tick={{ fontSize: 10, fill: '#475569' }}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [`${val} Applications`, 'Count']}
                  labelFormatter={(name) => `Stage: ${name}`}
                />
                <Bar dataKey="count" fill="#0B2240" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Regional Distribution Pie */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <h3 className="font-bold text-sm text-slate-900 mb-1">Regional Heat Breakdown</h3>
          <p className="text-xs text-slate-500 mb-4">AICTE Regional Directorates</p>
          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={regional_breakdown}
                  dataKey="count"
                  nameKey="region"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={38}
                  paddingAngle={3}
                >
                  {regional_breakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {regional_breakdown.map((item, idx) => (
              <span key={item.region} className="text-[11px] text-slate-600 flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                {item.region} ({item.count})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Escalations & Fast Access Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Escalations */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-600" />
              <h3 className="font-bold text-sm text-slate-900">Active SLA Escalation Ladder Events</h3>
            </div>
            <Link to="/config/escalations" className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
              View Ladders
            </Link>
          </div>
          {recent_escalations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
              No recent SLA escalations. All workflow stages are within prescribed timeframes.
            </div>
          ) : (
            <div className="space-y-3">
              {recent_escalations.map((esc) => (
                <div
                  key={esc.id}
                  className="p-3 bg-red-50/70 border border-red-200 rounded-lg flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-red-900 flex items-center gap-2">
                      <span>App #{esc.application_id}</span>
                      <span className="px-1.5 py-0.5 rounded bg-red-200 text-red-800 text-[10px]">
                        Escalated to {esc.escalated_to_role}
                      </span>
                    </div>
                    <p className="text-slate-700 mt-1">{esc.reason}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    {new Date(esc.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Action Matrix */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 mb-1">SIH Evaluation Quick Jump</h3>
            <p className="text-xs text-slate-500 mb-4">Direct shortcuts to verify each Problem Statement non-negotiable</p>

            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/applications/3"
                className="p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-left transition-colors"
              >
                <div className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-700" /> Rule #2: Decision Panel
                </div>
                <p className="text-[11px] text-amber-800 mt-1">
                  Test Competent Authority Human Oversight gate with checklist on App #1003.
                </p>
              </Link>

              <Link
                to="/audit"
                className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-colors"
              >
                <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-slate-700" /> Rule #1: Audit Trail
                </div>
                <p className="text-[11px] text-slate-600 mt-1">
                  Inspect immutable audit log of every stage transition, login, and config change.
                </p>
              </Link>

              <Link
                to="/config/workflow"
                className="p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-left transition-colors"
              >
                <div className="font-bold text-xs text-blue-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-blue-700" /> Rule #3: DB Routes & SLAs
                </div>
                <p className="text-[11px] text-blue-800 mt-1">
                  Configure stage SLA hours, roles, and allowed transitions dynamically.
                </p>
              </Link>

              <Link
                to="/undertakings"
                className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-left transition-colors"
              >
                <div className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-emerald-700" /> Undertakings Tracker
                </div>
                <p className="text-[11px] text-emerald-800 mt-1">
                  Monitor post-approval compliance deadlines and fulfillment evidence.
                </p>
              </Link>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Average Handbook Compliance Score: <strong>{summary.average_compliance_score}%</strong></span>
            <span>Active Undertakings: <strong>{summary.active_undertakings}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
