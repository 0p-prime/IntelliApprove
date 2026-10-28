import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  FileCheck2,
  FolderClosed,
  Bell,
  BarChart3,
  History,
  Settings,
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { apiRequest } from '../api/client';

export const Sidebar: React.FC<{ isOpen: boolean; onClose?: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    apiRequest<{ status: string }>('/health')
      .then((res) => setBackendHealthy(res.status === 'healthy'))
      .catch(() => setBackendHealthy(false));
  }, []);

  const menuItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/applications', label: 'Applications', icon: FileText },
    { to: '/evc', label: 'EVC Inspection', icon: Users },
    { to: '/undertakings', label: 'Undertakings', icon: FileCheck2 },
    { to: '/documents', label: 'Documents', icon: FolderClosed },
    { to: '/alerts', label: 'Alerts & Escalations', icon: Bell },
    { to: '/reports', label: 'Reports & Analytics', icon: BarChart3 },
    { to: '/audit', label: 'Audit Trail', icon: History },
    { to: '/admin', label: 'Admin Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden backdrop-blur-2xs"
        />
      )}

      <aside
        className={`fixed lg:sticky top-[53px] left-0 h-[calc(100vh-53px)] w-64 bg-white border-r border-slate-200 z-30 flex flex-col justify-between transition-transform duration-200 ease-in-out shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Navigation Links */}
        <div className="p-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Main Navigation
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#0B2240] text-white shadow-xs font-semibold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Bottom Health Indicator & Monorepo Badge */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-2">
          {/* Live Backend Health Check */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Backend API:</span>
            {backendHealthy === null ? (
              <span className="text-slate-400 text-[11px]">Checking...</span>
            ) : backendHealthy ? (
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-red-600 font-bold text-[11px]">
                <AlertCircle className="w-3 h-3" />
                Offline
              </span>
            )}
          </div>

          <div className="text-[10px] text-slate-400 text-center font-mono pt-1 border-t border-slate-200/60">
            IntelliApprove v1.0 • PS 26262
          </div>
        </div>
      </aside>
    </>
  );
};
