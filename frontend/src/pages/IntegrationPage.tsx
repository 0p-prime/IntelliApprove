import React, { useState, useEffect } from 'react';
import {
  GitPullRequest,
  ArrowRightLeft,
  Server,
  CheckCircle2,
  RefreshCw,
  Send,
  Download,
  Lock,
  Code2,
  ShieldCheck
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { LoadingState, ErrorState } from '../components/States';
import { Button } from '../components/ui/Button';

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
      setError(err.message || 'Failed to communicate with integration adapter.');
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
        payload.details = 'Interim stay order granted by High Court.';
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

  if (loading) return <LoadingState message="Connecting to bridge adapter..." />;
  if (error || !adapterStatus) return <ErrorState message={error || 'No adapter status'} onRetry={fetchStatus} />;

  return (
    <div className="space-y-6 font-sans text-[#111111]">
      {/* Top Header */}
      <div className="p-5 bg-white border border-[#E6E6E6] rounded-[8px] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] flex items-center justify-center text-[#111111]">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-[#111111]">
              External Portal Integration Adapter
            </h2>
          </div>
          <p className="text-xs text-[#595959] mt-1 max-w-2xl leading-relaxed">
            Bidirectional integration interface linking IntelliApprove with external regulatory databases (pull applications, push stage transitions) and OpenAPI-documented secure webhook endpoints.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <Button size="sm" onClick={fetchStatus}><RefreshCw className="w-3.5 h-3.5 text-white mr-1.5" />Ping adapter</Button>
        </div>
      </div>

      {/* Connectivity Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-[8px] border border-[#E6E6E6] flex items-center gap-3">
          <div className="w-10 h-10 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] flex items-center justify-center text-[#111111] font-bold shrink-0">
            <Server className="w-5 h-5 text-[#111111]" />
          </div>
          <div>
            <span className="text-[10px] text-[#595959] uppercase font-bold block">Adapter Status</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#18181B]" />
              <strong className="text-[#111111] text-sm font-bold">{adapterStatus.status}</strong>
            </div>
            <span className="text-[11px] text-[#595959]">{adapterStatus.latency_ms} ms ping latency</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-[8px] border border-[#E6E6E6] flex items-center gap-3">
          <div className="w-10 h-10 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] flex items-center justify-center text-[#111111] font-bold shrink-0">
            <Lock className="w-5 h-5 text-[#111111]" />
          </div>
          <div>
            <span className="text-[10px] text-[#595959] uppercase font-bold block">Security Protocol</span>
            <strong className="text-[#111111] text-xs font-mono font-bold block mt-0.5">
              HMAC-SHA256
            </strong>
            <span className="text-[11px] text-[#595959]">Shared Secret Verification</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-[8px] border border-[#E6E6E6] flex items-center gap-3">
          <div className="w-10 h-10 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] flex items-center justify-center text-[#111111] font-bold shrink-0">
            <Code2 className="w-5 h-5 text-[#111111]" />
          </div>
          <div>
            <span className="text-[10px] text-[#595959] uppercase font-bold block">API Standard</span>
            <strong className="text-[#111111] text-xs font-mono font-bold block mt-0.5">
              REST / OpenAPI 3.1
            </strong>
            <span className="text-[11px] text-[#595959]">JSON Ingress / Egress</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-[8px] border border-[#E6E6E6] flex items-center gap-3">
          <div className="w-10 h-10 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] flex items-center justify-center text-[#111111] font-bold shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#111111]" />
          </div>
          <div>
            <span className="text-[10px] text-[#595959] uppercase font-bold block">Rule #1 Immutability</span>
            <strong className="text-[#111111] text-xs font-bold block mt-0.5">
              100% Audit Chained
            </strong>
            <span className="text-[11px] text-[#595959]">Every payload hashed</span>
          </div>
        </div>
      </div>

      {/* Grid: 3 Integration Flows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Flow 1: Pull Inbound Applications */}
        <div className="bg-white p-5 rounded-[8px] border border-[#E6E6E6] space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E6E6E6]">
              <GitPullRequest className="w-4 h-4 text-[#111111]" />
              <h3 className="font-bold text-sm text-[#111111]">
                1. Pull Inbound Applications
              </h3>
            </div>
            <p className="text-xs text-[#595959] leading-relaxed">
              Pulls technical campus approval submissions entered through external portals and ingests them into the IntelliApprove state machine format.
            </p>

            {pullMessage && (
              <div className="p-2.5 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] text-[#111111] text-xs font-medium">
                {pullMessage}
              </div>
            )}

            {pulledApps.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-[#595959] uppercase tracking-wider block">
                  Pulled Batch Items:
                </span>
                {pulledApps.map((a, i) => (
                  <div key={i} className="p-2 bg-[#F4F4F5] rounded-[6px] border border-[#E6E6E6] text-xs">
                    <strong className="text-[#111111]">{a.legacy_app_id}</strong>
                    <div className="text-[#595959] truncate">{a.institution_name}</div>
                    <div className="text-[10px] text-[#595959]">{a.application_type}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button variant="primary" loading={syncingPull} onClick={handlePullApplications} className="w-full">Sync applications</Button>
        </div>

        {/* Flow 2: Push Status Updates to External Portal */}
        <div className="bg-white p-5 rounded-[8px] border border-[#E6E6E6] space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E6E6E6]">
              <Send className="w-4 h-4 text-[#111111]" />
              <h3 className="font-bold text-sm text-[#111111]">
                2. Push Status Update
              </h3>
            </div>
            <p className="text-xs text-[#595959] leading-relaxed">
              Dispatches stage progression events, scrutiny remarks, and verdicts from IntelliApprove back to external systems with SHA-256 checksums.
            </p>

            <div>
              <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                Application ID to Synchronize:
              </label>
              <input
                type="number"
                value={pushAppId}
                onChange={(e) => setPushAppId(e.target.value)}
                className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[8px] text-xs font-mono text-[#111111] focus:outline-none focus:border-[#111111]"
                placeholder="Enter App ID (e.g. 1)"
              />
            </div>

            {pushResult && (
              <div className="p-2.5 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] text-[#111111] text-xs space-y-1">
                <div className="font-bold">Sync Acknowledgment Received:</div>
                <div className="font-mono text-[10px] break-all">
                  Receipt: {pushResult.acknowledgment?.remote_receipt}
                </div>
                <div className="font-mono text-[10px] text-[#595959] truncate">
                  Checksum: {pushResult.status_payload?.checksum}
                </div>
              </div>
            )}
          </div>

          <Button variant="primary" loading={pushingStatus} onClick={handlePushStatus} className="w-full">Push updates</Button>
        </div>

        {/* Flow 3: Webhook Receiver Simulator */}
        <div className="bg-white p-5 rounded-[8px] border border-[#E6E6E6] space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#E6E6E6]">
              <ShieldCheck className="w-4 h-4 text-[#111111]" />
              <h3 className="font-bold text-sm text-[#111111]">
                3. OpenAPI Webhook Receiver
              </h3>
            </div>
            <p className="text-xs text-[#595959] leading-relaxed">
              Simulates secure webhook events dispatched from external systems (treasury fee clearance, state affiliation, or court orders).
            </p>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                  Event Notification Type:
                </label>
                <select
                  value={webhookEvent}
                  onChange={(e) => setWebhookEvent(e.target.value)}
                  className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[8px] text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
                >
                  <option value="AFFILIATION_FEE_PAID">AFFILIATION_FEE_PAID (Treasury Cleared)</option>
                  <option value="UNIVERSITY_NOC_ISSUED">UNIVERSITY_NOC_ISSUED (Affiliation NOC)</option>
                  <option value="COURT_STAY_ISSUED">COURT_STAY_ISSUED (Judicial Injunction)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#111111] mb-1">
                  Target Application Ref:
                </label>
                <input
                  type="text"
                  value={webhookAppRef}
                  onChange={(e) => setWebhookAppRef(e.target.value)}
                  className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[8px] text-xs font-mono text-[#111111] focus:outline-none focus:border-[#111111]"
                />
              </div>
            </div>

            {webhookResult && (
              <div className="p-2.5 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] text-[#111111] text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#111111]" />
                  Webhook Processed: {webhookResult.action_taken}
                </div>
                <div className="text-[10px] text-[#595959] font-mono">
                  HMAC Verified: {webhookResult.signature_verified ? 'YES' : 'BYPASSED'}
                </div>
              </div>
            )}
          </div>

          <Button variant="secondary" loading={simulatingWebhook} onClick={handleSimulateWebhook} className="w-full">Send webhook</Button>
        </div>
      </div>
    </div>
  );
};
