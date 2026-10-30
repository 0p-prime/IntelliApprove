import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Menu,
  Globe,
  Compass,
  LogOut,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { AlertsDrawer } from './AlertsDrawer';
import { TimeTravelWidget } from './TimeTravelWidget';
import { apiRequest } from '../api/client';
import { Alert } from '../types';
import { IntelliApproveLogo } from './Logo';
import { Button } from './ui/Button';

export interface HeaderProps {
  onToggleSidebar?: () => void;
  onOpenTour?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onOpenTour }) => {
  const { user, switchRole, demoUsers, logout } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [bellShaking, setBellShaking] = useState<boolean>(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState<boolean>(false);
  const prevCountRef = useRef<number>(0);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  const checkUnreadAlerts = async () => {
    try {
      const alerts = await apiRequest<Alert[]>('/alerts');
      const unread = alerts.filter((a) => !a.is_read).length;
      if (unread > prevCountRef.current) {
        setBellShaking(true);
        setTimeout(() => setBellShaking(false), 600);
      }
      prevCountRef.current = unread;
      setUnreadCount(unread);
    } catch (_) {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      checkUnreadAlerts();
      const interval = setInterval(checkUnreadAlerts, 15000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Click outside and Escape handler for avatar popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAvatarMenuOpen(false);
      }
    };
    if (avatarMenuOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [avatarMenuOpen]);

  // Context label: Jurisdiction or Institution
  const isInstitution = user?.role === 'INSTITUTION';
  const contextLabel = isInstitution ? 'Institution' : 'Jurisdiction';
  const contextValue = isInstitution
    ? (user?.institution_name || user?.full_name || 'Institution')
    : (user?.region_name ? `${user.region_name} Region` : 'National Office');

  return (
    <>
      <header className="header-frosted sticky top-0 z-20 border-b border-[#E6E6E6] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          {/* Left: Mobile hamburger menu toggle & logo on mobile */}
          <div className="flex items-center gap-3 shrink-0">
            {onToggleSidebar && (
              <Button
                variant="quiet"
                size="icon"
                aria-label="Toggle navigation menu"
                onClick={onToggleSidebar}
                className="lg:hidden header-btn !w-10 !min-w-[40px]"
              >
                <Menu className="w-4 h-4 text-white" />
              </Button>
            )}

            <div className="lg:hidden">
              <IntelliApproveLogo size="sm" showSubtitle={false} />
            </div>
          </div>

          {/* Right: Exact specified order:
              1. Context label (Jurisdiction or Institution)
              2. Guided tour
              3. Language toggle "EN | हिं"
              4. Sim Time
              5. Notification bell
              6. Avatar
          */}
          <div className="flex items-center gap-2 sm:gap-2.5 justify-end">
            {/* 1. Context label (Jurisdiction or Institution) */}
            <div className="hidden lg:flex items-center text-xs text-[#595959] whitespace-nowrap mr-1 select-none">
              <span>{contextLabel}:&nbsp;</span>
              <span className="font-semibold text-[#18181B] truncate max-w-[180px] xl:max-w-xs" title={contextValue}>
                {contextValue}
              </span>
            </div>

            {/* 2. Guided tour button: 40px high, 8px radius, black at rest, red on tap */}
            <Button
              size="sm"
              aria-label="Guided tour"
              title="Guided tour"
              onClick={onOpenTour}
              className="header-tour-btn font-sans"
            >
              <Compass className="w-4 h-4 text-white shrink-0" />
              <span className="header-tour-label">Guided tour</span>
            </Button>

            {/* 3. Language toggle "EN | हिं" */}
            <Button
              size="sm"
              onClick={toggleLanguage}
              aria-label={language === 'en' ? 'Switch to Hindi' : 'Switch to English'}
              title={language === 'en' ? 'Switch to Hindi (हिन्दी)' : 'Switch to English'}
              className="header-btn px-3 flex items-center gap-1.5 font-sans"
            >
              <Globe className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="text-xs font-medium">EN | हिं</span>
            </Button>

            {/* 4. Sim Time: Time-Travel Simulated Clock Controller */}
            <TimeTravelWidget />

            {/* 5. Notification bell */}
            <Button
              size="icon"
              aria-label="Open notifications"
              title="Notifications & statutory alerts"
              onClick={() => setDrawerOpen(true)}
              className="relative header-btn !w-10 !min-w-[40px]"
            >
              <Bell className={`w-4 h-4 text-white ${bellShaking ? 'animate-bell-shake' : ''}`} />
              {unreadCount > 0 && (
                <span
                  key={unreadCount}
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E0202A] ring-2 ring-white animate-badge-pop"
                />
              )}
            </Button>

            {/* 6. Avatar: user avatar button with popover */}
            <div className="relative" ref={avatarMenuRef}>
              <Button
                size="icon"
                aria-label={`User profile: ${user?.full_name || 'Account'}`}
                title={`${user?.full_name || 'User'} (${user?.role || ''})`}
                onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                className="header-btn !w-10 !min-w-[40px] font-bold text-xs text-white"
              >
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </Button>

              {avatarMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-[#E6E6E6] rounded-[8px] py-2 z-50 shadow-md">
                  {/* User Profile Info */}
                  <div className="px-3 py-2 border-b border-[#F4F4F5]">
                    <div className="font-semibold text-xs text-[#18181B] truncate">
                      {user?.full_name}
                    </div>
                    <div className="text-[11px] text-[#595959] truncate">
                      {user?.email}
                    </div>
                    <div className="text-[10px] text-[#595959] mt-0.5 font-medium">
                      Role: <span className="text-[#18181B]">{user?.role}</span>
                    </div>
                  </div>

                  {/* Switch Role persona options */}
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-[#595959] uppercase tracking-wider border-b border-[#F4F4F5]">
                    Switch Role
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {demoUsers.map((u) => {
                      const isCurrent = user?.email === u.email;
                      return (
                        <button
                          key={u.email}
                          type="button"
                          onClick={() => {
                            switchRole(u.email);
                            setAvatarMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors border-0 cursor-pointer rounded-[4px] ${
                            isCurrent
                              ? 'bg-[#F4F4F5] font-semibold text-[#18181B]'
                              : 'bg-transparent text-[#595959] hover:bg-[#F4F4F5] hover:text-[#18181B]'
                          }`}
                        >
                          <span className="truncate">{u.full_name || u.name} ({u.role})</span>
                          {isCurrent && <Check className="w-3 h-3 text-[#18181B] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Sign Out */}
                  <div className="border-t border-[#F4F4F5] mt-1 pt-1 px-1.5">
                    <Button
                      size="sm"
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        logout();
                      }}
                      className="w-full justify-start !min-h-[36px]"
                    >
                      <LogOut className="w-3.5 h-3.5 mr-2 text-white" />
                      Sign out
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Slide-out Alerts Drawer */}
      <AlertsDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          checkUnreadAlerts();
        }}
      />
    </>
  );
};

export default Header;
