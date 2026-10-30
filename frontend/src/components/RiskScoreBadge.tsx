import React, { useState } from 'react';
import { AlertTriangle, Clock, ShieldCheck, HelpCircle, ChevronDown } from 'lucide-react';
import { Button } from './ui/Button';

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
      className: 'bg-white text-[#B5121A] border-[#E0202A] font-semibold',
      label: 'High Delay Risk',
      icon: AlertTriangle
    },
    MEDIUM: {
      className: 'bg-[#F4F4F5] text-[#18181B] border-[#E6E6E6]',
      label: 'Medium Delay Risk',
      icon: Clock
    },
    LOW: {
      className: 'bg-[#F4F4F5] text-[#18181B] border-[#E6E6E6]',
      label: 'Low Delay Risk',
      icon: ShieldCheck
    }
  }[computedLevel] || {
    className: 'bg-[#F4F4F5] text-[#595959] border-[#E6E6E6]',
    label: 'Unassessed',
    icon: HelpCircle
  };

  const Icon = badgeConfig.icon;

  return (
    <div className="relative inline-block text-left">
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-xs font-medium border ${badgeConfig.className}`}
        >
          <Icon className="w-3.5 h-3.5" />
          <span>{roundedScore}/100</span>
          {!compact && <span>• {badgeConfig.label}</span>}
        </span>

        <Button type="button" variant="quiet" size="icon" aria-label="Explain delay risk score" onClick={() => setIsOpen(!isOpen)} className="w-7 h-7 min-w-7 min-h-7"><ChevronDown className="w-3.5 h-3.5" /></Button>
      </div>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-80 p-4 bg-white border border-[#E6E6E6] rounded-[8px] z-50 text-xs text-[#18181B] space-y-3">
          <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-2">
            <span className="font-semibold text-sm">Risk Score Breakdown</span>
            <span className="text-[11px] text-[#595959] font-mono">{roundedScore}/100</span>
          </div>

          <p className="text-[11px] text-[#595959] leading-relaxed">
            Formula: 30% Stage SLA Overrun + 20% Region Benchmark + 20% Officer Workload + 15% Return Count + 15% New Campus
          </p>

          {primaryDriver && (
            <div className="p-2 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] text-[11px]">
              <span className="font-semibold text-[#18181B]">Primary Driver: </span>
              <span className="text-[#595959]">{primaryDriver}</span>
              {primaryDriverDetails && (
                <div className="text-[10px] text-[#595959] mt-0.5">{primaryDriverDetails}</div>
              )}
            </div>
          )}

          {factors.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-semibold text-[#595959] uppercase tracking-wider">
                Contributing Factors
              </div>
              {factors.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] py-0.5">
                  <span className="text-[#595959] truncate mr-2">{f.name}</span>
                  <span className="font-mono font-medium text-[#18181B]">{f.percentage}%</span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-[#E6E6E6] flex justify-end">
            <Button variant="quiet" size="sm" onClick={() => setIsOpen(false)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
};
