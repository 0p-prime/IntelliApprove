import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  X,
  Bell,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Zap,
  ExternalLink,
  CheckCheck,
  ArrowRight
} from 'lucide-react';
import { Alert } from '../types';
import { apiRequest } from '../api/client';
import { Button } from './ui/Button';

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
  const navigate = useNavigate();
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
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
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

  const markAllRead = async () => {
    try {
      await apiRequest('/alerts/read-all', { method: 'POST' });
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
      if (onAlertUpdated) onAlertUpdated();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
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

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px] animate-backdrop-in"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md bg-white h-full border-l border-[#E6E6E6] flex flex-col animate-drawer-in">
        {/* Drawer Header - High Contrast Minimalist */}
        <div className="p-4 bg-white border-b border-[#E6E6E6] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-[#111111]" />
            <div>
              <h2 className="font-bold text-sm text-[#111111]">Notifications & Escalations</h2>
              <span className="text-[11px] text-[#595959]">
                {unreadCount > 0 ? `${unreadCount} unread notices` : 'All caught up'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="secondary" size="sm" onClick={markAllRead}>Mark all</Button>
            )}
            <Button variant="quiet" size="icon" aria-label="Close" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        {/* Live SLA Breach Engine Action Bar */}
        <div className="p-3 bg-[#F4F4F5] border-b border-[#E6E6E6] flex items-center justify-between gap-2">
          <div className="text-xs text-[#111111] leading-tight">
            <span className="font-semibold block flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-[#111111]" /> Automated Rules Engine
            </span>
            <span className="text-[11px] text-[#595959]">Evaluate SLA breaches & auto-escalations</span>
          </div>
          <Button variant="primary" size="sm" loading={triggering} onClick={triggerSlaCheck}>Run SLA audit</Button>
        </div>

        {triggerMessage && (
          <div className="px-4 py-2 bg-[#F4F4F5] text-[#111111] text-xs border-b border-[#E6E6E6] flex items-center gap-1.5 font-medium animate-row-enter">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#111111] shrink-0" />
            <span>{triggerMessage}</span>
          </div>
        )}

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-[#595959] text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#595959]" />
              Loading real-time notifications...
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 text-[#595959] text-sm">
              <CheckCircle2 className="w-8 h-8 text-[#111111] mx-auto mb-2" />
              No active alerts or escalation notices.
            </div>
          ) : (
            alerts.slice(0, 15).map((alert, index) => {
              const isUrgent = alert.severity === 'ESCALATION' || alert.severity === 'CRITICAL';
              return (
                <div
                  key={alert.id}
                  style={{ animationDelay: `${index * 40}ms` }}
                  className={`p-3.5 rounded-[8px] border transition-all animate-row-enter ${
                    alert.is_read
                      ? 'bg-[#FAFAFA] border-[#E6E6E6] text-[#595959]'
                      : isUrgent
                      ? 'bg-white border-[#E0202A] text-[#111111]'
                      : 'bg-white border-[#E6E6E6] text-[#111111]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wide">
                      {isUrgent ? (
                        <AlertTriangle className="w-4 h-4 text-[#B5121A] animate-chip-pulse" />
                      ) : (
                        <Bell className="w-4 h-4 text-[#111111]" />
                      )}
                      <span className={isUrgent ? 'text-[#B5121A] animate-chip-pulse font-bold' : 'text-[#111111]'}>
                        {alert.severity}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#595959]">
                      {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="font-semibold text-sm mt-1 text-[#111111]">{alert.title}</h3>
                  <p className="text-xs mt-1 text-[#595959] leading-relaxed">{alert.message}</p>

                  <div className="mt-2.5 pt-2 border-t border-[#E6E6E6] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[#595959] text-[11px]">
                        {alert.recipient_role || 'All Administrative Roles'}
                      </span>
                      {alert.application_id && (
                        <Button variant="quiet" size="sm" onClick={() => { onClose(); navigate(`/applications/${alert.application_id}`); }}>
      Open case
    </Button>
                      )}
                    </div>

                    {!alert.is_read && (
                      <Button variant="quiet" size="sm" onClick={() => markRead(alert.id)}>Mark verified</Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer with Link to Full Notification Center */}
        <div className="p-3 bg-[#F4F4F5] border-t border-[#E6E6E6] flex items-center justify-between">
          <Link
            to="/alerts"
            onClick={onClose}
            className="text-xs font-semibold text-[#111111] hover:text-[#B5121A] flex items-center gap-1.5"
          >
            <span>Open Full Notification Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <span className="text-[10px] text-[#595959]">Regulatory Vigilance</span>
        </div>
      </div>
    </div>
  );
};
