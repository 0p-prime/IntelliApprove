import React, { useState, useEffect } from 'react';
import {
  GitPullRequest,
  ArrowRightLeft,
  Server,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Download,
  Lock,
  FileCheck2,
  Scale,
  Code2,
  Clock,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { LoadingState, ErrorState } from '../components/States';

export const IntegrationPage: React.FC = () => {
  const [adapterStatus, setAdapterStatus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state
  const [syncingPull, setSyncingPull] = useState<boolean>(false);
  const [pulledApps, setPulledApps] = useState<any[]>([]);
  const [pullMessage, setPullMessage] = useState<string | null>(null);

  // Push status state
  const [pushAppId, setPushAppId] = useState<string>('1');
  const [pushingStatus, setPushingStatus] = useState<boolean>(false);
  const [pushResult, setPushResult] = useState<any>(null);

  // Webhook simulator state
  const [webhookEvent, setWebhookEvent] = useState<string>('AFFILIATION_FEE_PAID');
  const [webhookAppRef, setWebhookAppRef] = useState<string>('1-1029380001');
  const [simulatingWebhook, setSimulatingWebhook] = useState<boolean>(false);
  const [webhookResult, setWebhookResult] = useState<any>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<any>('/integration/status');
      setAdapterStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with AICTE integration adapter.');
    } finally {
      setLoading(false);
    }
  };

  const handlePullApplications = async () => {
    setSyncingPull(true);
    setPullMessage(null);
    try {
      const res = await apiRequest<any>('/integration/aicte-portal/sync-applications?batch_size=3', {
        method: 'POST'
      });
      setPulledApps(res.applications || []);
      setPullMessage(res.message);
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncingPull(false);
    }
  };

  const handlePushStatus = async () => {
    if (!pushAppId.trim()) return;
    setPushingStatus(true);
    setPushResult(null);
    try {
      const res = await apiRequest<any>('/integration/aicte-portal/push-status', {
        method: 'POST',
        body: JSON.stringify({ application_id: parseInt(pushAppId, 10) })
      });
      setPushResult(res);
    } catch (err: any) {
      alert(`Push failed: ${err.message}`);
    } finally {
      setPushingStatus(false);
    }
  };

  const handleSimulateWebhook = async () => {
    setSimulatingWebhook(true);
    setWebhookResult(null);
    try {
      const payload: any = {
        event_type: webhookEvent,
        ref_no: webhookAppRef,
        timestamp: new Date().toISOString()
      };
      if (webhookEvent === 'AFFILIATION_FEE_PAID') {
        payload.amount = 150000;
        payload.details = 'Statutory inspection and processing fee credited via BharatKosh.';
      } else if (webhookEvent === 'COURT_STAY_ISSUED') {
        payload.case_no = 'WP (C) 4029/2026';
        payload.details = 'Interim stay order granted by High Court of Delhi.';
      }

      const res = await apiRequest<any>('/integration/webhooks/aicte-event', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setWebhookResult(res);
    } catch (err: any) {
      alert(`Webhook error: ${err.message}`);
    } finally {
      setSimulatingWebhook(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) return <LoadingState message="Connecting to AICTE legacy e-governance bridge adapter..." />;
  if (error || !adapterStatus) return <ErrorState message={error || 'No adapter status'} onRetry={fetchStatus} />;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 gov-header-gradient text-white rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400 flex items-center justify-center text-blue-300">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              AICTE National Portal Integration Adapter
            </h2>
          </div>
          <p className="text-xs text-blue-100/90 mt-1 max-w-2xl leading-relaxed">
            Bidirectional integration interface linking IntelliApprove with the existing National AICTE ERP
            Portal (pull applications, push stage transitions) and OpenAPI-documented secure webhook endpoints.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={fetchStatus}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Ping Adapter
          </button>
        </div>
      </div>

      {/* Connectivity Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-700 font-bold shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Adapter Status</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <strong className="text-slate-900 text-sm font-bold">{adapterStatus.status}</strong>
            </div>
            <span className="text-[11px] text-slate-500">{adapterStatus.latency_ms} ms ping latency</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-300 flex items-center justify-center text-blue-700 font-bold shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Security Protocol</span>
            <strong className="text-slate-900 text-xs font-mono font-bold block mt-0.5">
              HMAC-SHA256
            </strong>
            <span className="text-[11px] text-slate-500">Shared Secret Verification</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-700 font-bold shrink-0">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">API Standard</span>
            <strong className="text-slate-900 text-xs font-mono font-bold block mt-0.5">
              REST / OpenAPI 3.1
            </strong>
            <span className="text-[11px] text-slate-500">JSON Ingress / Egress</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-300 flex items-center justify-center text-purple-700 font-bold shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Rule #1 Immutability</span>
            <strong className="text-slate-900 text-xs font-bold block mt-0.5 text-emerald-700">
              100% Audit Chained
            </strong>
            <span className="text-[11px] text-slate-500">Every payload hashed</span>
          </div>
        </div>
      </div>

      {/* Grid: 3 Integration Flows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Flow 1: Pull Inbound Applications */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <GitPullRequest className="w-4 h-4 text-blue-700" />
              <h3 className="font-bold text-sm text-slate-900">
                1. Pull Applications from AICTE Portal
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pulls technical campus approval submissions entered through the legacy national portal and converts them into the IntelliApprove state machine format.
            </p>

            {pullMessage && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
                {pullMessage}
              </div>
            )}

            {pulledApps.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Pulled Batch Items:
                </span>
                {pulledApps.map((a, i) => (
                  <div key={i} className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <strong className="text-slate-900">{a.legacy_app_id}</strong>
                    <div className="text-slate-600 truncate">{a.institution_name}</div>
                    <div className="text-[10px] text-slate-400">{a.application_type}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handlePullApplications}
            disabled={syncingPull}
            className="w-full py-2 bg-[#0B2240] hover:bg-[#07172C] text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className={`w-3.5 h-3.5 ${syncingPull ? 'animate-bounce' : ''}`} />
            {syncingPull ? 'Synchronizing...' : 'Pull Inbound Batch (Simulate)'}
          </button>
        </div>

        {/* Flow 2: Push Status Updates to Legacy Portal */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Send className="w-4 h-4 text-emerald-700" />
              <h3 className="font-bold text-sm text-slate-900">
                2. Push Status Update to Legacy Portal
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Dispatches stage progression events, scrutiny remarks, and authority verdicts from IntelliApprove back to the legacy national portal with cryptographic SHA-256 payload checksums.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Application ID to Synchronize:
              </label>
              <input
                type="number"
                value={pushAppId}
                onChange={(e) => setPushAppId(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                placeholder="Enter App ID (e.g. 1)"
              />
            </div>

            {pushResult && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs space-y-1">
                <div className="font-bold">Sync Acknowledgment Received:</div>
                <div className="font-mono text-[10px] break-all">
                  Receipt: {pushResult.acknowledgment?.remote_receipt}
                </div>
                <div className="font-mono text-[10px] text-slate-600 truncate">
                  Checksum: {pushResult.status_payload?.checksum}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handlePushStatus}
            disabled={pushingStatus}
            className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Send className={`w-3.5 h-3.5 ${pushingStatus ? 'animate-pulse' : ''}`} />
            {pushingStatus ? 'Pushing Status...' : 'Push Real-Time Status'}
          </button>
        </div>

        {/* Flow 3: Webhook Receiver Simulator */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <ShieldCheck className="w-4 h-4 text-purple-700" />
              <h3 className="font-bold text-sm text-slate-900">
                3. OpenAPI Webhook Receiver
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Simulates secure webhook events dispatched from external AICTE systems (treasury fee clearance, state government university affiliation, or court orders).
            </p>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Event Notification Type:
                </label>
                <select
                  value={webhookEvent}
                  onChange={(e) => setWebhookEvent(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="AFFILIATION_FEE_PAID">AFFILIATION_FEE_PAID (Treasury Cleared)</option>
                  <option value="UNIVERSITY_NOC_ISSUED">UNIVERSITY_NOC_ISSUED (Affiliation NOC)</option>
                  <option value="COURT_STAY_ISSUED">COURT_STAY_ISSUED (Judicial Injunction)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Target Application Ref:
                </label>
                <input
                  type="text"
                  value={webhookAppRef}
                  onChange={(e) => setWebhookAppRef(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            {webhookResult && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />
                  Webhook Processed: {webhookResult.action_taken}
                </div>
                <div className="text-[10px] text-blue-700 font-mono">
                  HMAC Verified: {webhookResult.signature_verified ? 'YES' : 'BYPASSED'}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSimulateWebhook}
            disabled={simulatingWebhook}
            className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Server className={`w-3.5 h-3.5 ${simulatingWebhook ? 'animate-spin' : ''}`} />
            {simulatingWebhook ? 'Dispatching...' : 'Dispatch Webhook Event'}
          </button>
        </div>
      </div>
    </div>
  );
};

