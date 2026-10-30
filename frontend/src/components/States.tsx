import React from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';

export const LoadingState: React.FC<{ message?: string }> = ({
  message = 'Loading data...',
}) => (
  <div className="flex flex-col items-center justify-center p-12 text-[#595959]">
    <Loader2 className="w-8 h-8 animate-spin text-[#111111] mb-3" />
    <p className="text-sm font-medium text-[#111111]">{message}</p>
  </div>
);

export const EmptyStateIllustration: React.FC<{ className?: string }> = ({ className = 'w-16 h-16' }) => (
  <svg
    className={`${className} mb-3 transition-transform hover:scale-105`}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Base Document / Folder Outline */}
    <rect
      x="12"
      y="16"
      width="40"
      height="34"
      rx="6"
      stroke="#18181B"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Header line */}
    <path
      d="M12 25 H52"
      stroke="#E6E6E6"
      strokeWidth="1.5"
    />
    {/* Content lines */}
    <path
      d="M20 33 H34"
      stroke="#595959"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M20 40 H44"
      stroke="#E6E6E6"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Red accent dot with subtle pulsing ring */}
    <circle
      cx="44"
      cy="33"
      r="3"
      fill="#E0202A"
      className="animate-pulse-ring"
    />
  </svg>
);

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}> = ({
  title = 'No records found',
  description = 'There are no items matching your criteria at this moment.',
  action,
}) => (
  <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-[8px] border border-[#E6E6E6] shadow-subtle animate-card-enter">
    <EmptyStateIllustration />
    <h3 className="text-base font-semibold text-[#111111]">{title}</h3>
    <p className="text-xs text-[#595959] max-w-sm mt-1">{description}</p>
    {action ? (
      <Button variant="primary" size="sm" onClick={action.onClick} className="mt-4">
        {action.label}
      </Button>
    ) : (
      <Button variant="secondary" size="sm" onClick={() => window.location.reload()} className="mt-4">
        Refresh data
      </Button>
    )}
  </div>
);

export const ErrorState: React.FC<{
  message?: string;
  onRetry?: () => void;
}> = ({
  message = 'An unexpected error occurred while loading this page.',
  onRetry,
}) => (
  <div className="flex flex-col items-center justify-center p-8 text-center bg-white border border-[#E0202A] rounded-[8px] my-4 shadow-subtle animate-card-enter">
    <AlertCircle className="w-8 h-8 text-[#B5121A] mb-2 animate-field-shake" />
    <h3 className="text-sm font-bold text-[#B5121A]">Failed to load</h3>
    <p className="text-xs text-[#595959] max-w-md mt-1">{message}</p>
    {onRetry && (
      <Button variant="secondary" size="sm" onClick={onRetry} className="mt-3">
        <RefreshCw className="w-3.5 h-3.5 mr-1" />
        Retry
      </Button>
    )}
  </div>
);
