import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  GitFork,
  Flame,
  CheckSquare,
  FileCheck2,
  History,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user } = useAuth();

  const navItems = [
    { to: '/', label: 'Executive Dashboard', icon: LayoutDashboard },
    { to: '/applications', label: 'Applications Portal', icon: FileText },
    ...(user?.role === 'INSTITUTION' || user?.role === 'ADMIN'
      ? [{ to: '/applications/new', label: 'New Application', icon: PlusCircle }]
      : []),
    { to: '/undertakings', label: 'Undertakings & Compliance', icon: FileCheck2 },
    { to: '/config/workflow', label: 'Workflow Stages & Routes', icon: GitFork },
    { to: '/config/escalations', label: 'Escalation Ladders', icon: Flame },
    { to: '/config/compliance', label: 'APH Norms Rules', icon: CheckSquare },
    { to: '/audit', label: 'Audit Trail Explorer', icon: History },
  ];

  return (
    <nav className="bg-white border-b border-[#E6E6E6] sticky top-[57px] z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[8px] whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-[#18181B] text-white'
                      : 'text-[#595959] hover:text-[#111111] hover:bg-[#F4F4F5]'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
