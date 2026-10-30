import React, { useState, useEffect } from 'react';
import {
  Clock,
  FastForward,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  X,
  Zap
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { SystemClock } from '../types';
import { Button } from './ui/Button';

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
        `Fast-forwarded +${days}d. Created ${res.evaluation.escalations_created} escalations & ${res.evaluation.notifications_created} notifications.`
      );
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
        `Jumped to ${customDate}. Evaluated alerts (${res.evaluation.notifications_created} notifications).`
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
    if (!dateStr) return '30 Oct 2026';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
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
      {/* Top Navbar Trigger Pill - High Contrast */}
      <Button
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Simulation clock control"
        className="!h-10 !min-h-[40px] !rounded-[8px] px-3 flex items-center gap-1.5 font-sans"
      >
        <Clock className="w-3.5 h-3.5 text-white shrink-0" />
        <span className="hidden sm:inline text-white/80 font-normal">Sim time: </span>
        <span className="font-semibold text-white tabular-nums">{formatSimDate(clock?.simulated_date)}</span>
        <ChevronDown className="w-3 h-3 text-white shrink-0" />
      </Button>

      {/* Popover Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-[8px] border border-[#E6E6E6] p-5 text-[#111111] z-50 animate-in fade-in duration-150">
          <div className="flex items-start justify-between pb-3 border-b border-[#E6E6E6]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] text-[#111111] flex items-center justify-center">
                <FastForward className="w-4 h-4 text-[#111111]" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-[#111111] uppercase tracking-wider">
                  Demo Time-Travel Controller
                </h4>
                <p className="text-[11px] text-[#595959]">
                  Simulated System Clock Controller
                </p>
              </div>
            </div>
            <Button variant="quiet" size="icon" aria-label="Close" onClick={() => setIsOpen(false)}><X className="w-4 h-4" /></Button>
          </div>

          <div className="mt-3.5 bg-[#F4F4F5] rounded-[8px] p-3.5 border border-[#E6E6E6]">
            <span className="text-[10px] font-bold text-[#595959] uppercase tracking-wider block">
              Active System Clock
            </span>
            <div className="font-mono text-sm font-bold text-[#111111] mt-0.5">
              {clock?.simulated_date ? new Date(clock.simulated_date).toUTCString() : 'Loading...'}
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#595959]">
              <span className={`inline-block w-2 h-2 rounded-full ${clock?.is_simulated ? 'bg-[#B5121A]' : 'bg-[#18181B]'}`} />
              <span className="font-medium text-[#111111]">
                {clock?.is_simulated
                  ? `Simulating future timestamp (+${Math.round(clock.delta_days)} days ahead)`
                  : 'Synchronized with real wall clock'}
              </span>
            </div>
          </div>

          {feedback && (
            <div className="mt-3 p-2.5 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] text-xs text-[#111111] flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#111111] shrink-0 mt-0.5" />
              <span className="leading-tight">{feedback}</span>
            </div>
          )}

          {/* Quick Fast-Forward Buttons */}
          <div className="mt-3.5">
            <label className="text-[11px] font-bold text-[#595959] uppercase tracking-wider block mb-1.5">
              Quick Fast-Forward Simulation
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '+1 Day', days: 1 },
                { label: '+3 Days', days: 3 },
                { label: '+7 Days', days: 7 },
                { label: '+30 Days', days: 30 }
              ].map((btn) => (
                <Button key={btn.days} variant="secondary" size="sm" disabled={loading} onClick={() => handleAdvance(btn.days)} className="text-center">{btn.label}</Button>
              ))}
            </div>
          </div>

          {/* Jump to Specific Date */}
          <div className="mt-3.5 pt-3.5 border-t border-[#E6E6E6]">
            <label className="text-[11px] font-bold text-[#595959] uppercase tracking-wider block mb-1.5">
              Jump to Specific Calendar Date
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-[#E6E6E6] rounded-[8px] text-xs text-[#111111] bg-white focus:outline-none focus:border-[#111111]"
              />
              <Button variant="primary" size="sm" loading={loading} disabled={!customDate} onClick={handleSetDate}>Apply</Button>
            </div>
          </div>

          {/* Reset Button & Info */}
          <div className="mt-3.5 pt-3.5 border-t border-[#E6E6E6] flex items-center justify-between">
            <Button size="sm" loading={loading} onClick={handleReset}><RotateCcw className="w-3.5 h-3.5 mr-1 text-white" />Reset</Button>
            <span className="text-[10px] text-[#595959]">
              Evaluates SLA & Ladders
            </span>
          </div>

          <div className="mt-3 text-[10px] text-[#595959] bg-[#F4F4F5] p-2.5 rounded-[8px] border border-[#E6E6E6] flex items-start gap-1.5 leading-relaxed">
            <Zap className="w-3.5 h-3.5 text-[#111111] shrink-0 mt-0.5" />
            <span>
              Advancing time immediately triggers the SLA engine, cascades overdue stages up the escalation ladder, and flags expired leases.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
