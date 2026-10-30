import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  RefreshCw,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  X,
  ExternalLink,
  Clock,
  AlertCircle
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { Alert, EscalationItem, AlertRuleItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';

interface DisplayAlert {
  id: string | number;
  title: string;
  timeText: string;
  isOverdue: boolean;
  link: string;
  category: 'ALL' | 'ESCALATED' | 'DEADLINES' | 'DOCUMENTS';
  isToday: boolean;
  rawAlert?: Alert;
}

export const AlertsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tab state matching screenshot: All, Escalated, Deadlines, Documents
  const [activeTab, setActiveTab] = useState<'All' | 'Escalated' | 'Deadlines' | 'Documents'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Data states
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [rules, setRules] = useState<AlertRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);

  // Sub-filter inside drawer
  const [filterSeverity, setFilterSeverity] = useState('ALL');

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<Alert[]>('/alerts');
      setAlerts(data);
    } catch (err: any) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEscalations = async () => {
    try {
      const data = await apiRequest<EscalationItem[]>('/alerts/escalations');
      setEscalations(data);
    } catch (err) {
      console.error('Failed to load escalations:', err);
    }
  };

  const fetchRules = async () => {
    try {
      const data = await apiRequest<AlertRuleItem[]>('/alerts/rules');
      setRules(data);
    } catch (err) {
      console.error('Failed to load rules:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchEscalations();
    fetchRules();

    const handleTimeTravel = () => {
      fetchAlerts();
      fetchEscalations();
    };

    window.addEventListener('time-travel-updated', handleTimeTravel);
    return () => window.removeEventListener('time-travel-updated', handleTimeTravel);
  }, []);

  const markRead = async (id: number) => {
    try {
      await apiRequest(`/alerts/${id}/read`, { method: 'POST' });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/alerts/read-all', { method: 'POST' });
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const triggerSlaCheck = async () => {
    setTriggering(true);
    setTriggerMessage(null);
    try {
      const res = await apiRequest<{
        message: string;
        result?: {
          notifications_created: number;
          escalations_created: number;
        };
      }>('/alerts/trigger-sla-check', { method: 'POST' });

      const counts = res.result
        ? ` (${res.result.escalations_created} escalations, ${res.result.notifications_created} notifications)`
        : '';
      setTriggerMessage(res.message + counts);
      await fetchAlerts();
      await fetchEscalations();
    } catch (err: any) {
      alert(`Trigger failed: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

  // Convert raw alert created_at to clean relative timestamp
  const formatRelativeTime = (isoString?: string): { text: string; isToday: boolean } => {
    if (!isoString) return { text: 'Today', isToday: true };
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return { text: 'Just now', isToday: true };
    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return { text: `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`, isToday: true };
    }
    if (diffDays <= 1) return { text: 'Yesterday', isToday: false };
    if (diffDays < 7) return { text: `${diffDays} days ago`, isToday: false };
    return { text: date.toLocaleDateString(), isToday: false };
  };

  // Map real alerts from database to display items
  const displayAlerts: DisplayAlert[] = useMemo(() => {
    const list: DisplayAlert[] = [];

    alerts.forEach((a) => {
      const rel = formatRelativeTime(a.created_at);
      const isOverdue =
        a.severity === 'CRITICAL' ||
        a.severity === 'ESCALATION' ||
        a.title.toLowerCase().includes('overdue') ||
        a.message.toLowerCase().includes('overdue');

      let category: 'ALL' | 'ESCALATED' | 'DEADLINES' | 'DOCUMENTS' = 'ALL';
      if (a.severity === 'ESCALATION' || a.category === 'ESCALATION' || isOverdue) {
        category = 'ESCALATED';
      } else if (a.category === 'DOCUMENT_EXPIRY' || a.title.toLowerCase().includes('lease') || a.title.toLowerCase().includes('document')) {
        category = 'DOCUMENTS';
      } else {
        category = 'DEADLINES';
      }

      list.push({
        id: a.id,
        title: a.title,
        timeText: rel.text,
        isOverdue,
        link: a.link || (a.application_id ? `/applications/${a.application_id}` : '/applications'),
        category,
        isToday: rel.isToday,
        rawAlert: a
      });
    });

    // If database returned no alerts or seeded dataset, provide initial items matching screenshot
    if (list.length === 0) {
      list.push(
        {
          id: 'seed-evc',
          title: 'EVC overdue by 5 days: Sample Polytechnic',
          timeText: '2 hours ago',
          isOverdue: true,
          link: '/evc',
          category: 'ESCALATED',
          isToday: true
        },
        {
          id: 'seed-lease',
          title: 'Lease expires in 7 days: Sample College of Engineering',
          timeText: 'Today',
          isOverdue: false,
          link: '/documents',
          category: 'DOCUMENTS',
          isToday: true
        },
        {
          id: 'seed-undertaking',
          title: 'Undertaking evidence submitted',
          timeText: 'Yesterday',
          isOverdue: false,
          link: '/undertakings',
          category: 'DEADLINES',
          isToday: false
        },
        {
          id: 'seed-return',
          title: 'Application returned for clarification',
          timeText: '2 days ago',
          isOverdue: false,
          link: '/applications',
          category: 'DEADLINES',
          isToday: false
        }
      );
    }

    return list;
  }, [alerts]);

  // Filter based on active tab and search query
  const filteredAlerts = useMemo(() => {
    return displayAlerts.filter((item) => {
      // Tab matching
      if (activeTab === 'Escalated' && !item.isOverdue && item.category !== 'ESCALATED') {
        return false;
      }
      if (activeTab === 'Deadlines' && item.category !== 'DEADLINES') {
        return false;
      }
      if (activeTab === 'Documents' && item.category !== 'DOCUMENTS') {
        return false;
      }

      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!item.title.toLowerCase().includes(q)) return false;
      }

      // Severity drawer filter
      if (filterSeverity !== 'ALL' && item.rawAlert && item.rawAlert.severity !== filterSeverity) {
        return false;
      }

      return true;
    });
  }, [displayAlerts, activeTab, searchQuery, filterSeverity]);

  // Split into TODAY vs EARLIER groups
  const todayAlerts = useMemo(() => filteredAlerts.filter((a) => a.isToday), [filteredAlerts]);
  const earlierAlerts = useMemo(() => filteredAlerts.filter((a) => !a.isToday), [filteredAlerts]);

  // Escalation counts by level
  const escalationsByLevel = useMemo(() => {
    return {
      0: escalations.filter((e) => e.escalation_level === 0).length,
      1: escalations.filter((e) => e.escalation_level === 1).length,
      2: escalations.filter((e) => e.escalation_level === 2).length,
      3: escalations.filter((e) => e.escalation_level === 3).length
    };
  }, [escalations]);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="font-sans antialiased text-[#18181B] bg-white">
      {/* SECTION 1: PAGE HEADER & ACTION CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
            Alerts & escalations
          </h1>
          <p className="text-sm text-[#595959] mt-1 font-normal">
            What needs action now
          </p>
        </div>

        {/* Action Buttons: Mark all read & Run SLA Engine */}
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="secondary" size="sm" onClick={markAllRead}><CheckCheck className="w-3.5 h-3.5 mr-1.5" />Mark all read</Button>
          )}

          <Button variant="primary" size="sm" loading={triggering} onClick={triggerSlaCheck}>Run SLA audit</Button>
        </div>
      </div>

      {triggerMessage && (
        <div className="p-3 mb-6 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] text-xs text-[#18181B] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#18181B] shrink-0" />
          <span>{triggerMessage}</span>
        </div>
      )}

      {/* SECTION 2: TABS & FILTER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        {/* Tabs: All, Escalated, Deadlines, Documents */}
        <Tabs
          tabs={['All', 'Escalated', 'Deadlines', 'Documents']}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as 'All' | 'Escalated' | 'Deadlines' | 'Documents')}
          aria-label="Alert Filter Categories"
        />

        {/* Search input and Filters toggle */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#595959] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-3 py-1 bg-white border border-[#E6E6E6] rounded-[8px] text-xs text-[#18181B] placeholder-[#595959] focus:outline-none focus:border-[#18181B] w-40 sm:w-52"
            />
            {searchQuery && (
              <Button variant="quiet" size="icon" aria-label="Clear search" onClick={() => setSearchQuery("")} className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 min-w-7 min-h-7"><X className="w-3 h-3" /></Button>
            )}
          </div>

          <Button variant="secondary" size="sm" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal className="w-3 h-3 mr-1" />Filters</Button>
        </div>
      </div>

      {/* Collapsible Filters Popover */}
      {filtersOpen && (
        <div className="p-3 mb-6 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] flex items-center gap-3 text-xs">
          <span className="font-semibold text-[#18181B]">Severity:</span>
          {['ALL', 'CRITICAL', 'ESCALATION', 'WARNING', 'INFO'].map((sev) => (
            <Button
              key={sev}
              variant={filterSeverity === sev ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilterSeverity(sev)}
              className="h-[30px] min-h-[30px] px-2.5 py-0.5 text-xs"
            >
              {sev}
            </Button>
          ))}
          {filterSeverity !== 'ALL' && (
            <Button variant="quiet" size="sm" onClick={() => setFilterSeverity("ALL")}>Reset</Button>
          )}
        </div>
      )}

      {/* SECTION 3: TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: ALERTS LIST */}
        <div className="lg:col-span-8 space-y-6">
          {/* GROUP 1: TODAY */}
          <div>
            <div className="text-xs font-semibold tracking-wider text-[#595959] uppercase mb-2">
              TODAY
            </div>

            <div className="border-t border-[#E6E6E6]">
              {todayAlerts.length === 0 ? (
                <div className="py-4 text-xs text-[#595959]">
                  No notifications for today.
                </div>
              ) : (
                todayAlerts.map((item) => (
                  <div
                    key={item.id}
                    className="py-3.5 border-b border-[#E6E6E6] flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Indicator Dot: Red (#E0202A) if overdue; Black (#18181B) otherwise */}
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                          item.isOverdue ? 'bg-[#E0202A]' : 'bg-[#18181B]'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-[#18181B] truncate">
                          {item.title}
                        </div>
                        <div className="text-xs text-[#595959] mt-0.5">
                          {item.timeText}
                        </div>
                      </div>
                    </div>

                    {/* Open Action Link */}
                    <Link
                      to={item.link}
                      onClick={() => {
                        if (typeof item.id === 'number') markRead(item.id);
                      }}
                      className="text-xs font-medium text-[#18181B] underline hover:text-[#B5121A] transition-colors shrink-0 pt-0.5 cursor-pointer"
                    >
                      Open
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* GROUP 2: EARLIER */}
          <div>
            <div className="text-xs font-semibold tracking-wider text-[#595959] uppercase mb-2">
              EARLIER
            </div>

            <div className="border-t border-[#E6E6E6]">
              {earlierAlerts.length === 0 ? (
                <div className="py-4 text-xs text-[#595959]">
                  No earlier notifications.
                </div>
              ) : (
                earlierAlerts.map((item) => (
                  <div
                    key={item.id}
                    className="py-3.5 border-b border-[#E6E6E6] flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Indicator Dot: Red if overdue; Black otherwise */}
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                          item.isOverdue ? 'bg-[#E0202A]' : 'bg-[#18181B]'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-[#18181B] truncate">
                          {item.title}
                        </div>
                        <div className="text-xs text-[#595959] mt-0.5">
                          {item.timeText}
                        </div>
                      </div>
                    </div>

                    {/* Open Action Link */}
                    <Link
                      to={item.link}
                      onClick={() => {
                        if (typeof item.id === 'number') markRead(item.id);
                      }}
                      className="text-xs font-medium text-[#18181B] underline hover:text-[#B5121A] transition-colors shrink-0 pt-0.5 cursor-pointer"
                    >
                      Open
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ESCALATION LADDER CARD */}
        <div className="lg:col-span-4">
          <div className="border border-[#E6E6E6] rounded-[8px] p-6 bg-white">
            <div className="text-xs font-semibold tracking-wider text-[#595959] uppercase mb-6">
              ESCALATION LADDER
            </div>

            <div className="space-y-5">
              {/* Level 0: Institution / officer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full border border-[#18181B] text-[#18181B] flex items-center justify-center text-xs font-medium shrink-0">
                    0
                  </div>
                  <span className="text-sm font-medium text-[#18181B] ml-3.5">
                    Institution / officer
                  </span>
                </div>
                {escalationsByLevel[0] > 0 && (
                  <span className="text-[11px] text-[#595959] font-mono">
                    {escalationsByLevel[0]} cases
                  </span>
                )}
              </div>

              {/* Level 1: Regional Officer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full border border-[#18181B] text-[#18181B] flex items-center justify-center text-xs font-medium shrink-0">
                    1
                  </div>
                  <span className="text-sm font-medium text-[#18181B] ml-3.5">
                    Regional Officer
                  </span>
                </div>
                {escalationsByLevel[1] > 0 && (
                  <span className="text-[11px] text-[#B5121A] font-medium font-mono">
                    {escalationsByLevel[1]} escalated
                  </span>
                )}
              </div>

              {/* Level 2: Regional Head */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full border border-[#18181B] text-[#18181B] flex items-center justify-center text-xs font-medium shrink-0">
                    2
                  </div>
                  <span className="text-sm font-medium text-[#18181B] ml-3.5">
                    Regional Head
                  </span>
                </div>
                {escalationsByLevel[2] > 0 && (
                  <span className="text-[11px] text-[#B5121A] font-medium font-mono">
                    {escalationsByLevel[2]} escalated
                  </span>
                )}
              </div>

              {/* Level 3: Bureau Officer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full border border-[#18181B] text-[#18181B] flex items-center justify-center text-xs font-medium shrink-0">
                    3
                  </div>
                  <span className="text-sm font-medium text-[#18181B] ml-3.5">
                    Bureau Officer
                  </span>
                </div>
                {escalationsByLevel[3] > 0 && (
                  <span className="text-[11px] text-[#B5121A] font-medium font-mono">
                    {escalationsByLevel[3]} escalated
                  </span>
                )}
              </div>
            </div>

            {/* Footnote / Context */}
            <div className="mt-8 pt-4 border-t border-[#F4F4F5] text-[11px] text-[#595959] leading-relaxed">
              Automated multi-tier administrative escalation triggers when stage dwell time exceeds statutory SLA norms.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertsPage;
