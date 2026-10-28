import React, { useState } from 'react';
import { AlertTriangle, Clock, ShieldCheck, ChevronDown, Info, HelpCircle } from 'lucide-react';

export interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  percentage: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  details: string;
}

export interface RiskScoreBadgeProps {
  score: number;
  level?: string;
  primaryDriver?: string;
  primaryDriverDetails?: string;
  formula?: string;
  factors?: RiskFactor[];
  compact?: boolean;
}

export const RiskScoreBadge: React.FC<RiskScoreBadgeProps> = ({
  score,
  level,
  primaryDriver,
  primaryDriverDetails,
  formula,
  factors = [],
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const roundedScore = Math.round(score);
  const computedLevel = level || (roundedScore >= 70 ? 'HIGH' : roundedScore >= 40 ? 'MEDIUM' : 'LOW');

  const badgeConfig = {
    HIGH: {
      bg: 'bg-rose-50 text-rose-800 border-rose-300',
      dot: 'bg-rose-500',
      label: 'High Delay Risk',
      icon: AlertTriangle
    },
    MEDIUM: {
      bg: 'bg-amber-50 text-amber-800 border-amber-300',
      dot: 'bg-amber-500',
      label: 'Medium Delay Risk',
      icon: Clock
    },
    LOW: {
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      dot: 'bg-emerald-500',
      label: 'Low Delay Risk',
      icon: ShieldCheck
    }
  }[computedLevel] || {
    bg: 'bg-slate-100 text-slate-800 border-slate-300',
    dot: 'bg-slate-500',
    label: 'Unassessed',
    icon: HelpCircle
  };

  const Icon = badgeConfig.icon;

  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeConfig.bg}`}
        >
          <span className={`w-2 h-2 rounded-full ${badgeConfig.dot}`} />
          <Icon className="w-3.5 h-3.5" />
          <span>{roundedScore}/100</span>
          {!compact && <span>• {badgeConfig.label}</span>}
        </span>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 cursor-pointer transition-colors"
          title="Why this score? View contributing factor breakdown"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Popover Card */}
          <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 text-xs text-slate-800 space-y-3 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${badgeConfig.dot}`} />
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Why this score? (Explainable Delay Risk)
                </h4>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeConfig.bg}`}>
                Score: {roundedScore} / 100
              </span>
            </div>

            {primaryDriver && (
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Primary Risk Driver:
                </span>
                <span className="font-bold text-slate-900 block mt-0.5">{primaryDriver}</span>
                {primaryDriverDetails && (
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    {primaryDriverDetails}
                  </p>
                )}
              </div>
            )}

            {/* Formula Banner */}
            <div className="p-2 bg-blue-50/70 border border-blue-200 rounded-lg text-[10px] font-mono text-blue-900 leading-tight">
              <strong>Transparent Weighted Formula:</strong>
              <div className="mt-0.5 text-blue-700">
                30% Stage SLA + 20% Regional Benchmark + 20% Officer Workload + 15% Return Count + 15% New Institution
              </div>
            </div>

            {/* Factors Breakdown */}
            {factors.length > 0 ? (
              <div className="space-y-2 pt-1">
                {factors.map((f, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700">{f.name}</span>
                      <span className="font-mono text-slate-500">
                        <strong>{f.score}</strong> / {f.weight} pts
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          f.severity === 'HIGH'
                            ? 'bg-rose-500'
                            : f.severity === 'MEDIUM'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, f.percentage))}%` }}
                      />
                    </div>

                    <p className="text-[10px] text-slate-500 leading-tight">{f.details}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                Score dynamically computed from current stage SLA dwell, regional velocity averages, and assigned officer backlog.
              </p>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

