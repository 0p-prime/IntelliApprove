import React, { useState, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

export type ButtonSize = 'default' | 'sm' | 'icon' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  loading?: boolean;
  tooltip?: string;
  variant?: string; // accepted for backward compatibility, all buttons are unified solid black
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      size = 'default',
      loading = false,
      disabled = false,
      tooltip,
      className = '',
      children,
      variant,
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    // Normalize size mappings
    const normalizedSize: 'default' | 'sm' | 'icon' =
      size === 'sm' ? 'sm' : size === 'icon' ? 'icon' : 'default';

    // Tooltip text for icon-only button
    const tooltipText = tooltip || (normalizedSize === 'icon' ? props['aria-label'] : undefined);

    // Non-icon buttons get the slide-in red checkmark on hover
    const isIcon = normalizedSize === 'icon';

    // Tapped state: visible on touch devices and quick taps for at least 250ms
    const [isTapped, setIsTapped] = useState<boolean>(false);
    const tapTimerRef = useRef<number | null>(null);

    const triggerTap = () => {
      if (disabled || loading) return;
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      setIsTapped(true);
    };

    const releaseTap = () => {
      if (disabled || loading) return;
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
      }
      tapTimerRef.current = window.setTimeout(() => {
        setIsTapped(false);
        tapTimerRef.current = null;
      }, 250);
    };

    useEffect(() => {
      return () => {
        if (tapTimerRef.current) {
          clearTimeout(tapTimerRef.current);
        }
      };
    }, []);

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      triggerTap();
      if (onPointerDown) onPointerDown(e);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
      releaseTap();
      if (onPointerUp) onPointerUp(e);
    };

    const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
      releaseTap();
      if (onPointerCancel) onPointerCancel(e);
    };

    const handlePointerLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (isTapped) {
        releaseTap();
      }
      if (onPointerLeave) onPointerLeave(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        triggerTap();
        releaseTap();
      }
      if (onKeyDown) onKeyDown(e);
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        className={`btn ia-btn ${
          normalizedSize === 'sm' ? 'btn-sm ia-btn-sm' : ''
        } ${isIcon ? 'btn-icon ia-btn-icon' : ''} ${
          isTapped && !loading && !disabled ? 'is-tapped' : ''
        } ${loading ? 'is-loading' : ''} ${className}`}
        {...props}
      >
        {/* Loading ring spinner (stays black button, white spinner) */}
        {loading && (
          <span
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            aria-hidden="true"
          >
            <span
              className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"
              aria-hidden="true"
            />
          </span>
        )}

        {/* Button Content */}
        <span
          className={`inline-flex items-center justify-center gap-1.5 transition-opacity duration-150 ${
            loading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {children}

          {/* Red check icon slides in on hover for non-icon buttons */}
          {!isIcon && (
            <span className="btn-check ia-btn-check" aria-hidden="true">
              <Check
                className="w-4 h-4 text-[#E0202A] shrink-0"
                strokeWidth={2.5}
              />
            </span>
          )}
        </span>

        {/* Icon-only Tooltip (44px icon buttons) */}
        {isIcon && tooltipText && (
          <span
            role="tooltip"
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-xs text-white bg-[#18181B] rounded-[6px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity z-50 font-sans shadow-none font-normal"
          >
            {tooltipText}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
