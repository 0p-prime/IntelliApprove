import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, X } from 'lucide-react';
import { Button } from '../components/ui/Button';

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

      {/* Floating Toast Container - Clean Minimal Flat */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm sm:max-w-md w-full pointer-events-none p-2 font-sans"
        role="region"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const isError = t.type === 'error';
          const isSuccess = t.type === 'success';

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-4 rounded-[8px] bg-white border flex items-start gap-3 transition-all animate-toast-in shadow-[0_8px_24px_rgba(0,0,0,0.08)] ${
                isError ? 'border-[#E0202A]' : 'border-[#E6E6E6]'
              }`}
            >
              {isSuccess ? (
                <svg
                  className="w-5 h-5 shrink-0 mt-0.5 text-[#18181B]"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="12" cy="12" r="10" stroke="#18181B" strokeWidth="2" />
                  <path
                    d="M8 12.5L10.5 15L16 9.5"
                    stroke="#E0202A"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-draw-check"
                  />
                </svg>
              ) : isError ? (
                <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5 text-[#B5121A] animate-field-shake" />
              ) : t.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[#18181B]" />
              ) : (
                <Info className="w-5 h-5 shrink-0 mt-0.5 text-[#18181B]" />
              )}
              <div className="flex-1 min-w-0">
                <div
                  className={`font-semibold text-xs tracking-tight ${
                    isError ? 'text-[#B5121A]' : 'text-[#111111]'
                  }`}
                >
                  {t.title || (isError ? 'Action Failed' : isSuccess ? 'Success' : 'Notice')}
                </div>
                <div className="text-xs text-[#595959] leading-relaxed mt-0.5 break-words">
                  {t.message}
                </div>
              </div>
              <Button variant="quiet" size="icon" aria-label="Dismiss toast" onClick={() => removeToast(t.id)}><X className="w-3.5 h-3.5" /></Button>
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
