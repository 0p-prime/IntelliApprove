import React, { useState, useEffect } from 'react';
import {
  Clock,
  FastForward,
  RotateCcw,
  Calendar,
  CheckCircle2,
  ChevronDown,
  X,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { SystemClock } from '../types';

export const TimeTravelWidget: React.FC = () => {
  const [clock, setClock] = useState<SystemClock | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState<string>('');

  const fetchClock = async () => {
    try {
      const data = await apiRequest<SystemClock>('/system/clock');
      setClock(data);
    } catch (err) {
      console.error('Failed to load system clock:', err);
    }
  };

  useEffect(() => {
    fetchClock();
  }, []);

  const handleAdvance = async (days: number) => {
    setLoading(true);
    setFeedback(null);
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
      setFeedback(
        `Fast-forwarded +${days}d! Created ${res.evaluation.escalations_created} escalations & ${res.evaluation.notifications_created} notifications.`
      );
      // Notify other views to re-fetch live data
      window.dispatchEvent(new CustomEvent('time-travel-updated', { detail: res.clock }));
    } catch (err: any) {
      alert(`Time advance failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDate = async () => {
    if (!customDate) return;
    setLoading(true);
    setFeedback(null);
    try {
      const targetIso = new Date(customDate).toISOString();
      const res = await apiRequest<{
        clock: SystemClock;
        evaluation: {
          notifications_created: number;
          escalations_created: number;
        };
      }>('/system/clock/set', {
        method: 'POST',
        body: JSON.stringify({ target_date: targetIso })
      });
      setClock(res.clock);
      setFeedback(
        `Jumped to ${customDate}! Evaluated alert engine (${res.evaluation.notifications_created} notifications).`
      );
      window.dispatchEvent(new CustomEvent('time-travel-updated', { detail: res.clock }));
    } catch (err: any) {
      alert(`Date change failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await apiRequest<{ clock: SystemClock }>('/system/clock/reset', {
        method: 'POST'
      });
      setClock(res.clock);
      setFeedback('System clock reset to real-time UTC.');
      window.dispatchEvent(new CustomEvent('time-travel-updated', { detail: res.clock }));
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setLoading(false);
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
    <div className="relative">
      {/* Top Navbar Trigger Pill */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-semibold text-amber-200 transition-all cursor-pointer shadow-inner"
        title="Time-Travel Simulator for Evaluators & Hackathon Judges"
      >
        <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
        <span className="hidden sm:inline text-amber-300 font-bold">Sim Time:</span>
        <span className="text-white font-mono">{formatSimDate(clock?.simulated_date)}</span>
        {clock?.is_simulated && (
          <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full shadow-xs">
            {clock.delta_days > 0 ? `+${Math.round(clock.delta_days)}d` : `${Math.round(clock.delta_days)}d`}
          </span>
        )}
        <ChevronDown className="w-3 h-3 text-amber-400/80" />
      </button>

      {/* Popover Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 text-slate-800 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-start justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                <FastForward className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                  Demo Time-Travel Controller
                </h4>
                <p className="text-[11px] text-slate-500">
                  SIH 2026 Evaluation Tool (PS 26262)
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active System Clock
            </span>
            <div className="font-mono text-sm font-bold text-slate-900 mt-0.5">
              {clock?.simulated_date ? new Date(clock.simulated_date).toUTCString() : 'Loading...'}
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-600">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span>
                {clock?.is_simulated
                  ? `Simulating future timestamp (${Math.round(clock.delta_days)} days ahead)`
                  : 'Synchronized with real wall clock'}
              </span>
            </div>
          </div>

          {feedback && (
            <div className="mt-2.5 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="leading-tight">{feedback}</span>
            </div>
          )}

          {/* Quick Fast-Forward Buttons */}
          <div className="mt-3">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
              Quick Fast-Forward Simulation
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: '+1 Day', days: 1 },
                { label: '+3 Days', days: 3 },
                { label: '+7 Days', days: 7 },
                { label: '+30 Days', days: 30 }
              ].map((btn) => (
                <button
                  key={btn.days}
                  onClick={() => handleAdvance(btn.days)}
                  disabled={loading}
                  className="px-2 py-2 bg-slate-100 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:text-amber-900 cursor-pointer transition-all disabled:opacity-50 text-center"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Jump to Specific Date */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
              Jump to Specific Calendar Date
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                onClick={handleSetDate}
                disabled={loading || !customDate}
                className="px-3 py-1.5 bg-[#0B2240] hover:bg-[#12315a] disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
              >
                Jump
              </button>
            </div>
          </div>

          {/* Reset Button & Info */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={handleReset}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-rose-600 font-medium cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Wall Clock
            </button>
            <span className="text-[10px] text-slate-400">
              Evaluates SLA & Ladders
            </span>
          </div>

          <div className="mt-2.5 text-[10px] text-slate-500 bg-amber-50/60 p-2 rounded-lg border border-amber-200/60 flex items-start gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Advancing time immediately triggers the SLA engine, cascades overdue stages up the escalation ladder, and flags expired leases.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

