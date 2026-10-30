import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

interface VisualStageStepperProps {
  timeline?: {
    stages: string[];
    history?: any[];
    template_name?: string;
  } | null;
  currentStage: string;
  status?: string;
  onRefresh?: () => void;
}

export const VisualStageStepper: React.FC<VisualStageStepperProps> = ({
  timeline,
  currentStage,
  status
}) => {
  // Default 5 stages: Submission, Scrutiny, EVC, SAC/SHC, Decision
  const standardStages = [
    { key: 'SUBMISSION', label: 'Submission' },
    { key: 'SCRUTINY', label: 'Scrutiny' },
    { key: 'EVC', label: 'EVC' },
    { key: 'SAC/SHC', label: 'SAC/SHC' },
    { key: 'DECISION', label: 'Decision' },
  ];

  const normalizedCurrent = (currentStage || '').toUpperCase();

  // Determine stage index (0 to 4)
  let activeIndex = 2; // Default to EVC
  if (normalizedCurrent.includes('SUBMIT')) activeIndex = 0;
  else if (normalizedCurrent.includes('SCRUTINY')) activeIndex = 1;
  else if (normalizedCurrent.includes('EVC')) activeIndex = 2;
  else if (normalizedCurrent.includes('SAC') || normalizedCurrent.includes('SHC')) activeIndex = 3;
  else if (normalizedCurrent.includes('DECISION') || normalizedCurrent.includes('BUREAU') || status === 'APPROVED' || status === 'REJECTED') activeIndex = 4;

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Fill to current stage on load in 400ms
    const timer = requestAnimationFrame(() => setLoaded(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const progressPercentage = Math.round((activeIndex / (standardStages.length - 1)) * 100);

  return (
    <div className="w-full">
      {/* Connected continuous progress bar track */}
      <div className="relative w-full h-[3px] bg-[#E6E6E6] rounded-full mb-5 overflow-hidden">
        <div
          className="absolute left-0 top-0 bottom-0 bg-[#E0202A] rounded-full transition-all duration-400 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ width: loaded ? `${progressPercentage}%` : '0%' }}
        />
      </div>

      <div className="grid grid-cols-5 gap-2 sm:gap-6">
        {standardStages.map((stage, idx) => {
          const isDone = idx < activeIndex;
          const isCurrent = idx === activeIndex;
          const isUpcoming = idx > activeIndex;

          return (
            <div key={stage.key} className="flex flex-col items-start relative group">
              {/* Step indicator node */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 ${
                    isCurrent
                      ? 'bg-[#E0202A] text-white animate-pulse-ring'
                      : isDone
                      ? 'bg-[#18181B] text-white'
                      : 'bg-[#F4F4F5] border border-[#E6E6E6] text-[#595959]'
                  }`}
                >
                  {isDone ? (
                    <span className="animate-check-pop">
                      <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                    </span>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                {/* Subtitle badge on active */}
                {isCurrent && (
                  <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#F4F4F5] text-[#18181B] border border-[#E6E6E6]">
                    Active
                  </span>
                )}
              </div>

              {/* Stage Title */}
              <div
                className={`text-xs font-semibold ${
                  isCurrent || isDone ? 'text-[#18181B]' : 'text-[#595959]'
                }`}
              >
                {stage.label}
              </div>

              {/* Status Subtitle: Done, Current, Upcoming */}
              <div
                className={`text-[11px] mt-0.5 ${
                  isCurrent
                    ? 'text-[#B5121A] font-medium'
                    : isDone
                    ? 'text-[#18181B]'
                    : 'text-[#595959]'
                }`}
              >
                {isCurrent ? 'Current' : isDone ? 'Done' : 'Upcoming'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VisualStageStepper;
