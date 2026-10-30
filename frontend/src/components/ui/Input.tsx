import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, icon, ...props }, ref) => {
    return (
      <div className={`w-full relative ${error ? 'animate-field-shake' : ''}`}>
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#595959]">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`w-full bg-white border rounded-[8px] py-2 text-sm text-[#111111] placeholder:text-[#595959] focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111] transition-colors font-sans ${
            icon ? 'pl-9 pr-3' : 'px-3'
          } ${error ? 'border-[#E0202A] focus:border-[#E0202A] focus:ring-[#E0202A]' : 'border-[#E6E6E6]'} ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-[#B5121A] font-medium">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;

