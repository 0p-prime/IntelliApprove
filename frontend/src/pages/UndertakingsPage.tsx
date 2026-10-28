import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Upload,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Download,
  Award,
  BarChart3,
  Building,
  AlertOctagon,
  FileText,
  Hash,
  Check,
  PlusCircle,
  ExternalLink
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { Undertaking, ComplianceScoreItem, ComplianceHeatTableData } from '../types';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { useAuth } from '../context/AuthContext';

export const UndertakingsPage: React.FC = () => {
  const { user } = useAuth();
  const isInstitution = user?.role === 'INSTITUTION';
  const isOfficer = !isInstitution;

  // Active Tab
  const [activeTab, setActiveTab] = useState<'queue' | 'all' | 'heattable'>('all');

  // Data states
  const [undertakings, setUndertakings] = useState<Undertaking[]>([]);
  const [heatTableData, setHeatTableData] = useState<ComplianceHeatTableData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('ALL');

  // Upload Evidence Modal
  const [uploadModalItem, setUploadModalItem] = useState<Undertaking | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Verify / Reject Modal
  const [reviewModalItem, setReviewModalItem] = useState<Undertaking | null>(null);
  const [reviewAction, setReviewAction] = useState<'VERIFY' | 'REJECT'>('VERIFY');
  const [reviewRemarks, setReviewRemarks] = useState<string>('');
  const [reviewSubmitting, setReviewSubmitting] = useState<boolean>(false);

  // Create Undertaking Modal (for officers)
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newAppId, setNewAppId] = useState<string>('');
  const [newConditionText, setNewConditionText] = useState<string>('');
  const [newDueDate, setNewDueDate] = useState<string>('');
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);

  // Fetch undertakings
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const undData = await apiRequest<Undertaking[]>('/undertakings');
      setUndertakings(undData);

      if (isOfficer) {
        const heatData = await apiRequest<ComplianceHeatTableData>('/undertakings/compliance-heat-table');
        setHeatTableData(heatData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load undertakings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Handle Evidence File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 15 * 1024 * 1024) {
        setUploadError('File exceeds 15 MB limit. Please select a smaller document.');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
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

      alert('Supporting evidence successfully uploaded with SHA-256 seal. Audit log recorded.');
      setUploadModalItem(null);
      setSelectedFile(null);
      await fetchData();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Submit Officer Review (Verify or Reject)
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalItem) return;
    if (!reviewRemarks.trim() || reviewRemarks.trim().length < 5) {
      alert('Mandatory speaking remarks required (min 5 characters)');
      return;
    }

    setReviewSubmitting(true);
    try {
      const endpoint = reviewAction === 'VERIFY' ? 'verify' : 'reject';
      await apiRequest(`/undertakings/${reviewModalItem.id}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ remarks: reviewRemarks.trim() }),
      });

      alert(`Undertaking #${reviewModalItem.id} marked as ${reviewAction === 'VERIFY' ? 'VERIFIED' : 'REJECTED'}. Audit trail recorded.`);
      setReviewModalItem(null);
      setReviewRemarks('');
      await fetchData();
    } catch (err: any) {
      alert(`Review action failed: ${err.message}`);
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Create Undertaking (Officer)
  const handleCreateUndertaking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppId || !newConditionText.trim() || !newDueDate) {
      alert('All fields are required');
      return;
    }

    setCreateSubmitting(true);
    try {
      await apiRequest('/undertakings', {
        method: 'POST',
        body: JSON.stringify({
          application_id: parseInt(newAppId, 10),
          condition_text: newConditionText.trim(),
          due_date: new Date(newDueDate).toISOString(),
        }),
      });

      alert('Compliance undertaking created and attached to application approval! Audit log recorded.');
      setShowCreateModal(false);
      setNewAppId('');
      setNewConditionText('');
      setNewDueDate('');
      await fetchData();
    } catch (err: any) {
      alert(`Creation failed: ${err.message}`);
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Filtered lists
  const verificationQueue = useMemo(() => {
    return undertakings.filter((u) => u.status === 'SUBMITTED');
  }, [undertakings]);

  const filteredUndertakings = useMemo(() => {
    return undertakings.filter((u) => {
      // Status filter
      if (statusFilter !== 'ALL' && u.status !== statusFilter) {
        return false;
      }
      // Region filter
      if (selectedRegionId !== 'ALL' && u.region_id !== parseInt(selectedRegionId, 10)) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cond = (u.condition_text || '').toLowerCase();
        const inst = (u.institution_name || '').toLowerCase();
        const app = (u.application_ref_no || '').toLowerCase();
        return cond.includes(q) || inst.includes(q) || app.includes(q);
      }
      return true;
    });
  }, [undertakings, statusFilter, selectedRegionId, searchQuery]);

  // Overall compliance metrics for Institution view
  const institutionScore = useMemo(() => {
    if (!isInstitution || undertakings.length === 0) return 100.0;
    const verified = undertakings.filter((u) => u.status === 'VERIFIED').length;
    return Math.round((verified / undertakings.length) * 1000) / 10;
  }, [undertakings, isInstitution]);

  if (loading) return <LoadingState message="Loading compliance undertakings & metrics..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Post-Approval Undertakings & Compliance Monitoring
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Statutory condition enforcement, cryptographic evidence verification, and AICTE compliance rating.
              </p>
            </div>
          </div>
        </div>

        {/* Institution Score Banner or Officer Quick Actions */}
        <div className="flex items-center gap-3">
          {isInstitution ? (
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Institutional Compliance Score</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xl font-black text-slate-900">{institutionScore}%</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    institutionScore >= 85 ? 'bg-emerald-100 text-emerald-800' : institutionScore >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {institutionScore >= 85 ? 'EXCELLENT' : institutionScore >= 60 ? 'MODERATE' : 'CRITICAL'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3.5 py-2 bg-[#0B2240] text-white rounded-lg text-xs font-semibold hover:bg-[#07172C] flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-amber-400" />
                Impose Undertaking
              </button>
              <button
                onClick={fetchData}
                title="Refresh"
                className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Officer View Tabs */}
      {isOfficer && (
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            All Undertakings ({undertakings.length})
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Verification Queue
            {verificationQueue.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold ml-1">
                {verificationQueue.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('heattable')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'heattable'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Compliance Heat Table
          </button>
        </div>
      )}

      {/* TAB 1: ALL UNDERTAKINGS & INSTITUTION VIEW */}
      {(isInstitution || activeTab === 'all') && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by condition, institution, application ref..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs outline-none bg-transparent"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 text-xs">
                  Clear
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Status:</span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-none font-medium cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Action</option>
                <option value="SUBMITTED">Evidence Submitted</option>
                <option value="VERIFIED">Verified Compliant</option>
                <option value="REJECTED">Deficient / Rejected</option>
                <option value="OVERDUE">Overdue Breaches</option>
              </select>

              {isOfficer && heatTableData?.regional_breakdown && (
                <select
                  value={selectedRegionId}
                  onChange={(e) => setSelectedRegionId(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-none font-medium cursor-pointer"
                >
                  <option value="ALL">All AICTE Regions</option>
                  {heatTableData.regional_breakdown.map((r) => (
                    <option key={r.region_id} value={r.region_id}>
                      {r.region_name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Undertakings Grid / List */}
          {filteredUndertakings.length === 0 ? (
            <EmptyState
              title="No Undertakings Found"
              description="No compliance conditions match the selected filters."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUndertakings.map((u) => {
                const isOverdue = u.status === 'OVERDUE';
                const isPending = u.status === 'PENDING';
                const isSubmitted = u.status === 'SUBMITTED';
                const isVerified = u.status === 'VERIFIED';
                const isRejected = u.status === 'REJECTED';

                return (
                  <div
                    key={u.id}
                    className={`p-4 rounded-xl border bg-white shadow-2xs space-y-3 flex flex-col justify-between transition-all ${
                      isOverdue
                        ? 'border-red-300 ring-1 ring-red-200 bg-red-50/20'
                        : isRejected
                        ? 'border-amber-300 ring-1 ring-amber-100'
                        : isVerified
                        ? 'border-emerald-200'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-2.5">
                      {/* Card Header & Status Chip */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                            Undertaking #{u.id} • {u.application_ref_no}
                          </span>
                          <span className="text-xs font-semibold text-slate-700 block truncate mt-0.5">
                            {u.institution_name}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                            isVerified
                              ? 'bg-emerald-100 text-emerald-800'
                              : isOverdue
                              ? 'bg-red-100 text-red-800 animate-pulse'
                              : isRejected
                              ? 'bg-rose-100 text-rose-800'
                              : isSubmitted
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {u.status}
                        </span>
                      </div>

                      {/* Condition Text */}
                      <p className="text-xs text-slate-800 leading-relaxed font-medium line-clamp-3">
                        {u.condition_text}
                      </p>

                      {/* Due date countdown chip */}
                      <div className="flex items-center gap-2 pt-1">
                        {isVerified ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Verified on {u.verified_at ? new Date(u.verified_at).toLocaleDateString() : 'Record'}</span>
                          </div>
                        ) : isOverdue ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-red-700 font-bold bg-red-100 px-2.5 py-1 rounded-md border border-red-200">
                            <AlertOctagon className="w-3.5 h-3.5 text-red-600" />
                            <span>Overdue by {u.days_overdue} day(s)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Due in {u.days_remaining} day(s) ({u.due_date ? new Date(u.due_date).toLocaleDateString() : 'TBD'})</span>
                          </div>
                        )}
                      </div>

                      {/* Evidence File Details */}
                      {u.evidence_filename && (
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
                              {u.evidence_filename}
                            </span>
                            <a
                              href={`/api/v1/undertakings/${u.id}/evidence/download`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5"
                            >
                              <Download className="w-3 h-3" />
                              View
                            </a>
                          </div>
                          {u.evidence_file_hash && (
                            <div className="font-mono text-[9px] text-slate-400 truncate" title={u.evidence_file_hash}>
                              SHA256: {u.evidence_file_hash.substring(0, 20)}...
                            </div>
                          )}
                        </div>
                      )}

                      {/* Verification / Rejection Remarks */}
                      {u.remarks && (
                        <div className={`p-2.5 rounded-lg text-[11px] space-y-0.5 ${
                          isRejected ? 'bg-rose-50 border border-rose-200 text-rose-800' : 'bg-slate-50 border border-slate-200 text-slate-700'
                        }`}>
                          <span className="font-bold block">
                            {isRejected ? 'Deficiency Reason:' : 'Officer Remarks:'}
                          </span>
                          <p className="italic text-[11px]">{u.remarks}</p>
                          {u.verifier_name && (
                            <span className="text-[10px] text-slate-500 block pt-0.5">
                              Reviewed by {u.verifier_name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Actions Footer */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
                      {/* Institution Upload Action */}
                      {(isInstitution || user?.role === 'ADMIN') && !isVerified && (
                        <button
                          onClick={() => setUploadModalItem(u)}
                          className="px-3 py-1.5 bg-[#0B2240] text-white rounded-lg font-semibold hover:bg-[#07172C] flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer text-xs"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-400" />
                          {u.evidence_filename ? 'Re-upload Evidence' : 'Upload Evidence'}
                        </button>
                      )}

                      {/* Officer Review Actions */}
                      {isOfficer && isSubmitted && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setReviewModalItem(u);
                              setReviewAction('VERIFY');
                              setReviewRemarks('');
                            }}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded-md font-semibold hover:bg-emerald-700 flex items-center gap-1 text-xs cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Verify
                          </button>
                          <button
                            onClick={() => {
                              setReviewModalItem(u);
                              setReviewAction('REJECT');
                              setReviewRemarks('');
                            }}
                            className="px-2.5 py-1 bg-rose-600 text-white rounded-md font-semibold hover:bg-rose-700 flex items-center gap-1 text-xs cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: VERIFICATION QUEUE (OFFICER VIEW) */}
      {isOfficer && activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>{verificationQueue.length} undertakings</strong> waiting for officer evaluation and compliance certification.
              </span>
            </div>
            <span className="text-[11px] font-semibold text-amber-700">Mandatory speaking remarks required on all decisions.</span>
          </div>

          {verificationQueue.length === 0 ? (
            <EmptyState
              title="Verification Queue Empty"
              description="No institutions have pending evidence waiting for review."
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Undertaking & App</th>
                    <th className="py-3 px-4">Institution & Region</th>
                    <th className="py-3 px-4">Condition Imposed</th>
                    <th className="py-3 px-4">Submitted Evidence</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {verificationQueue.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div>#{u.id}</div>
                        <div className="text-[11px] font-mono text-slate-500">{u.application_ref_no}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{u.institution_name}</div>
                        <div className="text-[11px] text-slate-500">{u.region_name} • {u.state}</div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs text-slate-700 font-medium">
                        {u.condition_text}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <FileCheck2 className="w-4 h-4 text-blue-600" />
                          <div>
                            <div className="font-semibold text-slate-800">{u.evidence_filename || 'Evidence File'}</div>
                            {u.evidence_file_hash && (
                              <div className="text-[9px] font-mono text-slate-400">
                                {u.evidence_file_hash.substring(0, 16)}...
                              </div>
                            )}
                          </div>
                        </div>
                        <a
                          href={`/api/v1/undertakings/${u.id}/evidence/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-[11px] font-bold inline-flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Inspect Document
                        </a>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {u.due_date ? new Date(u.due_date).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setReviewModalItem(u);
                              setReviewAction('VERIFY');
                              setReviewRemarks('');
                            }}
                            className="px-3 py-1.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 text-xs shadow-2xs transition-all cursor-pointer"
                          >
                            Verify Compliant
                          </button>
                          <button
                            onClick={() => {
                              setReviewModalItem(u);
                              setReviewAction('REJECT');
                              setReviewRemarks('');
                            }}
                            className="px-3 py-1.5 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 text-xs shadow-2xs transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COMPLIANCE HEAT TABLE */}
      {isOfficer && activeTab === 'heattable' && heatTableData && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">National Compliance Avg</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-2xl font-black text-slate-900">{heatTableData.summary.national_average_score}%</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  heatTableData.summary.national_average_score >= 85 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {heatTableData.summary.grade}
                </span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Statutory Undertakings</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-2xl font-black text-slate-900">{heatTableData.summary.total_undertakings}</span>
                <span className="text-xs text-slate-500 font-semibold">{heatTableData.summary.total_institutions} Institutions</span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Verified On-Time</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-2xl font-black text-emerald-600">{heatTableData.summary.verified_on_time}</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SLA Breaches / Overdue</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-2xl font-black text-red-600">{heatTableData.summary.overdue_count}</span>
                <AlertOctagon className="w-5 h-5 text-red-500 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Regional Rollup Cards */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">AICTE Regions Compliance Performance</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {heatTableData.regional_breakdown.map((r) => (
                <div key={r.region_id} className="p-3 bg-white rounded-lg border border-slate-200 text-center space-y-1 shadow-2xs">
                  <div className="text-[10px] font-bold text-slate-500 uppercase truncate" title={r.region_name}>
                    {r.region_name.replace(' Region', '')}
                  </div>
                  <div className="text-base font-black text-slate-900">{r.avg_compliance_score}%</div>
                  <div className="text-[9px] font-semibold text-slate-400">
                    {r.verified_on_time}/{r.total_undertakings} On-Time
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Institution Heat Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Institutional Compliance Scorecard Matrix</h3>
                <p className="text-[11px] text-slate-500">Colour-coded compliance score: (verified on time ÷ total conditions imposed).</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Institution Name</th>
                    <th className="py-3 px-4">State & Region</th>
                    <th className="py-3 px-4 text-center">Total Conditions</th>
                    <th className="py-3 px-4 text-center">Verified On-Time</th>
                    <th className="py-3 px-4 text-center">Verified Late</th>
                    <th className="py-3 px-4 text-center">Pending Review</th>
                    <th className="py-3 px-4 text-center">Overdue</th>
                    <th className="py-3 px-4 text-center">Deficiencies</th>
                    <th className="py-3 px-4 text-right">Compliance Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {heatTableData.institutions.map((inst) => {
                    const isHigh = inst.compliance_score >= 85;
                    const isMed = inst.compliance_score >= 60 && inst.compliance_score < 85;
                    const isLow = inst.compliance_score < 60;

                    return (
                      <tr key={inst.institution_id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div>{inst.institution_name}</div>
                          <span className="text-[10px] text-slate-400 font-normal">{inst.institution_type}</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <div>{inst.state}</div>
                          <div className="text-[10px] text-slate-400">{inst.region_name}</div>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                          {inst.total_undertakings}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            {inst.verified_on_time}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-600">
                          {inst.verified_late}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            inst.submitted_pending_review > 0 ? 'bg-blue-100 text-blue-800' : 'text-slate-400'
                          }`}>
                            {inst.submitted_pending_review}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            inst.overdue_breached > 0 ? 'bg-red-100 text-red-800 font-extrabold animate-pulse' : 'text-slate-400'
                          }`}>
                            {inst.overdue_breached}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-600">
                          {inst.rejected_deficiencies}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isHigh ? 'bg-emerald-500' : isMed ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${inst.compliance_score}%` }}
                              />
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-black ${
                                isHigh
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isMed
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {inst.compliance_score}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: UPLOAD EVIDENCE (INSTITUTION) */}
      {uploadModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Upload Supporting Compliance Evidence</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Undertaking #{uploadModalItem.id} • {uploadModalItem.application_ref_no}
                </p>
              </div>
              <button
                onClick={() => {
                  setUploadModalItem(null);
                  setSelectedFile(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium">
              <strong>Stipulated Condition:</strong> {uploadModalItem.condition_text}
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  id="evidence-file-upload"
                  onChange={handleFileChange}
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  className="hidden"
                />
                <label
                  htmlFor="evidence-file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">
                    {selectedFile ? selectedFile.name : 'Click to select supporting document'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    PDF, PNG, JPG, DOC up to 15MB. Cryptographic SHA-256 seal generated automatically.
                  </span>
                </label>
              </div>

              {selectedFile && (
                <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between font-medium text-slate-700">
                    <span>File Size:</span>
                    <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[10px]">
                    <span>File Type:</span>
                    <span>{selectedFile.type || 'Document'}</span>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                  {uploadError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUploadModalItem(null);
                    setSelectedFile(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-5 py-2 bg-[#0B2240] text-white rounded-lg text-xs font-bold hover:bg-[#07172C] disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                >
                  {uploading ? 'Calculating SHA256 & Uploading...' : 'Submit Evidence Seal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VERIFY OR REJECT (OFFICER) */}
      {reviewModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {reviewAction === 'VERIFY' ? 'Verify Compliance Evidence' : 'Reject Evidence for Deficiency'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Undertaking #{reviewModalItem.id} • {reviewModalItem.institution_name}
                </p>
              </div>
              <button onClick={() => setReviewModalItem(null)} className="text-slate-400 hover:text-slate-600 text-xs p-1">
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5 text-slate-700">
              <div>
                <span className="font-semibold block text-slate-900">Imposed Condition:</span>
                <p className="mt-0.5">{reviewModalItem.condition_text}</p>
              </div>
              {reviewModalItem.evidence_filename && (
                <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between">
                  <span className="font-semibold text-blue-700 flex items-center gap-1">
                    <FileCheck2 className="w-3.5 h-3.5" />
                    {reviewModalItem.evidence_filename}
                  </span>
                  <a
                    href={`/api/v1/undertakings/${reviewModalItem.id}/evidence/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 font-bold hover:underline"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {reviewAction === 'VERIFY' ? 'Mandatory Verification Remarks *' : 'Mandatory Deficiency Reason *'}
                </label>
                <textarea
                  rows={3}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder={
                    reviewAction === 'VERIFY'
                      ? 'e.g., Verified building plan approved by local authority. Carpet area meets AICTE APH norms.'
                      : 'e.g., Bank guarantee document lacks IFSC verification and official seal. Submit revised certificate.'
                  }
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalItem(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className={`px-5 py-2 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-2xs ${
                    reviewAction === 'VERIFY' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {reviewSubmitting
                    ? 'Recording Decision...'
                    : reviewAction === 'VERIFY'
                    ? 'Confirm & Certify Compliant'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: IMPOSE UNDERTAKING (OFFICER) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Impose Conditional Approval Undertaking</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Attach statutory time-bound compliance conditions to an AICTE approval.
                </p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 text-xs p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUndertaking} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Application ID *
                </label>
                <input
                  type="number"
                  value={newAppId}
                  onChange={(e) => setNewAppId(e.target.value)}
                  placeholder="e.g. 5"
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Condition / Norm Requirement *
                </label>
                <textarea
                  rows={3}
                  value={newConditionText}
                  onChange={(e) => setNewConditionText(e.target.value)}
                  placeholder="e.g. Complete appointment of qualified Librarian and recruit 2 Associate Professors before next semester."
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Stipulated Compliance Deadline (Due Date) *
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2 bg-[#0B2240] text-white rounded-lg text-xs font-bold hover:bg-[#07172C] disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                >
                  {createSubmitting ? 'Creating Condition...' : 'Impose Condition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
