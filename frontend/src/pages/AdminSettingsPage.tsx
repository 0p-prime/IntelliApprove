import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Settings,
  GitFork,
  Flame,
  CheckSquare,
  Activity,
  ShieldCheck,
  Database,
  RefreshCw,
  Clock,
  FastForward,
  RotateCcw,
  CheckCircle2,
  Bell,
  TrendingUp,
  Zap
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { SystemClock } from '../types';
import { LoadingState } from '../components/States';

export const AdminSettingsPage: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Time Travel State
  const [clock, setClock] = useState<SystemClock | null>(null);
  const [timeTraveling, setTimeTraveling] = useState(false);
  const [timeTravelFeedback, setTimeTravelFeedback] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState<number>(30);

  const fetchStatus = async () => {
    try {
      const [hData, cData] = await Promise.all([
        apiRequest('/health'),
        apiRequest<SystemClock>('/system/clock')
      ]);
      setHealth(hData);
      setClock(cData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTimeTravel = async (days: number) => {
    setTimeTraveling(true);
    setTimeTravelFeedback(null);
    try {
      const res = await apiRequest<{
        status: string;
        message: string;
        clock: SystemClock;
        evaluation: {
          notifications_created: number;
          escalations_created: number;
          escalations_resolved: number;
        };
      }>('/admin/time-travel', {
        method: 'POST',
        body: JSON.stringify({ days })
      });
      setClock(res.clock);
      setTimeTravelFeedback(
        `Fast-forwarded +${days} days! Evaluated alert engine: ${res.evaluation.escalations_created} escalations created, ${res.evaluation.notifications_created} notifications dispatched.`
      );
      window.dispatchEvent(new CustomEvent('time-travel-updated', { detail: res.clock }));
    } catch (err: any) {
      alert(`Time travel error: ${err.message}`);
    } finally {
      setTimeTraveling(false);
    }
  };

  const handleResetClock = async () => {
    setTimeTraveling(true);
    setTimeTravelFeedback(null);
    try {
      const res = await apiRequest<{
        status: string;
        clock: SystemClock;
      }>('/admin/reset-clock', {
        method: 'POST'
      });
      setClock(res.clock);
      setTimeTravelFeedback('System clock re-synchronized with real UTC wall clock.');
      window.dispatchEvent(new CustomEvent('time-travel-updated', { detail: res.clock }));
    } catch (err: any) {
      alert(`Reset error: ${err.message}`);
    } finally {
      setTimeTraveling(false);
    }
  };

  const formatSimDate = (dateStr?: string) => {
    if (!dateStr) return 'Loading...';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            System Administration & Dynamic Configurations
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Enforces Non-Negotiable Rule #3: All timelines, routes, reminder offsets, and ladders are configurable in the database.
          </p>
        </div>
      </div>

      {/* BIG DEMO TIME-TRAVEL CONTROLLER PANEL */}
      <div className="bg-gradient-to-br from-[#0B2240] via-slate-900 to-blue-950 text-white rounded-2xl p-6 shadow-xl border border-blue-900/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center justify-center shadow-inner">
              <Clock className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                Time-Travel Clock & Regulatory Simulator
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-mono font-bold">
                  SIH Hackathon Demo Tool
                </span>
              </h3>
              <p className="text-xs text-blue-200/80">
                Fast-forward simulated time to trigger stage SLA breaches, overdue undertaking escalations, and lease expiries without manual delays.
              </p>
            </div>
          </div>

          <button
            onClick={handleResetClock}
            disabled={timeTraveling}
            className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Real-Time Clock
          </button>
        </div>

        {/* Current Active Date Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/5 rounded-xl p-4 border border-white/10">
          <div>
            <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block">
              Active Simulated Date
            </span>
            <div className="text-lg font-black text-amber-300 font-mono mt-0.5">
              {formatSimDate(clock?.simulated_date)}
            </div>
            <span className="text-[11px] text-slate-300 block font-mono">
              {clock?.simulated_date ? new Date(clock.simulated_date).toUTCString() : ''}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block">
              Simulation Status
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${clock?.is_simulated ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="font-bold text-sm text-white">
                {clock?.is_simulated ? `Fast-Forwarded (+${Math.round(clock.delta_days)} days)` : 'Synchronized with Real UTC'}
              </span>
            </div>
            <span className="text-[11px] text-blue-200/70 block mt-0.5">
              Affects all SLA calculations & validity monitoring
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block">
              Automated Rules Engine
            </span>
            <div className="font-bold text-sm text-emerald-400 flex items-center gap-1.5 mt-1">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>APScheduler Daemon Active</span>
            </div>
            <span className="text-[11px] text-blue-200/70 block mt-0.5">
              Evaluates alert_rules every 60 seconds
            </span>
          </div>
        </div>

        {timeTravelFeedback && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{timeTravelFeedback}</span>
          </div>
        )}

        {/* Big Action Buttons */}
        <div className="pt-2">
          <label className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block mb-2">
            Preset Time Travel Fast-Forwards (Instant SLA & Escalation Trigger)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { days: 7, label: '+7 Days', desc: 'Trigger EVC & T-7 Undertaking Reminders' },
              { days: 30, label: '+30 Days', desc: 'Trigger Overdue Escalations & 30d Leases' },
              { days: 90, label: '+90 Days', desc: 'Trigger Full Cycle SLA Breaches & Expiries' },
            ].map((btn) => (
              <button
                key={btn.days}
                onClick={() => handleTimeTravel(btn.days)}
                disabled={timeTraveling}
                className="p-3.5 bg-white/10 hover:bg-amber-500/20 hover:border-amber-400/60 border border-white/15 rounded-xl text-left transition-all cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-black text-base text-white group-hover:text-amber-300">
                    {btn.label}
                  </span>
                  <FastForward className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-[11px] text-blue-200/80 leading-tight">
                  {btn.desc}
                </p>
              </button>
            ))}

            {/* Custom Days Input */}
            <div className="p-3 bg-white/5 border border-white/15 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider block mb-1">
                Custom Days
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1 bg-white/10 border border-white/20 rounded text-xs font-mono text-white text-center focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <button
                  onClick={() => handleTimeTravel(customDays)}
                  disabled={timeTraveling}
                  className="flex-1 py-1 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded transition-colors cursor-pointer"
                >
                  Advance
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Status Banner */}
      <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-600" />
          Engine Health & Scheduler Diagnostics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500 block">FastAPI Backend Status</span>
            <span className="font-bold text-emerald-600 text-sm mt-0.5 block">
              {health?.status === 'healthy' ? 'Operational (200 OK)' : 'Connecting...'}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500 block">APScheduler SLA Monitor</span>
            <span className="font-bold text-blue-800 text-sm mt-0.5 block">
              {health?.scheduler_enabled ? 'Active (Running every 60s)' : 'Disabled'}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500 block">Persistence Storage</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block">
              PostgreSQL / SQLite Fallback Connected
            </span>
          </div>
        </div>
      </div>

      {/* Admin Quick Panels */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center mb-3">
              <GitFork className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">Workflow Stages & Routes</h4>
            <p className="text-xs text-slate-500 mt-1">
              Configure lifecycle stages, max SLA hours, assigned roles, and transition permissions.
            </p>
          </div>
          <Link
            to="/config/workflow"
            className="px-3 py-2 bg-[#0B2240] hover:bg-[#07172C] text-white rounded-lg text-xs font-semibold text-center transition-colors"
          >
            Manage Stage Routes
          </Link>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center mb-3">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">Alert Rules & Offsets</h4>
            <p className="text-xs text-slate-500 mt-1">
              Configure T-7, T-3, T-1 reminder offsets, severities, and target notification roles.
            </p>
          </div>
          <Link
            to="/alerts"
            className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold text-center transition-colors"
          >
            Manage Alert Rules
          </Link>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-800 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">Escalation Ladder & Chain</h4>
            <p className="text-xs text-slate-500 mt-1">
              View Level 0, 1, 2, and 3 statutory administrative chain of command and active escalation events.
            </p>
          </div>
          <Link
            to="/alerts"
            className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold text-center transition-colors"
          >
            View Escalations
          </Link>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center mb-3">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">AICTE Handbook Norms</h4>
            <p className="text-xs text-slate-500 mt-1">
              Configure statutory minimums for FSR, land area, built-up area, computing, and committees.
            </p>
          </div>
          <Link
            to="/config/compliance"
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold text-center transition-colors"
          >
            Manage APH Norms
          </Link>
        </div>
      </div>
    </div>
  );
};
export default AdminSettingsPage;
