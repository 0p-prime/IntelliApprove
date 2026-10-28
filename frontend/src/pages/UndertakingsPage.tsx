import React, { useState, useEffect } from 'react';
import { FileCheck2, Clock, CheckCircle2, AlertTriangle, ShieldCheck, Upload, Send } from 'lucide-react';
import { apiRequest } from '../api/client';
import { Undertaking } from '../types';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { useAuth } from '../context/AuthContext';

export const UndertakingsPage: React.FC = () => {
  const { user } = useAuth();
  const [undertakings, setUndertakings] = useState<Undertaking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Evidence modal state
  const [activeFulfillId, setActiveFulfillId] = useState<number | null>(null);
  const [evidenceText, setEvidenceText] = useState('');
  const [submittingEvidence, setSubmittingEvidence] = useState(false);

  // Verification modal state
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [verifyRemarks, setVerifyRemarks] = useState('');

  const fetchUndertakings = async () => {
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
    fetchUndertakings();
  }, []);

  const handleFulfill = async (id: number) => {
    if (!evidenceText.trim()) return;
    setSubmittingEvidence(true);
    try {
      await apiRequest(`/undertakings/${id}/fulfill`, {
        method: 'POST',
        body: JSON.stringify({ submission_evidence: evidenceText }),
      });
      alert('Undertaking fulfillment evidence submitted! Audit log recorded.');
      setActiveFulfillId(null);
      setEvidenceText('');
      await fetchUndertakings();
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setSubmittingEvidence(false);
    }
  };

  const handleVerify = async (id: number, status: 'COMPLIANT' | 'BREACHED') => {
    try {
      await apiRequest(`/undertakings/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ status, remarks: verifyRemarks }),
      });
      alert(`Undertaking marked as ${status}. Audit log recorded.`);
      setVerifyingId(null);
      setVerifyRemarks('');
      await fetchUndertakings();
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    }
  };

  if (loading) return <LoadingState message="Loading compliance undertakings..." />;
  if (error) return <ErrorState message={error} onRetry={fetchUndertakings} />;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Post-Approval Undertakings & Compliance Monitoring
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tracking time-bound institutional commitments issued under conditional AICTE approvals.
          </p>
        </div>
      </div>

      {undertakings.length === 0 ? (
        <EmptyState
          title="No Active Undertakings"
          description="There are currently no conditional approval undertakings recorded."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {undertakings.map((u) => {
            const isPending = u.status === 'PENDING';
            const isSubmitted = u.status === 'SUBMITTED_FOR_REVIEW';
            const isCompliant = u.status === 'COMPLIANT';
            const isBreached = u.status === 'BREACHED';

            return (
              <div
                key={u.id}
                className={`p-5 rounded-xl border bg-white shadow-2xs space-y-3 transition-all ${
                  isBreached ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Undertaking #{u.id} • App #{u.application_id}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 mt-0.5">{u.title}</h3>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      isCompliant
                        ? 'bg-emerald-100 text-emerald-800'
                        : isBreached
                        ? 'bg-red-100 text-red-800 animate-pulse'
                        : isSubmitted
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {u.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{u.description}</p>

                <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 text-slate-600">
                  <div className="flex justify-between">
                    <span>Category:</span>
                    <span className="font-semibold text-slate-800">{u.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Due Date:</span>
                    <span className={`font-semibold ${isBreached ? 'text-red-600 font-bold' : 'text-slate-800'}`}>
                      {new Date(u.due_date).toLocaleDateString()}
                    </span>
                  </div>
                  {u.submission_evidence && (
                    <div className="pt-2 border-t border-slate-200 mt-1">
                      <span className="font-semibold text-slate-800 block">Submitted Evidence:</span>
                      <p className="text-slate-600 text-[11px] mt-0.5">{u.submission_evidence}</p>
                    </div>
                  )}
                  {u.verification_remarks && (
                    <div className="pt-1 text-slate-500 text-[11px]">
                      <strong>Verification Remarks:</strong> {u.verification_remarks}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-2 flex justify-end gap-2 text-xs">
                  {/* Institution fulfill */}
                  {isPending && (user?.role === 'INSTITUTION' || user?.role === 'ADMIN') && (
                    <div>
                      {activeFulfillId === u.id ? (
                        <div className="space-y-2 w-72">
                          <textarea
                            value={evidenceText}
                            onChange={(e) => setEvidenceText(e.target.value)}
                            placeholder="Enter purchase invoice details, appointment order refs, or upload proof..."
                            className="w-full p-2 border border-slate-300 rounded text-xs"
                            rows={2}
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleFulfill(u.id)}
                              disabled={submittingEvidence}
                              className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold cursor-pointer"
                            >
                              Submit Evidence
                            </button>
                            <button
                              onClick={() => setActiveFulfillId(null)}
                              className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setActiveFulfillId(u.id)}
                          className="px-3 py-1.5 bg-[#0B2240] text-white rounded text-xs font-semibold hover:bg-[#07172C] flex items-center gap-1.5 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-400" />
                          Submit Fulfillment Evidence
                        </button>
                      )}
                    </div>
                  )}

                  {/* Regional Officer verify */}
                  {isSubmitted && (user?.role === 'REGIONAL_OFFICER' || user?.role === 'ADMIN' || user?.role === 'COMPETENT_AUTHORITY') && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVerify(u.id, 'COMPLIANT')}
                        className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                      >
                        Verify Compliant
                      </button>
                      <button
                        onClick={() => handleVerify(u.id, 'BREACHED')}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 cursor-pointer"
                      >
                        Flag Breached
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
  );
};
