import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'overdue' | 'ontrack' | 'duesoon' | 'outline' | 'critical' | 'verified';
  dot?: boolean;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  dot = false,
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[8px] text-xs font-medium border font-sans select-none';

  const variantConfig = {
    default: {
      classes: 'bg-white text-[#111111] border-[#E6E6E6]',
      dotColor: 'bg-[#111111]',
    },
    secondary: {
      classes: 'bg-[#F6F6F6] text-[#595959] border-[#E6E6E6]',
      dotColor: 'bg-[#595959]',
    },
    overdue: {
      classes: 'bg-white text-[#B5121A] border-[#E0202A] font-semibold',
      dotColor: 'bg-[#E0202A]',
    },
    critical: {
      classes: 'bg-white text-[#B5121A] border-[#E0202A] font-semibold',
      dotColor: 'bg-[#E0202A]',
    },
    ontrack: {
      classes: 'bg-white text-[#111111] border-[#E6E6E6]',
      dotColor: 'bg-[#111111]',
    },
    duesoon: {
      classes: 'bg-white text-[#111111] border-[#E6E6E6]',
      dotColor: 'bg-[#595959]',
    },
    verified: {
      classes: 'bg-white text-[#111111] border-[#E6E6E6]',
      dotColor: 'bg-[#111111]',
    },
    outline: {
      classes: 'bg-transparent text-[#595959] border-[#E6E6E6]',
      dotColor: 'bg-[#595959]',
    },
  }[variant];

  return (
    <span className={`${baseClasses} ${variantConfig.classes} ${className}`} {...props}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${variantConfig.dotColor}`} />}
      {children}
    </span>
  );
};

export default Badge;

