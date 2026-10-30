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
    <div className="inline-flex flex-col items-start gap-1 p-3 bg-white border border-[#E6E6E6] rounded-[8px]">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-[#18181B] text-white rounded-[6px] flex items-center justify-center">
          <ShieldAlert className={size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'} />
        </div>
        <div>
          <span className={`font-bold tracking-wide text-[#18181B] ${size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'} uppercase flex items-center gap-1.5`}>
            Human Oversight Required
            <span className="inline-block w-2 h-2 rounded-full bg-[#18181B]" />
          </span>
          {showSubtitle && (
            <p className="text-xs text-[#595959] leading-tight mt-0.5">
              Statutory Regulation Gate: Automated algorithms only compute compliance scores. Final verdict strictly requires verified human competent authority sign-off.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
