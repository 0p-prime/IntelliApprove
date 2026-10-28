import React, { useState, useEffect } from 'react';
import { History, Search, Filter, ShieldCheck, RefreshCw, FileText, Code2, ArrowRight } from 'lucide-react';
import { apiRequest } from '../api/client';
import { AuditLog } from '../types';
import { LoadingState, EmptyState, ErrorState } from '../components/States';

export const AuditExplorerPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (actionFilter) params.append('action', actionFilter);
      if (entityFilter) params.append('entity_type', entityFilter);
      params.append('limit', '100');

      const data = await apiRequest<AuditLog[]>(`/audit?${params.toString()}`);
      setLogs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, entityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold tracking-tight">
              Rule #1: Immutable Vigilance & State Audit Trail
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Every state change (stage transitions, undertakings, document reviews, alerts, escalations, logins, config modifications) writes an unalterable audit log entry.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start md:self-auto transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Trail
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit trail by actor, entity ID, or keyword..."
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

        <div className="flex gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Entity:</span>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
            >
              <option value="">All Entities</option>
              <option value="application">Application</option>
              <option value="document">Document</option>
              <option value="undertaking">Undertaking</option>
              <option value="config">Configuration</option>
              <option value="user">User / Auth</option>
              <option value="escalation">Escalation</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
            >
              <option value="">All Actions</option>
              <option value="APPLICATION_STAGE_TRANSITION">APPLICATION_STAGE_TRANSITION</option>
              <option value="COMPETENT_AUTHORITY_DECISION_RECORDED">COMPETENT_AUTHORITY_DECISION_RECORDED</option>
              <option value="COMPLIANCE_EVALUATION_COMPLETED">COMPLIANCE_EVALUATION_COMPLETED</option>
              <option value="DOCUMENT_VERIFICATION_STATUS_UPDATED">DOCUMENT_VERIFICATION_STATUS_UPDATED</option>
              <option value="UNDERTAKING_CREATED">UNDERTAKING_CREATED</option>
              <option value="UNDERTAKING_VERIFICATION_RECORDED">UNDERTAKING_VERIFICATION_RECORDED</option>
              <option value="AUTOMATED_ESCALATION_TRIGGERED">AUTOMATED_ESCALATION_TRIGGERED</option>
              <option value="CONFIG_STAGE_UPDATED">CONFIG_STAGE_UPDATED</option>
              <option value="USER_LOGIN_SUCCESS">USER_LOGIN_SUCCESS</option>
            </select>
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
                  <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3">Actor & Role</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target Entity</th>
                  <th className="py-2.5 px-3">Details / Snapshot</th>
                  <th className="py-2.5 px-3">IP Address</th>
                  <th className="py-2.5 px-3 text-right">Diff Inspector</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 font-sans">
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
                    <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate">
                      {log.details || 'State modified'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {(log.old_value || log.new_value) && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2 py-1 bg-slate-100 hover:bg-[#0B2240] hover:text-white rounded text-[11px] font-semibold text-slate-700 flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <Code2 className="w-3 h-3" />
                          View Diff
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for Old vs New Snapshot Diff */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden space-y-4">
            <div className="p-4 bg-[#0B2240] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-400" />
                  Audit Log Diff Snapshot #{selectedLog.id}
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

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg text-slate-700">
                <strong>Event Details:</strong> {selectedLog.details}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="font-bold text-slate-700 block mb-1">Before State (old_value):</span>
                  <pre className="p-3 bg-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto text-slate-800 max-h-48">
                    {selectedLog.old_value || 'null (Initial Creation)'}
                  </pre>
                </div>

                <div>
                  <span className="font-bold text-slate-700 block mb-1">After State (new_value):</span>
                  <pre className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg font-mono text-[11px] overflow-x-auto text-emerald-900 max-h-48">
                    {selectedLog.new_value || 'null (Deletion)'}
                  </pre>
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
