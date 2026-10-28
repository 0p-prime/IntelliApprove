import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  UserCheck,
  ChevronDown,
  CheckCircle2,
  Menu,
  LogOut,
  Building2,
  ShieldAlert,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { AlertsDrawer } from './AlertsDrawer';
import { TimeTravelWidget } from './TimeTravelWidget';
import { apiRequest } from '../api/client';
import { Alert } from '../types';

export const Header: React.FC<{ onToggleSidebar?: () => void }> = ({ onToggleSidebar }) => {
  const { user, switchRole, logout, demoUsers } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const checkUnreadAlerts = async () => {
    try {
      const alerts = await apiRequest<Alert[]>('/alerts');
      const unread = alerts.filter((a) => !a.is_read).length;
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return {
          label: 'System Admin',
          badgeClass: 'bg-rose-500/20 text-rose-200 border-rose-400/40',
          dotClass: 'bg-rose-400'
        };
      case 'BUREAU_OFFICER':
      case 'COMPETENT_AUTHORITY':
        return {
          label: 'Bureau Officer (HQ)',
          badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
          dotClass: 'bg-amber-400'
        };
      case 'REGIONAL_HEAD':
        return {
          label: 'Regional Head',
          badgeClass: 'bg-purple-500/20 text-purple-200 border-purple-400/40',
          dotClass: 'bg-purple-400'
        };
      case 'REGIONAL_OFFICER':
      case 'SCRUTINY_OFFICER':
        return {
          label: 'Regional Officer',
          badgeClass: 'bg-blue-500/20 text-blue-200 border-blue-400/40',
          dotClass: 'bg-blue-400'
        };
      case 'EVC_MEMBER':
      case 'EVC_INSPECTOR':
        return {
          label: 'EVC Member',
          badgeClass: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
          dotClass: 'bg-indigo-400'
        };
      case 'INSTITUTION':
        return {
          label: 'Institution Admin',
          badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
          dotClass: 'bg-emerald-400'
        };
      default:
        return {
          label: 'Officer',
          badgeClass: 'bg-slate-500/20 text-slate-200 border-slate-400/40',
          dotClass: 'bg-slate-400'
        };
    }
  };

  const roleInfo = getRoleBadge(user?.role);

  return (
    <>
      {/* National Tricolor Top Stripe */}
      <div className="tricolor-bar" />

      <header className="gov-header-gradient text-white shadow-md sticky top-0 z-40 border-b border-blue-900/50">
        <div className="w-full px-4 sm:px-6 py-2 flex items-center justify-between">
          {/* Left: Mobile Toggle & Government Brand */}
          <div className="flex items-center gap-3">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="lg:hidden p-1.5 rounded hover:bg-white/10 text-white cursor-pointer"
                title="Toggle Navigation Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center shadow-inner shrink-0">
              <span className="font-serif font-black text-amber-300 text-lg tracking-tighter">AICTE</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
                  IntelliApprove
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/30 text-amber-300 font-medium border border-amber-400/40">
                    SIH 2026
                  </span>
                </h1>
              </div>
              <p className="text-[10px] text-blue-200/80 hidden sm:block">
                Approval Workflow Automation & Compliance Management (PS 26262)
              </p>
            </div>
          </div>

          {/* Right: Role Badge, Quick Demo Switcher, Notification Bell & Logout */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {/* Multilingual Toggle (English / Hindi) */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 border border-white/25 text-xs font-semibold text-white transition-all cursor-pointer shadow-xs"
              title={language === 'en' ? 'स्विच करें: हिंदी (HI)' : 'Switch to: English (EN)'}
            >
              <Globe className="w-3.5 h-3.5 text-amber-300" />
              <span className="font-medium tracking-tight">
                {language === 'en' ? '🇮🇳 हिंदी' : '🇬🇧 EN'}
              </span>
            </button>

            {/* Time-Travel Demo Clock Controller */}
            <TimeTravelWidget />

            {/* Prominent Role Badge in Top Bar */}
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${roleInfo.badgeClass}`}
                title={`Logged in as ${user?.role}`}
              >
                <span className={`w-2 h-2 rounded-full ${roleInfo.dotClass} animate-pulse`} />
                <span>{roleInfo.label}</span>
                {user?.region_name && (
                  <span className="text-[10px] opacity-80 hidden md:inline">({user.region_name})</span>
                )}
              </span>
            </div>

            {/* Quick Demo Role Switcher Dropdown (Judges / Testing) */}
            <div className="relative">
              <button
                onClick={() => setSwitcherOpen(!switcherOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-medium text-white transition-all cursor-pointer"
                title="Switch persona to test role-based scoping"
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden xl:inline text-[11px] text-blue-200">Switch Role:</span>
                <ChevronDown className="w-3 h-3 text-white/70" />
              </button>

              {switcherOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 text-slate-800 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Role Switcher (Evaluation)
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                      Scoping Active
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {demoUsers.map((du) => {
                      const isCurrent = user?.email === du.email;
                      return (
                        <button
                          key={du.email}
                          onClick={() => {
                            switchRole(du.email);
                            setSwitcherOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer ${
                            isCurrent ? 'bg-amber-50/70 font-semibold text-amber-900' : ''
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{du.full_name}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <span className="font-mono">{du.role}</span>
                              {du.region_name && <span>• {du.region_name}</span>}
                            </div>
                          </div>
                          {isCurrent && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="relative p-1.5 rounded-md hover:bg-white/10 text-white transition-colors cursor-pointer"
              title="Alerts and Escalations"
            >
              <Bell className="w-4.5 h-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center text-white ring-2 ring-[#0B2240] animate-bounce">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* User details */}
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-semibold text-white leading-tight">
                {user?.name || user?.full_name}
              </span>
              <span className="text-[10px] text-blue-200/80 leading-tight truncate max-w-[130px]">
                {user?.email}
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md hover:bg-red-500/20 hover:text-red-300 text-blue-100 transition-colors flex items-center gap-1 text-xs cursor-pointer border border-transparent hover:border-red-400/30"
              title="Sign Out of IntelliApprove"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px] font-medium">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Slide-out alerts drawer */}
      <AlertsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAlertUpdated={checkUnreadAlerts}
      />
    </>
  );
};
