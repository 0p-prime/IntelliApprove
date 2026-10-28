import React from 'react';
import { AlertTriangle, Clock, CheckCircle2, XCircle, FileEdit, Users, Award } from 'lucide-react';

interface StatusPillProps {
  status: string;
  isEscalated?: boolean;
  slaDeadline?: string;
  size?: 'sm' | 'md';
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  isEscalated = false,
  slaDeadline,
  size = 'md',
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'DRAFT':
        return {
          label: 'Draft Application',
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: FileEdit,
        };
      case 'UNDER_SCRUTINY':
        return {
          label: 'Document Scrutiny',
          bg: 'bg-blue-50 text-blue-800 border-blue-200',
          icon: Clock,
        };
      case 'SCRUTINY_DEFICIENT':
        return {
          label: 'Deficiency Rectification',
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: AlertTriangle,
        };
      case 'EVC_SCHEDULED':
      case 'EVC_COMPLETED':
        return {
          label: 'EVC Inspection',
          bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          icon: Users,
        };
      case 'SHC_REVIEW':
        return {
          label: 'Hearing Committee (SHC)',
          bg: 'bg-purple-50 text-purple-800 border-purple-200',
          icon: Clock,
        };
      case 'PENDING_AUTHORITY_DECISION':
        return {
          label: 'Awaiting Authority Verdict',
          bg: 'bg-orange-50 text-orange-900 border-orange-300 font-semibold',
          icon: Clock,
        };
      case 'APPROVED':
        return {
          label: 'Approved (EoA Issued)',
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          icon: CheckCircle2,
        };
      case 'APPROVED_WITH_CONDITIONS':
        return {
          label: 'Conditional Approval',
          bg: 'bg-teal-50 text-teal-800 border-teal-300',
          icon: Award,
        };
      case 'REJECTED':
        return {
          label: 'Refused / Rejected',
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: XCircle,
        };
      default:
        return {
          label: status.replace(/_/g, ' '),
          bg: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: Clock,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        className={`inline-flex items-center gap-1 font-medium rounded-full border shadow-2xs ${config.bg} ${padding}`}
      >
        <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {config.label}
      </span>

      {isEscalated && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-300 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-red-600" />
          SLA ESCALATED
        </span>
      )}
    </div>
  );
};
