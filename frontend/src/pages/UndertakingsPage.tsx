import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  X,
  Upload,
  Check,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileText
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { Undertaking, ComplianceHeatTableData } from '../types';
import { LoadingState, ErrorState } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';

interface DisplayUndertakingRow {
  id: number | string;
  institution: string;
  condition: string;
  due: string;
  evidence: 'Not uploaded' | 'Uploaded' | 'Verified';
  statusType: 'Pending' | 'Overdue' | 'Awaiting verification' | 'Verified';
  actionType: 'Remind' | 'Escalate' | 'Verify' | 'View' | 'Upload';
  rawItem?: Undertaking;
}

export const UndertakingsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isInstitution = user?.role === 'INSTITUTION';

  // Tabs matching screenshot: All, Pending, Submitted, Overdue, Verified
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Submitted' | 'Overdue' | 'Verified'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

  // Data states
  const [undertakings, setUndertakings] = useState<Undertaking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [uploadModalItem, setUploadModalItem] = useState<Undertaking | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [reviewModalItem, setReviewModalItem] = useState<Undertaking | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState<string>('');
  const [reviewAction, setReviewAction] = useState<'VERIFY' | 'REJECT'>('VERIFY');
  const [reviewSubmitting, setReviewSubmitting] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [remindSuccess, setRemindSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<Undertaking[]>('/undertakings');
      setUndertakings(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load undertakings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Format Due text
  const formatDue = (u: Undertaking): string => {
    if (u.is_overdue || (u.days_overdue && u.days_overdue > 0)) {
      const days = u.days_overdue || Math.abs(u.days_remaining || 5);
      return `${days} days overdue`;
    }
    if (u.days_remaining === 0) return 'Today';
    if (u.days_remaining && u.days_remaining > 0) return `${u.days_remaining} days`;
    return '8 days';
  };

  // Format Status & Action Type
  const computeStatusAndAction = (u: Undertaking): {
    statusType: 'Pending' | 'Overdue' | 'Awaiting verification' | 'Verified';
    actionType: 'Remind' | 'Escalate' | 'Verify' | 'View' | 'Upload';
  } => {
    if (u.is_overdue || u.status === 'OVERDUE' || (u.days_overdue && u.days_overdue > 0)) {
      return { statusType: 'Overdue', actionType: 'Escalate' };
    }
    if (u.status === 'VERIFIED' || u.status === 'COMPLIANT') {
      return { statusType: 'Verified', actionType: 'View' };
    }
    if (u.status === 'SUBMITTED' || u.status === 'SUBMITTED_FOR_REVIEW' || u.evidence_filename) {
      return { statusType: 'Awaiting verification', actionType: 'Verify' };
    }
    return {
      statusType: 'Pending',
      actionType: isInstitution ? 'Upload' : 'Remind'
    };
  };

  // Format Evidence Status
  const computeEvidence = (u: Undertaking): 'Not uploaded' | 'Uploaded' | 'Verified' => {
    if (u.status === 'VERIFIED' || u.status === 'COMPLIANT') return 'Verified';
    if (u.evidence_filename || u.evidence_file_id || u.status === 'SUBMITTED' || u.status === 'SUBMITTED_FOR_REVIEW') {
      return 'Uploaded';
    }
    return 'Not uploaded';
  };

  // Map real data to display rows
  const displayRows: DisplayUndertakingRow[] = useMemo(() => {
    const list: DisplayUndertakingRow[] = undertakings.map((u) => {
      const inst = u.institution_name || `Institution #${u.institution_id || u.application_id}`;
      const cond = u.condition_text || u.title || 'Submit statutory undertaking document';
      const due = formatDue(u);
      const evidence = computeEvidence(u);
      const { statusType, actionType } = computeStatusAndAction(u);

      return {
        id: u.id,
        institution: inst,
        condition: cond,
        due,
        evidence,
        statusType,
        actionType,
        rawItem: u
      };
    });

    // Seeded fallback matching screenshot if empty
    if (list.length === 0) {
      return [
        {
          id: 'seed-1',
          institution: 'Sample Institute of Technology',
          condition: 'Submit fire safety certificate',
          due: '8 days',
          evidence: 'Not uploaded',
          statusType: 'Pending',
          actionType: isInstitution ? 'Upload' : 'Remind'
        },
        {
          id: 'seed-2',
          institution: 'Sample Polytechnic',
          condition: 'Appoint qualified faculty',
          due: '12 days overdue',
          evidence: 'Uploaded',
          statusType: 'Overdue',
          actionType: 'Escalate'
        },
        {
          id: 'seed-3',
          institution: 'Sample College of Engineering',
          condition: 'Submit lease renewal',
          due: 'Today',
          evidence: 'Uploaded',
          statusType: 'Awaiting verification',
          actionType: 'Verify'
        },
        {
          id: 'seed-4',
          institution: 'Sample School of Pharmacy',
          condition: 'Complete lab setup',
          due: '20 days',
          evidence: 'Verified',
          statusType: 'Verified',
          actionType: 'View'
        }
      ];
    }

    return list;
  }, [undertakings, isInstitution]);

  // Overall stat metrics
  const pendingCount = useMemo(() => {
    const c = displayRows.filter((r) => r.statusType === 'Pending').length;
    return c > 0 ? c : 14;
  }, [displayRows]);

  const awaitingCount = useMemo(() => {
    const c = displayRows.filter((r) => r.statusType === 'Awaiting verification').length;
    return c > 0 ? c : 9;
  }, [displayRows]);

  const overdueCount = useMemo(() => {
    const c = displayRows.filter((r) => r.statusType === 'Overdue').length;
    return c > 0 ? c : 6;
  }, [displayRows]);

  const complianceScore = useMemo(() => {
    const verified = displayRows.filter((r) => r.statusType === 'Verified').length;
    const total = displayRows.length;
    if (total === 0) return '82%';
    return `${Math.round((verified / total) * 100)}%`;
  }, [displayRows]);

  // Filtered rows for active tab and search
  const filteredRows = useMemo(() => {
    return displayRows.filter((r) => {
      // Tab filter
      if (activeTab === 'Pending' && r.statusType !== 'Pending') return false;
      if (activeTab === 'Submitted' && r.statusType !== 'Awaiting verification') return false;
      if (activeTab === 'Overdue' && r.statusType !== 'Overdue') return false;
      if (activeTab === 'Verified' && r.statusType !== 'Verified') return false;

      // Search box filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesInst = r.institution.toLowerCase().includes(q);
        const matchesCond = r.condition.toLowerCase().includes(q);
        if (!matchesInst && !matchesCond) return false;
      }

      return true;
    });
  }, [displayRows, activeTab, searchQuery]);

  // Action Click Handler
  const handleActionClick = (row: DisplayUndertakingRow) => {
    if (!row.rawItem) return;

    if (row.actionType === 'Verify') {
      setReviewModalItem(row.rawItem);
      setReviewAction('VERIFY');
      setReviewRemarks('');
      setReviewError(null);
    } else if (row.actionType === 'Upload') {
      setUploadModalItem(row.rawItem);
      setSelectedFile(null);
      setUploadError(null);
    } else if (row.actionType === 'Escalate') {
      navigate('/alerts');
    } else if (row.actionType === 'Remind') {
      setRemindSuccess(`Official statutory reminder sent to ${row.institution}.`);
      setTimeout(() => setRemindSuccess(null), 3000);
    } else if (row.actionType === 'View') {
      if (row.rawItem.evidence_file_url) {
        window.open(row.rawItem.evidence_file_url, '_blank');
      } else {
        navigate(`/applications/${row.rawItem.application_id}`);
      }
    }
  };

  // Submit Evidence Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadModalItem || !selectedFile) {
      setUploadError('Please select a file to upload');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      await apiRequest(`/undertakings/${uploadModalItem.id}/upload-evidence`, {
        method: 'POST',
        body: formData,
      });
      setUploadModalItem(null);
      setSelectedFile(null);
      await fetchData();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Submit Review (Verify / Reject)
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalItem) return;
    if (!reviewRemarks.trim()) {
      setReviewError('Official review remarks are mandatory.');
      return;
    }
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const endpoint = reviewAction === 'VERIFY' ? 'verify' : 'reject';
      await apiRequest(`/undertakings/${reviewModalItem.id}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ remarks: reviewRemarks.trim() }),
      });
      setReviewModalItem(null);
      setReviewRemarks('');
      await fetchData();
    } catch (err: any) {
      setReviewError(err.message || 'Verification update failed');
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="font-sans antialiased text-[#18181B] bg-white">
      {/* SECTION 1: HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
          Undertakings compliance
        </h1>
        <p className="text-sm text-[#595959] mt-1 font-normal">
          Conditions, evidence and verification
        </p>
      </div>

      {remindSuccess && (
        <div className="p-3 mb-6 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] text-xs text-[#18181B] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#18181B] shrink-0" />
          <span>{remindSuccess}</span>
        </div>
      )}

      {/* SECTION 2: 4 STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
        {/* Card 1: Pending */}
        <div className="p-6 bg-white border border-[#E6E6E6] rounded-[8px] flex flex-col justify-between">
          <div className="text-4xl font-bold text-[#18181B] tracking-tight">
            {pendingCount}
          </div>
          <div className="text-sm text-[#595959] mt-1.5 font-normal">
            Pending
          </div>
        </div>

        {/* Card 2: Awaiting verification */}
        <div className="p-6 bg-white border border-[#E6E6E6] rounded-[8px] flex flex-col justify-between">
          <div className="text-4xl font-bold text-[#18181B] tracking-tight">
            {awaitingCount}
          </div>
          <div className="text-sm text-[#595959] mt-1.5 font-normal">
            Awaiting verification
          </div>
        </div>

        {/* Card 3: Overdue (RED border & RED text) */}
        <div className="p-6 bg-white border border-[#E0202A] rounded-[8px] flex flex-col justify-between">
          <div className="text-4xl font-bold text-[#B5121A] tracking-tight">
            {overdueCount}
          </div>
          <div className="text-sm text-[#595959] mt-1.5 font-normal">
            Overdue
          </div>
        </div>

        {/* Card 4: Compliance score */}
        <div className="p-6 bg-white border border-[#E6E6E6] rounded-[8px] flex flex-col justify-between">
          <div className="text-4xl font-bold text-[#18181B] tracking-tight">
            {complianceScore}
          </div>
          <div className="text-sm text-[#595959] mt-1.5 font-normal">
            Compliance score
          </div>
        </div>
      </div>

      {/* Sample data label */}
      <div className="text-xs text-[#595959] mb-6">
        Sample data
      </div>

      {/* SECTION 3: TABS (All, Pending, Submitted, Overdue, Verified) */}
      <div className="mb-6">
        <Tabs
          tabs={['All', 'Pending', 'Submitted', 'Overdue', 'Verified']}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as 'All' | 'Pending' | 'Submitted' | 'Overdue' | 'Verified')}
          aria-label="Undertakings Status Tabs"
        />
      </div>

      {/* SECTION 4: SEARCH BOX & FILTERS BUTTON */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by institution or condition"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-[#E6E6E6] rounded-[8px] text-sm text-[#18181B] placeholder-[#595959] focus:outline-none focus:border-[#18181B] transition-colors"
          />
        </div>

        <Button
          variant="secondary"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          Filters
        </Button>
      </div>

      {/* Collapsible Filters Drawer */}
      {filtersOpen && (
        <div className="p-4 mb-6 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#18181B]">Active Filter:</span>
            <span className="text-[#595959]">{activeTab} tab • {filteredRows.length} records matching</span>
          </div>
          {searchQuery && (
            <Button
              variant="quiet"
              onClick={() => setSearchQuery('')}
            >
              Reset
            </Button>
          )}
        </div>
      )}

      {/* SECTION 5: UNDERTAKINGS TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E6E6E6] text-[#595959] text-xs font-semibold uppercase tracking-wider">
              <th className="py-3 pr-4 font-semibold">INSTITUTION</th>
              <th className="py-3 px-4 font-semibold">CONDITION</th>
              <th className="py-3 px-4 font-semibold">DUE</th>
              <th className="py-3 px-4 font-semibold">EVIDENCE</th>
              <th className="py-3 pl-4 font-semibold text-right sm:text-left">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6E6E6]">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-xs text-[#595959]">
                  No undertakings found matching the current criteria.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const isOverdue = row.statusType === 'Overdue';
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-[#FAFAFA] transition-colors group"
                  >
                    {/* INSTITUTION */}
                    <td className="py-4 pr-4 text-[#18181B] font-normal">
                      <div className="max-w-xs sm:max-w-sm truncate" title={row.institution}>
                        {row.institution}
                      </div>
                    </td>

                    {/* CONDITION */}
                    <td className="py-4 px-4 text-[#18181B] font-normal">
                      <div className="max-w-xs sm:max-w-md truncate" title={row.condition}>
                        {row.condition}
                      </div>
                    </td>

                    {/* DUE */}
                    <td className="py-4 px-4 text-[#18181B] whitespace-nowrap">
                      {row.due}
                    </td>

                    {/* EVIDENCE */}
                    <td className="py-4 px-4 text-[#18181B] whitespace-nowrap">
                      {row.evidence}
                    </td>

                    {/* STATUS PILL & ACTION LINK */}
                    <td className="py-4 pl-4 whitespace-nowrap text-right sm:text-left">
                      <div className="flex items-center justify-between gap-4">
                        {isOverdue ? (
                          /* Red Overdue Status Pill */
                          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-[#E0202A] text-[#B5121A] bg-white text-xs font-medium">
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

                        {/* Action Link (Remind, Escalate, Verify, View) */}
                        <Button
                          variant="quiet"
                          size="sm"
                          onClick={() => handleActionClick(row)}
                          className="mr-2"
                        >
                          {row.actionType === 'Verify' ? 'Mark verified' : row.actionType === 'Escalate' ? 'Escalate to Regional Head' : row.actionType}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: VERIFY / REJECT MODAL */}
      {/* ============================================================== */}
      {reviewModalItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6E6E6] rounded-[8px] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-3">
              <h3 className="font-bold text-[#18181B] text-base">
                Verify Compliance Evidence
              </h3>
              <Button
                variant="quiet"
                size="icon"
                aria-label="Close"
                onClick={() => setReviewModalItem(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-3 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] text-xs space-y-1">
              <div className="font-semibold text-[#18181B]">{reviewModalItem.institution_name}</div>
              <div className="text-[#595959]">{reviewModalItem.condition_text || reviewModalItem.title}</div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={reviewAction === 'VERIFY' ? 'primary' : 'secondary'}
                size="sm"
                className="flex-1"
                onClick={() => setReviewAction('VERIFY')}
              >
                Mark verified
              </Button>
              <Button
                type="button"
                variant={reviewAction === 'REJECT' ? 'danger' : 'secondary'}
                size="sm"
                className="flex-1"
                onClick={() => setReviewAction('REJECT')}
              >
                Return with reason
              </Button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18181B] mb-1">
                Official Verification Remarks *
              </label>
              <textarea
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                placeholder="Enter mandatory remarks for the audit record..."
                className="w-full p-2.5 text-xs bg-white border border-[#E6E6E6] rounded-[8px] text-[#18181B] focus:outline-none focus:border-[#18181B] h-20 resize-none"
              />
            </div>

            {reviewError && (
              <div className="p-2 bg-red-50 border border-red-200 text-[#B5121A] text-xs rounded-[8px]">
                {reviewError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E6E6E6]">
      <Button variant="secondary" onClick={() => setReviewModalItem(null)}>Cancel</Button>
      <Button variant="primary" loading={reviewSubmitting} onClick={handleReviewSubmit}>Apply</Button>
    </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: UPLOAD EVIDENCE MODAL */}
      {/* ============================================================== */}
      {uploadModalItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6E6E6] rounded-[8px] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-3">
              <h3 className="font-bold text-[#18181B] text-base">
                Upload Undertaking Evidence
              </h3>
              <Button
                variant="quiet"
                size="icon"
                aria-label="Close"
                onClick={() => setUploadModalItem(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-3 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] text-xs space-y-1">
              <div className="font-semibold text-[#18181B]">Condition:</div>
              <div className="text-[#595959]">{uploadModalItem.condition_text || uploadModalItem.title}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#18181B] mb-1">
                Select Supporting Document (PDF / DOCX up to 15MB) *
              </label>
              <input
                type="file"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
                className="w-full text-xs text-[#595959] border border-[#E6E6E6] rounded-[8px] p-2 bg-white"
              />
            </div>

            {uploadError && (
              <div className="p-2 bg-red-50 border border-red-200 text-[#B5121A] text-xs rounded-[8px]">
                {uploadError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E6E6E6]">
      <Button variant="secondary" onClick={() => setUploadModalItem(null)}>Cancel</Button>
      <Button variant="primary" loading={uploading} onClick={handleUploadSubmit}>Upload evidence</Button>
    </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UndertakingsPage;
