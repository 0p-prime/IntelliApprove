import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Building2,
  FileText,
  Clock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  FileCheck2,
  Users,
  Eye,
  RefreshCw,
  Award,
  Hash,
  Download,
  CheckSquare,
  Lock,
  ChevronRight,
  History
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { Application, WorkflowRoute, ComplianceNormRule } from '../types';
import { HumanOversightBadge } from '../components/HumanOversightBadge';
import { StatusPill } from '../components/StatusPill';
import { LoadingState, ErrorState } from '../components/States';
import { useAuth } from '../context/AuthContext';

export const ApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [allowedActions, setAllowedActions] = useState<WorkflowRoute[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'compliance' | 'documents' | 'evc' | 'decision' | 'undertakings' | 'audit'
  >('overview');

  // Action / Modal states
  const [transitioning, setTransitioning] = useState<boolean>(false);
  const [evaluatingCompliance, setEvaluatingCompliance] = useState<boolean>(false);
  const [complianceMessage, setComplianceMessage] = useState<string | null>(null);
  
  // Decision Form States (Rule #2)
  const [verdict, setVerdict] = useState<'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED'>('APPROVED');
  const [decisionNotes, setDecisionNotes] = useState<string>('');
  const [checklist, setChecklist] = useState({
    scrutiny_verified: false,
    evc_infra_verified: false,
    aph_norms_checked: false,
    vigilance_cleared: false,
  });
  const [submittingDecision, setSubmittingDecision] = useState<boolean>(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // Scrutiny & EVC Form States
  const [scrutinyRemarks, setScrutinyRemarks] = useState('');
  const [scrutinyRec, setScrutinyRec] = useState('RECOMMEND_EVC');
  const [evcNotes, setEvcNotes] = useState('');
  const [evcRec, setEvcRec] = useState('RECOMMENDED');
  const [evcInfra, setEvcInfra] = useState(true);
  const [evcFaculty, setEvcFaculty] = useState(true);
  const [evcLabs, setEvcLabs] = useState(true);

  // Document verification modal state
  const [verifyingDocId, setVerifyingDocId] = useState<number | null>(null);
  const [docRemarks, setDocRemarks] = useState('');

  // Rectification state
  const [rectifyingDefId, setRectifyingDefId] = useState<number | null>(null);
  const [rectificationProof, setRectificationProof] = useState('');

  const fetchApplicationDetails = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const appData = await apiRequest<Application>(`/applications/${id}`);
      setApplication(appData);

      // Load allowed workflow actions for this application and current user role
      const actionsData = await apiRequest<WorkflowRoute[]>(`/workflow/allowed-actions/${id}`);
      setAllowedActions(actionsData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch application');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicationDetails();
  }, [id, user?.role]);

  // Handle stage transition
  const handleTransition = async (route: WorkflowRoute) => {
    if (!application) return;
    const remarks = prompt(`Enter remarks for action: "${route.action_name}"`) || '';
    setTransitioning(true);
    try {
      const updated = await apiRequest<Application>(`/workflow/transition?application_id=${application.id}`, {
        method: 'POST',
        body: JSON.stringify({
          target_stage_id: route.to_stage_id,
          action_name: route.action_name,
          remarks: remarks,
        }),
      });
      setApplication(updated);
      await fetchApplicationDetails();
    } catch (err: any) {
      alert(`Transition failed: ${err.message}`);
    } finally {
      setTransitioning(false);
    }
  };

  // Run automated compliance engine
  const handleRunCompliance = async () => {
    if (!application) return;
    setEvaluatingCompliance(true);
    setComplianceMessage(null);
    try {
      const res: any = await apiRequest(`/compliance/${application.id}/evaluate`, {
        method: 'POST',
      });
      setComplianceMessage(
        `Compliance evaluation complete: ${res.checks_passed}/${res.checks_evaluated} checks satisfied. New Score: ${res.compliance_score}%. Deficiencies: ${res.deficiencies_count}.`
      );
      await fetchApplicationDetails();
    } catch (err: any) {
      alert(`Compliance run failed: ${err.message}`);
    } finally {
      setEvaluatingCompliance(false);
    }
  };

  // Submit Scrutiny Report
  const handleSubmitScrutiny = async () => {
    if (!application) return;
    try {
      await apiRequest(`/workflow/scrutiny-report/${application.id}`, {
        method: 'POST',
        body: JSON.stringify({
          remarks: scrutinyRemarks,
          recommendation: scrutinyRec,
        }),
      });
      alert('Scrutiny report submitted successfully!');
      await fetchApplicationDetails();
    } catch (err: any) {
      alert(`Failed to submit scrutiny report: ${err.message}`);
    }
  };

  // Submit EVC Inspection Report
  const handleSubmitEVC = async () => {
    if (!application) return;
    try {
      await apiRequest(`/workflow/evc-report/${application.id}`, {
        method: 'POST',
        body: JSON.stringify({
          inspection_notes: evcNotes,
          recommendation: evcRec,
          infra_verified: evcInfra,
          faculty_verified: evcFaculty,
          labs_functional: evcLabs,
        }),
      });
      alert('EVC inspection report submitted successfully!');
      await fetchApplicationDetails();
    } catch (err: any) {
      alert(`Failed to submit EVC report: ${err.message}`);
    }
  };

  // Verify Document
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

  // Submit Rectification
  const handleSubmitRectification = async (defId: number) => {
    try {
      await apiRequest(`/compliance/deficiencies/${defId}/rectify`, {
        method: 'POST',
        body: JSON.stringify({ rectification_proof: rectificationProof }),
      });
      setRectifyingDefId(null);
      setRectificationProof('');
      await fetchApplicationDetails();
    } catch (err: any) {
      alert(`Rectification submission failed: ${err.message}`);
    }
  };

  // Competent Authority Decision (Rule #2)
  const handleAuthorityDecision = async () => {
    if (!application) return;
    setDecisionError(null);

    // Verify all checklist items
    const allChecked = Object.values(checklist).every(Boolean);
    if (!allChecked) {
      setDecisionError('All Human Oversight Checklist items must be explicitly confirmed before issuing a decision.');
      return;
    }

    if (!decisionNotes.trim()) {
      setDecisionError('Please provide formal decision notes / speaking order justification.');
      return;
    }

    setSubmittingDecision(true);
    try {
      const updated = await apiRequest<Application>(`/workflow/authority-decision/${application.id}`, {
        method: 'POST',
        body: JSON.stringify({
          verdict,
          notes: decisionNotes,
          checklist_acknowledgement: checklist,
        }),
      });
      setApplication(updated);
      alert(`Competent Authority Decision (${verdict}) formally recorded and digitally signed!`);
      await fetchApplicationDetails();
    } catch (err: any) {
      setDecisionError(err.message || 'Failed to record decision');
    } finally {
      setSubmittingDecision(false);
    }
  };

  if (loading) return <LoadingState message="Loading application details..." />;
  if (error || !application) return <ErrorState message={error || 'Application not found'} onRetry={fetchApplicationDetails} />;

  const isAuthorityUser = user?.role === 'COMPETENT_AUTHORITY' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/applications" className="hover:text-slate-800">Applications</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="font-mono text-slate-800 font-semibold">{application.application_number}</span>
      </div>

      {/* Top Banner & Action Gate */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 font-mono tracking-tight">
                {application.application_number}
              </h1>
              <StatusPill status={application.status} isEscalated={application.is_escalated} />
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                AY {application.academic_year}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-900">{application.institution?.name}</span>
              <span>•</span>
              <span>AICTE ID: <strong>{application.institution?.aicte_id}</strong></span>
              <span>•</span>
              <span>{application.institution?.state} ({application.institution?.region} Directorate)</span>
            </div>
          </div>

          {/* Persistent Non-Negotiable Rule #2 Badge */}
          <div className="shrink-0">
            <HumanOversightBadge size="sm" />
          </div>
        </div>

        {/* Dynamic Workflow Transition Actions (Rule #3: Read from DB) */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Current Assigned Stage:</span>
            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-medium border border-blue-200">
              {application.current_stage?.name || application.status}
            </span>
            {application.sla_deadline && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500 ml-2">
                <Clock className="w-3.5 h-3.5" />
                SLA: {new Date(application.sla_deadline).toLocaleDateString()} ({application.current_stage?.sla_hours || 72}h window)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {allowedActions.length === 0 ? (
              <span className="text-xs text-slate-400 italic">
                No next actions for your current role ({user?.role}).
              </span>
            ) : (
              allowedActions.map((route) => (
                <button
                  key={route.id}
                  onClick={() => handleTransition(route)}
                  disabled={transitioning}
                  className="px-3.5 py-1.5 bg-[#0B2240] hover:bg-[#07172C] disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  {route.action_name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-2 bg-white px-4 rounded-t-xl">
        {[
          { key: 'overview', label: 'Overview & Programs', icon: Building2 },
          { key: 'compliance', label: `APH Compliance & Norms (${application.compliance_score}%)`, icon: CheckSquare },
          { key: 'documents', label: `Documents (${application.documents?.length || 0})`, icon: FileText },
          { key: 'evc', label: 'EVC Physical Inspection', icon: Users },
          { key: 'decision', label: 'Competent Authority Decision', icon: Award, highlight: true },
          { key: 'undertakings', label: `Undertakings (${application.undertakings?.length || 0})`, icon: FileCheck2 },
          { key: 'audit', label: 'Immutable Audit Trail', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-3 px-3 text-xs font-medium border-b-2 whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
                isActive
                  ? 'border-[#0B2240] text-[#0B2240] font-bold'
                  : tab.highlight
                  ? 'border-transparent text-amber-700 hover:text-amber-900 bg-amber-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 ${tab.highlight ? 'text-amber-600' : ''}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="bg-white p-6 rounded-b-xl border border-slate-200 border-t-0 shadow-2xs">
        {/* TAB 1: OVERVIEW & PROGRAMS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                Institutional Infrastructure Baseline
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">Total Campus Land</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {application.institution?.total_land_acres} Acres
                  </span>
                  <span className="text-[10px] text-slate-400">Norm: ≥ 5.0 Acres</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">Built-up Instructional Area</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {application.institution?.total_builtup_sqm} Sqm
                  </span>
                  <span className="text-[10px] text-slate-400">Instructional & Admin</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">Computer Terminals</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {application.institution?.total_computers} PCs
                  </span>
                  <span className="text-[10px] text-slate-400">LAN connected</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-slate-500 block">Broadband Internet</span>
                  <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                    {application.institution?.broadband_bandwidth_mbps} Mbps
                  </span>
                  <span className="text-[10px] text-slate-400">Dedicated lease line</span>
                </div>
              </div>
            </div>

            {/* Academic Programs Table */}
            <div>
              <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Academic Programs & Faculty Cadre Adherence
              </h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Program Name</th>
                      <th className="py-2.5 px-3">Level</th>
                      <th className="py-2.5 px-3">Prev Intake</th>
                      <th className="py-2.5 px-3">Requested Intake</th>
                      <th className="py-2.5 px-3">Total Enrolled</th>
                      <th className="py-2.5 px-3">Faculty Count</th>
                      <th className="py-2.5 px-3">Computed FSR</th>
                      <th className="py-2.5 px-3">Cadre Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {application.programs?.map((prog) => {
                      const fsr = roundVal(prog.total_enrolled / Math.max(prog.faculty_count, 1));
                      const isFsrGood = fsr <= 15.0;
                      return (
                        <tr key={prog.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{prog.program_name}</td>
                          <td className="py-2.5 px-3 text-slate-600">{prog.level}</td>
                          <td className="py-2.5 px-3 text-slate-600">{prog.approved_intake_prev_year}</td>
                          <td className="py-2.5 px-3 font-bold text-blue-700">{prog.requested_intake}</td>
                          <td className="py-2.5 px-3 text-slate-700">{prog.total_enrolled}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">{prog.faculty_count}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                isFsrGood ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              1:{fsr}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{prog.cadre_ratio}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AUTOMATED COMPLIANCE & APH NORMS */}
        {activeTab === 'compliance' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-slate-900">AICTE Approval Process Handbook (APH) Compliance</h3>
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                    Score: {application.compliance_score}%
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Automated norms audit checking FSR, Land, Built-up area, Computing facilities, and Statutory Committees.
                </p>
              </div>

              <button
                onClick={handleRunCompliance}
                disabled={evaluatingCompliance}
                className="px-4 py-2 bg-[#0B2240] hover:bg-[#07172C] disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow-2xs flex items-center gap-2 transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${evaluatingCompliance ? 'animate-spin' : ''}`} />
                Re-evaluate Compliance Now
              </button>
            </div>

            {complianceMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {complianceMessage}
              </div>
            )}

            {/* Flagged Deficiencies Section */}
            <div>
              <h4 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Flagged Deficiencies ({application.deficiencies?.length || 0})
              </h4>
              {application.deficiencies?.length === 0 ? (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  All evaluated AICTE APH norms are compliant. Zero critical deficiencies detected.
                </div>
              ) : (
                <div className="space-y-3">
                  {application.deficiencies?.map((def) => (
                    <div
                      key={def.id}
                      className={`p-4 rounded-lg border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        def.is_rectified
                          ? 'bg-slate-50 border-slate-200'
                          : def.severity === 'CRITICAL'
                          ? 'bg-red-50/70 border-red-300'
                          : 'bg-amber-50/70 border-amber-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              def.severity === 'CRITICAL' ? 'bg-red-200 text-red-900' : 'bg-amber-200 text-amber-900'
                            }`}
                          >
                            {def.severity}
                          </span>
                          <span className="font-bold text-slate-900">{def.title}</span>
                          {def.is_rectified && (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              RECTIFIED
                            </span>
                          )}
                        </div>
                        <p className="text-slate-700 mt-1">{def.description}</p>
                        {def.rectification_proof && (
                          <div className="mt-2 p-2 bg-white/80 rounded border border-slate-200 text-slate-600">
                            <strong>Submitted Proof:</strong> {def.rectification_proof}
                          </div>
                        )}
                      </div>

                      {!def.is_rectified && (user?.role === 'INSTITUTION' || user?.role === 'ADMIN') && (
                        <div>
                          {rectifyingDefId === def.id ? (
                            <div className="space-y-2 w-72">
                              <textarea
                                value={rectificationProof}
                                onChange={(e) => setRectificationProof(e.target.value)}
                                placeholder="Explain rectification actions and reference uploaded proofs..."
                                className="w-full p-2 border border-slate-300 rounded text-xs"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSubmitRectification(def.id)}
                                  className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-semibold"
                                >
                                  Submit Proof
                                </button>
                                <button
                                  onClick={() => setRectifyingDefId(null)}
                                  className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRectifyingDefId(def.id)}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow-2xs cursor-pointer whitespace-nowrap"
                            >
                              Submit Rectification Proof
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DOCUMENT SCRUTINY WORKSPACE */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                Submitted Mandatory Affidavits & Legal Evidence
              </h3>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Document Type</th>
                      <th className="py-2.5 px-3">File Name</th>
                      <th className="py-2.5 px-3">Uploaded At</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Scrutiny Remarks</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {application.documents?.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{doc.doc_type}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{doc.file_name}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              doc.status === 'VERIFIED_COMPLIANT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : doc.status === 'DEFICIENT_REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {doc.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{doc.verification_remarks || 'Pending verification'}</td>
                        <td className="py-2.5 px-3 text-right">
                          {(user?.role === 'SCRUTINY_OFFICER' || user?.role === 'ADMIN') && (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleVerifyDocument(doc.id, 'VERIFIED_COMPLIANT')}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold cursor-pointer"
                              >
                                Mark Compliant
                              </button>
                              <button
                                onClick={() => handleVerifyDocument(doc.id, 'DEFICIENT_REJECTED')}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold cursor-pointer"
                              >
                                Flag Deficient
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Scrutiny Committee Assessment Submission */}
            {(user?.role === 'SCRUTINY_OFFICER' || user?.role === 'ADMIN') && (
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                <h4 className="font-bold text-xs text-blue-900 uppercase tracking-wider">
                  Scrutiny Committee Findings & Recommendation
                </h4>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Formal Committee Scrutiny Remarks:
                  </label>
                  <textarea
                    value={scrutinyRemarks}
                    onChange={(e) => setScrutinyRemarks(e.target.value)}
                    placeholder="Enter document verification findings, deficiency notes, or compliance clearance..."
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-700">Recommendation:</label>
                    <select
                      value={scrutinyRec}
                      onChange={(e) => setScrutinyRec(e.target.value)}
                      className="p-1.5 bg-white border border-slate-300 rounded text-xs font-semibold"
                    >
                      <option value="RECOMMEND_EVC">Clear Documents & Recommend for EVC Inspection</option>
                      <option value="ISSUE_DEFICIENCY">Issue Formal Scrutiny Deficiency Notice</option>
                      <option value="REFER_SHC">Refer directly to Standing Hearing Committee</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSubmitScrutiny}
                    className="px-4 py-2 bg-[#0B2240] hover:bg-[#07172C] text-white rounded text-xs font-semibold shadow-2xs"
                  >
                    Submit Scrutiny Report
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: EVC PHYSICAL INSPECTION */}
        {activeTab === 'evc' && (
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h3 className="font-bold text-sm text-slate-900">Expert Visit Committee (EVC) Physical Report</h3>
              <p className="text-xs text-slate-600">
                Status: <strong>{application.evc_recommendation || 'Inspection Pending / In Progress'}</strong>
              </p>
              {application.evc_remarks && (
                <div className="p-3 bg-white rounded border border-slate-200 text-xs text-slate-800">
                  <strong>Inspection Observations:</strong> {application.evc_remarks}
                </div>
              )}
            </div>

            {/* EVC Inspector Action Panel */}
            {(user?.role === 'EVC_INSPECTOR' || user?.role === 'ADMIN') && (
              <div className="p-5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-4">
                <h4 className="font-bold text-xs text-indigo-900 uppercase tracking-wider">
                  Submit EVC Physical Verification & Lab Evaluation
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 p-3 bg-white rounded-lg border border-indigo-200 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evcInfra}
                      onChange={(e) => setEvcInfra(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    Campus & Land Verified
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-white rounded-lg border border-indigo-200 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evcFaculty}
                      onChange={(e) => setEvcFaculty(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    Faculty Physically Present
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-white rounded-lg border border-indigo-200 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evcLabs}
                      onChange={(e) => setEvcLabs(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    Computer Labs Functional
                  </label>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    EVC Chairman Inspection Notes:
                  </label>
                  <textarea
                    value={evcNotes}
                    onChange={(e) => setEvcNotes(e.target.value)}
                    placeholder="Record geotagged site verification observations, equipment adequacy, and deficiencies..."
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-700">Recommendation:</label>
                    <select
                      value={evcRec}
                      onChange={(e) => setEvcRec(e.target.value)}
                      className="p-1.5 bg-white border border-slate-300 rounded text-xs font-semibold"
                    >
                      <option value="RECOMMENDED">RECOMMENDED for Approval (EoA)</option>
                      <option value="DEFICIENT_HEARING">DEFICIENT - Refer to Standing Hearing Committee</option>
                      <option value="NOT_RECOMMENDED">NOT RECOMMENDED (Critical Infrastructure Missing)</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSubmitEVC}
                    className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-semibold shadow-2xs"
                  >
                    Submit EVC Inspection Report
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: COMPETENT AUTHORITY FINAL DECISION PANEL (CRITICAL RULE #2) */}
        {activeTab === 'decision' && (
          <div className="space-y-6">
            {/* Prominent Rule #2 Banner */}
            <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl human-oversight-pulse space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-sm uppercase">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                  Statutory Rule #2: Human Oversight Mandate
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-xs font-bold">
                  Human Sign-Off Required
                </span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                By AICTE statutory regulation, this system <strong>NEVER auto-approves or auto-rejects</strong> an application. All automated compliance scores and scrutiny reports are decision-support indicators. The final verdict can only be rendered by an authorized human Competent Authority member after explicit verification of the statutory checklist below.
              </p>
            </div>

            {/* Check if already decided */}
            {application.decision_verdict ? (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {application.decision_verdict === 'APPROVED' ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    ) : application.decision_verdict === 'APPROVED_WITH_CONDITIONS' ? (
                      <Award className="w-6 h-6 text-teal-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-rose-600" />
                    )}
                    <div>
                      <h4 className="text-base font-bold text-slate-900">
                        Final Verdict Issued: {application.decision_verdict}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Decided on {application.decision_date ? new Date(application.decision_date).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {application.approval_letter_number && (
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">EoA Order Number</span>
                      <div className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                        {application.approval_letter_number}
                      </div>
                    </div>
                  )}
                </div>

                {/* Digital Signature & Speaking Order Box */}
                <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700">Official Decision Justification / Speaking Order:</span>
                    <p className="mt-1 text-slate-800 leading-relaxed">{application.decision_notes}</p>
                  </div>
                  {application.digital_signature_hash && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-500 font-mono text-[11px]">
                      <span>Digital Signature Hash (SHA-256):</span>
                      <span className="text-slate-700 truncate max-w-md">{application.digital_signature_hash}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Decision Entry Form for Competent Authority */
              <div className="p-6 bg-white border border-slate-200 rounded-xl space-y-5">
                <h3 className="font-bold text-sm text-slate-900">Competent Authority Evaluation Workspace</h3>

                {!isAuthorityUser && (
                  <div className="p-3 bg-slate-100 text-slate-700 rounded-lg text-xs flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-500" />
                    You are currently viewing as <strong>{user?.role}</strong>. To test issuing this decision, switch role to <strong>Competent Authority</strong> using the Demo Switcher in the top right header!
                  </div>
                )}

                {/* Mandatory Checklist */}
                <div className="space-y-2 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wider mb-2">
                    Mandatory Competent Authority Verification Checklist
                  </h4>
                  <label className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.scrutiny_verified}
                      onChange={(e) => setChecklist({ ...checklist, scrutiny_verified: e.target.checked })}
                      className="rounded text-[#0B2240]"
                    />
                    I have reviewed and verified the Scrutiny Committee legal document clearances.
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.evc_infra_verified}
                      onChange={(e) => setChecklist({ ...checklist, evc_infra_verified: e.target.checked })}
                      className="rounded text-[#0B2240]"
                    />
                    I have reviewed the EVC physical inspection findings and verified adequate laboratory equipment.
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.aph_norms_checked}
                      onChange={(e) => setChecklist({ ...checklist, aph_norms_checked: e.target.checked })}
                      className="rounded text-[#0B2240]"
                    />
                    I have checked the AICTE Approval Process Handbook norm calculations (FSR, Land, Built-up area).
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checklist.vigilance_cleared}
                      onChange={(e) => setChecklist({ ...checklist, vigilance_cleared: e.target.checked })}
                      className="rounded text-[#0B2240]"
                    />
                    Vigilance, disciplinary record, and statutory fee payments are confirmed clear.
                  </label>
                </div>

                {/* Verdict Selection */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-2">Select Final Verdict:</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label
                      className={`p-3 rounded-lg border text-xs font-semibold cursor-pointer flex items-center gap-2 ${
                        verdict === 'APPROVED' ? 'bg-emerald-50 border-emerald-400 text-emerald-900' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="verdict"
                        value="APPROVED"
                        checked={verdict === 'APPROVED'}
                        onChange={() => setVerdict('APPROVED')}
                      />
                      Grant Unconditional EoA Approval
                    </label>

                    <label
                      className={`p-3 rounded-lg border text-xs font-semibold cursor-pointer flex items-center gap-2 ${
                        verdict === 'APPROVED_WITH_CONDITIONS' ? 'bg-teal-50 border-teal-400 text-teal-900' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="verdict"
                        value="APPROVED_WITH_CONDITIONS"
                        checked={verdict === 'APPROVED_WITH_CONDITIONS'}
                        onChange={() => setVerdict('APPROVED_WITH_CONDITIONS')}
                      />
                      Conditional Approval (Undertakings Monitored)
                    </label>

                    <label
                      className={`p-3 rounded-lg border text-xs font-semibold cursor-pointer flex items-center gap-2 ${
                        verdict === 'REJECTED' ? 'bg-rose-50 border-rose-400 text-rose-900' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="verdict"
                        value="REJECTED"
                        checked={verdict === 'REJECTED'}
                        onChange={() => setVerdict('REJECTED')}
                      />
                      Refuse Approval (Issue Speaking Order)
                    </label>
                  </div>
                </div>

                {/* Decision Notes */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Formal Speaking Order Justification & Conditions:
                  </label>
                  <textarea
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    placeholder="Enter the official speaking order rationale signed off by Member Secretary / Competent Authority..."
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-[#0B2240]"
                    rows={4}
                  />
                </div>

                {decisionError && (
                  <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    {decisionError}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleAuthorityDecision}
                    disabled={submittingDecision || !isAuthorityUser}
                    className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Award className="w-4 h-4" />
                    {submittingDecision ? 'Signing & Recording Decision...' : 'Record Human Authority Verdict'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 6: UNDERTAKINGS */}
        {activeTab === 'undertakings' && (
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-slate-500" />
              Post-Approval Time-Bound Commitments
            </h3>
            {application.undertakings?.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
                No active undertakings imposed for this application.
              </div>
            ) : (
              <div className="space-y-3">
                {application.undertakings?.map((u) => (
                  <div key={u.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{u.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.status === 'COMPLIANT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : u.status === 'BREACHED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {u.status}
                      </span>
                    </div>
                    <p className="text-slate-600">{u.description}</p>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3">
                      <span>Category: <strong>{u.category}</strong></span>
                      <span>Due Date: <strong>{new Date(u.due_date).toLocaleDateString()}</strong></span>
                    </div>
                    {u.submission_evidence && (
                      <div className="p-2 bg-white rounded border border-slate-200 text-slate-700">
                        <strong>Evidence:</strong> {u.submission_evidence}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 7: IMMUTABLE AUDIT TRAIL (CRITICAL RULE #1) */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  Application Lifecycle Audit History
                </h3>
                <p className="text-xs text-slate-500">
                  Non-Negotiable Rule #1: Every state change, inspection, report, and decision is cryptographically logged.
                </p>
              </div>
              <Link
                to="/audit"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
              >
                Global Audit Explorer <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {application.stage_history?.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
                  No stage transitions recorded yet.
                </div>
              ) : (
                application.stage_history?.map((h) => (
                  <div key={h.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-start justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{h.action_taken}</div>
                      <p className="text-slate-600 mt-0.5">{h.remarks || 'No remarks provided'}</p>
                    </div>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(h.created_at).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function roundVal(num: number): number {
  return Math.round(num * 10) / 10;
}
