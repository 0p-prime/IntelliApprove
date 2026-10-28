import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  Upload,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Download,
  Building2,
  Calendar,
  History,
  ChevronRight,
  ExternalLink,
  Layers,
  ArrowRight,
  ShieldAlert,
  Hash,
  Check,
  X
} from 'lucide-react';
import { apiRequest } from '../api/client';
import {
  DocumentItem,
  DocumentExpiryTimelineData,
  DocumentExpiringSummary,
  DocumentRenewalHistory
} from '../types';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { useAuth } from '../context/AuthContext';

export const DocumentsPage: React.FC = () => {
  const { user } = useAuth();
  const isInstitution = user?.role === 'INSTITUTION';
  const isOfficer = !isInstitution;

  // Data states
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [timelineData, setTimelineData] = useState<DocumentExpiryTimelineData | null>(null);
  const [expiringSummary, setExpiringSummary] = useState<DocumentExpiringSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedValidity, setSelectedValidity] = useState<string>('ALL');
  const [selectedDocType, setSelectedDocType] = useState<string>('ALL');
  const [selectedVerificationStatus, setSelectedVerificationStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('ALL');

  // Renewal Modal
  const [renewalModalDoc, setRenewalModalDoc] = useState<DocumentItem | null>(null);
  const [renewalIssueDate, setRenewalIssueDate] = useState<string>('');
  const [renewalExpiryDate, setRenewalExpiryDate] = useState<string>('');
  const [renewalFile, setRenewalFile] = useState<File | null>(null);
  const [renewalSubmitting, setRenewalSubmitting] = useState<boolean>(false);
  const [renewalError, setRenewalError] = useState<string | null>(null);

  // Verification Modal (Officer)
  const [verifyModalDoc, setVerifyModalDoc] = useState<DocumentItem | null>(null);
  const [verifyAction, setVerifyAction] = useState<'VERIFY' | 'REJECT'>('VERIFY');
  const [verifyRemarks, setVerifyRemarks] = useState<string>('');
  const [verifySubmitting, setVerifySubmitting] = useState<boolean>(false);

  // History Drawer
  const [historyDrawerDocId, setHistoryDrawerDocId] = useState<number | null>(null);
  const [renewalHistory, setRenewalHistory] = useState<DocumentRenewalHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // Fetch all documents and timeline
  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [docs, timeline, summary] = await Promise.all([
        apiRequest<DocumentItem[]>('/documents'),
        apiRequest<DocumentExpiryTimelineData>('/documents/expiry-timeline'),
        apiRequest<DocumentExpiringSummary>('/documents/expiring-summary')
      ]);
      setDocuments(docs);
      setTimelineData(timeline);
      setExpiringSummary(summary);
    } catch (err: any) {
      setError(err.message || 'Failed to load documents repository');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [user]);

  // Load renewal history when drawer opens
  const openHistoryDrawer = async (docId: number) => {
    setHistoryDrawerDocId(docId);
    setHistoryLoading(true);
    try {
      const data = await apiRequest<DocumentRenewalHistory>(`/documents/${docId}/renewal-history`);
      setRenewalHistory(data);
    } catch (err: any) {
      alert(`Failed to load renewal history: ${err.message}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Handle Renewal File Selection
  const handleRenewalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (f.size > 15 * 1024 * 1024) {
        setRenewalError('File size exceeds 15MB limit.');
        setRenewalFile(null);
        return;
      }
      setRenewalFile(f);
      setRenewalError(null);
    }
  };

  // Submit Renewal
  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewalModalDoc || !renewalFile || !renewalIssueDate || !renewalExpiryDate) {
      setRenewalError('All fields including renewed deed file are required');
      return;
    }

    if (new Date(renewalExpiryDate) <= new Date(renewalIssueDate)) {
      setRenewalError('Expiry date must be strictly after the issue date');
      return;
    }

    setRenewalSubmitting(true);
    setRenewalError(null);

    try {
      const formData = new FormData();
      formData.append('renewal_of_id', renewalModalDoc.id.toString());
      formData.append('issue_date', renewalIssueDate);
      formData.append('expiry_date', renewalExpiryDate);
      formData.append('file', renewalFile);

      await apiRequest('/documents/renew', {
        method: 'POST',
        body: formData,
      });

      alert(`Renewed ${renewalModalDoc.doc_type} successfully uploaded! Cryptographic SHA-256 seal registered and queued for officer verification.`);
      setRenewalModalDoc(null);
      setRenewalFile(null);
      setRenewalIssueDate('');
      setRenewalExpiryDate('');
      await fetchAllData();
    } catch (err: any) {
      setRenewalError(err.message || 'Renewal upload failed');
    } finally {
      setRenewalSubmitting(false);
    }
  };

  // Submit Officer Verification / Rejection
  const handleOfficerVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyModalDoc) return;
    if (!verifyRemarks.trim() || verifyRemarks.trim().length < 5) {
      alert('Mandatory speaking remarks required (min 5 characters)');
      return;
    }

    setVerifySubmitting(true);
    try {
      const endpoint = verifyAction === 'VERIFY' ? 'verify' : 'reject';
      await apiRequest(`/documents/${verifyModalDoc.id}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ remarks: verifyRemarks.trim() }),
      });

      alert(`Document #${verifyModalDoc.id} marked as ${verifyAction === 'VERIFY' ? 'VERIFIED' : 'REJECTED'}. Audit log recorded.`);
      setVerifyModalDoc(null);
      setVerifyRemarks('');
      await fetchAllData();
    } catch (err: any) {
      alert(`Verification action failed: ${err.message}`);
    } finally {
      setVerifySubmitting(false);
    }
  };

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => {
      // Validity status filter
      if (selectedValidity !== 'ALL' && d.validity_status !== selectedValidity) {
        return false;
      }
      // Verification status filter
      if (selectedVerificationStatus !== 'ALL' && d.verification_status !== selectedVerificationStatus) {
        return false;
      }
      // Doc type filter
      if (selectedDocType !== 'ALL' && d.doc_type !== selectedDocType) {
        return false;
      }
      // Region filter
      if (selectedRegionId !== 'ALL' && d.region_id !== parseInt(selectedRegionId, 10)) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const dtype = (d.doc_type || '').toLowerCase();
        const inst = (d.institution_name || '').toLowerCase();
        const fname = (d.file_name || '').toLowerCase();
        return dtype.includes(q) || inst.includes(q) || fname.includes(q);
      }
      return true;
    });
  }, [documents, selectedValidity, selectedVerificationStatus, selectedDocType, selectedRegionId, searchQuery]);

  if (loading) return <LoadingState message="Loading documents and validity monitoring status..." />;
  if (error) return <ErrorState message={error} onRetry={fetchAllData} />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Institutional Lease & Legal Document Monitoring
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Statutory land lease tracking, building safety affidavits, automated 90/60/30/7-day renewal alerts & escalation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllData}
            title="Refresh"
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expiry Timeline Breakdown Widget */}
      {timelineData && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Statutory Validity Expiry Timeline
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Monitoring compliance risk across all registered land leases, fire safety NOCs, and municipal approvals.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <span>Total Tracked Documents:</span>
              <span className="font-bold text-slate-900 px-2 py-0.5 bg-slate-100 rounded-md">
                {timelineData.summary.total}
              </span>
            </div>
          </div>

          {/* Color-Coded Expiry Timeline Bar */}
          <div className="space-y-2">
            <div className="h-4 w-full bg-slate-100 rounded-full flex overflow-hidden p-0.5 gap-0.5">
              {timelineData.summary.expired_count > 0 && (
                <div
                  className="bg-red-500 h-full rounded-l-full transition-all cursor-pointer hover:opacity-90"
                  style={{
                    width: `${Math.max(4, (timelineData.summary.expired_count / timelineData.summary.total) * 100)}%`
                  }}
                  title={`Expired: ${timelineData.summary.expired_count}`}
                  onClick={() => setSelectedValidity('EXPIRED')}
                />
              )}
              {timelineData.summary.critical_count > 0 && (
                <div
                  className="bg-rose-600 h-full transition-all cursor-pointer hover:opacity-90"
                  style={{
                    width: `${Math.max(4, (timelineData.summary.critical_count / timelineData.summary.total) * 100)}%`
                  }}
                  title={`Critical (<=30d): ${timelineData.summary.critical_count}`}
                  onClick={() => setSelectedValidity('CRITICAL')}
                />
              )}
              {timelineData.summary.expiring_soon_count > 0 && (
                <div
                  className="bg-amber-500 h-full transition-all cursor-pointer hover:opacity-90"
                  style={{
                    width: `${Math.max(4, (timelineData.summary.expiring_soon_count / timelineData.summary.total) * 100)}%`
                  }}
                  title={`Expiring Soon (31-90d): ${timelineData.summary.expiring_soon_count}`}
                  onClick={() => setSelectedValidity('EXPIRING_SOON')}
                />
              )}
              {timelineData.summary.valid_count > 0 && (
                <div
                  className="bg-emerald-500 h-full rounded-r-full transition-all cursor-pointer hover:opacity-90"
                  style={{
                    width: `${Math.max(4, (timelineData.summary.valid_count / timelineData.summary.total) * 100)}%`
                  }}
                  title={`Safe & Valid (>90d): ${timelineData.summary.valid_count}`}
                  onClick={() => setSelectedValidity('VALID')}
                />
              )}
            </div>

            {/* Timeline Bucket Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <button
                onClick={() => setSelectedValidity(selectedValidity === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedValidity === 'EXPIRED'
                    ? 'border-red-400 bg-red-50/50 ring-2 ring-red-200'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
                    <AlertOctagon className="w-3.5 h-3.5 text-red-600" />
                    Expired
                  </span>
                  <span className="text-lg font-black text-red-700">
                    {timelineData.summary.expired_count}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Requires immediate renewal</div>
              </button>

              <button
                onClick={() => setSelectedValidity(selectedValidity === 'CRITICAL' ? 'ALL' : 'CRITICAL')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedValidity === 'CRITICAL'
                    ? 'border-rose-400 bg-rose-50/50 ring-2 ring-rose-200'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-rose-600" />
                    Critical (≤30 Days)
                  </span>
                  <span className="text-lg font-black text-rose-700">
                    {timelineData.summary.critical_count}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Urgent legal review</div>
              </button>

              <button
                onClick={() => setSelectedValidity(selectedValidity === 'EXPIRING_SOON' ? 'ALL' : 'EXPIRING_SOON')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedValidity === 'EXPIRING_SOON'
                    ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-200'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Expiring Soon (31-90d)
                  </span>
                  <span className="text-lg font-black text-amber-700">
                    {timelineData.summary.expiring_soon_count}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Initiate renewal process</div>
              </button>

              <button
                onClick={() => setSelectedValidity(selectedValidity === 'VALID' ? 'ALL' : 'VALID')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedValidity === 'VALID'
                    ? 'border-emerald-400 bg-emerald-50/50 ring-2 ring-emerald-200'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Safe & Valid (&gt;90d)
                  </span>
                  <span className="text-lg font-black text-emerald-700">
                    {timelineData.summary.valid_count}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Compliant validity window</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by document type, institution name, deed filename..."
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
          {/* Doc Type Filter */}
          <select
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-none font-medium cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            <option value="LEASE">Land Lease Deed</option>
            <option value="BUILDING_PLAN">Building Plan NOC</option>
            <option value="FIRE_SAFETY">Fire Safety NOC</option>
            <option value="NOC">Municipal NOC</option>
            <option value="AUDITED_ACCOUNTS">Audited Accounts</option>
            <option value="AFFILIATION_ORDER">Affiliation Order</option>
          </select>

          {/* Verification Status Filter */}
          <select
            value={selectedVerificationStatus}
            onChange={(e) => setSelectedVerificationStatus(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-none font-medium cursor-pointer"
          >
            <option value="ALL">All Scrutiny Statuses</option>
            <option value="PENDING">Pending Scrutiny</option>
            <option value="VERIFIED">Verified Compliant</option>
            <option value="REJECTED">Deficient / Rejected</option>
          </select>

          {/* Validity Status Filter */}
          <select
            value={selectedValidity}
            onChange={(e) => setSelectedValidity(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-none font-medium cursor-pointer"
          >
            <option value="ALL">All Validity Statuses</option>
            <option value="EXPIRED">Expired</option>
            <option value="CRITICAL">Critical (≤30 Days)</option>
            <option value="EXPIRING_SOON">Expiring Soon (31-90 Days)</option>
            <option value="VALID">Safe & Valid (&gt;90 Days)</option>
          </select>
        </div>
      </div>

      {/* Documents Table View */}
      {filteredDocuments.length === 0 ? (
        <EmptyState
          title="No Documents Found"
          description="No document records match the active validity filters."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Document Category</th>
                  <th className="py-3 px-4">Institution & Region</th>
                  <th className="py-3 px-4">Validity Timeline & Expiry</th>
                  <th className="py-3 px-4">Scrutiny Status</th>
                  <th className="py-3 px-4">Evidence Deed</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocuments.map((doc) => {
                  const isExpired = doc.validity_status === 'EXPIRED';
                  const isCritical = doc.validity_status === 'CRITICAL';
                  const isExpiringSoon = doc.validity_status === 'EXPIRING_SOON';
                  const isValid = doc.validity_status === 'VALID';

                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isExpired ? 'bg-red-50/20' : isCritical ? 'bg-rose-50/15' : ''
                      }`}
                    >
                      {/* Document Category & ID */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <FileText className={`w-4 h-4 shrink-0 ${
                            isExpired ? 'text-red-500' : isCritical ? 'text-rose-500' : 'text-blue-600'
                          }`} />
                          <div>
                            <div className="font-bold text-slate-900">{doc.doc_type.replace(/_/g, ' ')}</div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              Doc #{doc.id} {doc.renewal_of_id ? `• Renewal of #${doc.renewal_of_id}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Institution & Region */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{doc.institution_name}</div>
                        <div className="text-[11px] text-slate-500">
                          {doc.region_name} • {doc.state}
                        </div>
                      </td>

                      {/* Expiry & Validity Countdown */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isExpired
                                  ? 'bg-red-100 text-red-800 animate-pulse'
                                  : isCritical
                                  ? 'bg-rose-100 text-rose-800'
                                  : isExpiringSoon
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {doc.validity_status.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-700">
                              {isExpired
                                ? `Expired ${doc.days_expired}d ago`
                                : `${doc.days_remaining}d remaining`}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Expires: {doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString() : 'Indefinite'}
                          </div>
                        </div>
                      </td>

                      {/* Scrutiny Status */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              doc.verification_status === 'VERIFIED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : doc.verification_status === 'REJECTED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {doc.verification_status}
                          </span>
                          {doc.verifier_name && (
                            <div className="text-[9px] text-slate-400">by {doc.verifier_name}</div>
                          )}
                          {doc.remarks && (
                            <div className="text-[10px] text-slate-600 italic max-w-xs truncate" title={doc.remarks}>
                              "{doc.remarks}"
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Evidence File */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="font-mono text-slate-700 text-xs truncate max-w-[180px]" title={doc.file_name}>
                            {doc.file_name}
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`/api/v1/documents/${doc.id}/file/download`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-bold text-[10px] flex items-center gap-0.5"
                            >
                              <Download className="w-3 h-3" />
                              View Deed
                            </a>
                            {doc.sha256_hash && (
                              <span className="text-[9px] font-mono text-slate-400" title={doc.sha256_hash}>
                                [{doc.sha256_hash.substring(0, 8)}...]
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Institution Renewal Upload Action */}
                          {(isInstitution || user?.role === 'ADMIN') && (isExpired || isCritical || isExpiringSoon) && (
                            <button
                              onClick={() => {
                                setRenewalModalDoc(doc);
                                setRenewalError(null);
                                setRenewalFile(null);
                                setRenewalIssueDate(new Date().toISOString().split('T')[0]);
                                setRenewalExpiryDate(new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]);
                              }}
                              className="px-2.5 py-1.5 bg-[#0B2240] text-white rounded-md font-semibold hover:bg-[#07172C] text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                            >
                              <Upload className="w-3 h-3 text-amber-400" />
                              Upload Renewal
                            </button>
                          )}

                          {/* Officer Verification Actions */}
                          {isOfficer && doc.verification_status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => {
                                  setVerifyModalDoc(doc);
                                  setVerifyAction('VERIFY');
                                  setVerifyRemarks('');
                                }}
                                className="px-2 py-1 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 text-xs cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                Verify
                              </button>
                              <button
                                onClick={() => {
                                  setVerifyModalDoc(doc);
                                  setVerifyAction('REJECT');
                                  setVerifyRemarks('');
                                }}
                                className="px-2 py-1 bg-rose-600 text-white rounded font-semibold hover:bg-rose-700 text-xs cursor-pointer flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                Reject
                              </button>
                            </>
                          )}

                          {/* Lineage & History Button */}
                          <button
                            onClick={() => openHistoryDrawer(doc.id)}
                            title="View Renewal History & Cryptographic Audit Trail"
                            className="p-1.5 border border-slate-200 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: RENEWAL UPLOAD FLOW (INSTITUTION) */}
      {renewalModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Upload Renewed Document</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Extending validity for {renewalModalDoc.doc_type.replace(/_/g, ' ')} (Doc #{renewalModalDoc.id})
                </p>
              </div>
              <button
                onClick={() => {
                  setRenewalModalDoc(null);
                  setRenewalFile(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-xs p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1 text-amber-900">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Previous Document Expired / Expiring on {renewalModalDoc.expiry_date ? new Date(renewalModalDoc.expiry_date).toLocaleDateString() : 'N/A'}
              </div>
              <p className="text-[11px] text-amber-800">
                Please attach registered renewal deed / latest NOC approved by competent state authority.
              </p>
            </div>

            <form onSubmit={handleRenewalSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    New Issue Date *
                  </label>
                  <input
                    type="date"
                    value={renewalIssueDate}
                    onChange={(e) => setRenewalIssueDate(e.target.value)}
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    New Expiry Date *
                  </label>
                  <input
                    type="date"
                    value={renewalExpiryDate}
                    onChange={(e) => setRenewalExpiryDate(e.target.value)}
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* File Drop Area */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  id="renewal-doc-file"
                  onChange={handleRenewalFileChange}
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  className="hidden"
                />
                <label
                  htmlFor="renewal-doc-file"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-full">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-700">
                    {renewalFile ? renewalFile.name : 'Select renewed deed file (PDF, PNG, JPG)'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Maximum 15MB. SHA-256 cryptographic seal generated upon upload.
                  </span>
                </label>
              </div>

              {renewalFile && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-0.5 text-slate-700">
                  <div className="flex justify-between font-semibold">
                    <span>File Size:</span>
                    <span>{(renewalFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                </div>
              )}

              {renewalError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                  {renewalError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRenewalModalDoc(null);
                    setRenewalFile(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renewalSubmitting || !renewalFile}
                  className="px-5 py-2 bg-[#0B2240] text-white rounded-lg text-xs font-bold hover:bg-[#07172C] disabled:opacity-50 flex items-center gap-1.5 shadow-2xs"
                >
                  {renewalSubmitting ? 'Hashing & Uploading...' : 'Register Renewed Deed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: OFFICER VERIFY / REJECT */}
      {verifyModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {verifyAction === 'VERIFY' ? 'Verify Document Renewal' : 'Reject Document with Deficiency'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Doc #{verifyModalDoc.id} • {verifyModalDoc.institution_name}
                </p>
              </div>
              <button onClick={() => setVerifyModalDoc(null)} className="text-slate-400 hover:text-slate-600 text-xs p-1">
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-900">Category:</span>
                <span>{verifyModalDoc.doc_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-900">Proposed Expiry:</span>
                <span>{verifyModalDoc.expiry_date ? new Date(verifyModalDoc.expiry_date).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="font-semibold text-slate-900">Evidence File:</span>
                <a
                  href={`/api/v1/documents/${verifyModalDoc.id}/file/download`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 font-bold hover:underline"
                >
                  Inspect Deed ({verifyModalDoc.file_name})
                </a>
              </div>
            </div>

            <form onSubmit={handleOfficerVerificationSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {verifyAction === 'VERIFY' ? 'Mandatory Verification Remarks *' : 'Mandatory Deficiency Reason *'}
                </label>
                <textarea
                  rows={3}
                  value={verifyRemarks}
                  onChange={(e) => setVerifyRemarks(e.target.value)}
                  placeholder={
                    verifyAction === 'VERIFY'
                      ? 'e.g. Registered Sub-Registrar lease deed verified. Valid for 30 years as per AICTE Chapter I norms.'
                      : 'e.g. Building plan lacks municipal structural safety endorsement and fire department clearance.'
                  }
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifyModalDoc(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifySubmitting}
                  className={`px-5 py-2 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 shadow-2xs ${
                    verifyAction === 'VERIFY' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {verifySubmitting
                    ? 'Recording Decision...'
                    : verifyAction === 'VERIFY'
                    ? 'Certify & Mark Valid'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: DOCUMENT RENEWAL HISTORY & AUDIT TRAIL */}
      {historyDrawerDocId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Document Renewal Lineage & Audit Trail</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inspection of Doc #{historyDrawerDocId} historical validity sequence.
                </p>
              </div>
              <button
                onClick={() => {
                  setHistoryDrawerDocId(null);
                  setRenewalHistory(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {historyLoading ? (
              <LoadingState message="Fetching renewal lineage and cryptographic trail..." />
            ) : renewalHistory ? (
              <div className="space-y-6">
                {/* Renewal Sequence Timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Renewal Chain ({renewalHistory.lineage.length} Iterations)
                  </h4>

                  <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                    {renewalHistory.lineage.map((item, idx) => (
                      <div key={item.id} className="relative flex items-start gap-4 pl-8">
                        <div className={`absolute left-2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs mt-1 ${
                          item.validity_status === 'VALID' ? 'bg-emerald-500' : item.validity_status === 'EXPIRED' ? 'bg-red-500' : 'bg-amber-500'
                        }`} />
                        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs w-full space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">
                                {idx === 0 ? 'Original Baseline Deed' : `Renewal #${idx}`} • Doc #{item.id}
                              </span>
                              <div className="font-bold text-xs text-slate-900 mt-0.5">{item.file_name}</div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.validity_status === 'VALID' ? 'bg-emerald-100 text-emerald-800' : item.validity_status === 'EXPIRED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {item.validity_status}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-600 grid grid-cols-2 gap-1 font-mono">
                            <div>Issue: {new Date(item.issue_date).toLocaleDateString()}</div>
                            <div>Expiry: {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : 'Indefinite'}</div>
                          </div>

                          {item.remarks && (
                            <div className="p-2 bg-slate-50 rounded text-[10px] text-slate-600 italic">
                              Remarks: {item.remarks}
                            </div>
                          )}

                          <div className="pt-1 flex items-center justify-between text-[10px]">
                            <span className="font-mono text-slate-400">
                              SHA256: {item.sha256_hash ? item.sha256_hash.substring(0, 16) : 'N/A'}...
                            </span>
                            <a
                              href={`/api/v1/documents/${item.id}/file/download`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 font-bold hover:underline"
                            >
                              Download File
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cryptographic Audit Trail */}
                <div className="space-y-3 pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Cryptographic Audit Trail
                  </h4>

                  {renewalHistory.audit_trail.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No explicit audit events recorded for this lineage.</p>
                  ) : (
                    <div className="space-y-2">
                      {renewalHistory.audit_trail.map((log) => (
                        <div key={log.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">{log.action}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">{log.details}</p>
                          <div className="flex items-center justify-between pt-1 text-[9px] text-slate-400 font-mono">
                            <span>Actor: {log.actor_name} ({log.actor_role})</span>
                            <span title={log.hash}>Hash: {log.hash.substring(0, 12)}...</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
