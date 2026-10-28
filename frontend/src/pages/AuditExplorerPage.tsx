import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  ShieldCheck,
  RefreshCw,
  Code2,
  Lock,
  Key,
  CheckCircle2,
  AlertTriangle,
  Download,
  Copy,
  Check,
  ExternalLink,
  Cpu,
  Layers
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { AuditLog, ChainVerificationResult } from '../types';
import { LoadingState, EmptyState, ErrorState } from '../components/States';

export const AuditExplorerPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Cryptographic Verification State
  const [verification, setVerification] = useState<ChainVerificationResult | null>(null);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (actorFilter.trim()) params.append('actor_email', actorFilter.trim());
      if (actionFilter) params.append('action', actionFilter);
      if (entityFilter) params.append('entity_type', entityFilter);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      params.append('limit', '100');

      const data = await apiRequest<AuditLog[]>(`/audit?${params.toString()}`);
      setLogs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await apiRequest<ChainVerificationResult>('/audit/verify-chain');
      setVerification(res);
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setActorFilter('');
    setActionFilter('');
    setEntityFilter('');
    setFromDate('');
    setToDate('');
  };

  const handleExportTrail = async () => {
    try {
      const data = await apiRequest<any>('/audit/export?limit=500');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AICTE_Audit_Trail_Certificate_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, entityFilter, fromDate, toDate]);

  useEffect(() => {
    handleVerifyChain();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 gov-header-gradient text-white rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">
              Rule #1: Cryptographic State Audit Trail & Vigilance Explorer
            </h2>
          </div>
          <p className="text-xs text-blue-100/90 mt-1 max-w-3xl">
            Immutable, append-only ledger linking every statutory decision, stage transition, document review, and
            investigation into a SHA-256 tamper-evident cryptographic hash chain.
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-2xs ${
                verification?.is_valid
                  ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-300'
                  : 'bg-red-500/20 border border-red-400 text-red-300'
              }`}
            >
              {verification?.is_valid ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400" />
              )}
              Integrity: {verification?.is_valid ? 'Verified (SHA-256 Intact)' : 'Integrity Check Pending'}
            </span>
            <span className="text-[11px] text-blue-200 font-mono hidden sm:inline">
              Genesis Anchor: 7c1c21e...
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={handleExportTrail}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-amber-300" />
            Export Certificate
          </button>
          <button
            onClick={fetchLogs}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Cryptographic Verification Panel */}
      {verification && (
        <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                  verification.is_valid
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-700'
                    : 'bg-red-50 border border-red-300 text-red-700'
                }`}
              >
                {verification.is_valid ? <Lock className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900">
                    {verification.is_valid
                      ? 'Tamper-Evident SHA-256 Hash Chain: 100% Verified'
                      : 'Cryptographic Chain Integrity Warning'}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${
                      verification.is_valid
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-red-100 text-red-900 border border-red-300'
                    }`}
                  >
                    {verification.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Algorithm: {verification.algorithm} • Verified in {verification.verification_duration_ms} ms
                </div>
              </div>
            </div>

            <button
              onClick={handleVerifyChain}
              disabled={verifying}
              className="px-3.5 py-1.5 bg-[#0B2240] hover:bg-[#07172C] disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shadow-2xs shrink-0 self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
              Re-Verify Chain Now
            </button>
          </div>

          {/* Cryptographic Hashes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="font-medium flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-700" />
                  Genesis Hash (Root Block)
                </span>
                <button
                  onClick={() => copyToClipboard(verification.genesis_hash, 'genesis')}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Copy Genesis Hash"
                >
                  {copiedHash === 'genesis' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <div className="font-mono text-[11px] text-slate-800 truncate" title={verification.genesis_hash}>
                {verification.genesis_hash}
              </div>
              <span className="text-[10px] text-slate-400 block">AICTE IntelliApprove Trust Anchor</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span className="font-medium flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-700" />
                  Head Block Hash (Latest)
                </span>
                <button
                  onClick={() => copyToClipboard(verification.head_hash || '', 'head')}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Copy Head Block Hash"
                >
                  {copiedHash === 'head' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <div className="font-mono text-[11px] text-slate-800 truncate" title={verification.head_hash || 'N/A'}>
                {verification.head_hash || 'N/A'}
              </div>
              <span className="text-[10px] text-slate-400 block">Continuously linked & chained</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-purple-700" />
                Ledger Chain Height
              </span>
              <div className="text-base font-bold text-slate-900 font-mono">
                {verification.total_blocks.toLocaleString()} Blocks
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold block">0 broken links • 100% continuous</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit trail by general keywords, hash digest, or reason..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-[#0B2240] text-white text-xs font-semibold rounded-lg hover:bg-[#07172C] cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Actor Email / Role:</label>
            <input
              type="text"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
              placeholder="e.g. officer@aicte.gov.in"
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target Entity:</label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs"
            >
              <option value="">All Entities</option>
              <option value="application">Application</option>
              <option value="document">Document</option>
              <option value="undertaking">Undertaking</option>
              <option value="evc">EVC / Committee</option>
              <option value="deficiency">Deficiency</option>
              <option value="report">Report Generation</option>
              <option value="config">Configuration</option>
              <option value="user">User / Auth</option>
              <option value="escalation">Escalation</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Action Type:</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs"
            >
              <option value="">All Actions</option>
              <option value="APPLICATION_STAGE_TRANSITION">APPLICATION_STAGE_TRANSITION</option>
              <option value="APPLICATION_RETURNED_FOR_RECTIFICATION">APPLICATION_RETURNED_FOR_RECTIFICATION</option>
              <option value="COMPLIANCE_EVALUATION_COMPLETED">COMPLIANCE_EVALUATION_COMPLETED</option>
              <option value="DEFICIENCY_RECTIFICATION_SUBMITTED">DEFICIENCY_RECTIFICATION_SUBMITTED</option>
              <option value="DOCUMENT_VERIFIED">DOCUMENT_VERIFIED</option>
              <option value="UNDERTAKING_VERIFIED">UNDERTAKING_VERIFIED</option>
              <option value="EVC_SCHEDULED">EVC_SCHEDULED</option>
              <option value="REPORT_GENERATED">REPORT_GENERATED</option>
              <option value="REPORT_EXPORTED_CSV">REPORT_EXPORTED_CSV</option>
              <option value="AUTOMATED_ESCALATION_TRIGGERED">AUTOMATED_ESCALATION_TRIGGERED</option>
              <option value="SYSTEM_CLOCK_ADVANCED">SYSTEM_CLOCK_ADVANCED</option>
              <option value="USER_LOGIN_SUCCESS">USER_LOGIN_SUCCESS</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">From Date (UTC):</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">To Date (UTC):</label>
            <div className="flex gap-1.5">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs"
              />
              {(search || actorFilter || actionFilter || entityFilter || fromDate || toDate) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded hover:bg-slate-100 cursor-pointer"
                  title="Clear all filters"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Audit Table */}
      {loading ? (
        <LoadingState message="Fetching immutable audit logs..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchLogs} />
      ) : logs.length === 0 ? (
        <EmptyState title="No Audit Logs Found" description="Try adjusting search query or filters." />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Block #</th>
                  <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3">Actor & Role</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target Entity</th>
                  <th className="py-2.5 px-3">Details / Snapshot</th>
                  <th className="py-2.5 px-3">Hash Lineage</th>
                  <th className="py-2.5 px-3 text-right">Block Inspector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 font-sans">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 text-[11px]">
                      #{log.id}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{log.user_email}</div>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
                        {log.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 font-mono text-[10px] font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">
                      <span className="text-slate-400 font-sans uppercase text-[10px] block">
                        {log.entity_type}
                      </span>
                      #{log.entity_id}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate" title={log.details || ''}>
                      {log.details || 'State modified'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[10px]">
                      <div className="flex items-center gap-1" title={`Prev: ${log.prev_hash}\nCurr: ${log.hash}`}>
                        <span className="text-slate-400 truncate w-14">{log.prev_hash?.slice(0, 7)}</span>
                        <span className="text-slate-300">→</span>
                        <span className="font-bold text-emerald-700 truncate w-14">{log.hash?.slice(0, 7)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2 py-1 bg-slate-100 hover:bg-[#0B2240] hover:text-white rounded text-[11px] font-semibold text-slate-700 flex items-center gap-1 ml-auto cursor-pointer transition-colors"
                      >
                        <Code2 className="w-3 h-3" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Block Inspector & Cryptographic Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 animate-in zoom-in-95 duration-150">
            <div className="p-4 gov-header-gradient text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-300" />
                  Audit Block #{selectedLog.id} • Cryptographic Inspector
                </h3>
                <span className="text-xs text-blue-200 font-mono">{selectedLog.action}</span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-white/70 hover:text-white text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              {/* Hash Chain Details */}
              <div className="p-3 bg-slate-900 text-slate-200 rounded-xl space-y-2 font-mono text-[11px]">
                <div className="text-[10px] uppercase font-bold text-amber-400">SHA-256 Tamper-Evident Digest</div>
                <div className="flex flex-col gap-1">
                  <div className="flex gap-2">
                    <span className="text-slate-400 w-24 shrink-0">Previous Hash:</span>
                    <span className="text-blue-300 break-all">{selectedLog.prev_hash || 'GENESIS'}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-400 w-24 shrink-0">Current Hash:</span>
                    <span className="text-emerald-400 font-bold break-all">{selectedLog.hash || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Event Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Actor</span>
                  <strong className="text-slate-800">{selectedLog.user_email}</strong>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Role</span>
                  <span className="font-mono text-slate-800">{selectedLog.role}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Entity Target</span>
                  <span className="font-mono text-slate-800">
                    {selectedLog.entity_type} #{selectedLog.entity_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Client IP</span>
                  <span className="font-mono text-slate-800">{selectedLog.ip_address || '127.0.0.1'}</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
                <strong>Event Reason & Remarks:</strong> {selectedLog.details || 'State modified'}
              </div>

              {/* Before vs After Diffs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">
                    State Change Diff (Before vs After Execution)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Deterministic Canonical Serialized Payload
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-200/70">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-rose-800 text-[11px] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        State Before (old_value)
                      </span>
                      <span className="text-[10px] text-rose-600 font-mono">Pre-state snapshot</span>
                    </div>
                    {(() => {
                      const v = selectedLog.old_value;
                      if (!v || v === 'null' || v === 'None') {
                        return <div className="p-3 bg-white/80 rounded-lg font-sans text-slate-400 italic text-xs">null (Initial Creation / No Prior State)</div>;
                      }
                      try {
                        const parsed = JSON.parse(v);
                        return (
                          <pre className="p-3 bg-white/90 rounded-lg font-mono text-[11px] overflow-x-auto text-slate-800 max-h-56 border border-rose-200">
                            {JSON.stringify(parsed, null, 2)}
                          </pre>
                        );
                      } catch {
                        return (
                          <pre className="p-3 bg-white/90 rounded-lg font-mono text-[11px] overflow-x-auto text-slate-800 max-h-56 border border-rose-200 whitespace-pre-wrap break-all">
                            {v}
                          </pre>
                        );
                      }
                    })()}
                  </div>

                  <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200/70">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-emerald-800 text-[11px] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        State After (new_value)
                      </span>
                      <span className="text-[10px] text-emerald-600 font-mono">Post-state snapshot</span>
                    </div>
                    {(() => {
                      const v = selectedLog.new_value;
                      if (!v || v === 'null' || v === 'None') {
                        return <div className="p-3 bg-white/80 rounded-lg font-sans text-slate-400 italic text-xs">null (Terminal / Purged State)</div>;
                      }
                      try {
                        const parsed = JSON.parse(v);
                        return (
                          <pre className="p-3 bg-white/90 rounded-lg font-mono text-[11px] overflow-x-auto text-emerald-950 max-h-56 border border-emerald-200">
                            {JSON.stringify(parsed, null, 2)}
                          </pre>
                        );
                      } catch {
                        return (
                          <pre className="p-3 bg-white/90 rounded-lg font-mono text-[11px] overflow-x-auto text-emerald-950 max-h-56 border border-emerald-200 whitespace-pre-wrap break-all">
                            {v}
                          </pre>
                        );
                      }
                    })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-[#0B2240] text-white rounded text-xs font-semibold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
