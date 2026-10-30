import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  SlidersHorizontal,
  Calendar as CalendarIcon,
  FileText,
  Upload,
  Building,
  MapPin,
  ExternalLink,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { EVCScheduleItem, EVCCommitteeMember } from '../types';
import { LoadingState, ErrorState } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { Drawer } from '../components/ui/Drawer';
import { HumanOversightBadge } from '../components/HumanOversightBadge';

interface EVCStats {
  queued: number;
  scheduled: number;
  due_this_week: number;
  overdue: number;
}

export const EVCPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Role permissions
  const canSchedule = ['ADMIN', 'BUREAU_OFFICER', 'REGIONAL_HEAD', 'REGIONAL_OFFICER', 'SCRUTINY_OFFICER'].includes(user?.role || '');
  const canComplete = ['EVC_MEMBER', 'EVC_INSPECTOR', 'ADMIN', 'REGIONAL_OFFICER', 'REGIONAL_HEAD', 'BUREAU_OFFICER'].includes(user?.role || '');
  const isInstitution = user?.role === 'INSTITUTION';

  // Tabs: Queue, Calendar, Overdue, Completed
  const [activeTab, setActiveTab] = useState<'Queue' | 'Calendar' | 'Overdue' | 'Completed'>('Queue');

  // Data states
  const [schedules, setSchedules] = useState<EVCScheduleItem[]>([]);
  const [stats, setStats] = useState<EVCStats>({ queued: 0, scheduled: 0, due_this_week: 0, overdue: 0 });
  const [committeeMembers, setCommitteeMembers] = useState<EVCCommitteeMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter Drawer state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [filterRegion, setFilterRegion] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCommittee, setFilterCommittee] = useState<string>('ALL');
  const [activeCardFilter, setActiveCardFilter] = useState<'queued' | 'scheduled' | 'due_this_week' | 'overdue' | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Calendar month state
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  // Drawers and Modals
  const [isScheduleDrawerOpen, setIsScheduleDrawerOpen] = useState<boolean>(false);
  const [schedulingItem, setSchedulingItem] = useState<EVCScheduleItem | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [selectedCommitteeIds, setSelectedCommitteeIds] = useState<number[]>([]);
  const [scheduleNotes, setScheduleNotes] = useState<string>('');
  const [submittingSchedule, setSubmittingSchedule] = useState<boolean>(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Visit Detail Drawer
  const [isVisitDrawerOpen, setIsVisitDrawerOpen] = useState<boolean>(false);
  const [selectedVisit, setSelectedVisit] = useState<EVCScheduleItem | null>(null);

  // Reschedule Modal
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState<boolean>(false);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');
  const [submittingReschedule, setSubmittingReschedule] = useState<boolean>(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Complete Stage Modal
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState<boolean>(false);
  const [completeRemarks, setCompleteRemarks] = useState<string>('');
  const [completeRecommendation, setCompleteRecommendation] = useState<string>('RECOMMENDED');
  const [completeReportUrl, setCompleteReportUrl] = useState<string>('');
  const [completeInfra, setCompleteInfra] = useState<boolean>(true);
  const [completeFaculty, setCompleteFaculty] = useState<boolean>(true);
  const [completeLabs, setCompleteLabs] = useState<boolean>(true);
  const [submittingComplete, setSubmittingComplete] = useState<boolean>(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // Fetch data
  const fetchEVCData = async () => {
    setLoading(true);
    setError(null);
    try {
      const tabParam = activeTab.toLowerCase();
      const [schedData, statsData, membersData] = await Promise.all([
        apiRequest<EVCScheduleItem[]>(`/evc?tab=${tabParam}`),
        apiRequest<EVCStats>('/evc/stats').catch(() => ({ queued: 0, scheduled: 0, due_this_week: 0, overdue: 0 })),
        apiRequest<EVCCommitteeMember[]>('/evc/committee-members').catch(() => [])
      ]);
      setSchedules(schedData || []);
      setStats(statsData);
      setCommitteeMembers(membersData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load EVC schedules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEVCData();
    setCurrentPage(1);
  }, [activeTab]);

  // Format Due column text
  const formatDue = (item: EVCScheduleItem): string => {
    if (item.status === 'COMPLETED' || item.completed_at) {
      return 'Completed';
    }
    if (item.is_overdue || item.days_overdue > 0) {
      return `${item.days_overdue || Math.abs(item.days_remaining)} days overdue`;
    }
    if (item.days_remaining === 0) return 'Due today';
    if (item.days_remaining > 0) return `Due in ${item.days_remaining} days`;
    return '14 days';
  };

  // Format Committee column text
  const formatCommittee = (item: EVCScheduleItem): string => {
    if (item.committee_members && item.committee_members.length > 0) {
      return item.committee_members.map((m) => m.name).slice(0, 2).join(', ');
    }
    if (item.status === 'QUEUED' || !item.scheduled_date) {
      return 'Not assigned';
    }
    return 'Expert Committee';
  };

  // Compute status pill matching design: Due soon, Overdue, In queue, Scheduled, Completed
  const computeStatus = (item: EVCScheduleItem): 'Due soon' | 'Overdue' | 'In queue' | 'Scheduled' | 'Completed' => {
    if (item.status === 'COMPLETED' || item.completed_at) {
      return 'Completed';
    }
    if (item.is_overdue || item.status === 'OVERDUE' || item.days_overdue > 0) {
      return 'Overdue';
    }
    if (item.is_due_soon || (item.days_remaining <= 3 && item.days_remaining >= 0)) {
      return 'Due soon';
    }
    if (item.status === 'QUEUED' || !item.scheduled_date) {
      return 'In queue';
    }
    return 'Scheduled';
  };

  // Stat card click filter handling
  const handleStatCardClick = (filter: 'queued' | 'scheduled' | 'due_this_week' | 'overdue') => {
    if (activeCardFilter === filter) {
      setActiveCardFilter(null);
      return;
    }
    setActiveCardFilter(filter);
    if (filter === 'overdue') {
      setActiveTab('Overdue');
    } else {
      setActiveTab('Queue');
    }
    setCurrentPage(1);
  };

  // Filtered list
  const filteredSchedules = useMemo(() => {
    return schedules.filter((item) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesInst = item.institution_name?.toLowerCase().includes(q);
        const matchesRef = item.application_ref_no?.toLowerCase().includes(q);
        const matchesState = item.state?.toLowerCase().includes(q);
        const matchesRegion = item.region_name?.toLowerCase().includes(q);
        const matchesCommittee = item.committee_members?.some((m) => m.name.toLowerCase().includes(q));
        if (!matchesInst && !matchesRef && !matchesState && !matchesRegion && !matchesCommittee) {
          return false;
        }
      }

      // 2. Card filter
      if (activeCardFilter === 'queued') {
        const st = computeStatus(item);
        if (st !== 'In queue') return false;
      } else if (activeCardFilter === 'scheduled') {
        const st = computeStatus(item);
        if (st !== 'Scheduled' && st !== 'Due soon') return false;
      } else if (activeCardFilter === 'due_this_week') {
        if (item.status === 'COMPLETED' || item.completed_at) return false;
        if (item.days_remaining > 7 || item.days_remaining < 0) return false;
      } else if (activeCardFilter === 'overdue') {
        const st = computeStatus(item);
        if (st !== 'Overdue') return false;
      }

      // 3. Region filter
      if (filterRegion !== 'ALL') {
        if (item.region_name !== filterRegion) return false;
      }

      // 4. Institution Type filter
      if (filterType !== 'ALL') {
        if (item.institution_type !== filterType) return false;
      }

      // 5. Committee filter
      if (filterCommittee === 'ASSIGNED') {
        if (!item.committee_members || item.committee_members.length === 0) return false;
      } else if (filterCommittee === 'UNASSIGNED') {
        if (item.committee_members && item.committee_members.length > 0) return false;
      }

      return true;
    });
  }, [schedules, searchQuery, activeCardFilter, filterRegion, filterType, filterCommittee]);

  // Paginated list
  const paginatedSchedules = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSchedules.slice(start, start + pageSize);
  }, [filteredSchedules, currentPage]);

  const totalPages = Math.ceil(filteredSchedules.length / pageSize) || 1;

  // Actions
  const handleOpenScheduleModal = (target?: EVCScheduleItem) => {
    setSchedulingItem(target || null);
    setScheduleError(null);
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(10, 0, 0, 0);
    setScheduleDate(d.toISOString().slice(0, 16));
    setSelectedCommitteeIds(target?.committee_ids?.length ? target.committee_ids : []);
    setScheduleNotes('');
    setIsScheduleDrawerOpen(true);
  };

  const handleScheduleSubmit = async () => {
    if (!schedulingItem && !schedules.length) return;
    const targetId = schedulingItem?.id || schedules.find((s) => s.status === 'QUEUED')?.id || schedules[0]?.id;
    if (!targetId) return;

    if (!scheduleDate) {
      setScheduleError('Please select a visit date and time.');
      return;
    }
    if (selectedCommitteeIds.length === 0) {
      setScheduleError('Please pick at least one committee member.');
      return;
    }

    setSubmittingSchedule(true);
    setScheduleError(null);
    try {
      await apiRequest(`/evc/${targetId}/schedule`, {
        method: 'POST',
        body: JSON.stringify({
          scheduled_date: new Date(scheduleDate).toISOString(),
          committee_ids: selectedCommitteeIds,
          notes: scheduleNotes
        })
      });
      setIsScheduleDrawerOpen(false);
      await fetchEVCData();
    } catch (err: any) {
      setScheduleError(err.message || 'Failed to schedule inspection');
    } finally {
      setSubmittingSchedule(false);
    }
  };

  const handleOpenReschedule = (item: EVCScheduleItem) => {
    setSelectedVisit(item);
    setRescheduleError(null);
    const d = new Date();
    d.setDate(d.getDate() + 5);
    d.setHours(10, 0, 0, 0);
    setRescheduleDate(d.toISOString().slice(0, 16));
    setRescheduleReason('');
    setIsRescheduleModalOpen(true);
  };

  const handleRescheduleSubmit = async () => {
    if (!selectedVisit) return;
    if (!rescheduleDate) {
      setRescheduleError('Please select a new scheduled date.');
      return;
    }
    if (!rescheduleReason.trim()) {
      setRescheduleError('A mandatory speaking reason must be provided for rescheduling.');
      return;
    }

    setSubmittingReschedule(true);
    setRescheduleError(null);
    try {
      await apiRequest(`/evc/${selectedVisit.id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({
          new_date: new Date(rescheduleDate).toISOString(),
          reason: rescheduleReason
        })
      });
      setIsRescheduleModalOpen(false);
      if (isVisitDrawerOpen) setIsVisitDrawerOpen(false);
      await fetchEVCData();
    } catch (err: any) {
      setRescheduleError(err.message || 'Failed to reschedule inspection');
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const handleOpenComplete = (item: EVCScheduleItem) => {
    setSelectedVisit(item);
    setCompleteError(null);
    setCompleteRemarks('');
    setCompleteRecommendation('RECOMMENDED');
    setCompleteReportUrl('');
    setCompleteInfra(true);
    setCompleteFaculty(true);
    setCompleteLabs(true);
    setIsCompleteModalOpen(true);
  };

  const handleCompleteSubmit = async () => {
    if (!selectedVisit) return;
    if (!completeRemarks.trim()) {
      setCompleteError('Please provide inspection findings and committee remarks.');
      return;
    }

    setSubmittingComplete(true);
    setCompleteError(null);
    try {
      await apiRequest(`/evc/${selectedVisit.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          remarks: completeRemarks,
          recommendation: completeRecommendation,
          report_url: completeReportUrl,
          infra_verified: completeInfra,
          faculty_verified: completeFaculty,
          labs_functional: completeLabs
        })
      });
      setIsCompleteModalOpen(false);
      if (isVisitDrawerOpen) setIsVisitDrawerOpen(false);
      await fetchEVCData();
    } catch (err: any) {
      setCompleteError(err.message || 'Failed to complete visit stage');
    } finally {
      setSubmittingComplete(false);
    }
  };

  // Calendar Helpers
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarEventsByDay = useMemo(() => {
    const map: Record<number, EVCScheduleItem[]> = {};
    for (const s of schedules) {
      if (s.scheduled_date) {
        const d = new Date(s.scheduled_date);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          if (!map[day]) map[day] = [];
          map[day].push(s);
        }
      }
    }
    return map;
  }, [schedules, year, month]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="font-sans antialiased text-[#18181B] bg-white">
      {/* SECTION 1: HEADER & "SCHEDULE VISIT" ACTION */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
            EVC physical inspections
          </h1>
          <p className="text-sm text-[#595959] mt-1 font-normal">
            Queue, schedule and overdue
          </p>
        </div>

        {/* Schedule Visit Button (Brand Key Action, hidden if role cannot schedule) */}
        {canSchedule && (
          <Button
            variant="brand"
            onClick={() => handleOpenScheduleModal()}
            className="self-start sm:self-auto shrink-0"
          >
            Schedule visit
          </Button>
        )}
      </div>

      {/* SECTION 2: 4 STAT CARDS (Clickable filter) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1: In queue */}
        <div
          onClick={() => handleStatCardClick('queued')}
          className={`p-6 bg-white border rounded-[8px] flex flex-col justify-between cursor-pointer transition-colors ${
            activeCardFilter === 'queued' ? 'border-[#18181B] bg-[#FAFAFA]' : 'border-[#E6E6E6] hover:border-[#18181B]'
          }`}
        >
          <div className="text-4xl font-bold text-[#18181B] tracking-tight">
            {stats.queued}
          </div>
          <div className="text-sm text-[#595959] mt-1.5 font-normal flex items-center justify-between">
            <span>In queue</span>
            {activeCardFilter === 'queued' && <span className="text-xs text-[#18181B] font-medium">Filtered</span>}
          </div>
        </div>

        {/* Card 2: Scheduled */}
        <div
          onClick={() => handleStatCardClick('scheduled')}
          className={`p-6 bg-white border rounded-[8px] flex flex-col justify-between cursor-pointer transition-colors ${
            activeCardFilter === 'scheduled' ? 'border-[#18181B] bg-[#FAFAFA]' : 'border-[#E6E6E6] hover:border-[#18181B]'
          }`}
        >
          <div className="text-4xl font-bold text-[#18181B] tracking-tight">
            {stats.scheduled}
          </div>
          <div className="text-sm text-[#595959] mt-1.5 font-normal flex items-center justify-between">
            <span>Scheduled</span>
            {activeCardFilter === 'scheduled' && <span className="text-xs text-[#18181B] font-medium">Filtered</span>}
          </div>
        </div>

        {/* Card 3: Due this week */}
        <div
          onClick={() => handleStatCardClick('due_this_week')}
          className={`p-6 bg-white border rounded-[8px] flex flex-col justify-between cursor-pointer transition-colors ${
            activeCardFilter === 'due_this_week' ? 'border-[#18181B] bg-[#FAFAFA]' : 'border-[#E6E6E6] hover:border-[#18181B]'
          }`}
        >
          <div className="text-4xl font-bold text-[#18181B] tracking-tight">
            {stats.due_this_week}
          </div>
          <div className="text-sm text-[#595959] mt-1.5 font-normal flex items-center justify-between">
            <span>Due this week</span>
            {activeCardFilter === 'due_this_week' && <span className="text-xs text-[#18181B] font-medium">Filtered</span>}
          </div>
        </div>

        {/* Card 4: Overdue (RED border & RED text) */}
        <div
          onClick={() => handleStatCardClick('overdue')}
          className={`p-6 bg-white border rounded-[8px] flex flex-col justify-between cursor-pointer transition-colors ${
            activeCardFilter === 'overdue' ? 'border-[#B5121A] bg-red-50/40' : 'border-[#E0202A] hover:bg-red-50/20'
          }`}
        >
          <div className="text-4xl font-bold text-[#B5121A] tracking-tight">
            {stats.overdue}
          </div>
          <div className="text-sm text-[#B5121A] mt-1.5 font-medium flex items-center justify-between">
            <span>Overdue</span>
            {activeCardFilter === 'overdue' && <span className="text-xs font-bold">Filtered</span>}
          </div>
        </div>
      </div>

      {/* SECTION 3: TABS (Queue, Calendar, Overdue, Completed) */}
      <div className="mb-6">
        <Tabs
          tabs={['Queue', 'Calendar', 'Overdue', 'Completed']}
          activeTab={activeTab}
          onChange={(tab) => {
            setActiveTab(tab as 'Queue' | 'Calendar' | 'Overdue' | 'Completed');
            setActiveCardFilter(null);
            setCurrentPage(1);
          }}
          aria-label="EVC Inspection Stages"
        />
      </div>

      {/* ============================================================== */}
      {/* SECTION 4A: TABLE VIEW (Queue, Overdue, Completed)             */}
      {/* ============================================================== */}
      {activeTab !== 'Calendar' && (
        <div>
          {/* SEARCH & FILTERS BAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#595959] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by institution, application, or committee..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 bg-white border border-[#E6E6E6] rounded-[8px] text-sm text-[#18181B] placeholder-[#595959] focus:outline-none focus:border-[#18181B]"
              />
              {searchQuery && (
                <Button
                  size="icon"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 min-w-7 min-h-7 rounded"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Filters Toggle Button & Active Filter Tags */}
            <div className="flex items-center gap-2">
              {(filterRegion !== 'ALL' || filterType !== 'ALL' || filterCommittee !== 'ALL' || activeCardFilter) && (
                <Button
                  size="sm"
                  onClick={() => {
                    setFilterRegion('ALL');
                    setFilterType('ALL');
                    setFilterCommittee('ALL');
                    setActiveCardFilter(null);
                    setSearchQuery('');
                  }}
                >
                  Reset filters
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsFilterDrawerOpen(true)}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                Filters
                {(filterRegion !== 'ALL' || filterType !== 'ALL' || filterCommittee !== 'ALL') && (
                  <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-[#E0202A]" />
                )}
              </Button>
            </div>
          </div>

          {/* LOADING & ERROR STATES */}
          {loading && (
            <div className="py-16">
              <LoadingState message="Loading EVC physical inspection schedules..." />
            </div>
          )}

          {error && !loading && (
            <div className="py-12">
              <ErrorState message={error} onRetry={fetchEVCData} />
            </div>
          )}

          {/* DATA TABLE */}
          {!loading && !error && (
            <>
              {filteredSchedules.length === 0 ? (
                <div className="py-16 text-center border border-[#E6E6E6] rounded-[8px] bg-white">
                  <div className="w-12 h-12 rounded-full bg-[#F6F6F6] text-[#595959] flex items-center justify-center mx-auto mb-3">
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#18181B]">No inspections found</h3>
                  <p className="text-xs text-[#595959] mt-1 max-w-sm mx-auto">
                    {searchQuery || activeCardFilter
                      ? 'No physical inspection schedules match your search or filter criteria.'
                      : `There are currently no inspections in the ${activeTab.toLowerCase()} list.`}
                  </p>
                  {(searchQuery || filterRegion !== 'ALL' || activeCardFilter) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setFilterRegion('ALL');
                        setFilterType('ALL');
                        setFilterCommittee('ALL');
                        setActiveCardFilter(null);
                      }}
                      className="mt-4"
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="border border-[#E6E6E6] rounded-[8px] overflow-hidden bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      {/* Sticky Table Header */}
                      <thead className="bg-[#FAFAFA] border-b border-[#E6E6E6] text-xs font-semibold text-[#595959] uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="py-3 px-4">Institution</th>
                          <th className="py-3 px-4">Application</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4">Due</th>
                          <th className="py-3 px-4">Committee</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E6E6E6]">
                        {paginatedSchedules.map((item) => {
                          const statusText = computeStatus(item);
                          const isOverdue = statusText === 'Overdue';
                          const isDueSoon = statusText === 'Due soon';

                          return (
                            <tr
                              key={item.id}
                              className="hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                              onClick={() => {
                                setSelectedVisit(item);
                                setIsVisitDrawerOpen(true);
                              }}
                            >
                              {/* 1. Institution */}
                              <td className="py-3.5 px-4 font-medium text-[#18181B] max-w-[240px]">
                                <div className="truncate font-semibold">{item.institution_name}</div>
                                <div className="text-xs text-[#595959] truncate flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span>{item.state || item.region_name || 'India'}</span>
                                </div>
                              </td>

                              {/* 2. Application Ref */}
                              <td className="py-3.5 px-4 text-xs font-mono text-[#595959]">
                                <Link
                                  to={`/applications/${item.application_id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[#18181B] hover:text-[#E0202A] underline flex items-center gap-1"
                                >
                                  <span>{item.application_ref_no || `APP-${item.application_id}`}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </Link>
                              </td>

                              {/* 3. Type (New institution vs Existing) */}
                              <td className="py-3.5 px-4 text-xs text-[#18181B]">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-[4px] font-medium ${
                                    item.is_new_institution
                                      ? 'bg-[#18181B] text-white font-semibold'
                                      : 'bg-[#F4F4F5] text-[#595959] border border-[#E6E6E6]'
                                  }`}
                                >
                                  {item.is_new_institution ? 'New institution' : 'Existing'}
                                </span>
                              </td>

                              {/* 4. Due Column */}
                              <td className="py-3.5 px-4 text-xs">
                                <span
                                  className={`font-medium ${
                                    isOverdue ? 'text-[#B5121A] font-bold' : isDueSoon ? 'text-[#18181B]' : 'text-[#595959]'
                                  }`}
                                >
                                  {formatDue(item)}
                                </span>
                              </td>

                              {/* 5. Committee Column */}
                              <td className="py-3.5 px-4 text-xs text-[#595959] max-w-[180px]">
                                <span className="truncate block">{formatCommittee(item)}</span>
                              </td>

                              {/* 6. Status Badge */}
                              <td className="py-3.5 px-4 text-xs">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[16px] text-xs font-medium border ${
                                    isOverdue
                                      ? 'border-[#E0202A] text-[#B5121A] bg-white'
                                      : isDueSoon
                                      ? 'border-[#18181B] text-[#18181B] bg-white'
                                      : statusText === 'Completed'
                                      ? 'border-[#E6E6E6] text-[#595959] bg-[#F4F4F5]'
                                      : 'border-[#E6E6E6] text-[#18181B] bg-white'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isOverdue
                                        ? 'bg-[#E0202A]'
                                        : isDueSoon
                                        ? 'bg-[#18181B]'
                                        : statusText === 'Completed'
                                        ? 'bg-[#595959]'
                                        : 'bg-[#18181B]'
                                    }`}
                                  />
                                  <span>{statusText}</span>
                                </span>
                              </td>

                              {/* 7. Action Button */}
                              <td
                                className="py-3.5 px-4 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {statusText === 'In queue' && canSchedule ? (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleOpenScheduleModal(item)}
                                  >
                                    Schedule
                                  </Button>
                                ) : isOverdue && canSchedule ? (
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleOpenReschedule(item)}
                                  >
                                    Reschedule
                                  </Button>
                                ) : statusText === 'Scheduled' || statusText === 'Due soon' ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    {canComplete && (
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleOpenComplete(item)}
                                      >
                                        Complete stage
                                      </Button>
                                    )}
                                    {canSchedule && (
                                      <Button
                                        variant="quiet"
                                        size="sm"
                                        onClick={() => handleOpenReschedule(item)}
                                      >
                                        Reschedule
                                      </Button>
                                    )}
                                  </div>
                                ) : (
                                  <Button
                                    variant="quiet"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedVisit(item);
                                      setIsVisitDrawerOpen(true);
                                    }}
                                  >
                                    View
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* PAGINATION BAR */}
                  <div className="px-4 py-3 border-t border-[#E6E6E6] bg-[#FAFAFA] flex items-center justify-between text-xs text-[#595959]">
                    <div>
                      Showing {(currentPage - 1) * pageSize + 1} to{' '}
                      {Math.min(currentPage * pageSize, filteredSchedules.length)} of{' '}
                      {filteredSchedules.length} inspections
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      >
                        <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                        Previous
                      </Button>
                      <span className="font-medium text-[#18181B] px-2">
                        {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 4B: CALENDAR VIEW                                      */}
      {/* ============================================================== */}
      {activeTab === 'Calendar' && (
        <div className="border border-[#E6E6E6] rounded-[8px] bg-white p-6">
          {/* Calendar Header with Navigation */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[#18181B]">
              {monthNames[month]} {year}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCalendarDate(new Date())}
              >
                Today
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-7 border-t border-l border-[#E6E6E6]">
            {/* Weekday headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-semibold text-[#595959] border-r border-b border-[#E6E6E6] bg-[#FAFAFA]"
              >
                {day}
              </div>
            ))}

            {/* Empty days before 1st of month */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="h-28 border-r border-b border-[#E6E6E6] bg-[#FAFAFA]/50"
              />
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const events = calendarEventsByDay[dayNum] || [];
              const isToday =
                new Date().getDate() === dayNum &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`h-28 border-r border-b border-[#E6E6E6] p-1.5 flex flex-col justify-between overflow-y-auto transition-colors ${
                    isToday ? 'bg-[#FAFAFA]' : 'bg-white'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span
                      className={`w-6 h-6 flex items-center justify-center rounded-full font-medium ${
                        isToday ? 'bg-[#18181B] text-white font-bold' : 'text-[#18181B]'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {events.length > 0 && (
                      <span className="text-[10px] text-[#595959] font-medium">
                        {events.length} visit{events.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Visit chips */}
                  <div className="space-y-1 mt-1">
                    {events.map((ev) => {
                      const st = computeStatus(ev);
                      const isOverdue = st === 'Overdue';
                      const isCompleted = st === 'Completed';

                      return (
                        <div
                          key={ev.id}
                          onClick={() => {
                            setSelectedVisit(ev);
                            setIsVisitDrawerOpen(true);
                          }}
                          className={`px-2 py-1 rounded-[4px] text-[11px] font-medium truncate cursor-pointer transition-opacity hover:opacity-90 ${
                            isOverdue
                              ? 'bg-[#E0202A] text-white'
                              : isCompleted
                              ? 'bg-[#F4F4F5] text-[#18181B] border border-[#E6E6E6]'
                              : 'bg-[#18181B] text-white'
                          }`}
                          title={`${ev.institution_name} (${st})`}
                        >
                          {ev.institution_name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DRAWER 1: FILTERS DRAWER                                       */}
      {/* ============================================================== */}
      <Drawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        title="Filter inspections"
        subtitle="Narrow down EVC visits by region, campus type, and committee status"
        width="md"
      >
        <div className="p-6 space-y-6">
          {/* Region Filter */}
          <div>
            <label className="block text-xs font-semibold text-[#18181B] uppercase tracking-wider mb-2">
              AICTE Region
            </label>
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#E6E6E6] rounded-[8px] text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
            >
              <option value="ALL">All Regions</option>
              <option value="Northern">Northern Region</option>
              <option value="Southern">Southern Region</option>
              <option value="Western">Western Region</option>
              <option value="Eastern">Eastern Region</option>
              <option value="Central">Central Region</option>
              <option value="North-Western">North-Western Region</option>
              <option value="South-Western">South-Western Region</option>
              <option value="South-Central">South-Central Region</option>
            </select>
          </div>

          {/* Institution Type Filter */}
          <div>
            <label className="block text-xs font-semibold text-[#18181B] uppercase tracking-wider mb-2">
              Institution Category
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#E6E6E6] rounded-[8px] text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
            >
              <option value="ALL">All Categories</option>
              <option value="Engineering">Engineering & Technology</option>
              <option value="Polytechnic">Polytechnic Institute</option>
              <option value="Pharmacy">Pharmacy</option>
              <option value="Management">Management (MBA/PGDM)</option>
              <option value="Architecture">Architecture</option>
            </select>
          </div>

          {/* Committee Assignment Filter */}
          <div>
            <label className="block text-xs font-semibold text-[#18181B] uppercase tracking-wider mb-2">
              Committee Status
            </label>
            <select
              value={filterCommittee}
              onChange={(e) => setFilterCommittee(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#E6E6E6] rounded-[8px] text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ASSIGNED">Committee Assigned</option>
              <option value="UNASSIGNED">Not Assigned</option>
            </select>
          </div>

          <div className="pt-4 border-t border-[#E6E6E6] flex items-center justify-end gap-3">
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                setFilterRegion('ALL');
                setFilterType('ALL');
                setFilterCommittee('ALL');
                setActiveCardFilter(null);
              }}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsFilterDrawerOpen(false)}
            >
              Apply
            </Button>
          </div>
        </div>
      </Drawer>

      {/* ============================================================== */}
      {/* DRAWER 2: SCHEDULE INSPECTION DRAWER                           */}
      {/* ============================================================== */}
      <Drawer
        isOpen={isScheduleDrawerOpen}
        onClose={() => setIsScheduleDrawerOpen(false)}
        title={schedulingItem ? `Schedule: ${schedulingItem.institution_name}` : 'Schedule physical inspection'}
        subtitle="Designate statutory inspection date and assign Expert Visit Committee experts"
        width="lg"
      >
        <div className="p-6 space-y-5">
          {scheduleError && (
            <div className="p-3 bg-red-50 border border-[#E0202A] rounded-[8px] text-xs text-[#B5121A]">
              {scheduleError}
            </div>
          )}

          {/* Application Reference info */}
          {schedulingItem && (
            <div className="p-3 bg-[#F4F4F5] rounded-[8px] border border-[#E6E6E6] text-xs space-y-1">
              <div className="font-semibold text-[#18181B]">{schedulingItem.institution_name}</div>
              <div className="text-[#595959]">Application Ref: {schedulingItem.application_ref_no}</div>
              <div className="text-[#595959]">Statutory Due: {schedulingItem.due_date ? new Date(schedulingItem.due_date).toLocaleDateString() : 'N/A'}</div>
            </div>
          )}

          {/* Visit Date & Time Picker */}
          <div>
            <label className="block text-xs font-semibold text-[#18181B] uppercase tracking-wider mb-2">
              Inspection Date & Time *
            </label>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#E6E6E6] rounded-[8px] text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
            />
          </div>

          {/* Multi-Select Committee Members */}
          <div>
            <label className="block text-xs font-semibold text-[#18181B] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Select Committee Experts *</span>
              <span className="text-[11px] font-normal text-[#595959]">
                {selectedCommitteeIds.length} selected
              </span>
            </label>
            <div className="max-h-56 overflow-y-auto border border-[#E6E6E6] rounded-[8px] divide-y divide-[#E6E6E6]">
              {committeeMembers.map((m) => {
                const isSelected = selectedCommitteeIds.includes(m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedCommitteeIds(selectedCommitteeIds.filter((id) => id !== m.id));
                      } else {
                        setSelectedCommitteeIds([...selectedCommitteeIds, m.id]);
                      }
                    }}
                    className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA]'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-[#18181B]">{m.name}</div>
                      <div className="text-[11px] text-[#595959]">{m.region_name} • {m.role}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#F4F4F5] text-[#595959]">
                        {m.active_assignments} active
                      </span>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="accent-[#E0202A] w-4 h-4"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes / Special Instructions */}
          <div>
            <label className="block text-xs font-semibold text-[#18181B] uppercase tracking-wider mb-2">
              Inspection Directives & Focus Areas
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Verify barrier-free physical access, laboratory power ratings, and faculty original degrees..."
              value={scheduleNotes}
              onChange={(e) => setScheduleNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#E6E6E6] rounded-[8px] text-xs text-[#18181B] focus:outline-none focus:border-[#18181B] resize-none"
            />
          </div>

          {/* Drawer Actions */}
          <div className="pt-4 border-t border-[#E6E6E6] flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsScheduleDrawerOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="brand"
              loading={submittingSchedule}
              onClick={handleScheduleSubmit}
            >
              Save
            </Button>
          </div>
        </div>
      </Drawer>

      {/* ============================================================== */}
      {/* DRAWER 3: VISIT DETAIL DRAWER (With Timeline & Actions)         */}
      {/* ============================================================== */}
      <Drawer
        isOpen={isVisitDrawerOpen}
        onClose={() => setIsVisitDrawerOpen(false)}
        title={selectedVisit?.institution_name || 'Inspection details'}
        subtitle={selectedVisit?.application_ref_no}
        width="lg"
      >
        {selectedVisit && (
          <div className="p-6 space-y-6">
            {/* Human Oversight Required Badge */}
            <HumanOversightBadge size="sm" showSubtitle={false} />

            {/* Status & Timing Overview */}
            <div className="p-4 bg-[#FAFAFA] border border-[#E6E6E6] rounded-[8px] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#595959] uppercase font-semibold">Inspection Status</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[16px] text-xs font-medium border ${
                    selectedVisit.is_overdue
                      ? 'border-[#E0202A] text-[#B5121A] bg-white'
                      : 'border-[#18181B] text-[#18181B] bg-white'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      selectedVisit.is_overdue ? 'bg-[#E0202A]' : 'bg-[#18181B]'
                    }`}
                  />
                  <span>{computeStatus(selectedVisit)}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-[#E6E6E6]">
                <div>
                  <div className="text-[#595959]">Scheduled Date:</div>
                  <div className="font-semibold text-[#18181B] mt-0.5">
                    {selectedVisit.scheduled_date
                      ? new Date(selectedVisit.scheduled_date).toLocaleString()
                      : 'Not scheduled yet'}
                  </div>
                </div>
                <div>
                  <div className="text-[#595959]">Statutory Due Date:</div>
                  <div className="font-semibold text-[#18181B] mt-0.5">
                    {selectedVisit.due_date
                      ? new Date(selectedVisit.due_date).toLocaleDateString()
                      : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Institution Details */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#18181B] uppercase tracking-wider">
                Campus Profile
              </h4>
              <div className="p-3 bg-white border border-[#E6E6E6] rounded-[8px] text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#595959]">Category:</span>
                  <span className="font-medium text-[#18181B]">{selectedVisit.institution_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#595959]">Status Type:</span>
                  <span className="font-medium text-[#18181B]">
                    {selectedVisit.is_new_institution ? 'New Institution (10-day window)' : 'Existing Campus (21-day window)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#595959]">Region:</span>
                  <span className="font-medium text-[#18181B]">{selectedVisit.region_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#595959]">State:</span>
                  <span className="font-medium text-[#18181B]">{selectedVisit.state}</span>
                </div>
              </div>
            </div>

            {/* Assigned Committee Experts */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#18181B] uppercase tracking-wider">
                Assigned Expert Visit Committee
              </h4>
              {selectedVisit.committee_members && selectedVisit.committee_members.length > 0 ? (
                <div className="border border-[#E6E6E6] rounded-[8px] divide-y divide-[#E6E6E6]">
                  {selectedVisit.committee_members.map((m) => (
                    <div key={m.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-[#18181B]">{m.name}</div>
                        <div className="text-[11px] text-[#595959]">{m.email}</div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#F4F4F5] text-[#18181B] font-mono">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-[#FAFAFA] border border-[#E6E6E6] rounded-[8px] text-xs text-[#595959]">
                  No committee experts assigned yet.
                </div>
              )}
            </div>

            {/* Timeline of Actions */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-[#18181B] uppercase tracking-wider">
                Timeline & Verification Milestones
              </h4>
              <div className="border-l-2 border-[#E6E6E6] ml-3 pl-4 space-y-4 text-xs">
                <div>
                  <div className="font-semibold text-[#18181B]">Application Scrutiny Cleared</div>
                  <div className="text-[11px] text-[#595959]">Preliminary documentation verified by Regional Office</div>
                </div>
                <div>
                  <div className="font-semibold text-[#18181B]">EVC Inspection Mandated</div>
                  <div className="text-[11px] text-[#595959]">Physical infrastructure and faculty cadre inspection ordered</div>
                </div>
                {selectedVisit.scheduled_date && (
                  <div>
                    <div className="font-semibold text-[#18181B]">Inspection Scheduled</div>
                    <div className="text-[11px] text-[#595959]">
                      Set for {new Date(selectedVisit.scheduled_date).toLocaleDateString()} with committee experts
                    </div>
                  </div>
                )}
                {selectedVisit.completed_at && (
                  <div>
                    <div className="font-semibold text-[#18181B]">Inspection Completed</div>
                    <div className="text-[11px] text-[#595959]">
                      Verified on {new Date(selectedVisit.completed_at).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Action Buttons */}
            <div className="pt-4 border-t border-[#E6E6E6] flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsVisitDrawerOpen(false)}
              >
                Close
              </Button>
              {canSchedule && !selectedVisit.completed_at && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleOpenReschedule(selectedVisit)}
                >
                  Reschedule
                </Button>
              )}
              {canComplete && !selectedVisit.completed_at && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenComplete(selectedVisit)}
                >
                  Complete stage
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ============================================================== */}
      {/* MODAL 1: RESCHEDULE MODAL                                      */}
      {/* ============================================================== */}
      {isRescheduleModalOpen && selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div className="bg-white border border-[#E6E6E6] rounded-[8px] max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#18181B]">Reschedule physical inspection</h3>
              <p className="text-xs text-[#595959] mt-0.5">
                {selectedVisit.institution_name} ({selectedVisit.application_ref_no})
              </p>
            </div>

            {rescheduleError && (
              <div className="p-3 bg-red-50 border border-[#E0202A] rounded-[8px] text-xs text-[#B5121A]">
                {rescheduleError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#18181B] uppercase tracking-wider mb-2">
                New Inspection Date *
              </label>
              <input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E6E6E6] rounded-[8px] text-sm text-[#18181B] focus:outline-none focus:border-[#18181B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18181B] uppercase tracking-wider mb-2">
                Mandatory Justification Reason *
              </label>
              <textarea
                rows={3}
                placeholder="State formal reason for postponing/rescheduling statutory visit..."
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E6E6E6] rounded-[8px] text-xs text-[#18181B] focus:outline-none focus:border-[#18181B] resize-none"
              />
            </div>

            <div className="pt-3 border-t border-[#E6E6E6] flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsRescheduleModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={submittingReschedule}
                onClick={handleRescheduleSubmit}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: COMPLETE STAGE MODAL                                  */}
      {/* ============================================================== */}
      {isCompleteModalOpen && selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div className="bg-white border border-[#E6E6E6] rounded-[8px] max-w-lg w-full p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#18181B]">Complete EVC inspection</h3>
              <p className="text-xs text-[#595959] mt-0.5">
                Submit formal report to advance {selectedVisit.institution_name} to the next stage
              </p>
            </div>

            {completeError && (
              <div className="p-3 bg-red-50 border border-[#E0202A] rounded-[8px] text-xs text-[#B5121A]">
                {completeError}
              </div>
            )}

            {/* Checklist Verifications */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#18181B] uppercase tracking-wider">
                APH Norm Checklist Verification
              </label>
              <div className="space-y-2 p-3 bg-[#FAFAFA] border border-[#E6E6E6] rounded-[8px] text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={completeInfra}
                    onChange={(e) => setCompleteInfra(e.target.checked)}
                    className="accent-[#E0202A] w-4 h-4"
                  />
                  <span>Campus land and instructional area physically verified</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={completeFaculty}
                    onChange={(e) => setCompleteFaculty(e.target.checked)}
                    className="accent-[#E0202A] w-4 h-4"
                  />
                  <span>Faculty cadre, original credentials & presence verified</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={completeLabs}
                    onChange={(e) => setCompleteLabs(e.target.checked)}
                    className="accent-[#E0202A] w-4 h-4"
                  />
                  <span>Computing facilities, library & laboratories operational</span>
                </label>
              </div>
            </div>

            {/* Recommendation Select */}
            <div>
              <label className="block text-xs font-semibold text-[#18181B] uppercase tracking-wider mb-2">
                Committee Recommendation *
              </label>
              <select
                value={completeRecommendation}
                onChange={(e) => setCompleteRecommendation(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E6E6E6] rounded-[8px] text-xs text-[#18181B] focus:outline-none focus:border-[#18181B]"
              >
                <option value="RECOMMENDED">RECOMMENDED (Meets all statutory norms)</option>
                <option value="DEFICIENT_HEARING">DEFICIENT_HEARING (Refer to Standing Hearing Committee)</option>
                <option value="NOT_RECOMMENDED">NOT_RECOMMENDED (Critical non-compliances flagged)</option>
              </select>
            </div>

            {/* Report Document URL / File */}
            <div>
              <label className="block text-xs font-semibold text-[#18181B] uppercase tracking-wider mb-2">
                Signed Inspection Report Evidence URL
              </label>
              <input
                type="text"
                placeholder="https://storage.aicte.gov.in/evc/reports/sample_report.pdf"
                value={completeReportUrl}
                onChange={(e) => setCompleteReportUrl(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E6E6E6] rounded-[8px] text-xs text-[#18181B] focus:outline-none focus:border-[#18181B]"
              />
            </div>

            {/* Remarks / Summary */}
            <div>
              <label className="block text-xs font-semibold text-[#18181B] uppercase tracking-wider mb-2">
                Inspection Findings & Summary *
              </label>
              <textarea
                rows={3}
                placeholder="Summarize key observations, building approvals, lab equipment, and committee consensus..."
                value={completeRemarks}
                onChange={(e) => setCompleteRemarks(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E6E6E6] rounded-[8px] text-xs text-[#18181B] focus:outline-none focus:border-[#18181B] resize-none"
              />
            </div>

            <div className="pt-3 border-t border-[#E6E6E6] flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsCompleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={submittingComplete}
                onClick={handleCompleteSubmit}
              >
                Complete stage
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EVCPage;
