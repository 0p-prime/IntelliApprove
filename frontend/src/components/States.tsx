import React from 'react';
import { Loader2, AlertCircle, Inbox, RefreshCw } from 'lucide-react';

export const LoadingState: React.FC<{ message?: string }> = ({
  message = 'Loading data...',
}) => (
  <div className="flex flex-col items-center justify-center p-12 text-slate-500">
    <Loader2 className="w-8 h-8 animate-spin text-[#0B2240] mb-3" />
    <p className="text-sm font-medium">{message}</p>
  </div>
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
  <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-slate-200">
    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
      <Inbox className="w-6 h-6" />
    </div>
    <h3 className="text-base font-semibold text-slate-800">{title}</h3>
    <p className="text-xs text-slate-500 max-w-sm mt-1">{description}</p>
    {action && (
      <button
        onClick={action.onClick}
        className="mt-4 px-4 py-2 bg-[#0B2240] hover:bg-[#07172C] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors"
      >
        {action.label}
      </button>
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
  <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 border border-red-200 rounded-xl my-4">
    <AlertCircle className="w-8 h-8 text-red-600 mb-2" />
    <h3 className="text-sm font-bold text-red-900">Failed to load</h3>
    <p className="text-xs text-red-700 max-w-md mt-1">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-3 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry Request
      </button>
    )}
  </div>
);
