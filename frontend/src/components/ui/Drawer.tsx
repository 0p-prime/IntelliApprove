import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }[width];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px] animate-backdrop-in"
        onClick={onClose}
      />
      {/* Drawer Panel - slides in from right with shadow */}
      <div
        className={`relative z-10 w-full ${widthClasses} bg-white border-l border-[#E6E6E6] h-full flex flex-col font-sans animate-drawer-in`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E6E6]">
          <div>
            {title && (
              <h2 className="text-base font-bold text-[#111111] tracking-tight">{title}</h2>
            )}
            {subtitle && (
              <p className="text-xs text-[#595959] mt-0.5">{subtitle}</p>
            )}
          </div>
          <Button variant="quiet" size="icon" aria-label="Close" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};

export default Drawer;

