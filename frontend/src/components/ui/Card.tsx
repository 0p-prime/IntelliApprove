import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  isAlert?: boolean;
  isInteractive?: boolean;
  isOverdue?: boolean;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  isAlert = false,
  isInteractive = false,
  isOverdue = false,
  className = '',
  children,
  ...props
}) => {
  const overdueClass = isOverdue ? 'stat-card-overdue' : '';
  const interactiveClass = isInteractive ? `stat-card ${overdueClass}` : 'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)]';

  return (
    <div
      className={`bg-white border rounded-[8px] p-5 font-sans ${
        isAlert || isOverdue ? 'border-[#E0202A]' : 'border-[#E6E6E6]'
      } ${interactiveClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={`mb-3 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <h3 className={`text-base font-bold text-[#111111] tracking-tight ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <p className={`text-xs text-[#595959] mt-0.5 ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={className} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={`mt-4 pt-3 border-t border-[#E6E6E6] flex items-center justify-between ${className}`} {...props}>
    {children}
  </div>
);

export default Card;

