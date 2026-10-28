import React, { useState } from 'react';
import {
  Compass,
  Sparkles,
  ShieldCheck,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  UserCheck,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../api/client';
import { useToast } from '../context/ToastContext';

export const DemoBanner: React.FC<{
  onOpenTour: () => void;
}> = ({ onOpenTour }) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [advancing, setAdvancing] = useState<boolean>(false);

  // Quick 30-day time advance for judges demo
  const handleQuickAdvance30d = async () => {
    setAdvancing(true);
    try {
      await apiRequest('/admin/time-travel', {
        method: 'POST',
        body: JSON.stringify({ days: 30 })
      });
      toast.success(
        'Simulated system clock fast-forwarded by +30 Days! SLA alerts and multi-tier escalations evaluated.',
        'Clock Simulated'
      );
      // Trigger a page reload or state refresh
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: any) {
      toast.error(err.message || 'Failed to advance clock', 'Simulation Error');
    } finally {
      setAdvancing(false);
    }
  };

  if (collapsed) {
    return (
      <div className="bg-amber-500/10 border-b border-amber-400/30 px-4 py-1 flex items-center justify-between text-xs text-amber-900">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="font-bold text-[11px] uppercase tracking-wider text-amber-800">
            Demo Sandbox Mode Active
          </span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            (SIH 2026 Evaluation Suite)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenTour}
            className="text-[11px] font-bold text-blue-900 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-amber-600" />
            <span>Guided Tour</span>
          </button>
          <button
            onClick={() => setCollapsed(false)}
            className="p-0.5 text-slate-500 hover:text-slate-800 cursor-pointer"
            title="Expand Demo Bar"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-[#07172C] via-[#0B2240] to-[#12335C] text-white border-b border-amber-400/30 shadow-xs relative z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col md:flex-row items-center justify-between gap-2.5">
        {/* Left: Demo Mode Indicator & Guidelines */}
        <div className="flex items-center gap-2.5 text-center md:text-left flex-wrap justify-center md:justify-start">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
            Evaluation Suite
          </span>
          <span className="text-xs font-semibold text-slate-100">
            Smart India Hackathon 2026 (PS 26262)
          </span>
          <span className="hidden lg:inline text-slate-400 text-xs">•</span>
          <span className="hidden lg:inline text-[11px] text-blue-200/90 font-medium">
            AICTE Regulatory Sandbox • Non-Negotiable Human Sign-Off Enforced (Rule #2)
          </span>
        </div>

        {/* Right: Quick Demo Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {/* Start Guided Tour */}
          <button
            onClick={onOpenTour}
            className="px-2.5 py-1 rounded-md bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Launch interactive guided walkthrough of all features"
          >
            <Compass className="w-3.5 h-3.5 text-slate-900" />
            <span>Guided Tour</span>
          </button>

          {/* Quick Fast-Forward Demo Button */}
          <button
            onClick={handleQuickAdvance30d}
            disabled={advancing}
            className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-blue-100 hover:text-white text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title="Fast-forward system clock +30 days to test SLAs and Escalations"
          >
            <Clock className={`w-3.5 h-3.5 text-amber-300 ${advancing ? 'animate-spin' : ''}`} />
            <span>{advancing ? 'Advancing...' : '+30d Time Travel'}</span>
          </button>

          {/* Minimize Banner */}
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Minimize Banner"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

