import React from 'react';
import { Button } from './Button';

export interface ToastProps {
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ title, message, type = 'info', onClose }) => {
  const isError = type === 'error';
  return (
    <div
      className={`p-4 rounded-[8px] bg-white border flex items-start gap-3 ${
        isError ? 'border-[#E0202A]' : 'border-[#E6E6E6]'
      }`}
    >
      <div className="flex-1 min-w-0">
        {title && (
          <div
            className={`font-semibold text-xs tracking-tight ${
              isError ? 'text-[#B5121A]' : 'text-[#111111]'
            }`}
          >
            {title}
          </div>
        )}
        <div className="text-xs text-[#595959] leading-relaxed mt-0.5 break-words">{message}</div>
      </div>
      {onClose && (
        <Button variant="quiet" size="icon" aria-label="Close" onClick={onClose}>✕</Button>
      )}
    </div>
  );
};

export default Toast;
