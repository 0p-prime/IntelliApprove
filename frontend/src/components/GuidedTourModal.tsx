import React, { useState } from 'react';
import {
  ShieldCheck,
  GitBranch,
  AlertTriangle,
  Users,
  FileCheck2,
  FolderClosed,
  History,
  Clock,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Compass,
  CheckCircle2
} from 'lucide-react';

export interface TourStep {
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  description: string;
  keyPoints: string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to IntelliApprove',
    subtitle: 'AICTE Regulatory Workflow & Compliance Automation Platform',
    badge: 'SIH 2026 PS 26262',
    icon: Compass,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-900',
    description:
      'IntelliApprove automates, monitors, and enforces regulatory compliance across all technical and management institutions in India, strictly respecting AICTE Chapter I & II Approval Process Handbook (APH) norms.',
    keyPoints: [
      'Comprehensive pipeline covering 150+ seeded institutions and applications',
      'Unified tracking across 8 AICTE Regional Directorates',
      'Dual-language interface with instant English / Hindi toggle'
    ]
  },
  {
    title: 'Role-Based Access Control (RBAC)',
    subtitle: 'Multi-Role Scoping & Quick Persona Switcher for Evaluation',
    badge: 'Non-Negotiable Rule #5',
    icon: ShieldCheck,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-800',
    description:
      'Every transaction is strictly scoped by administrative persona. Institutions only access their own files; Regional Officers oversee their jurisdiction; Bureau Officers govern nationwide approvals.',
    keyPoints: [
      'Judges can use the "Switch Role" dropdown in the top bar to test data scoping on the fly',
      '6 distinct personas: Admin, Bureau Officer, Regional Head, Regional Officer, EVC Member, Institution',
      'Login rate limiting and 7-day refresh token rotation'
    ]
  },
  {
    title: 'Approval Workflow Engine',
    subtitle: '5 Configurable Route Templates with Strict Human Oversight Gate',
    badge: 'Non-Negotiable Rule #2 & #3',
    icon: GitBranch,
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-800',
    description:
      'Applications automatically transition through dynamic route templates. In compliance with Non-Negotiable Rule #2, the system NEVER auto-approves or auto-rejects cases; all final decisions require authorized human sign-off with speaking remarks.',
    keyPoints: [
      'Dynamic templates: Scrutiny Only, Scrutiny + EVC, EVC + SAC/SHC, EVC Only, Full 5-Stage Route',
      'Mandatory-reason return/revert flow for deficiency clarifications with status "RETURNED"',
      'Automated Electronic Case Summary (ECS) generation marked "Draft for official review"'
    ]
  },
  {
    title: 'Explainable Delay Risk Score',
    subtitle: 'Transparent 5-Factor Predictive Bottleneck Analysis',
    badge: 'Differentiating Feature #1',
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-800',
    description:
      'Predicts pendency risk using an explainable 0–100 weighted formula rather than an opaque black box. Clicking any risk badge opens a transparent breakdown of contributing factors.',
    keyPoints: [
      'Weighted Formula: 30% Ageing vs SLA + 20% Regional Benchmark + 20% Officer Workload + 15% Returns + 15% New Institution Flag',
      'Identifies primary delay driver (e.g. Officer Workload Congestion)',
      'High-risk cases dashboard widget prioritizing cases nearing regulatory breach'
    ]
  },
  {
    title: 'Expert Visit Committee (EVC) Module',
    subtitle: 'Physical Campus Inspections with Priority Scheduling',
    badge: 'Field Inspection Engine',
    icon: Users,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-800',
    description:
      'Automatically creates queued inspection records when preliminary scrutiny completes. Prioritizes new institutions with shorter turnaround windows.',
    keyPoints: [
      'Interactive 3-tab interface: Inspection Queue, Interactive Monthly Calendar, and Overdue Escalations',
      'Committee member picker with multi-expert pool assignment',
      'On inspection report submission, automatically advances the case to the next route stage'
    ]
  },
  {
    title: 'Undertakings & Cryptographic Proofs',
    subtitle: 'Post-Approval Condition Compliance & Institution Scorecards',
    badge: 'Legal Accountability',
    icon: FileCheck2,
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-800',
    description:
      'Tracks statutory undertakings issued during conditional approvals. Institutions upload evidence proofs with SHA-256 cryptographic hashing to prevent document tampering.',
    keyPoints: [
      'Evidence hashing with SHA-256 registered upon upload',
      'Officer verification and rejection queues requiring mandatory speaking orders',
      'Dynamic Institutional Compliance Scorecards measuring on-time adherence'
    ]
  },
  {
    title: 'Document Validity & Lease OCR Assist',
    subtitle: 'Automated Deed Expiry Monitoring & AI Pre-Fill',
    badge: 'Differentiating Feature #3',
    icon: FolderClosed,
    iconBg: 'bg-cyan-100',
    iconColor: 'text-cyan-800',
    description:
      'Monitors institutional land leases, building safety certificates, and fire NOCs. Upon deed upload, Lease OCR Assist parses tenure clauses to pre-fill expiry dates with human verification confirmation.',
    keyPoints: [
      'Color-coded validity cohorts: 90 Days (Expiring Soon), 30 Days (Critical), and Expired',
      'Lease OCR Assist scans text/images and pre-fills dates with confidence ratings',
      'Human officer verification required before renewal registration'
    ]
  },
  {
    title: 'Cryptographic SHA-256 Audit Trail',
    subtitle: 'Tamper-Evident Merkle-Linked Government Ledger',
    badge: 'Non-Negotiable Rule #1',
    icon: History,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-800',
    description:
      'Every single state change, login, report export, and webhook writes a cryptographically linked block: hash = SHA-256(prev_hash + canonical_json(row)).',
    keyPoints: [
      'Endpoint /audit/verify-chain validates linear hash chain from Genesis block',
      'Interactive side-by-side diff viewer showing old vs new state changes',
      'Tamper detection immediately isolates broken linkages'
    ]
  },
  {
    title: 'Time-Travel Simulator Clock',
    subtitle: 'Simulate Days/Weeks to Test Alerts & Automated Escalations',
    badge: 'Evaluation Tool',
    icon: Clock,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-800',
    description:
      'Judges can fast-forward simulated system time (+7 Days, +30 Days, +90 Days) to witness automated SLA warnings, email notifications, and Level 1 -> Level 2 -> Level 3 escalations.',
    keyPoints: [
      'Accessible anytime via the "Simulated Clock" widget in the top navigation bar',
      'Instantly triggers the automated rules evaluation engine upon time advance',
      'One-click "Reset to Today" button restores real-world clock'
    ]
  },
  {
    title: 'Statutory AI Assistant & Bridge',
    subtitle: 'Role-Scoped Natural Language Queries & Legacy Portal Sync',
    badge: 'Differentiating Feature #2 & #4',
    icon: Sparkles,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-800',
    description:
      'Officers can ask natural-language questions and auto-draft deficiency notices. Connects with the legacy AICTE approval portal via HMAC-SHA256 verified webhooks.',
    keyPoints: [
      'Floating AI Assistant available globally via the sparkles button in the bottom right',
      'Drafts statutory notices clearly watermarked [AI Draft — Requires Official Review]',
      'Bidirectional legacy portal synchronization bridge in /integration'
    ]
  }
];

export const GuidedTourModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState<number>(0);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;
  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Tricolor Header Accent */}
        <div className="tricolor-bar" />

        {/* Modal Top Bar */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#0B2240] text-amber-300 font-mono">
              Guided Tour • Step {currentStep + 1} of {TOUR_STEPS.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              IntelliApprove Walkthrough
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
            title="Exit Tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl ${step.iconBg} ${step.iconColor} shrink-0 shadow-inner`}>
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                {step.badge}
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                {step.title}
              </h3>
              <p className="text-xs font-semibold text-blue-900 mt-0.5">
                {step.subtitle}
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
            {step.description}
          </p>

          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Key Capabilities:
            </div>
            <div className="space-y-1.5">
              {step.keyPoints.map((point, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer with Progress Dots & Action Buttons */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          {/* Progress Indicators */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  i === currentStep
                    ? 'w-6 bg-[#0B2240]'
                    : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
                title={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-1.5 bg-[#0B2240] hover:bg-[#12335C] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <span>{isLast ? 'Complete Tour' : 'Next Step'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

