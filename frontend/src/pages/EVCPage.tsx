import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  Clock,
  MapPin,
  Building2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Calendar,
  RotateCcw,
  Search,
  Filter,
  X,
  FileText,
  CheckSquare,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Award,
  Layers,
  FileCheck2,
  UserCheck
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { EVCScheduleItem, EVCCommitteeMember } from '../types';
import { StatusPill } from '../components/StatusPill';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { HumanOversightBadge } from '../components/HumanOversightBadge';
import { useAuth } from '../context/AuthContext';

export const EVCPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tabs: 'queue' | 'calendar' | 'overdue'
  const [activeTab, setActiveTab] = useState<'queue' | 'calendar' | 'overdue'>('queue');

  // Data states
  const [schedules, setSchedules] = useState<EVCScheduleItem[]>([]);
  const [committeeMembers, setCommitteeMembers] = useState<EVCCommitteeMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [newInstitutionsOnly, setNewInstitutionsOnly] = useState<boolean>(false);

  // Modals state
  const [schedulingItem, setSchedulingItem] = useState<EVCScheduleItem | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [selectedCommitteeIds, setSelectedCommitteeIds] = useState<number[]>([]);
  const [submittingSchedule, setSubmittingSchedule] = useState<boolean>(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Reschedule state
  const [reschedulingItem, setReschedulingItem] = useState<EVCScheduleItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');
  const [submittingReschedule, setSubmittingReschedule] = useState<boolean>(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Complete Inspection Modal state
  const [completingItem, setCompletingItem] = useState<EVCScheduleItem | null>(null);
  const [reportSummary, setReportSummary] = useState<string>('');
  const [recommendation, setRecommendation] = useState<string>('RECOMMENDED');
  const [infraVerified, setInfraVerified] = useState<boolean>(true);
  const [facultyVerified, setFacultyVerified] = useState<boolean>(true);
  const [labsFunctional, setLabsFunctional] = useState<boolean>(true);
  const [submittingComplete, setSubmittingComplete] = useState<boolean>(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // Calendar month state
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedDaySchedules, setSelectedDaySchedules] = useState<{ day: number; items: EVCScheduleItem[] } | null>(null);

  const fetchEVCData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [schedData, membersData] = await Promise.all([
        apiRequest<EVCScheduleItem[]>(`/evc/schedules?tab=${activeTab}`),
        apiRequest<EVCCommitteeMember[]>('/evc/committee-members').catch(() => [])
      ]);
      setSchedules(schedData);
      setCommitteeMembers(membersData);
    } catch (err: any) {
      setError(err.message || 'Failed to load EVC schedule data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEVCData();
  }, [activeTab]);

  // Filtered schedules for current tab
  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (selectedRegion !== 'ALL' && s.region_name !== selectedRegion) {
        return false;
      }
      if (newInstitutionsOnly && !s.is_new_institution) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesRef = s.application_ref_no?.toLowerCase().includes(query);
        const matchesInst = s.institution_name?.toLowerCase().includes(query);
        const matchesState = s.state?.toLowerCase().includes(query);
        if (!matchesRef && !matchesInst && !matchesState) return false;
      }
      return true;
    });
  }, [schedules, selectedRegion, newInstitutionsOnly, searchTerm]);

  // Handle Schedule Visit
  const handleOpenScheduleModal = (item: EVCScheduleItem) => {
    setSchedulingItem(item);
    setScheduleError(null);
    // Default date: 7 days from now at 10:00 AM
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(10, 0, 0, 0);
    setScheduleDate(d.toISOString().slice(0, 16));
    setSelectedCommitteeIds(item.committee_ids.length > 0 ? item.committee_ids : []);
  };

  const handleScheduleSubmit = async () => {
    if (!schedulingItem) return;
    if (!scheduleDate) {
      setScheduleError('Please select a visit date and time.');
      return;
    }
    if (selectedCommitteeIds.length === 0) {
      setScheduleError('Please pick at least one Expert Visit Committee member.');
      return;
    }

    setSubmittingSchedule(true);
    setScheduleError(null);
    try {
      await apiRequest(`/evc/${schedulingItem.id}/schedule`, {
        method: 'POST',
        body: JSON.stringify({
          scheduled_date: new Date(scheduleDate).toISOString(),
          committee_ids: selectedCommitteeIds
        })
      });
      setSchedulingItem(null);
      await fetchEVCData();
      alert('EVC physical inspection visit scheduled successfully! Committee members notified.');
    } catch (err: any) {
      setScheduleError(err.message || 'Failed to schedule visit');
    } finally {
      setSubmittingSchedule(false);
    }
  };

  // Handle Reschedule Visit
  const handleOpenRescheduleModal = (item: EVCScheduleItem) => {
    setReschedulingItem(item);
    setRescheduleError(null);
    setRescheduleReason('');
    const d = item.scheduled_date ? new Date(item.scheduled_date) : new Date();
    d.setDate(d.getDate() + 3);
    setRescheduleDate(d.toISOString().slice(0, 16));
  };

  const handleRescheduleSubmit = async () => {
    if (!reschedulingItem) return;
    if (!rescheduleDate) {
      setRescheduleError('Please select the new rescheduled date.');
      return;
    }
    if (!rescheduleReason.trim()) {
      setRescheduleError('A mandatory administrative reason is required for rescheduling.');
      return;
    }

    setSubmittingReschedule(true);
    setRescheduleError(null);
    try {
      await apiRequest(`/evc/${reschedulingItem.id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({
          scheduled_date: new Date(rescheduleDate).toISOString(),
          reason: rescheduleReason.trim()
        })
      });
      setReschedulingItem(null);
      await fetchEVCData();
      alert('EVC inspection visit rescheduled and logged to audit trail.');
    } catch (err: any) {
      setRescheduleError(err.message || 'Failed to reschedule visit');
    } finally {
      setSubmittingReschedule(false);
    }
  };

  // Handle Complete Inspection (Auto-advancement)
  const handleOpenCompleteModal = (item: EVCScheduleItem) => {
    setCompletingItem(item);
    setCompleteError(null);
    setReportSummary('');
    setRecommendation('RECOMMENDED');
    setInfraVerified(true);
    setFacultyVerified(true);
    setLabsFunctional(true);
  };

  const handleCompleteSubmit = async () => {
    if (!completingItem) return;
    if (!reportSummary.trim() || reportSummary.trim().length < 10) {
      setCompleteError('Please provide formal committee inspection observations (minimum 10 characters).');
      return;
    }

    setSubmittingComplete(true);
    setCompleteError(null);
    try {
      const res: any = await apiRequest(`/evc/${completingItem.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          report_summary: reportSummary.trim(),
          recommendation,
          infra_verified: infraVerified,
          faculty_verified: facultyVerified,
          labs_functional: labsFunctional
        })
      });
      setCompletingItem(null);
      await fetchEVCData();
      alert(res.message || 'EVC inspection completed and application auto-advanced to the next stage!');
    } catch (err: any) {
      setCompleteError(err.message || 'Failed to complete inspection');
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

  const canManageSchedule =
    user?.role === 'REGIONAL_OFFICER' ||
    user?.role === 'REGIONAL_HEAD' ||
    user?.role === 'BUREAU_OFFICER' ||
    user?.role === 'ADMIN' ||
    user?.role === 'SCRUTINY_OFFICER';

  const canCompleteInspection =
    user?.role === 'EVC_MEMBER' ||
    user?.role === 'EVC_INSPECTOR' ||
    user?.role === 'ADMIN' ||
    user?.role === 'REGIONAL_OFFICER';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Expert Visit Committee (EVC) Operations
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-[#0B2240] border border-blue-200">
                AICTE APH Norms
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                Role: <strong>{user?.role}</strong>
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Statutory on-site and virtual inspection portal. New institutions are strictly prioritised with shorter prescribed timelines (10-day vs 21-day due window).
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <HumanOversightBadge size="sm" showSubtitle={false} />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'queue'
                  ? 'bg-white text-[#0B2240] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inspection Queue
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-white text-[#0B2240] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Calendar (Month View)
            </button>
            <button
              onClick={() => setActiveTab('overdue')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overdue'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-rose-700 hover:text-rose-900 hover:bg-rose-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Overdue Escalations
            </button>
          </div>

          {/* Quick Stats Summary */}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Total in view: <strong className="text-slate-900">{filteredSchedules.length}</strong>
            </span>
            <span>•</span>
            <span>
              New Campuses: <strong className="text-purple-700">{schedules.filter((s) => s.is_new_institution).length}</strong>
            </span>
          </div>
        </div>

        {/* Filter Controls (for Queue & Overdue tabs) */}
        {activeTab !== 'calendar' && (
          <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter by ref no, institution, or state..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-[#0B2240] focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="p-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All Regions</option>
                <option value="Northern">Northern</option>
                <option value="Southern">Southern</option>
                <option value="Western">Western</option>
                <option value="Eastern">Eastern</option>
                <option value="Central">Central</option>
                <option value="South-Western">South-Western</option>
                <option value="North-Western">North-Western</option>
                <option value="South-Central">South-Central</option>
              </select>

              <button
                onClick={() => setNewInstitutionsOnly(!newInstitutionsOnly)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                  newInstitutionsOnly
                    ? 'bg-purple-100 text-purple-900 border-purple-400'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Prioritise New Institutions
              </button>

              {(searchTerm || selectedRegion !== 'ALL' || newInstitutionsOnly) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedRegion('ALL');
                    setNewInstitutionsOnly(false);
                  }}
                  className="px-2 py-1 text-slate-500 hover:text-slate-800 bg-slate-100 rounded text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <LoadingState message="Aggregating EVC inspection schedules and committee assignments..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchEVCData} />
      ) : (
        <>
          {/* =========================================================================
              TAB 1: QUEUE TAB
             ========================================================================= */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              {filteredSchedules.length === 0 ? (
                <EmptyState
                  title="No EVC Inspections in Queue"
                  description="There are currently no active applications awaiting physical inspection in your scope."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredSchedules.map((item) => (
                    <div
                      key={item.id}
                      className={`p-5 rounded-xl border shadow-2xs space-y-4 transition-all bg-white ${
                        item.is_new_institution
                          ? 'border-purple-200 ring-1 ring-purple-100 hover:border-purple-300'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-[#0B2240]">
                              {item.application_ref_no || `App #${item.application_id}`}
                            </span>

                            {/* Required Badge 1: New Institution */}
                            {item.is_new_institution && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1 shadow-2xs">
                                <Sparkles className="w-3 h-3 text-purple-600" />
                                New Institution (Priority Window)
                              </span>
                            )}

                            {/* Status Badge */}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                item.status === 'QUEUED'
                                  ? 'bg-slate-100 text-slate-800 border border-slate-300'
                                  : item.status === 'SCHEDULED'
                                  ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                  : item.status === 'DUE_SOON'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                                  : item.status === 'OVERDUE'
                                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {item.status.replace(/_/g, ' ')}
                            </span>
                          </div>

                          <h3 className="font-bold text-sm text-slate-900 mt-1">
                            {item.institution_name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {item.state} ({item.region_name} Directorate) • Discipline: {item.institution_type}
                          </div>
                        </div>

                        {/* Required Badge 2 & 3: Due in X days / Overdue by X days */}
                        <div className="shrink-0 text-right">
                          {item.is_overdue ? (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              Overdue by {item.days_overdue} days
                            </span>
                          ) : (
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 ${
                                item.days_remaining <= 3
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              Due in {item.days_remaining} days
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Timeline & Committee Particulars */}
                      <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-2 border border-slate-100">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Scheduled Visit Date:</span>
                          <span className="font-bold text-slate-900 font-mono">
                            {item.scheduled_date
                              ? new Date(item.scheduled_date).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Not Yet Scheduled (In Queue)'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Prescribed Due Window:</span>
                          <span className="font-semibold text-slate-700">
                            {new Date(item.due_date).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })} ({item.is_new_institution ? '10-day expedited norm' : '21-day standard norm'})
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-200">
                          <span className="text-slate-500 font-medium block mb-1">Assigned Committee Members:</span>
                          {item.committee_members.length === 0 ? (
                            <span className="text-slate-400 italic">No experts assigned yet.</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {item.committee_members.map((m) => (
                                <span
                                  key={m.id}
                                  className="px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200 text-[11px] font-medium"
                                >
                                  {m.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        <Link
                          to={`/applications/${item.application_id}`}
                          className="text-xs text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-1"
                        >
                          View Full Case <ArrowRight className="w-3 h-3" />
                        </Link>

                        <div className="flex items-center gap-2">
                          {/* Schedule / Reschedule Actions */}
                          {canManageSchedule && item.status !== 'COMPLETED' && (
                            item.status === 'QUEUED' ? (
                              <button
                                onClick={() => handleOpenScheduleModal(item)}
                                className="px-3 py-1.5 bg-[#0B2240] hover:bg-[#07172C] text-white rounded text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                              >
                                Schedule Visit
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenRescheduleModal(item)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold border border-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Reschedule
                              </button>
                            )
                          )}

                          {/* Complete Inspection Action */}
                          {canCompleteInspection && item.status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleOpenCompleteModal(item)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Complete & Upload Report
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 2: CALENDAR TAB (MONTH VIEW WITH COLOUR-CODED VISITS)
             ========================================================================= */}
          {activeTab === 'calendar' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-6">
              {/* Calendar Month Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {calendarDate.toLocaleString('default', { month: 'long' })} {year}
                  </h3>
                  <button
                    onClick={() => setCalendarDate(new Date())}
                    className="text-xs px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold cursor-pointer"
                  >
                    Today
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-xs mr-4">
                    <span className="flex items-center gap-1 text-[11px] text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Scheduled
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Due Soon
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span> Overdue
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> Completed
                    </span>
                  </div>

                  <button
                    onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-slate-600"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer text-slate-600"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Month Grid */}
              <div className="grid grid-cols-7 border-t border-l border-slate-200 text-xs">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div
                    key={d}
                    className="p-2.5 bg-slate-50 font-bold text-center text-slate-600 border-r border-b border-slate-200 uppercase text-[10px]"
                  >
                    {d}
                  </div>
                ))}

                {/* Empty cells before first day */}
                {[...Array(firstDayOfMonth)].map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[90px] bg-slate-50/40 border-r border-b border-slate-200" />
                ))}

                {/* Days of month */}
                {[...Array(daysInMonth)].map((_, i) => {
                  const dayNum = i + 1;
                  const dayEvents = calendarEventsByDay[dayNum] || [];
                  const isToday =
                    new Date().getDate() === dayNum &&
                    new Date().getMonth() === month &&
                    new Date().getFullYear() === year;

                  return (
                    <div
                      key={dayNum}
                      onClick={() => dayEvents.length > 0 && setSelectedDaySchedules({ day: dayNum, items: dayEvents })}
                      className={`min-h-[90px] p-2 border-r border-b border-slate-200 transition-colors ${
                        dayEvents.length > 0 ? 'hover:bg-blue-50/40 cursor-pointer' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                            isToday ? 'bg-[#0B2240] text-white' : 'text-slate-700'
                          }`}
                        >
                          {dayNum}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] font-bold text-slate-400">
                            {dayEvents.length} visit{dayEvents.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Event Pills */}
                      <div className="space-y-1">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            className={`px-1.5 py-0.5 rounded text-[10px] truncate font-semibold border ${
                              ev.status === 'OVERDUE'
                                ? 'bg-rose-50 text-rose-800 border-rose-300'
                                : ev.status === 'DUE_SOON'
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : ev.status === 'COMPLETED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-blue-50 text-blue-900 border-blue-200'
                            }`}
                            title={`${ev.institution_name} - ${ev.status}`}
                          >
                            {ev.institution_name}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[9px] text-slate-400 font-semibold pl-1">
                            +{dayEvents.length - 2} more...
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Day Preview Drawer/Modal */}
              {selectedDaySchedules && (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[#0B2240]">
                      Visits on {calendarDate.toLocaleString('default', { month: 'short' })} {selectedDaySchedules.day}, {year}
                    </h4>
                    <button
                      onClick={() => setSelectedDaySchedules(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {selectedDaySchedules.items.map((it) => (
                      <div
                        key={it.id}
                        className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{it.institution_name}</span>
                            {it.is_new_institution && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 text-[10px] font-bold">
                                New Institution
                              </span>
                            )}
                            <span className="font-mono text-slate-500 text-[11px]">{it.application_ref_no}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Status: <strong className="text-slate-700">{it.status}</strong> • State: {it.state}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Link
                            to={`/applications/${it.application_id}`}
                            className="text-xs text-blue-700 font-semibold hover:underline"
                          >
                            View Case
                          </Link>
                          {canCompleteInspection && it.status !== 'COMPLETED' && (
                            <button
                              onClick={() => handleOpenCompleteModal(it)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold cursor-pointer"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 3: OVERDUE TAB
             ========================================================================= */}
          {activeTab === 'overdue' && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-center justify-between text-xs text-rose-900">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm">Critical EVC SLA Breaches</h4>
                    <p>
                      These physical inspections have breached the prescribed AICTE statutory due window. Escalations are automatically routed to the Regional Head for committee re-assignment.
                    </p>
                  </div>
                </div>
                <span className="font-mono font-bold text-lg bg-rose-200 px-3 py-1 rounded-lg">
                  {filteredSchedules.length} Breaches
                </span>
              </div>

              {filteredSchedules.length === 0 ? (
                <EmptyState
                  title="Zero Overdue Inspections"
                  description="All Expert Visit Committee inspections are currently operating within prescribed SLA windows."
                />
              ) : (
                <div className="space-y-3">
                  {filteredSchedules.map((item) => (
                    <div
                      key={item.id}
                      className="p-5 bg-white border-2 border-rose-200 rounded-xl shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-rose-950">
                              {item.application_ref_no || `App #${item.application_id}`}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white shadow-2xs">
                              Overdue by {item.days_overdue} days
                            </span>
                            {item.is_new_institution && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900">
                                New Institution
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-sm text-slate-900 mt-1">
                            {item.institution_name}
                          </h3>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {item.state} ({item.region_name} Directorate) • Statutory Due Date:{' '}
                            <strong className="text-rose-700 font-mono">
                              {new Date(item.due_date).toLocaleDateString()}
                            </strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {canManageSchedule && (
                            <button
                              onClick={() => handleOpenRescheduleModal(item)}
                              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded text-xs font-bold border border-rose-300 transition-colors cursor-pointer"
                            >
                              Emergency Reschedule
                            </button>
                          )}
                          {canCompleteInspection && (
                            <button
                              onClick={() => handleOpenCompleteModal(item)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                            >
                              Complete Inspection
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Committee & Overdue Context */}
                      <div className="p-3 bg-rose-50/40 rounded-lg text-xs space-y-1 text-slate-700">
                        <div>
                          <span className="font-medium text-slate-500">Scheduled Date: </span>
                          <span className="font-mono">
                            {item.scheduled_date ? new Date(item.scheduled_date).toLocaleString() : 'Not Set'}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-500">Assigned Committee: </span>
                          {item.committee_members.length > 0 ? (
                            <span>{item.committee_members.map((m) => m.name).join(', ')}</span>
                          ) : (
                            <span className="text-rose-700 font-semibold italic">Unassigned (Action Required)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          MODAL 1: SCHEDULE VISIT WITH COMMITTEE MEMBER PICKER
         ========================================================================= */}
      {schedulingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-[#0B2240]">
                <Calendar className="w-5 h-5 text-blue-900" />
                <h3 className="font-bold text-base text-slate-900">Schedule EVC Physical Inspection</h3>
              </div>
              <button onClick={() => setSchedulingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs space-y-1">
              <div className="font-bold text-[#0B2240]">{schedulingItem.institution_name}</div>
              <div className="text-slate-600 font-mono text-[11px]">{schedulingItem.application_ref_no} • {schedulingItem.state}</div>
              <div className="text-blue-900 pt-1 font-medium">
                Prescribed Statutory Due Date: <strong>{new Date(schedulingItem.due_date).toLocaleDateString()}</strong>
              </div>
            </div>

            {/* Visit Date Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Inspection Visit Date & Time:
              </label>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#0B2240]"
              />
            </div>

            {/* Committee Member Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pick Committee Expert Members:
              </label>
              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                {committeeMembers.map((m) => {
                  const isChecked = selectedCommitteeIds.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between p-2.5 text-xs cursor-pointer hover:bg-slate-50 ${
                        isChecked ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCommitteeIds([...selectedCommitteeIds, m.id]);
                            } else {
                              setSelectedCommitteeIds(selectedCommitteeIds.filter((id) => id !== m.id));
                            }
                          }}
                          className="rounded text-[#0B2240]"
                        />
                        <div>
                          <span className="font-bold text-slate-900 block">{m.name}</span>
                          <span className="text-[11px] text-slate-500">{m.email} • {m.region_name}</span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                        {m.active_assignments} active
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Selected: {selectedCommitteeIds.length} expert(s)
              </div>
            </div>

            {scheduleError && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{scheduleError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSchedulingItem(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleSubmit}
                disabled={submittingSchedule}
                className="px-5 py-2 bg-[#0B2240] hover:bg-[#07172C] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2"
              >
                {submittingSchedule ? 'Scheduling...' : 'Confirm EVC Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: RESCHEDULE VISIT WITH MANDATORY REASON
         ========================================================================= */}
      {reschedulingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-700">
                <RotateCcw className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base text-slate-900">Reschedule EVC Inspection</h3>
              </div>
              <button onClick={() => setReschedulingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1">
              <div className="font-bold text-slate-900">{reschedulingItem.institution_name}</div>
              <div className="text-slate-600 font-mono text-[11px]">{reschedulingItem.application_ref_no}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Inspection Visit Date:
              </label>
              <input
                type="datetime-local"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mandatory Speaking Reason for Rescheduling <span className="text-rose-600">*</span>:
              </label>
              <textarea
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="State statutory reason (e.g. member unavailability, regional law & order, weather disruption)..."
                rows={3}
                className="w-full p-3 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {rescheduleError && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{rescheduleError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setReschedulingItem(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={submittingReschedule}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2"
              >
                {submittingReschedule ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: COMPLETE INSPECTION & AUTO-ADVANCE STAGE
         ========================================================================= */}
      {completingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">Complete EVC Inspection Report</h3>
              </div>
              <button onClick={() => setCompletingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Auto-Advancement Notice */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-700" />
                Workflow Auto-Advancement Enabled
              </div>
              <p className="text-[11px] text-emerald-800">
                Submitting this report marks EVC complete and automatically advances Application{' '}
                <strong>{completingItem.application_ref_no}</strong> to the next stage in its template.
              </p>
            </div>

            {/* Checklist */}
            <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <span className="font-bold text-slate-700 block uppercase text-[10px]">On-Site Norms Verification:</span>
              <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={infraVerified}
                  onChange={(e) => setInfraVerified(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                Campus Land, Built-up Area & Master Plan Verified
              </label>
              <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={facultyVerified}
                  onChange={(e) => setFacultyVerified(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                Faculty Cadre Physically Present & Attendance Confirmed
              </label>
              <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={labsFunctional}
                  onChange={(e) => setLabsFunctional(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                Computer Terminals & Core Laboratories Functional
              </label>
            </div>

            {/* Recommendation Select */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Committee Recommendation:
              </label>
              <select
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
              >
                <option value="RECOMMENDED">RECOMMENDED for Approval (EoA)</option>
                <option value="DEFICIENT_HEARING">DEFICIENT - Refer to Standing Hearing Committee</option>
                <option value="NOT_RECOMMENDED">NOT RECOMMENDED (Critical Infrastructure Missing)</option>
              </select>
            </div>

            {/* Report Summary */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Formal Committee Inspection Findings & Observations <span className="text-rose-600">*</span>:
              </label>
              <textarea
                value={reportSummary}
                onChange={(e) => setReportSummary(e.target.value)}
                placeholder="Record geotagged site verification observations, equipment adequacy, and compliance findings..."
                rows={4}
                className="w-full p-3 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {completeError && (
              <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{completeError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setCompletingItem(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteSubmit}
                disabled={submittingComplete}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2"
              >
                {submittingComplete ? 'Advancing Stage...' : 'Submit & Advance Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
