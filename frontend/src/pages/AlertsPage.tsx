import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Zap,
  ArrowRight,
  TrendingUp,
  Settings,
  ListFilter,
  CheckCheck,
  Building2,
  Clock,
  Layers,
  ExternalLink,
  Edit2
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { Alert, EscalationItem, AlertRuleItem } from '../types';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { useAuth } from '../context/AuthContext';

export const AlertsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ALERTS' | 'ESCALATIONS' | 'RULES'>('ALERTS');
  
  // Tab 1: Alerts
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Tab 2: Escalations
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [loadingEscalations, setLoadingEscalations] = useState(false);

  // Tab 3: Rules
  const [rules, setRules] = useState<AlertRuleItem[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRuleItem | null>(null);
  const [editOffset, setEditOffset] = useState<number>(0);
  const [editSeverity, setEditSeverity] = useState<string>('INFO');
  const [savingRule, setSavingRule] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<Alert[]>('/alerts');
      setAlerts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const fetchEscalations = async () => {
    setLoadingEscalations(true);
    try {
      const data = await apiRequest<EscalationItem[]>('/alerts/escalations');
      setEscalations(data);
    } catch (err) {
      console.error('Failed to load escalations:', err);
    } finally {
      setLoadingEscalations(false);
    }
  };

  const fetchRules = async () => {
    setLoadingRules(true);
    try {
      const data = await apiRequest<AlertRuleItem[]>('/alerts/rules');
      setRules(data);
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setLoadingRules(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchEscalations();
    fetchRules();

    const handleTimeTravel = () => {
      fetchAlerts();
      fetchEscalations();
    };

    window.addEventListener('time-travel-updated', handleTimeTravel);
    return () => window.removeEventListener('time-travel-updated', handleTimeTravel);
  }, []);

  const markRead = async (id: number) => {
    try {
      await apiRequest(`/alerts/${id}/read`, { method: 'POST' });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/alerts/read-all', { method: 'POST' });
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const triggerSlaCheck = async () => {
    setTriggering(true);
    setTriggerMessage(null);
    try {
      const res = await apiRequest<{
        message: string;
        result?: {
          notifications_created: number;
          escalations_created: number;
        };
      }>('/alerts/trigger-sla-check', { method: 'POST' });
      
      const counts = res.result
        ? ` (${res.result.escalations_created} escalations, ${res.result.notifications_created} notifications)`
        : '';
      setTriggerMessage(res.message + counts);
      await fetchAlerts();
      await fetchEscalations();
    } catch (err: any) {
      alert(`Trigger failed: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

  const handleSaveRule = async () => {
    if (!editingRule) return;
    setSavingRule(true);
    try {
      await apiRequest(`/alerts/rules/${editingRule.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          offset_days: editOffset,
          severity: editSeverity
        })
      });
      setEditingRule(null);
      await fetchRules();
    } catch (err: any) {
      alert(`Failed to update rule: ${err.message}`);
    } finally {
      setSavingRule(false);
    }
  };

  // Filter alerts
  const filteredAlerts = alerts.filter((a) => {
    const matchesSev = filterSeverity === 'ALL' || a.severity === filterSeverity;
    const matchesCat = filterCategory === 'ALL' || (a.category && a.category === filterCategory);
    const matchesSearch =
      !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSev && matchesCat && matchesSearch;
  });

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Alert & Escalation Management Center
            </h2>
            <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
              SLA Engine Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Proactive deadline alerts, automated administrative escalation ladders (RO → RH → Bureau), and dynamic rule configurations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark All Read ({unreadCount})
            </button>
          )}

          <button
            onClick={triggerSlaCheck}
            disabled={triggering}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${triggering ? 'animate-spin' : ''}`} />
            Run SLA Breach Engine
          </button>
        </div>
      </div>

      {triggerMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{triggerMessage}</span>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('ALERTS')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'ALERTS'
              ? 'border-[#0B2240] text-[#0B2240]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Live Notifications</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-600 text-white font-black">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ESCALATIONS')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'ESCALATIONS'
              ? 'border-[#0B2240] text-[#0B2240]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Escalation Ladder & Chain ({escalations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('RULES')}
          className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'RULES'
              ? 'border-[#0B2240] text-[#0B2240]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Alert Rules Matrix ({rules.length})</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: LIVE NOTIFICATIONS */}
      {/* ============================================================== */}
      {activeTab === 'ALERTS' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {['ALL', 'ESCALATION', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setFilterSeverity(sev)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    filterSeverity === sev
                      ? 'bg-[#0B2240] text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {sev === 'ALL' ? 'All Severities' : sev}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="ALL">All Categories</option>
                <option value="STAGE_SLA">Stage SLAs</option>
                <option value="UNDERTAKING_DEADLINE">Undertakings</option>
                <option value="LEASE_EXPIRY">Document Expiries</option>
                <option value="EVC_SCHEDULE">EVC Inspections</option>
              </select>

              <input
                type="text"
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 w-44"
              />
            </div>
          </div>

          {loading ? (
            <LoadingState message="Loading alert notifications..." />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchAlerts} />
          ) : filteredAlerts.length === 0 ? (
            <EmptyState
              title="No Notifications Found"
              description="There are currently no alerts matching your applied filters."
            />
          ) : (
            <div className="space-y-2.5">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-xl border transition-all ${
                    alert.is_read
                      ? 'bg-white border-slate-200 text-slate-600'
                      : alert.severity === 'ESCALATION'
                      ? 'bg-red-50/80 border-red-300 shadow-xs'
                      : alert.severity === 'CRITICAL'
                      ? 'bg-rose-50/80 border-rose-300'
                      : alert.severity === 'WARNING'
                      ? 'bg-amber-50/80 border-amber-300'
                      : 'bg-blue-50/80 border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide">
                      {alert.severity === 'ESCALATION' ? (
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      ) : alert.severity === 'CRITICAL' ? (
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                      ) : (
                        <Bell className="w-4 h-4 text-blue-600 shrink-0" />
                      )}
                      <span
                        className={
                          alert.severity === 'ESCALATION'
                            ? 'text-red-700 font-extrabold'
                            : alert.severity === 'CRITICAL'
                            ? 'text-rose-700'
                            : alert.severity === 'WARNING'
                            ? 'text-amber-700'
                            : 'text-blue-700'
                        }
                      >
                        {alert.severity}
                      </span>
                      {alert.category && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700 font-medium">
                          {alert.category}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 mt-1.5">{alert.title}</h3>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">{alert.message}</p>

                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">
                        Target: <strong>{alert.recipient_role || 'All Administrative Roles'}</strong>
                      </span>
                      {alert.application_id && (
                        <Link
                          to={`/applications/${alert.application_id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                        >
                          <span>Open Application #{alert.application_id}</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>

                    {!alert.is_read && (
                      <button
                        onClick={() => markRead(alert.id)}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: ESCALATION LADDER & CHAIN */}
      {/* ============================================================== */}
      {activeTab === 'ESCALATIONS' && (
        <div className="space-y-4">
          {/* Escalation Hierarchy Architecture Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-[#0B2240] to-blue-900 text-white p-5 rounded-2xl shadow-lg border border-blue-900/50">
            <h3 className="font-bold text-sm text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Statutory Multi-Tier Administrative Escalation Ladder
            </h3>
            <p className="text-xs text-blue-100/90 leading-relaxed mb-4">
              When an application or compliance milestone exceeds its permissible SLA threshold, the system automatically escalates responsibility up the government hierarchy with immutable cryptographic audit logging.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-white/10 rounded-xl p-3 border border-white/15">
                <div className="text-[10px] font-bold text-amber-300 uppercase">Level 1 Escalation (+2 Days)</div>
                <div className="font-bold text-white text-sm mt-0.5">Regional Officer → Regional Head</div>
                <p className="text-[11px] text-blue-200 mt-1">
                  Triggered at +2 days past stage SLA. Regional Head receives urgent intervention directive.
                </p>
              </div>

              <div className="bg-white/10 rounded-xl p-3 border border-white/15">
                <div className="text-[10px] font-bold text-rose-300 uppercase">Level 2 Escalation (+5 Days)</div>
                <div className="font-bold text-white text-sm mt-0.5">Regional Head → Bureau Officer</div>
                <p className="text-[11px] text-blue-200 mt-1">
                  Triggered at +5 days past deadline. Escalated directly to Member Secretary / Approval Bureau at AICTE HQ.
                </p>
              </div>

              <div className="bg-white/10 rounded-xl p-3 border border-white/15">
                <div className="text-[10px] font-bold text-emerald-300 uppercase">Level 3 Apex (+10 Days)</div>
                <div className="font-bold text-white text-sm mt-0.5">Bureau Officer → Apex Council</div>
                <p className="text-[11px] text-blue-200 mt-1">
                  Executive Committee / Vigilance hearing convened for statutory non-compliance orders.
                </p>
              </div>
            </div>
          </div>

          {/* Escalations Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                Automated Escalation Events Log ({escalations.length})
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Enforces Non-Negotiable Rule #1 (Immutable Audited State)
              </span>
            </div>

            {loadingEscalations ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                Loading escalation records...
              </div>
            ) : escalations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                No active escalations recorded. All cases within prescribed SLA.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Level</th>
                      <th className="py-2.5 px-4 font-semibold">Entity / Ref</th>
                      <th className="py-2.5 px-4 font-semibold">Institution</th>
                      <th className="py-2.5 px-4 font-semibold">Chain of Command</th>
                      <th className="py-2.5 px-4 font-semibold">Escalation Reason</th>
                      <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {escalations.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              e.escalation_level === 1
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : e.escalation_level === 2
                                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                : 'bg-red-100 text-red-900 border border-red-300'
                            }`}
                          >
                            Level {e.escalation_level}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {e.application_id ? (
                            <Link
                              to={`/applications/${e.application_id}`}
                              className="text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1"
                            >
                              <span>{e.application_number}</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span>{e.application_number}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {e.institution_name}
                        </td>
                        <td className="py-3 px-4 text-slate-800">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span className="text-slate-500">{e.from_role}</span>
                            <ArrowRight className="w-3 h-3 text-amber-600" />
                            <span className="text-red-700 font-bold">{e.escalated_to_role}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs leading-relaxed">
                          {e.escalation_reason}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                          {new Date(e.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: ALERT RULES MATRIX */}
      {/* ============================================================== */}
      {activeTab === 'RULES' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <h3 className="font-bold text-sm text-slate-900">
              Database-Driven Dynamic Alert & Escalation Rules Matrix
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configured notification offsets, trigger types, severities, and target administrative roles.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            {loadingRules ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                Loading alert rules...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">ID</th>
                      <th className="py-2.5 px-4 font-semibold">Category</th>
                      <th className="py-2.5 px-4 font-semibold">Trigger Type</th>
                      <th className="py-2.5 px-4 font-semibold">Offset (Days)</th>
                      <th className="py-2.5 px-4 font-semibold">Severity</th>
                      <th className="py-2.5 px-4 font-semibold">Target Roles</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      {user?.role === 'ADMIN' && (
                        <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rules.map((rule) => {
                      let rolesList: string[] = [];
                      try {
                        rolesList = JSON.parse(rule.notify_roles_json);
                      } catch {
                        rolesList = [rule.notify_roles_json];
                      }

                      return (
                        <tr key={rule.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-mono text-slate-500">#{rule.id}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                              {rule.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700">
                            {rule.trigger_type}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {rule.offset_days > 0
                              ? `+${rule.offset_days}d`
                              : `${rule.offset_days}d`}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                rule.severity === 'ESCALATION'
                                  ? 'bg-red-100 text-red-900'
                                  : rule.severity === 'CRITICAL'
                                  ? 'bg-rose-100 text-rose-900'
                                  : rule.severity === 'WARNING'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-blue-100 text-blue-900'
                              }`}
                            >
                              {rule.severity}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {rolesList.map((r) => (
                                <span
                                  key={r}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700"
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          </td>
                          {user?.role === 'ADMIN' && (
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  setEditingRule(rule);
                                  setEditOffset(rule.offset_days);
                                  setEditSeverity(rule.severity);
                                }}
                                className="px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-50 rounded font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" />
                                Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Rule Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
            <h3 className="font-bold text-sm text-slate-900">
              Edit Alert Rule #{editingRule.id} ({editingRule.category})
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Adjust trigger offset and severity. Modifications are recorded in the audit trail.
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Trigger Offset (Days)
                </label>
                <input
                  type="number"
                  value={editOffset}
                  onChange={(e) => setEditOffset(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Negative values represent reminder offsets before deadline (e.g. -7). Positive values represent days overdue (e.g. +2).
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Alert Severity
                </label>
                <select
                  value={editSeverity}
                  onChange={(e) => setEditSeverity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                >
                  <option value="INFO">INFO</option>
                  <option value="WARNING">WARNING</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="ESCALATION">ESCALATION</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingRule(null)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                disabled={savingRule}
                className="px-4 py-2 text-xs font-semibold bg-[#0B2240] hover:bg-[#12315a] disabled:opacity-50 text-white rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {savingRule && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AlertsPage;
