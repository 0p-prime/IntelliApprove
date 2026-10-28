import React, { useState, useEffect } from 'react';
import { Bell, User, Shield, Building2, ChevronDown, CheckCircle2, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AlertsDrawer } from './AlertsDrawer';
import { apiRequest } from '../api/client';
import { Alert } from '../types';

export const Header: React.FC = () => {
  const { user, switchRole, demoUsers, logout } = useAuth();
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

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'INSTITUTION':
        return { label: 'Institution Admin', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'SCRUTINY_OFFICER':
        return { label: 'Scrutiny Officer', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'EVC_INSPECTOR':
        return { label: 'EVC Inspector', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
      case 'REGIONAL_OFFICER':
        return { label: 'Regional Officer', color: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'COMPETENT_AUTHORITY':
        return { label: 'Competent Authority', color: 'bg-amber-100 text-amber-900 border-amber-300 font-bold' };
      case 'ADMIN':
        return { label: 'System Admin', color: 'bg-rose-100 text-rose-800 border-rose-300' };
      default:
        return { label: 'Guest', color: 'bg-gray-100 text-gray-800 border-gray-300' };
    }
  };

  const roleInfo = getRoleBadge(user?.role);

  return (
    <>
      {/* National Tricolor Top Stripe */}
      <div className="tricolor-bar" />

      <header className="gov-header-gradient text-white shadow-md sticky top-0 z-40 border-b border-blue-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          {/* Logo & Government Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 border-2 border-amber-400/80 flex items-center justify-center shadow-inner">
              <span className="font-serif font-black text-amber-300 text-xl tracking-tighter">AICTE</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
                  IntelliApprove
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 font-medium border border-amber-400/40">
                    SIH 2026
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-blue-200/80 hidden sm:block">
                All India Council for Technical Education • Statutory Approval & Compliance Automation Portal
              </p>
            </div>
          </div>

          {/* Quick Demo Role Switcher & User Profile */}
          <div className="flex items-center gap-3">
            {/* Quick Role Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setSwitcherOpen(!switcherOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-medium text-white transition-all cursor-pointer"
                title="Switch persona to test role-based permissions"
              >
                <UserCheck className="w-4 h-4 text-amber-300" />
                <span className="hidden md:inline">Demo Switcher:</span>
                <span className="font-semibold text-amber-200">{roleInfo.label}</span>
                <ChevronDown className="w-3.5 h-3.5 text-white/70" />
              </button>

              {switcherOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 py-2 text-slate-800 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Quick Role Switcher (SIH Evaluation)
                  </div>
                  {demoUsers.map((du) => {
                    const isCurrent = user?.email === du.email;
                    return (
                      <button
                        key={du.email}
                        onClick={() => {
                          switchRole(du.email);
                          setSwitcherOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between transition-colors ${
                          isCurrent ? 'bg-amber-50/60 font-semibold text-amber-900' : ''
                        }`}
                      >
                        <div>
                          <div className="font-medium text-slate-900">{du.full_name}</div>
                          <div className="text-[11px] text-slate-500">{du.designation || du.role}</div>
                        </div>
                        {isCurrent && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="relative p-2 rounded-md hover:bg-white/10 text-white transition-colors cursor-pointer"
              title="Alerts and Escalations"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center text-white ring-2 ring-[#0B2240] animate-bounce">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* User Info */}
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-semibold text-white leading-tight">{user?.full_name}</span>
              <span className="text-[11px] text-blue-200 leading-tight">{user?.email}</span>
            </div>
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
