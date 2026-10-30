import React, { useState } from 'react';
import { Button } from './ui/Button';
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
  description: string;
  keyPoints: string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to IntelliApprove',
    subtitle: 'Approval Workflow Automation and Compliance Management',
    badge: 'System Walkthrough',
    icon: Compass,
    description:
      'IntelliApprove automates, monitors, and enforces regulatory compliance across all technical and management institutions in India, strictly respecting statutory Approval Process Handbook norms.',
    keyPoints: [
      'Comprehensive pipeline covering 150+ seeded institutions and applications',
      'Unified tracking across 8 Regional Directorates',
      'Dual-language interface with instant English / Hindi toggle'
    ]
  },
  {
    title: 'Role-Based Access Control (RBAC)',
    subtitle: 'Multi-Role Scoping & Quick Persona Switcher for Evaluation',
    badge: 'Strict Governance',
    icon: ShieldCheck,
    description:
      'Every transaction is strictly scoped by administrative persona. Institutions only access their own files; Regional Officers oversee their jurisdiction; Bureau Officers govern nationwide approvals.',
    keyPoints: [
      'Evaluators can use the "Switch Role" menu in the bottom-left sidebar to test data scoping on the fly',
      '6 distinct personas: Admin, Bureau Officer, Regional Head, Regional Officer, EVC Member, Institution',
      'Login rate limiting and 7-day refresh token rotation'
    ]
  },
  {
    title: 'Approval Workflow Engine',
    subtitle: '5 Configurable Route Templates with Strict Human Oversight Gate',
    badge: 'Workflow Integrity',
    icon: GitBranch,
    description:
      'Applications automatically transition through dynamic route templates. In compliance with strict regulations, the system NEVER auto-approves or auto-rejects cases; all final decisions require authorized human sign-off with speaking remarks.',
    keyPoints: [
      'Dynamic templates: Scrutiny Only, Scrutiny + EVC, EVC + SAC/SHC, EVC Only, Full 5-Stage Route',
      'Mandatory-reason return/revert flow for deficiency clarifications with status "RETURNED"',
      'Automated Electronic Case Summary (ECS) generation marked "Draft for official review"'
    ]
  },
  {
    title: 'Explainable Delay Risk Score',
    subtitle: 'Transparent 5-Factor Predictive Bottleneck Analysis',
    badge: 'Predictive Intelligence',
    icon: AlertTriangle,
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
    badge: 'Tenure Vigilance',
    icon: FolderClosed,
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
    badge: 'Audit Transparency',
    icon: History,
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
    description:
      'Evaluators can fast-forward simulated system time (+7 Days, +30 Days, +90 Days) to witness automated SLA warnings, email notifications, and Level 1 -> Level 2 -> Level 3 escalations.',
    keyPoints: [
      'Accessible anytime via the "Sim Time" widget in the top navigation bar',
      'Instantly triggers the automated rules evaluation engine upon time advance',
      'One-click "Reset to Today" button restores real-world clock'
    ]
  },
  {
    title: 'Statutory AI Assistant & Bridge',
    subtitle: 'Role-Scoped Natural Language Queries & Legacy Portal Sync',
    badge: 'Assistant & Bridge',
    icon: Sparkles,
    description:
      'Officers can ask natural-language questions and auto-draft deficiency notices. Connects with external approval databases via verified webhooks.',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-[8px] max-w-xl w-full border border-[#E6E6E6] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 bg-white border-b border-[#E6E6E6] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-[4px] bg-[#18181B] text-white font-mono">
              Step {currentStep + 1} of {TOUR_STEPS.length}
            </span>
            <span className="text-xs text-[#595959] font-medium">
              IntelliApprove Guided Tour
            </span>
          </div>
          <Button variant="quiet" size="icon" aria-label="Close" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-[8px] bg-[#F4F4F5] text-[#111111] border border-[#E6E6E6] shrink-0">
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#111111] bg-[#F4F4F5] px-2 py-0.5 rounded border border-[#E6E6E6]">
                {step.badge}
              </span>
              <h3 className="text-lg font-bold text-[#111111] mt-1">
                {step.title}
              </h3>
              <p className="text-xs font-medium text-[#595959] mt-0.5">
                {step.subtitle}
              </p>
            </div>
          </div>

          <p className="text-xs text-[#111111] leading-relaxed bg-[#F4F4F5] p-3.5 rounded-[8px] border border-[#E6E6E6]">
            {step.description}
          </p>

          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#595959]">
              Key Capabilities:
            </div>
            <div className="space-y-1.5">
              {step.keyPoints.map((point, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-[#111111]">
                  <CheckCircle2 className="w-4 h-4 text-[#111111] shrink-0 mt-0.5" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer with Progress Dots & Action Buttons */}
        <div className="px-6 py-4 bg-[#F4F4F5] border-t border-[#E6E6E6] flex items-center justify-between gap-3">
          {/* Progress Indicators */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentStep(i)}
                aria-label={`Go to tour step ${i + 1}`}
                className={`h-2 rounded-full transition-all cursor-pointer border-0 p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0202A] ${
                  i === currentStep
                    ? 'w-6 bg-[#18181B]'
                    : 'w-2 bg-[#D4D4D8] hover:bg-[#A1A1AA]'
                }`}
              />
            ))}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="secondary" onClick={handlePrev}>Previous</Button>
            )}
            <Button variant="primary" size="sm" onClick={handleNext}>{isLast ? "Complete tour" : "Next"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
