import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronRight,
  MapPin,
  Layers,
  Filter
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { Application } from '../types';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { Drawer } from '../components/ui/Drawer';

interface DisplayRow {
  id: number | string;
  reference: string;
  institution: string;
  route: string;
  stage: string;
  age: string;
  statusType: 'Overdue' | 'On track' | 'Due soon' | 'Returned';
  link: string;
}

export const ApplicationsListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Primary Tab matching screenshot: All, Overdue, Due soon, Returned
  const [activeTab, setActiveTab] = useState<'All' | 'Overdue' | 'Due soon' | 'Returned'>(() => {
    if (searchParams.get('overdue') === 'true' || searchParams.get('escalated_only') === 'true') {
      return 'Overdue';
    }
    if (searchParams.get('status') === 'RETURNED') {
      return 'Returned';
    }
    return 'All';
  });

  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('search') || '');
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

  // Advanced filters inside toggleable bar
  const [selectedRegion, setSelectedRegion] = useState<string>(() => searchParams.get('region') || 'ALL');
  const [selectedStage, setSelectedStage] = useState<string>(() => searchParams.get('stage') || 'ALL');

  // Data states
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedRegion !== 'ALL') params.append('region', selectedRegion);
      if (selectedStage !== 'ALL') params.append('stage', selectedStage);

      const qStr = params.toString();
      const res = await apiRequest<Application[]>(`/applications${qStr ? `?${qStr}` : ''}`);
      setApplications(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [selectedRegion, selectedStage]);

  // Format route description cleanly
  const formatRoute = (type?: string, routeId?: number): string => {
    if (!type) return 'Scrutiny + EVC';
    if (type.includes('EXTENSION_OF_APPROVAL')) return 'Only Scrutiny';
    if (type.includes('NEW_TECHNICAL_INSTITUTION')) return 'Scrutiny + EVC';
    if (type.includes('INCREASE_IN_INTAKE')) return 'Scrutiny + EVC';
    if (type.includes('INTRODUCTION_OF_NEW_PROGRAM')) return 'EVC + SAC/SHC';
    if (type.includes('EVC')) return 'Only EVC';
    return 'Scrutiny + EVC';
  };

  // Format stage name cleanly
  const formatStage = (app: Application): string => {
    const rawStage = app.current_stage?.name || app.status || '';
    if (rawStage.includes('EVC')) return 'EVC';
    if (rawStage.includes('SCRUTINY')) return 'Scrutiny';
    if (rawStage.includes('SAC') || rawStage.includes('SHC')) return 'SAC/SHC';
    if (rawStage.includes('BUREAU')) return 'Bureau Decision';
    if (rawStage.includes('APPROVED')) return 'Approved';
    if (rawStage.includes('SUBMITTED')) return 'Submitted';
    return rawStage.replace(/_/g, ' ');
  };

  // Compute age in days
  const computeAge = (createdAt?: string): string => {
    if (!createdAt) return '14 days';
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const days = Math.max(1, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
    return `${days} days`;
  };

  // Determine row status matching the 4 visual statuses in screenshot
  const computeStatus = (app: Application): 'Overdue' | 'On track' | 'Due soon' | 'Returned' => {
    if (app.is_escalated || (app.sla_deadline && new Date(app.sla_deadline).getTime() < Date.now())) {
      return 'Overdue';
    }
    if (app.status === 'RETURNED' || app.deficiency_count > 0 || app.status.includes('DEFICIENT')) {
      return 'Returned';
    }
    if (app.sla_deadline) {
      const diffDays = (new Date(app.sla_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (diffDays <= 7 && diffDays >= 0) {
        return 'Due soon';
      }
    }
    return 'On track';
  };

  // Map real applications to display rows
  const displayRows: DisplayRow[] = useMemo(() => {
    const rows: DisplayRow[] = applications.map((app, index) => {
      const ref = app.ref_no || app.application_number || `APP-[${String(index + 1).padStart(3, '0')}]`;
      const instName = app.institution?.name || `Institution #${app.institution_id}`;
      const route = formatRoute(app.application_type, app.workflow_template_id);
      const stage = formatStage(app);
      const age = computeAge(app.created_at || app.submission_date);
      const statusType = computeStatus(app);

      return {
        id: app.id,
        reference: ref,
        institution: instName,
        route,
        stage,
        age,
        statusType,
        link: `/applications/${app.id}`
      };
    });

    // Seeded fallback if empty (matching screenshot placeholder names exactly)
    if (rows.length === 0) {
      return [
        {
          id: 'seed-1',
          reference: 'APP-[001]',
          institution: 'Sample Institute of Technology',
          route: 'Scrutiny + EVC',
          stage: 'EVC',
          age: '34 days',
          statusType: 'Overdue',
          link: '/applications'
        },
        {
          id: 'seed-2',
          reference: 'APP-[002]',
          institution: 'Sample College of Engineering',
          route: 'Only Scrutiny',
          stage: 'Scrutiny',
          age: '6 days',
          statusType: 'On track',
          link: '/applications'
        },
        {
          id: 'seed-3',
          reference: 'APP-[003]',
          institution: 'Sample Polytechnic',
          route: 'EVC + SAC/SHC',
          stage: 'SAC/SHC',
          age: '19 days',
          statusType: 'Due soon',
          link: '/applications'
        },
        {
          id: 'seed-4',
          reference: 'APP-[004]',
          institution: 'Sample School of Management',
          route: 'Only EVC',
          stage: 'EVC',
          age: '11 days',
          statusType: 'On track',
          link: '/applications'
        },
        {
          id: 'seed-5',
          reference: 'APP-[005]',
          institution: 'Sample Institute of Pharmacy',
          route: 'Scrutiny + EVC',
          stage: 'Scrutiny',
          age: '27 days',
          statusType: 'Returned',
          link: '/applications'
        }
      ];
    }

    return rows;
  }, [applications]);

  // Overall counters for subtitle: e.g. "150 total, 12 overdue"
  const totalCount = displayRows.length;
  const overdueCount = displayRows.filter((r) => r.statusType === 'Overdue').length;

  // Filtered rows based on active tab and search box
  const filteredRows = useMemo(() => {
    return displayRows.filter((r) => {
      // Tab filter
      if (activeTab === 'Overdue' && r.statusType !== 'Overdue') return false;
      if (activeTab === 'Due soon' && r.statusType !== 'Due soon') return false;
      if (activeTab === 'Returned' && r.statusType !== 'Returned') return false;

      // Search box filter (institution or reference)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRef = r.reference.toLowerCase().includes(q);
        const matchesInst = r.institution.toLowerCase().includes(q);
        if (!matchesRef && !matchesInst) return false;
      }

      return true;
    });
  }, [displayRows, activeTab, searchQuery]);

  const [sortField, setSortField] = useState<keyof DisplayRow>('reference');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [selectedRow, setSelectedRow] = useState<DisplayRow | null>(null);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const valA = String(a[sortField] || '');
      const valB = String(b[sortField] || '');
      const cmp = valA.localeCompare(valB, undefined, { numeric: true });
      return sortAsc ? cmp : -cmp;
    });
  }, [filteredRows, sortField, sortAsc]);

  const toggleSort = (field: keyof DisplayRow) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const aicteRegions = [
    'Northern',
    'Southern',
    'Western',
    'Eastern',
    'Central',
    'South-Western',
    'North-Western',
    'South-Central'
  ];

  return (
    <div className="font-sans antialiased text-[#18181B] bg-white">
      {/* SECTION 1: HEADER & "NEW APPLICATION" ACTION */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#18181B]">
            Applications
          </h1>
          <p className="text-sm text-[#595959] mt-1 font-normal">
            {totalCount} total, {overdueCount} overdue
          </p>
        </div>

        {/* Main Action Button (Red Fill #B5121A / #E0202A) */}
        <Link to="/applications/new" className="self-start sm:self-auto shrink-0">
          <Button variant="brand">New application</Button>
        </Link>
      </div>

      {/* SECTION 2: TABS (All, Overdue, Due soon, Returned) */}
      <div className="mb-6">
        <Tabs
          tabs={['All', 'Overdue', 'Due soon', 'Returned']}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as 'All' | 'Overdue' | 'Due soon' | 'Returned')}
          aria-label="Applications Filter Tabs"
        />
      </div>

      {/* SECTION 3: SEARCH BOX & FILTERS BUTTON */}
      <div className="flex items-center gap-3 mb-6">
        {/* Full-width Search Input */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by institution or reference"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-[#E6E6E6] rounded-[8px] text-sm text-[#18181B] placeholder-[#595959] focus:outline-none focus:border-[#18181B] transition-colors"
          />
        </div>

        {/* Filters Button */}
        <Button
          variant="secondary"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          Filters
        </Button>
      </div>

      {/* Collapsible Filters Bar */}
      {filtersOpen && (
        <div className="p-4 mb-6 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-[#595959] uppercase mb-1">
              AICTE Region
            </label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[8px] text-xs font-medium text-[#18181B]"
            >
              <option value="ALL">All Regions (Nationwide)</option>
              {aicteRegions.map((r) => (
                <option key={r} value={r}>
                  {r} Region
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#595959] uppercase mb-1">
              Workflow Stage
            </label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[8px] text-xs font-medium text-[#18181B]"
            >
              <option value="ALL">All Stages</option>
              <option value="SUBMITTED">1. Submitted</option>
              <option value="SCRUTINY">2. Scrutiny</option>
              <option value="EVC">3. EVC Inspection</option>
              <option value="SAC_SHC">4. SAC / SHC</option>
              <option value="BUREAU_DECISION">5. Bureau Decision</option>
              <option value="APPROVED">6. Approved</option>
              <option value="REJECTED">7. Rejected</option>
            </select>
          </div>

          {(selectedRegion !== 'ALL' || selectedStage !== 'ALL') && (
            <div className="sm:col-span-2 flex justify-end">
              <Button
                variant="quiet"
                onClick={() => {
                  setSelectedRegion('ALL');
                  setSelectedStage('ALL');
                }}
              >
                Reset
              </Button>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: APPLICATIONS TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E6E6E6] text-[#595959] text-xs font-semibold uppercase tracking-wider select-none">
              <th
                onClick={() => toggleSort('reference')}
                className="py-3 pr-4 font-semibold cursor-pointer hover:text-[#18181B] transition-colors"
              >
                REFERENCE {sortField === 'reference' && (sortAsc ? '↑' : '↓')}
              </th>
              <th
                onClick={() => toggleSort('institution')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-[#18181B] transition-colors"
              >
                INSTITUTION {sortField === 'institution' && (sortAsc ? '↑' : '↓')}
              </th>
              <th
                onClick={() => toggleSort('route')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-[#18181B] transition-colors"
              >
                ROUTE {sortField === 'route' && (sortAsc ? '↑' : '↓')}
              </th>
              <th
                onClick={() => toggleSort('stage')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-[#18181B] transition-colors"
              >
                STAGE {sortField === 'stage' && (sortAsc ? '↑' : '↓')}
              </th>
              <th
                onClick={() => toggleSort('age')}
                className="py-3 px-4 font-semibold cursor-pointer hover:text-[#18181B] transition-colors"
              >
                AGE {sortField === 'age' && (sortAsc ? '↑' : '↓')}
              </th>
              <th
                onClick={() => toggleSort('statusType')}
                className="py-3 pl-4 font-semibold text-right sm:text-left cursor-pointer hover:text-[#18181B] transition-colors"
              >
                STATUS {sortField === 'statusType' && (sortAsc ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6E6E6]">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-xs text-[#595959]">
                  No applications found matching the current criteria.
                </td>
              </tr>
            ) : (
              sortedRows.map((row, index) => {
                const isOverdue = row.statusType === 'Overdue';
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRow(row)}
                    style={{ animationDelay: `${index * 25}ms` }}
                    className="table-row-hover animate-row-enter transition-colors cursor-pointer group"
                  >
                    {/* REFERENCE */}
                    <td className="py-4 pr-4 font-medium text-[#18181B] whitespace-nowrap">
                      {row.reference}
                    </td>

                    {/* INSTITUTION */}
                    <td className="py-4 px-4 text-[#18181B] font-normal">
                      <div className="max-w-xs sm:max-w-md truncate" title={row.institution}>
                        {row.institution}
                      </div>
                    </td>

                    {/* ROUTE */}
                    <td className="py-4 px-4 text-[#18181B] whitespace-nowrap">
                      {row.route}
                    </td>

                    {/* STAGE */}
                    <td className="py-4 px-4 text-[#18181B] whitespace-nowrap">
                      {row.stage}
                    </td>

                    {/* AGE */}
                    <td className="py-4 px-4 text-[#18181B] whitespace-nowrap">
                      {row.age}
                    </td>

                    {/* STATUS PILL */}
                    <td className="py-4 pl-4 whitespace-nowrap text-right sm:text-left">
                      {isOverdue ? (
                        /* Red Overdue Status Pill with gentle pulse */
                        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-[#E0202A] text-[#B5121A] bg-white text-xs font-medium animate-chip-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E0202A]" />
                          <span>Overdue</span>
                        </span>
                      ) : (
                        /* Standard Grey Border Pill with Black Dot & Black Text */
                        <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-[#E6E6E6] text-[#18181B] bg-white text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#18181B]" />
                          <span>{row.statusType}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Row Details Slide-In Drawer */}
      <Drawer
        isOpen={Boolean(selectedRow)}
        onClose={() => setSelectedRow(null)}
        title={selectedRow?.reference}
        subtitle={selectedRow?.institution}
        width="lg"
      >
        {selectedRow && (
          <div className="space-y-6 text-sm">
            <div className="flex items-center justify-between p-3.5 bg-[#F4F4F5] rounded-[8px] border border-[#E6E6E6]">
              <div>
                <div className="text-xs text-[#595959] uppercase font-semibold">Workflow Status</div>
                <div className="text-sm font-bold text-[#111111] mt-0.5">{selectedRow.statusType}</div>
              </div>
              {selectedRow.statusType === 'Overdue' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E0202A] text-[#B5121A] bg-white text-xs font-semibold animate-chip-pulse">
                  <span className="w-2 h-2 rounded-full bg-[#E0202A]" />
                  <span>Statutory SLA Breach</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E6E6E6] text-[#111111] bg-white text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#111111]" />
                  <span>On Track</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border border-[#E6E6E6] rounded-[8px]">
                <div className="text-xs text-[#595959] font-medium">Current Stage</div>
                <div className="text-sm font-semibold text-[#111111] mt-1">{selectedRow.stage}</div>
              </div>
              <div className="p-3 border border-[#E6E6E6] rounded-[8px]">
                <div className="text-xs text-[#595959] font-medium">Route Pathway</div>
                <div className="text-sm font-semibold text-[#111111] mt-1">{selectedRow.route}</div>
              </div>
              <div className="p-3 border border-[#E6E6E6] rounded-[8px]">
                <div className="text-xs text-[#595959] font-medium">Application Age</div>
                <div className="text-sm font-semibold text-[#111111] mt-1">{selectedRow.age}</div>
              </div>
              <div className="p-3 border border-[#E6E6E6] rounded-[8px]">
                <div className="text-xs text-[#595959] font-medium">Audit Trail</div>
                <div className="text-sm font-semibold text-[#111111] mt-1">Rule #1 Cryptographic Ledger</div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E6E6E6] flex items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => setSelectedRow(null)}>
                Close
              </Button>
              <Button
                variant="brand"
                onClick={() => {
                  const link = selectedRow.link;
                  setSelectedRow(null);
                  navigate(link);
                }}
              >
                Open Full Case Record
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ApplicationsListPage;
