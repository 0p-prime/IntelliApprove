import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  FileCheck2,
  FolderClosed,
  Bell,
  BarChart3,
  History,
  LogOut,
  ChevronDown,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api/client';
import { IntelliApproveLogo, IntelliApproveIcon } from './Logo';
import { Button } from './ui/Button';

export interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  collapsed: externalCollapsed,
  onToggleCollapse,
}) => {
  const { user, isAuthenticated, logout, switchRole, demoUsers } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileMenuOpen(false);
    };
    if (profileMenuOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileMenuOpen]);

  // Exactly 8 items with unchanged statutory menu names
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/applications', label: 'Applications', icon: FileText },
    { to: '/evc', label: 'EVC Physical Inspections', icon: Users },
    { to: '/undertakings', label: 'Undertakings Compliance', icon: FileCheck2 },
    { to: '/documents', label: 'Document & Lease Validity', icon: FolderClosed },
    { to: '/alerts', label: 'Alerts & Escalations', icon: Bell },
    { to: '/reports', label: 'Statutory Reports', icon: BarChart3 },
    { to: '/audit', label: 'Cryptographic Audit Trail', icon: History },
  ];

  // 250ms tap persistence logic for pointer events
  const [tappedIndex, setTappedIndex] = useState<number | null>(null);
  const tapTimerRef = useRef<number | null>(null);

  const handlePointerDown = (index: number) => {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    setTappedIndex(index);
  };

  const handlePointerUp = () => {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = window.setTimeout(() => {
      setTappedIndex(null);
      tapTimerRef.current = null;
    }, 250);
  };

  const [userCardTapped, setUserCardTapped] = useState(false);
  const userTapTimerRef = useRef<number | null>(null);

  const handleUserPointerDown = () => {
    if (userTapTimerRef.current) clearTimeout(userTapTimerRef.current);
    setUserCardTapped(true);
  };

  const handleUserPointerUp = () => {
    if (userTapTimerRef.current) clearTimeout(userTapTimerRef.current);
    userTapTimerRef.current = window.setTimeout(() => {
      setUserCardTapped(false);
      userTapTimerRef.current = null;
    }, 250);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name?: string) => {
    if (!name) return 'SS';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatRole = (role?: string) => {
    switch (role) {
      case 'REGIONAL_HEAD': return 'Regional Head';
      case 'REGIONAL_OFFICER': return 'Regional Officer';
      case 'BUREAU_OFFICER': return 'Bureau Officer';
      case 'EVC_MEMBER': return 'EVC Member';
      case 'INSTITUTION': return 'Institution Admin';
      case 'ADMIN': return 'Administrator';
      default: return role ? role.replace(/_/g, ' ') : 'Official';
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen bg-[#FAFAFA] border-r border-[#E6E6E6] z-30 flex flex-col justify-between transition-all duration-200 ease-in-out shrink-0 select-none ${
          isCollapsed
            ? 'w-[72px] min-w-[72px] max-w-[72px]'
            : 'w-[250px] min-w-[250px] max-w-[250px]'
        } ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top: Logo & Navigation */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo Section */}
          <div className="h-[68px] px-4 border-b border-[#E6E6E6] flex items-center justify-between shrink-0">
            {isCollapsed ? (
              <div className="w-full flex items-center justify-center">
                <button
                  type="button"
                  onClick={toggleCollapse}
                  className="p-1 rounded-[6px] hover:bg-[rgba(17,17,17,0.06)] text-[#18181B] transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <IntelliApproveIcon className="w-7 h-7" />
                </button>
              </div>
            ) : (
              <>
                <IntelliApproveLogo size="md" showSubtitle={false} />
                <button
                  type="button"
                  onClick={toggleCollapse}
                  className="hidden lg:flex p-1.5 rounded-[6px] hover:bg-[rgba(17,17,17,0.06)] text-[#595959] hover:text-[#18181B] transition-colors cursor-pointer border-0 bg-transparent"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Navigation Items in ONE Connected List:
              1px #E0E0E0 outer border, 8px outer corner radius, overflow hidden, no gaps between items.
              Every item: 52px high, 16px horizontal padding, shaded grey fill rgba(17,17,17,0.05),
              black text, 1px divider line between items rgba(17,17,17,0.08), transparent 4px left edge.
              Active item: solid red 4px line on LEFT edge, light shaded fill rgba(224,32,42,0.08),
              bold dark-red text #B5121A. Red dot removed.
          */}
          <nav className="p-3 overflow-y-auto flex-1">
            <div className="sidebar-connected-list">
              {navItems.map((item, idx) => {
                const isCurrent =
                  item.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.to);
                const isTapped = tappedIndex === idx;
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onClose}
                    onPointerDown={() => handlePointerDown(idx)}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onPointerLeave={() => {
                      if (isTapped) handlePointerUp();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handlePointerDown(idx);
                        handlePointerUp();
                      }
                    }}
                    aria-current={isCurrent ? 'page' : undefined}
                    title={item.label}
                    className={`sidebar-tab-item ${
                      isCurrent ? 'is-active' : ''
                    } ${isTapped ? 'is-tapped' : ''} ${
                      isCollapsed ? 'is-collapsed' : ''
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isCollapsed ? '' : 'mr-3'
                      } ${isCurrent ? 'text-[#B5121A]' : 'text-[#18181B]'}`}
                    />
                    {!isCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Bottom Area: User Profile as Connected Rectangular Box */}
        <div className="p-3 border-t border-[#E6E6E6] bg-[#FAFAFA] relative" ref={profileMenuRef}>
          {!isAuthenticated ? (
            <Button onClick={() => navigate('/login')} className="w-full">
              Sign in
            </Button>
          ) : (
            <div className="sidebar-user-card">
              <button
                type="button"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                onPointerDown={handleUserPointerDown}
                onPointerUp={handleUserPointerUp}
                onPointerCancel={handleUserPointerUp}
                onPointerLeave={() => {
                  if (userCardTapped) handleUserPointerUp();
                }}
                className={`sidebar-user-item ${userCardTapped ? 'is-tapped' : ''} ${
                  isCollapsed ? 'is-collapsed' : ''
                }`}
                title={user?.full_name ? `${user.full_name} (${formatRole(user?.role)})` : 'User Profile'}
                aria-label="User Account Menu"
              >
                {/* Circular Black Avatar with White Initials */}
                <div className="w-7 h-7 rounded-full bg-[#18181B] text-white flex items-center justify-center text-xs font-semibold shrink-0">
                  {getInitials(user?.full_name)}
                </div>

                {!isCollapsed && (
                  <>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="text-xs font-semibold text-[#18181B] truncate leading-tight">
                        {user?.full_name || 'Official User'}
                      </div>
                      <div className="text-[11px] text-[#595959] truncate mt-0.5 leading-tight">
                        {formatRole(user?.role)}
                      </div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-[#595959] shrink-0" />
                  </>
                )}
              </button>

              {/* Popover Menu for Demo Role Switcher & Logout */}
              {profileMenuOpen && (
                <div className="absolute bottom-full left-3 right-3 mb-2 bg-white border border-[#E6E6E6] rounded-[8px] py-1.5 z-50 shadow-md">
                  <div className="px-3 py-1 text-[10px] font-semibold text-[#595959] uppercase tracking-wider border-b border-[#F4F4F5]">
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
                            setProfileMenuOpen(false);
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

                  <div className="border-t border-[#F4F4F5] mt-1 pt-1 px-1.5">
                    <Button
                      size="sm"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left justify-start !min-h-[36px]"
                    >
                      <LogOut className="w-3.5 h-3.5 mr-2 text-white" />
                      Sign out
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
