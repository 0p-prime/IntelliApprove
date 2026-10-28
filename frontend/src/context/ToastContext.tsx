import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  toast: {
    success: (msg: string, title?: string) => void;
    error: (msg: string, title?: string) => void;
    warning: (msg: string, title?: string) => void;
    info: (msg: string, title?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string, duration: number = 4500) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const newToast: Toast = { id, type, message, title, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]); // Keep max 5 toasts

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = {
    success: (msg: string, title?: string) => showToast(msg, 'success', title || 'Success'),
    error: (msg: string, title?: string) => showToast(msg, 'error', title || 'Error'),
    warning: (msg: string, title?: string) => showToast(msg, 'warning', title || 'Warning'),
    info: (msg: string, title?: string) => showToast(msg, 'info', title || 'Notice'),
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, toast }}>
      {children}

      {/* Floating Animated Toast Container */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none p-2"
        role="region"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const config = {
            success: {
              border: 'border-emerald-300 bg-emerald-50 text-emerald-900',
              icon: CheckCircle2,
              iconColor: 'text-emerald-600',
              defaultTitle: 'Completed Successfully'
            },
            error: {
              border: 'border-rose-300 bg-rose-50 text-rose-900',
              icon: AlertOctagon,
              iconColor: 'text-rose-600',
              defaultTitle: 'Action Failed'
            },
            warning: {
              border: 'border-amber-300 bg-amber-50 text-amber-900',
              icon: AlertTriangle,
              iconColor: 'text-amber-600',
              defaultTitle: 'Attention Required'
            },
            info: {
              border: 'border-blue-300 bg-blue-50 text-blue-900',
              icon: Info,
              iconColor: 'text-blue-600',
              defaultTitle: 'Government Notice'
            }
          }[t.type];

          const Icon = config.icon;

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-3.5 rounded-xl border shadow-lg backdrop-blur-xs flex items-start gap-3 transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 ${config.border}`}
            >
              <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconColor}`} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs tracking-tight">
                  {t.title || config.defaultTitle}
                </div>
                <div className="text-[11px] leading-relaxed mt-0.5 opacity-90 break-words">
                  {t.message}
                </div>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer shrink-0 transition-colors"
                title="Dismiss toast"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

