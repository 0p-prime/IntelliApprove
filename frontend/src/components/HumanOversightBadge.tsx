import React from 'react';
import { ShieldAlert, UserCheck } from 'lucide-react';

interface HumanOversightBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

/**
 * Non-Negotiable Rule #2:
 * "The system NEVER auto-approves or auto-rejects an application.
 * Final decisions are reserved for human competent authorities.
 * Show a 'Human Oversight Required' badge on every decision screen."
 */
export const HumanOversightBadge: React.FC<HumanOversightBadgeProps> = ({
  size = 'md',
  showSubtitle = true,
}) => {
  return (
    <div className="inline-flex flex-col items-start gap-1 p-3 bg-amber-50/90 border border-amber-300 rounded-lg human-oversight-pulse shadow-sm">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-amber-600 text-white rounded-md shadow-xs flex items-center justify-center">
          <ShieldAlert className={size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'} />
        </div>
        <div>
          <span className={`font-bold tracking-wide text-amber-900 ${size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'} uppercase flex items-center gap-1.5`}>
            Human Oversight Required
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          </span>
          {showSubtitle && (
            <p className="text-xs text-amber-800 leading-tight">
              AICTE Regulation Gate: Automated algorithms only compute compliance scores. Final verdict strictly requires verified human competent authority sign-off.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
