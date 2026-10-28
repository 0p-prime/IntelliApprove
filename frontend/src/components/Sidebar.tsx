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
  PlusCircle,
  GitBranch,
  ShieldCheck,
  AlertCircle,
  Share2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiRequest } from '../api/client';

export const Sidebar: React.FC<{ isOpen: boolean; onClose?: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    apiRequest<{ status: string }>('/health')
      .then((res) => setBackendHealthy(res.status === 'healthy'))
      .catch(() => setBackendHealthy(false));
  }, []);

  const role = user?.role || 'INSTITUTION';

  // Define role-specific navigation menus
  const allNavItems = [
    {
      to: '/',
      label: t('nav.dashboard', 'Dashboard'),
      icon: LayoutDashboard,
      roles: ['ADMIN', 'BUREAU_OFFICER', 'REGIONAL_HEAD', 'REGIONAL_OFFICER', 'EVC_MEMBER', 'INSTITUTION']
    },
    {
      to: '/applications',
      label: role === 'INSTITUTION' ? t('nav.my_applications', 'My Applications') : t('nav.applications', 'Applications'),
      icon: FileText,
      roles: ['ADMIN', 'BUREAU_OFFICER', 'REGIONAL_HEAD', 'REGIONAL_OFFICER', 'EVC_MEMBER', 'INSTITUTION']
    },
    {
      to: '/applications/new',
      label: t('nav.new_application', 'New Application'),
      icon: PlusCircle,
      roles: ['ADMIN', 'INSTITUTION']
    },
    {
      to: '/evc',
      label: role === 'EVC_MEMBER' ? t('nav.assigned_inspections', 'Assigned Inspections') : t('nav.evc', 'EVC Inspections'),
      icon: Users,
      roles: ['ADMIN', 'BUREAU_OFFICER', 'REGIONAL_HEAD', 'REGIONAL_OFFICER', 'EVC_MEMBER']
    },
    {
      to: '/undertakings',
      label: t('nav.undertakings', 'Undertakings Compliance'),
      icon: FileCheck2,
      roles: ['ADMIN', 'BUREAU_OFFICER', 'REGIONAL_HEAD', 'REGIONAL_OFFICER', 'EVC_MEMBER', 'INSTITUTION']
    },
    {
      to: '/documents',
      label: t('nav.documents', 'Document & Lease Validity'),
      icon: FolderClosed,
      roles: ['ADMIN', 'BUREAU_OFFICER', 'REGIONAL_HEAD', 'REGIONAL_OFFICER', 'EVC_MEMBER', 'INSTITUTION']
    },
    {
      to: '/alerts',
      label: t('nav.alerts', 'Alerts & Escalations'),
      icon: Bell,
      roles: ['ADMIN', 'BUREAU_OFFICER', 'REGIONAL_HEAD', 'REGIONAL_OFFICER', 'INSTITUTION']
    },
    {
      to: '/reports',
      label: t('nav.reports', 'Statutory Reports'),
      icon: BarChart3,
      roles: ['ADMIN', 'BUREAU_OFFICER', 'REGIONAL_HEAD', 'REGIONAL_OFFICER']
    },
    {
      to: '/audit',
      label: t('nav.audit', 'System Audit Trail'),
      icon: History,
      roles: ['ADMIN', 'BUREAU_OFFICER', 'REGIONAL_HEAD']
    },
    {
      to: '/integration',
      label: t('nav.integration', 'AICTE Portal Bridge'),
      icon: Share2,
      roles: ['ADMIN', 'BUREAU_OFFICER']
    },
    {
      to: '/config/workflow',
      label: t('nav.workflow_routes', 'Workflow Routes'),
      icon: GitBranch,
      roles: ['ADMIN', 'BUREAU_OFFICER']
    },
    {
      to: '/admin',
      label: t('nav.admin_settings', 'Admin Settings'),
      icon: Settings,
      roles: ['ADMIN']
    },
  ];

  // Filter based on active user role (support aliases)
  const normalizedRole = 
    role === 'COMPETENT_AUTHORITY' ? 'BUREAU_OFFICER' :
    role === 'SCRUTINY_OFFICER' ? 'REGIONAL_OFFICER' :
    role === 'EVC_INSPECTOR' ? 'EVC_MEMBER' : role;

  const visibleItems = allNavItems.filter((item) => item.roles.includes(normalizedRole));

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
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Navigation</span>
            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
              {normalizedRole}
            </span>
          </div>

          {visibleItems.map((item) => {
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

        {/* Bottom Health Indicator & Scope Info */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-2">
          {/* Active Jurisdiction Scope */}
          <div className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 space-y-0.5">
            <div className="font-semibold text-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
              Active Scope
            </div>
            <div className="truncate font-medium text-[#0B2240]">
              {user?.region_name ? `${user.region_name} Region` : 'National Jurisdiction'}
            </div>
            {user?.institution_name && (
              <div className="text-[10px] text-slate-500 truncate" title={user.institution_name}>
                {user.institution_name}
              </div>
            )}
          </div>

          {/* Live Backend Health Check */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-500 text-[11px]">Backend API:</span>
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
        </div>
      </aside>
    </>
  );
};
