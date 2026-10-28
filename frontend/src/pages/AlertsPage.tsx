import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw, Zap } from 'lucide-react';
import { apiRequest } from '../api/client';
import { Alert } from '../types';
import { LoadingState, EmptyState, ErrorState } from '../components/States';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState('ALL');

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

  useEffect(() => {
    fetchAlerts();
  }, []);

  const markRead = async (id: number) => {
    try {
      await apiRequest(`/alerts/${id}/read`, { method: 'POST' });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const triggerSlaCheck = async () => {
    setTriggering(true);
    setTriggerMessage(null);
    try {
      const res = await apiRequest<{ message: string }>('/alerts/trigger-sla-check', { method: 'POST' });
      setTriggerMessage(res.message);
      await fetchAlerts();
    } catch (err: any) {
      alert(`Trigger failed: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

  const filtered = filterSeverity === 'ALL'
    ? alerts
    : alerts.filter((a) => a.severity === filterSeverity);

  if (loading) return <LoadingState message="Loading alert notifications..." />;
  if (error) return <ErrorState message={error} onRetry={fetchAlerts} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Alert & Escalation Management Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time compliance monitoring, SLA deadline alerts, and automatic escalation ladder notifications.
          </p>
        </div>

        <button
          onClick={triggerSlaCheck}
          disabled={triggering}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer self-start sm:self-auto transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${triggering ? 'animate-spin' : ''}`} />
          Run SLA Breach Audit Engine
        </button>
      </div>

      {triggerMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {triggerMessage}
        </div>
      )}

      {/* Severity Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        {['ALL', 'ESCALATION', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              filterSeverity === sev
                ? 'border-[#0B2240] text-[#0B2240] font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {sev === 'ALL' ? 'All Alerts' : sev}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No Alerts Found"
          description="There are currently no alerts matching this severity category."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
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
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  ) : alert.severity === 'CRITICAL' ? (
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                  ) : (
                    <Bell className="w-4 h-4 text-blue-600" />
                  )}
                  <span>{alert.severity}</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {new Date(alert.created_at).toLocaleString()}
                </span>
              </div>

              <h3 className="font-bold text-sm text-slate-900 mt-1">{alert.title}</h3>
              <p className="text-xs text-slate-700 mt-1 leading-relaxed">{alert.message}</p>

              <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">
                  Target Recipient: <strong>{alert.recipient_role || 'All Administrative Roles'}</strong>
                </span>
                {!alert.is_read && (
                  <button
                    onClick={() => markRead(alert.id)}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs cursor-pointer"
                  >
                    Mark as Acknowledged
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
