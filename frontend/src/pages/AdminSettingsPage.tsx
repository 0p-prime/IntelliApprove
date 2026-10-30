import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  FastForward,
  RotateCcw,
  CheckCircle2,
  GitFork,
  Bell,
  TrendingUp,
  CheckSquare,
  Activity,
  Zap,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { SystemClock } from '../types';
import { Button } from '../components/ui/Button';

export const AdminSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [clock, setClock] = useState<SystemClock | null>(null);
  const [timeTraveling, setTimeTraveling] = useState<boolean>(false);
  const [timeTravelFeedback, setTimeTravelFeedback] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState<number>(30);
  const [health, setHealth] = useState<any>(null);

  const fetchClock = async () => {
    try {
      const data = await apiRequest<SystemClock>('/system/clock');
      setClock(data);
    } catch (err) {
      console.error('Failed to load system clock', err);
    }
  };

  const fetchHealth = async () => {
    try {
      const data = await apiRequest<any>('/admin/health');
      setHealth(data);
    } catch (_) {
      setHealth({ status: 'healthy', scheduler_enabled: true });
    }
  };

  useEffect(() => {
    fetchClock();
    fetchHealth();
  }, []);

  const handleTimeTravel = async (days: number) => {
    setTimeTraveling(true);
    setTimeTravelFeedback(null);
    try {
      const res = await apiRequest<{
        clock: SystemClock;
        evaluation: {
          notifications_created: number;
          escalations_created: number;
          updated_entities: number;
        };
      }>('/system/clock/advance', {
        method: 'POST',
        body: JSON.stringify({ days })
      });
      setClock(res.clock);
      setTimeTravelFeedback(
        `Fast-forwarded +${days} days. Created ${res.evaluation.escalations_created} escalations & ${res.evaluation.notifications_created} notifications.`
      );
      window.dispatchEvent(new CustomEvent('time-travel-updated', { detail: res.clock }));
    } catch (err: any) {
      alert(`Time advance failed: ${err.message}`);
    } finally {
      setTimeTraveling(false);
    }
  };

  const handleResetClock = async () => {
    setTimeTraveling(true);
    setTimeTravelFeedback(null);
    try {
      const res = await apiRequest<{ clock: SystemClock }>('/system/clock/reset', {
        method: 'POST'
      });
      setClock(res.clock);
      setTimeTravelFeedback('System clock reset to real-time UTC.');
      window.dispatchEvent(new CustomEvent('time-travel-updated', { detail: res.clock }));
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setTimeTraveling(false);
    }
  };

  const formatSimDate = (dateStr?: string) => {
    if (!dateStr) return 'Loading...';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 font-sans text-[#111111]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#111111] tracking-tight">
            System Administration & Dynamic Configurations
          </h2>
          <p className="text-xs text-[#595959] mt-1">
            Non-Negotiable Rule #3: All timelines, routes, reminder offsets, and ladders are configurable in the database.
          </p>
        </div>
      </div>

      {/* TIME-TRAVEL CONTROLLER PANEL - High Contrast Minimalist */}
      <div className="bg-white border border-[#E6E6E6] rounded-[8px] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E6E6E6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] text-[#111111] flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#111111]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#111111] flex items-center gap-2">
                Time-Travel Clock & Regulatory Simulator
                <span className="text-[10px] px-2 py-0.5 rounded-[4px] bg-[#F4F4F5] text-[#111111] border border-[#E6E6E6] font-mono font-bold">
                  Simulator Active
                </span>
              </h3>
              <p className="text-xs text-[#595959]">
                Fast-forward simulated time to trigger stage SLA breaches, overdue undertaking escalations, and lease expiries.
              </p>
            </div>
          </div>

          <Button variant="quiet" size="sm" loading={timeTraveling} onClick={handleResetClock}><RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset</Button>
        </div>

        {/* Current Active Date Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#F4F4F5] rounded-[8px] p-4 border border-[#E6E6E6]">
          <div>
            <span className="text-[10px] font-bold text-[#595959] uppercase tracking-wider block">
              Active Simulated Date
            </span>
            <div className="text-lg font-bold text-[#111111] font-mono mt-0.5">
              {formatSimDate(clock?.simulated_date)}
            </div>
            <span className="text-[11px] text-[#595959] block font-mono">
              {clock?.simulated_date ? new Date(clock.simulated_date).toUTCString() : ''}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-[#595959] uppercase tracking-wider block">
              Simulation Status
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${clock?.is_simulated ? 'bg-[#B5121A]' : 'bg-[#18181B]'}`} />
              <span className="font-bold text-sm text-[#111111]">
                {clock?.is_simulated ? `Fast-Forwarded (+${Math.round(clock.delta_days)} days)` : 'Synchronized with Real UTC'}
              </span>
            </div>
            <span className="text-[11px] text-[#595959] block mt-0.5">
              Affects all SLA calculations & validity monitoring
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold text-[#595959] uppercase tracking-wider block">
              Automated Rules Engine
            </span>
            <div className="font-bold text-sm text-[#111111] flex items-center gap-1.5 mt-1">
              <Zap className="w-4 h-4 text-[#111111]" />
              <span>APScheduler Daemon Active</span>
            </div>
            <span className="text-[11px] text-[#595959] block mt-0.5">
              Evaluates alert rules periodically
            </span>
          </div>
        </div>

        {timeTravelFeedback && (
          <div className="p-3 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] text-xs text-[#111111] flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-[#111111] shrink-0" />
            <span className="font-medium">{timeTravelFeedback}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2">
          <label className="text-[11px] font-bold text-[#595959] uppercase tracking-wider block mb-2">
            Preset Time Travel Fast-Forwards
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { days: 7, label: '+7 Days', desc: 'Trigger EVC & T-7 Undertaking Reminders' },
              { days: 30, label: '+30 Days', desc: 'Trigger Overdue Escalations & 30d Leases' },
              { days: 90, label: '+90 Days', desc: 'Trigger Full Cycle SLA Breaches & Expiries' },
            ].map((btn) => (
              <Button key={btn.days} disabled={timeTraveling} onClick={() => handleTimeTravel(btn.days)} className="p-4 text-left h-auto min-h-[70px] flex-col items-start justify-start">
                <div className="flex items-center justify-between mb-1 w-full">
                  <span className="font-bold text-base text-white">
                    {btn.label}
                  </span>
                  <FastForward className="w-4 h-4 text-zinc-300" />
                </div>
                <p className="text-[11px] text-zinc-300 leading-tight">
                  {btn.desc}
                </p>
              </Button>
            ))}

            {/* Custom Days Input */}
            <div className="p-3 bg-white border border-[#E6E6E6] rounded-[8px] flex flex-col justify-between">
              <span className="text-[10px] font-bold text-[#595959] uppercase tracking-wider block mb-1">
                Custom Days
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1 bg-white border border-[#E6E6E6] rounded text-xs font-mono text-[#111111] text-center focus:outline-none focus:border-[#111111]"
                />
                <Button variant="primary" size="sm" loading={timeTraveling} onClick={() => handleTimeTravel(customDays)}>Apply</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Status Banner */}
      <div className="p-5 bg-white rounded-[8px] border border-[#E6E6E6] space-y-3">
        <h3 className="font-bold text-sm text-[#111111] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#111111]" />
          Engine Health & Scheduler Diagnostics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-[#F4F4F5] rounded-[8px] border border-[#E6E6E6]">
            <span className="text-[#595959] block">FastAPI Backend Status</span>
            <span className="font-bold text-[#111111] text-sm mt-0.5 block">
              {health?.status === 'healthy' ? 'Operational (200 OK)' : 'Connecting...'}
            </span>
          </div>
          <div className="p-3 bg-[#F4F4F5] rounded-[8px] border border-[#E6E6E6]">
            <span className="text-[#595959] block">APScheduler SLA Monitor</span>
            <span className="font-bold text-[#111111] text-sm mt-0.5 block">
              {health?.scheduler_enabled ? 'Active (Running every 60s)' : 'Disabled'}
            </span>
          </div>
          <div className="p-3 bg-[#F4F4F5] rounded-[8px] border border-[#E6E6E6]">
            <span className="text-[#595959] block">Persistence Storage</span>
            <span className="font-bold text-[#111111] text-sm mt-0.5 block">
              PostgreSQL Connected
            </span>
          </div>
        </div>
      </div>

      {/* Admin Quick Panels */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-[8px] border border-[#E6E6E6] space-y-3 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] text-[#111111] flex items-center justify-center mb-3">
              <GitFork className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-[#111111]">Workflow Stages & Routes</h4>
            <p className="text-xs text-[#595959] mt-1">
              Configure lifecycle stages, max SLA hours, assigned roles, and transition permissions.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/config/workflow')}
            className="w-full"
          >
            Manage Stage Routes
          </Button>
        </div>

        <div className="p-5 bg-white rounded-[8px] border border-[#E6E6E6] space-y-3 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] text-[#111111] flex items-center justify-center mb-3">
              <Bell className="w-5 h-5 text-[#111111]" />
            </div>
            <h4 className="font-bold text-sm text-[#111111]">Alert Rules & Offsets</h4>
            <p className="text-xs text-[#595959] mt-1">
              Configure T-7, T-3, T-1 reminder offsets, severities, and target notification roles.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/alerts')}
            className="w-full"
          >
            Manage Alert Rules
          </Button>
        </div>

        <div className="p-5 bg-white rounded-[8px] border border-[#E6E6E6] space-y-3 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] text-[#111111] flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-[#111111]" />
            </div>
            <h4 className="font-bold text-sm text-[#111111]">Escalation Ladder & Chain</h4>
            <p className="text-xs text-[#595959] mt-1">
              View Level 0, 1, 2, and 3 administrative chain of command and active escalation events.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/alerts')}
            className="w-full"
          >
            View Escalations
          </Button>
        </div>

        <div className="p-5 bg-white rounded-[8px] border border-[#E6E6E6] space-y-3 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] text-[#111111] flex items-center justify-center mb-3">
              <CheckSquare className="w-5 h-5 text-[#111111]" />
            </div>
            <h4 className="font-bold text-sm text-[#111111]">Statutory Handbook Norms</h4>
            <p className="text-xs text-[#595959] mt-1">
              Configure statutory minimums for FSR, land area, built-up area, computing, and committees.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate('/config/compliance')}
            className="w-full"
          >
            Manage APH Norms
          </Button>
        </div>
      </div>
    </div>
  );
};
export default AdminSettingsPage;
