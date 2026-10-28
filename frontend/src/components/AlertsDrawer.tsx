import React, { useState, useEffect } from 'react';
import { X, Bell, AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw, Zap } from 'lucide-react';
import { Alert } from '../types';
import { apiRequest } from '../api/client';

interface AlertsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAlertUpdated?: () => void;
}

export const AlertsDrawer: React.FC<AlertsDrawerProps> = ({
  isOpen,
  onClose,
  onAlertUpdated,
}) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Alert[]>('/alerts');
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen]);

  const markRead = async (id: number) => {
    try {
      await apiRequest(`/alerts/${id}/read`, { method: 'POST' });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
      if (onAlertUpdated) onAlertUpdated();
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
      if (onAlertUpdated) onAlertUpdated();
    } catch (err) {
      console.error('Failed to trigger SLA check:', err);
    } finally {
      setTriggering(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 bg-[#0B2240] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <h2 className="font-semibold text-base">Alerts & Compliance Escalations</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live SLA Breach Engine Action Bar */}
        <div className="p-3 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between gap-2">
          <div className="text-xs text-amber-900 leading-tight">
            <span className="font-semibold block flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-600" /> APScheduler SLA Engine
            </span>
            Evaluate SLA breaches & auto-escalation ladders
          </div>
          <button
            onClick={triggerSlaCheck}
            disabled={triggering}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow-xs flex items-center gap-1.5 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${triggering ? 'animate-spin' : ''}`} />
            Run SLA Audit
          </button>
        </div>

        {triggerMessage && (
          <div className="px-4 py-2 bg-emerald-50 text-emerald-800 text-xs border-b border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {triggerMessage}
          </div>
        )}

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
              Loading real-time notifications...
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              No active alerts or escalation notices.
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3.5 rounded-lg border transition-all ${
                  alert.is_read
                    ? 'bg-slate-50/60 border-slate-200 text-slate-600'
                    : alert.severity === 'ESCALATION'
                    ? 'bg-red-50 border-red-300 text-red-900 shadow-xs'
                    : alert.severity === 'CRITICAL'
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : alert.severity === 'WARNING'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wide">
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
                    {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <h3 className="font-semibold text-sm mt-1">{alert.title}</h3>
                <p className="text-xs mt-1 text-slate-700 leading-relaxed">{alert.message}</p>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">
                    Target: {alert.recipient_role || 'All Roles'}
                  </span>
                  {!alert.is_read && (
                    <button
                      onClick={() => markRead(alert.id)}
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-xs cursor-pointer"
                    >
                      Mark as acknowledged
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
