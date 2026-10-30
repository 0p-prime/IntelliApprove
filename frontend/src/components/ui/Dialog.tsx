import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px] animate-backdrop-in"
        onClick={onClose}
      />
      {/* Container - fades and scales from 0.97, 1px #E6E6E6 border, 8px radius */}
      <div
        className={`relative z-10 w-full ${maxWidthClasses} bg-white border border-[#E6E6E6] rounded-[8px] p-6 text-left max-h-[90vh] flex flex-col font-sans animate-dialog-in`}
      >
        <div className="flex items-start justify-between pb-3 border-b border-[#E6E6E6]">
          <div>
            {title && (
              <h2 className="text-base font-bold text-[#111111] tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="text-xs text-[#595959] mt-0.5">{description}</p>
            )}
          </div>
          <Button variant="quiet" size="icon" aria-label="Close" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="mt-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

export default Dialog;

