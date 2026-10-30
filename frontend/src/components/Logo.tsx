import React from 'react';

/**
 * IntelliApprove Brand Icon
 * Matches the official logo: A circle ring with a red top-left quadrant (#E0202A),
 * black remaining circumference (#18181B), and a black centered checkmark.
 */
export const IntelliApproveIcon: React.FC<{
  className?: string;
  lightMode?: boolean;
  animated?: boolean;
}> = ({
  className = 'w-7 h-7',
  lightMode = false,
  animated = false,
}) => (
  <svg
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="IntelliApprove Icon"
  >
    {/* Red Top-Left Arc (#E0202A): from approx 8:30 (x=7, y=19) to 11:45 (x=16, y=6.5) */}
    <path
      d="M 6.8 19.5 A 12 12 0 0 1 16.5 6.4"
      stroke="#E0202A"
      strokeWidth="3.2"
      strokeLinecap="round"
      className={animated ? 'animate-draw-ring' : ''}
    />
    {/* Ring: remaining 3/4 circle from 11:45 clockwise back to 8:30 */}
    <path
      d="M 20.5 6.7 A 12 12 0 1 1 8.2 23.5"
      stroke={lightMode ? '#FFFFFF' : '#18181B'}
      strokeWidth="3.2"
      strokeLinecap="round"
      className={animated ? 'animate-draw-ring' : ''}
    />
    {/* Centered Checkmark: pops in */}
    <path
      d="M 12 18.5 L 16.2 22.8 L 24.5 14"
      stroke={lightMode ? '#FFFFFF' : '#18181B'}
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={animated ? { transformOrigin: 'center', animationDelay: '550ms' } : undefined}
      className={animated ? 'animate-check-pop' : ''}
    />
  </svg>
);

export const IntelliApproveShieldIcon = IntelliApproveIcon;

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  lightText?: boolean;
  animated?: boolean;
}

export const IntelliApproveLogo: React.FC<LogoProps> = ({
  size = 'md',
  showSubtitle = true,
  lightText = false,
  animated = false,
}) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-9 h-9'
  };
  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl'
  };

  return (
    <div className="flex items-center gap-2.5">
      <div className="shrink-0 flex items-center justify-center">
        <IntelliApproveIcon className={iconSizes[size]} lightMode={lightText} animated={animated} />
      </div>
      <div className="flex flex-col">
        <span
          className={`font-bold tracking-tight leading-none ${textSizes[size]} ${
            lightText ? 'text-white' : 'text-[#18181B]'
          }`}
        >
          IntelliApprove
        </span>
        {showSubtitle && (
          <span className="text-[8px] font-semibold tracking-[0.2em] text-[#E0202A] uppercase mt-1 leading-none">
            AUTOMATE · MONITOR · COMPLY
          </span>
        )}
      </div>
    </div>
  );
};
