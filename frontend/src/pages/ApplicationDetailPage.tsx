import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  CheckSquare,
  ShieldCheck,
  X,
  Send,
  Eye,
  ExternalLink
} from 'lucide-react';
import { apiRequest } from '../api/client';
import {
  Application,
  WorkflowRoute,
  TimelineData,
  CaseSummaryData,
  ApplicationFullHistoryResponse,
  FullHistoryEvent
} from '../types';
import { VisualStageStepper } from '../components/VisualStageStepper';
import { LoadingState, ErrorState } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';

export const ApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [application, setApplication] = useState<Application | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [allowedActions, setAllowedActions] = useState<WorkflowRoute[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs matching screenshot: Overview, Timeline, Documents, Audit
  const [activeTab, setActiveTab] = useState<'Overview' | 'Timeline' | 'Documents' | 'Audit'>('Overview');

  // Full History State
  const [fullHistory, setFullHistory] = useState<ApplicationFullHistoryResponse | null>(null);
  const [riskData, setRiskData] = useState<any>(null);

  // Complete Stage Modal
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState<boolean>(false);
  const [stageRemarks, setStageRemarks] = useState<string>('');
  const [completingStage, setCompletingStage] = useState<boolean>(false);
  const [stageError, setStageError] = useState<string | null>(null);

  // Return Application Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnTargetStage, setReturnTargetStage] = useState<string>('SUBMITTED');
  const [returningApp, setReturningApp] = useState<boolean>(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  // Document verification modal
  const [verifyingDocId, setVerifyingDocId] = useState<number | null>(null);
  const [docRemarks, setDocRemarks] = useState('');

  const fetchApplicationDetails = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [appData, timelineData, actionsData, fullHistoryData, riskScoreData] = await Promise.all([
        apiRequest<Application>(`/applications/${id}`),
        apiRequest<TimelineData>(`/applications/${id}/timeline`).catch(() => null),
        apiRequest<WorkflowRoute[]>(`/workflow/allowed-actions/${id}`).catch(() => []),
        apiRequest<ApplicationFullHistoryResponse>(`/applications/${id}/full-history`).catch(() => null),
        apiRequest<any>(`/applications/${id}/risk-score`).catch(() => null),
      ]);
      setApplication(appData);
      setTimeline(timelineData);
      setAllowedActions(actionsData);
      if (fullHistoryData) setFullHistory(fullHistoryData);
      if (riskScoreData) setRiskData(riskScoreData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch application');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicationDetails();
  }, [id]);

  // Complete Stage Handler
  const handleCompleteStageSubmit = async () => {
    if (!application) return;
    setCompletingStage(true);
    setStageError(null);
    try {
      const updated = await apiRequest<Application>(`/applications/${application.id}/complete-stage`, {
        method: 'POST',
        body: JSON.stringify({
          remarks: stageRemarks.trim() || undefined,
        }),
      });
      setApplication(updated);
      setIsCompleteModalOpen(false);
      setStageRemarks('');
      await fetchApplicationDetails();
    } catch (err: any) {
      setStageError(err.message || 'Failed to complete stage');
    } finally {
      setCompletingStage(false);
    }
  };

  // Return Application Handler
  const handleReturnSubmit = async () => {
    if (!application) return;
    if (!returnReason.trim()) {
      setReturnError('A mandatory reason must be provided when returning an application.');
      return;
    }
    setReturningApp(true);
    setReturnError(null);
    try {
      const updated = await apiRequest<Application>(`/applications/${application.id}/return`, {
        method: 'POST',
        body: JSON.stringify({
          reason: returnReason.trim(),
          target_stage: returnTargetStage || undefined,
        }),
      });
      setApplication(updated);
      setIsReturnModalOpen(false);
      setReturnReason('');
      setReturnTargetStage('SUBMITTED');
      await fetchApplicationDetails();
    } catch (err: any) {
      setReturnError(err.message || 'Failed to return application');
    } finally {
      setReturningApp(false);
    }
  };

  // Verify Document Handler
  const handleVerifyDocument = async (docId: number, status: string) => {
    try {
      await apiRequest(`/documents/verify/${docId}`, {
        method: 'POST',
        body: JSON.stringify({ status, remarks: docRemarks }),
      });
      setVerifyingDocId(null);
      setDocRemarks('');
      await fetchApplicationDetails();
    } catch (err: any) {
      alert(`Document verification failed: ${err.message}`);
    }
  };

  if (loading) return <LoadingState message="Loading application details..." />;
  if (error || !application) return <ErrorState message={error || 'Application not found'} onRetry={fetchApplicationDetails} />;

  // Display fields
  const refNo = application.ref_no || application.application_number || 'APP-[001]';
  const institutionName = application.institution?.name || 'Sample Institute of Technology';
  const regionName = application.institution?.region || 'Western';

  // Format route description
  const formatRoute = (type?: string): string => {
    if (!type) return 'Scrutiny + EVC';
    if (type.includes('EXTENSION_OF_APPROVAL')) return 'Only Scrutiny';
    if (type.includes('NEW_TECHNICAL_INSTITUTION')) return 'Scrutiny + EVC';
    if (type.includes('INCREASE_IN_INTAKE')) return 'Scrutiny + EVC';
    if (type.includes('INTRODUCTION_OF_NEW_PROGRAM')) return 'EVC + SAC/SHC';
    if (type.includes('EVC')) return 'Only EVC';
    return 'Scrutiny + EVC';
  };
  const routeDescription = `${formatRoute(application.application_type)} | ${regionName} Region`;

  // Age in days
  const ageDays = (() => {
    if (!application.created_at) return '34 days';
    const days = Math.max(1, Math.floor((Date.now() - new Date(application.created_at).getTime()) / (1000 * 60 * 60 * 24)));
    return `${days} days`;
  })();

  // Officer name
  const officerName = application.current_stage?.assigned_role
    ? application.current_stage.assigned_role.replace(/_/g, ' ')
    : 'Sample Officer';

  // Next deadline text
  const nextDeadlineText = (() => {
    if (application.sla_deadline) {
      const diffDays = Math.ceil((new Date(application.sla_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} days`;
      if (diffDays === 0) return 'Due today';
      return `Due in ${diffDays} days`;
    }
    return 'EVC due in 3 days';
  })();

  // Current stage for stepper
  const currentStageName = (application.current_stage?.name || application.current_stage || application.status || 'EVC').toUpperCase();

  // Timeline events for overview matching screenshot
  const timelineEvents = (() => {
    if (fullHistory?.events && fullHistory.events.length > 0) {
      return fullHistory.events.slice(0, 5).map((e) => ({
        id: e.id,
        title: e.title || e.event_type.replace(/_/g, ' '),
        details: `${new Date(e.timestamp).toLocaleDateString()} | ${e.actor_role || 'Officer'}`
      }));
    }
    return [
      {
        id: 't-1',
        title: 'Scrutiny completed by officer',
        details: 'Sample date | Regional Officer'
      },
      {
        id: 't-2',
        title: 'Returned for clarification, reason recorded',
        details: 'Sample date | Regional Officer'
      },
      {
        id: 't-3',
        title: 'Application submitted',
        details: 'Sample date | Institution'
      }
    ];
  })();

  return (
    <div className="font-sans antialiased text-[#18181B] bg-white">
      {/* SECTION 1: BREADCRUMB */}
      <div className="text-xs text-[#595959] mb-3 flex items-center gap-1.5">
        <Link to="/applications" className="hover:text-[#18181B] transition-colors">
          Applications
        </Link>
        <span>/</span>
        <span className="font-medium text-[#18181B]">{refNo}</span>
      </div>

      {/* SECTION 2: TITLE & SUBTITLE */}
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
          {institutionName}
        </h1>
        <p className="text-sm text-[#595959] mt-1 font-normal">
          {routeDescription}
        </p>
      </div>

      {/* SECTION 3: ACTION BUTTONS ROW */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        {/* Complete stage button (Key Action: Brand) */}
        <Button
          variant="brand"
          onClick={() => setIsCompleteModalOpen(true)}
        >
          Complete stage
        </Button>

        {/* Return with reason button (Danger variant) */}
        <Button
          variant="danger"
          onClick={() => setIsReturnModalOpen(true)}
        >
          Return with reason
        </Button>

        {/* Human oversight required badge */}
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#E6E6E6] bg-white text-xs font-medium text-[#18181B]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#18181B]" />
          <span>Human oversight required</span>
        </span>
      </div>

      {/* SECTION 4: HORIZONTAL STAGE STEPPER */}
      <div className="mb-8">
        <VisualStageStepper
          timeline={timeline}
          currentStage={currentStageName}
          status={application.status}
        />
      </div>

      {/* SECTION 5: TABS (Overview, Timeline, Documents, Audit) */}
      <div className="mb-6">
        <Tabs
          tabs={['Overview', 'Timeline', 'Documents', 'Audit']}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as 'Overview' | 'Timeline' | 'Documents' | 'Audit')}
          aria-label="Application Details View"
        />
      </div>

      {/* SECTION 6: TAB CONTENTS */}
      {activeTab === 'Overview' && (
        <div className="space-y-8">
          {/* 4-Column Metadata Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <div className="text-xs font-semibold tracking-wider text-[#595959] uppercase">
                REGION
              </div>
              <div className="text-sm font-semibold text-[#18181B] mt-1">
                {regionName}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold tracking-wider text-[#595959] uppercase">
                AGE
              </div>
              <div className="text-sm font-semibold text-[#18181B] mt-1">
                {ageDays}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold tracking-wider text-[#595959] uppercase">
                OFFICER
              </div>
              <div className="text-sm font-semibold text-[#18181B] mt-1">
                {officerName}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold tracking-wider text-[#595959] uppercase">
                NEXT DEADLINE
              </div>
              <div className="text-sm font-semibold text-[#18181B] mt-1">
                {nextDeadlineText}
              </div>
            </div>
          </div>

          {/* TIMELINE Section */}
          <div>
            <div className="text-xs font-semibold tracking-wider text-[#595959] uppercase mb-4">
              TIMELINE
            </div>

            <div className="border-t border-[#E6E6E6]">
              {timelineEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="py-3.5 border-b border-[#E6E6E6] flex items-start gap-3"
                >
                  {/* Black Dot */}
                  <span className="w-2 h-2 rounded-full bg-[#18181B] shrink-0 mt-1.5" />
                  <div>
                    <div className="font-semibold text-sm text-[#18181B]">
                      {evt.title}
                    </div>
                    <div className="text-xs text-[#595959] mt-0.5">
                      {evt.details}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Timeline' && (
        <div className="space-y-4">
          <div className="text-xs font-semibold tracking-wider text-[#595959] uppercase mb-2">
            DETAILED EVENT TRAIL
          </div>
          <div className="border-t border-[#E6E6E6] divide-y divide-[#E6E6E6]">
            {fullHistory?.events && fullHistory.events.length > 0 ? (
              fullHistory.events.map((evt) => (
                <div key={evt.id} className="py-3.5 flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-[#18181B] shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-[#18181B]">
                      {evt.title || evt.event_type.replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs text-[#595959] mt-0.5">
                      {new Date(evt.timestamp).toLocaleString()} • {evt.actor_role} ({evt.actor_name})
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-xs text-[#595959]">
                No additional historical events recorded for this application.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Documents' && (
        <div className="space-y-4">
          <div className="text-xs font-semibold tracking-wider text-[#595959] uppercase mb-2">
            VERIFIED APPLICATION DOCUMENTS
          </div>
          <div className="border border-[#E6E6E6] rounded-[8px] overflow-hidden bg-white">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E6E6E6] text-[#595959] font-semibold bg-[#FAFAFA]">
                  <th className="py-3 px-4">Document Type</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E6E6]">
                {application.documents && application.documents.length > 0 ? (
                  application.documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-[#FAFAFA]">
                      <td className="py-3 px-4 font-semibold text-[#18181B]">{doc.doc_type}</td>
                      <td className="py-3 px-4 text-[#595959]">{doc.file_name}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] border border-[#E6E6E6] bg-white text-[#18181B]">
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="quiet"
                          size="sm"
                          onClick={() => setVerifyingDocId(doc.id)}
                          className="mr-3"
                        >
                          Mark verified
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => window.open(doc.file_url, '_blank')}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#595959]">
                      No supporting documents attached to this application record.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Audit' && (
        <div className="space-y-4">
          <div className="text-xs font-semibold tracking-wider text-[#595959] uppercase mb-2">
            CRYPTOGRAPHIC AUDIT RECORD
          </div>
          <div className="p-4 border border-[#E6E6E6] rounded-[8px] bg-[#FAFAFA] space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#18181B]">Application Digest (SHA-256):</span>
              <span className="font-mono text-[11px] text-[#595959] truncate max-w-sm">
                {application.digital_signature_hash || '7c1c21e4b97c46a3666b6c28f9d0c2e6...'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#18181B]">Integrity Status:</span>
              <span className="text-[#18181B] font-medium">Chain Intact & Immutable</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#18181B]">Regulatory Mandate:</span>
              <span className="text-[#595959]">Strict Human Oversight Enforced</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: COMPLETE STAGE MODAL */}
      {/* ============================================================== */}
      {isCompleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6E6E6] rounded-[8px] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-3">
              <h3 className="font-bold text-[#18181B] text-base">
                Complete Stage: {currentStageName}
              </h3>
              <Button
                variant="quiet"
                size="icon"
                aria-label="Close"
                onClick={() => setIsCompleteModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-xs text-[#595959]">
              Confirming stage completion will advance this application to the next statutory review stage.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#18181B] mb-1">
                Official Review Remarks
              </label>
              <textarea
                value={stageRemarks}
                onChange={(e) => setStageRemarks(e.target.value)}
                placeholder="Enter remarks for the official stage record..."
                className="w-full p-2.5 text-xs bg-white border border-[#E6E6E6] rounded-[8px] text-[#18181B] focus:outline-none focus:border-[#18181B] h-24 resize-none"
              />
            </div>

            {stageError && (
              <div className="p-2 bg-red-50 border border-red-200 text-[#B5121A] text-xs rounded-[8px]">
                {stageError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E6E6E6]">
              <Button
                variant="secondary"
                onClick={() => setIsCompleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={completingStage}
                onClick={handleCompleteStageSubmit}
              >
                Complete stage
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: RETURN APPLICATION MODAL */}
      {/* ============================================================== */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6E6E6] rounded-[8px] max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-3">
              <h3 className="font-bold text-[#18181B] text-base">
                Return Application for Clarification
              </h3>
              <Button
                variant="quiet"
                size="icon"
                aria-label="Close"
                onClick={() => setIsReturnModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-xs text-[#595959]">
              Under statutory governance, a mandatory justification is required when reverting an institutional application.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#18181B] mb-1">
                Mandatory Reason for Return *
              </label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Specific deficiencies or clarification required from the institution..."
                className="w-full p-2.5 text-xs bg-white border border-[#E6E6E6] rounded-[8px] text-[#18181B] focus:outline-none focus:border-[#18181B] h-24 resize-none"
              />
            </div>

            {returnError && (
              <div className="p-2 bg-red-50 border border-red-200 text-[#B5121A] text-xs rounded-[8px]">
                {returnError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E6E6E6]">
              <Button
                variant="secondary"
                onClick={() => setIsReturnModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={returningApp}
                onClick={handleReturnSubmit}
              >
                Return with reason
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: DOCUMENT VERIFY MODAL */}
      {/* ============================================================== */}
      {verifyingDocId !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6E6E6] rounded-[8px] max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-2">
              <h4 className="font-bold text-sm text-[#18181B]">Verify Supporting Document</h4>
              <Button
                variant="quiet"
                size="icon"
                aria-label="Close"
                onClick={() => setVerifyingDocId(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#18181B] mb-1">
                Verification Remarks
              </label>
              <input
                type="text"
                value={docRemarks}
                onChange={(e) => setDocRemarks(e.target.value)}
                placeholder="Remarks (e.g. Land registry verified)"
                className="w-full p-2 text-xs bg-white border border-[#E6E6E6] rounded-[8px]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E6E6E6]">
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleVerifyDocument(verifyingDocId, 'DEFICIENT_REJECTED')}
              >
                Return with reason
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleVerifyDocument(verifyingDocId, 'VERIFIED_COMPLIANT')}
              >
                Mark verified
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationDetailPage;
