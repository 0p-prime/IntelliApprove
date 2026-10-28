import React from 'react';
import {
  CheckCircle2,
  Clock,
  Circle,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Building2,
  FileSearch,
  Users,
  Scale,
  Award,
  XCircle,
  RotateCcw
} from 'lucide-react';
import { TimelineData } from '../types';

interface VisualStageStepperProps {
  timeline: TimelineData | null;
  currentStage: string;
  status: string;
  onRefresh?: () => void;
}

export const VisualStageStepper: React.FC<VisualStageStepperProps> = ({
  timeline,
  currentStage,
  status
}) => {
  if (!timeline) {
    return (
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 animate-pulse text-xs text-slate-400">
        Loading route workflow sequence...
      </div>
    );
  }

  const { stages, history, template_name } = timeline;

  const stageIcons: Record<string, React.ElementType> = {
    SUBMITTED: Building2,
    SCRUTINY: FileSearch,
    EVC: Users,
    SAC_SHC: Scale,
    BUREAU_DECISION: Award,
    APPROVED: ShieldCheck,
    REJECTED: XCircle,
  };

  const stageLabels: Record<string, string> = {
    SUBMITTED: '1. Submission',
    SCRUTINY: '2. Scrutiny',
    EVC: '3. EVC Inspection',
    SAC_SHC: '4. SAC / SHC Hearing',
    BUREAU_DECISION: '5. Bureau Decision',
    APPROVED: 'Approved (EoA)',
    REJECTED: 'Rejected',
  };

  // Build sequential list of stages in route (filter out terminal approved/rejected from sequence steps)
  const routeStages = stages.filter((s) => s !== 'APPROVED' && s !== 'REJECTED');
  
  // Find current active index
  const normalizedCurrent = (currentStage || '').toUpperCase();
  const isTerminalApproved = status === 'APPROVED' || normalizedCurrent === 'APPROVED';
  const isTerminalRejected = status === 'REJECTED' || normalizedCurrent === 'REJECTED';
  const isReturned = status === 'RETURNED';

  const currentIndex = routeStages.indexOf(normalizedCurrent);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
      {/* Route Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Approval Route Template:
          </span>
          <span className="text-xs font-extrabold text-[#0B2240] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full font-mono">
            {template_name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {isReturned && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-300 flex items-center gap-1">
              <RotateCcw className="w-3 h-3 text-amber-700" />
              Returned for Clarification
            </span>
          )}
          {isTerminalApproved && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold border border-emerald-300 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              Final Decision: APPROVED
            </span>
          )}
          {isTerminalRejected && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-900 font-bold border border-red-300 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-red-700" />
              Final Decision: REJECTED
            </span>
          )}
        </div>
      </div>

      {/* Stepper Timeline Progression */}
      <div className="relative pt-2 pb-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {routeStages.map((stageKey, idx) => {
            const Icon = stageIcons[stageKey] || Circle;
            const isCompleted =
              isTerminalApproved ||
              isTerminalRejected ||
              (currentIndex > -1 && idx < currentIndex);
            const isCurrent =
              !isTerminalApproved && !isTerminalRejected && idx === currentIndex;
            const isUpcoming = idx > currentIndex && currentIndex > -1;

            // Find history entry for this stage
            const stageHist = history
              .filter((h) => h.stage === stageKey)
              .slice(-1)[0];

            return (
              <div
                key={stageKey}
                className={`relative rounded-xl p-3 border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-300/40 shadow-xs'
                    : isCompleted
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-slate-50/60 border-slate-200 text-slate-400'
                }`}
              >
                {/* Stage Header */}
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? 'bg-amber-500 text-white shadow-xs animate-pulse'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      isCurrent
                        ? 'bg-amber-200/80 text-amber-900 font-extrabold'
                        : isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isCurrent ? 'Active Stage' : isCompleted ? 'Completed' : 'Upcoming'}
                  </span>
                </div>

                {/* Stage Name */}
                <div>
                  <div
                    className={`text-xs font-bold leading-tight ${
                      isCurrent
                        ? 'text-amber-950 font-extrabold'
                        : isCompleted
                        ? 'text-slate-900'
                        : 'text-slate-500'
                    }`}
                  >
                    {stageLabels[stageKey] || stageKey}
                  </div>

                  {/* Stage Context / History metadata */}
                  {stageHist ? (
                    <div className="mt-1.5 text-[10px] text-slate-500 space-y-0.5">
                      <div className="truncate font-medium text-slate-700">
                        {stageHist.officer_name || 'System / Desk'}
                      </div>
                      {stageHist.completed_at ? (
                        <div className="text-[9px] text-slate-400">
                          {new Date(stageHist.completed_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      ) : stageHist.entered_at ? (
                        <div className="text-[9px] text-amber-700 font-semibold">
                          Entered: {new Date(stageHist.entered_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-1.5 text-[10px] text-slate-400 italic">
                      Pending arrival
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Terminal Decision Card */}
          <div
            className={`rounded-xl p-3 border flex flex-col justify-between ${
              isTerminalApproved
                ? 'bg-emerald-100/60 border-emerald-400 ring-2 ring-emerald-300 shadow-xs'
                : isTerminalRejected
                ? 'bg-red-100/60 border-red-400 ring-2 ring-red-300 shadow-xs'
                : 'bg-slate-50/60 border-slate-200 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isTerminalApproved
                    ? 'bg-emerald-700 text-white'
                    : isTerminalRejected
                    ? 'bg-red-700 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <Award className="w-4 h-4" />
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  isTerminalApproved
                    ? 'bg-emerald-200 text-emerald-900'
                    : isTerminalRejected
                    ? 'bg-red-200 text-red-900'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                Final Gate
              </span>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-900 leading-tight">
                {isTerminalApproved
                  ? 'Extension Granted'
                  : isTerminalRejected
                  ? 'Application Refused'
                  : 'Authority Verdict'}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                {isTerminalApproved
                  ? 'EoA Letter Issued'
                  : isTerminalRejected
                  ? 'Deficiencies Not Rectified'
                  : 'Awaiting Bureau Review'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

