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
  size = 'md',
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'DRAFT':
        return {
          label: 'Draft Application',
          className: 'bg-[#F4F4F5] text-[#595959] border-[#E6E6E6]',
          icon: FileEdit,
        };
      case 'UNDER_SCRUTINY':
      case 'SCRUTINY':
        return {
          label: 'Document Scrutiny',
          className: 'bg-[#F4F4F5] text-[#18181B] border-[#E6E6E6]',
          icon: Clock,
        };
      case 'SCRUTINY_DEFICIENT':
        return {
          label: 'Deficiency Rectification',
          className: 'bg-[#F4F4F5] text-[#18181B] border-[#E6E6E6]',
          icon: AlertTriangle,
        };
      case 'EVC_SCHEDULED':
      case 'EVC_COMPLETED':
      case 'EVC':
        return {
          label: 'EVC Inspection',
          className: 'bg-[#F4F4F5] text-[#18181B] border-[#E6E6E6]',
          icon: Users,
        };
      case 'SHC_REVIEW':
      case 'SAC_SHC':
        return {
          label: 'Hearing Committee (SHC)',
          className: 'bg-[#F4F4F5] text-[#18181B] border-[#E6E6E6]',
          icon: Clock,
        };
      case 'PENDING_AUTHORITY_DECISION':
      case 'BUREAU_DECISION':
        return {
          label: 'Awaiting Authority Verdict',
          className: 'bg-[#F4F4F5] text-[#18181B] border-[#E6E6E6] font-semibold',
          icon: Clock,
        };
      case 'APPROVED':
        return {
          label: 'Approved (EoA Issued)',
          className: 'bg-[#F4F4F5] text-[#18181B] border-[#E6E6E6] font-medium',
          icon: CheckCircle2,
        };
      case 'APPROVED_WITH_CONDITIONS':
        return {
          label: 'Conditional Approval',
          className: 'bg-[#F4F4F5] text-[#18181B] border-[#E6E6E6]',
          icon: Award,
        };
      case 'REJECTED':
        return {
          label: 'Refused / Rejected',
          className: 'bg-[#FFFFFF] text-[#B5121A] border-[#E0202A] font-medium',
          icon: XCircle,
        };
      default:
        return {
          label: status.replace(/_/g, ' '),
          className: 'bg-[#F4F4F5] text-[#18181B] border-[#E6E6E6]',
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
        className={`inline-flex items-center gap-1 font-medium rounded-[8px] border ${config.className} ${padding}`}
      >
        <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span>{config.label}</span>
      </span>

      {isEscalated && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-[8px] bg-white text-[#B5121A] border border-[#E0202A]">
          <AlertTriangle className="w-3 h-3 text-[#B5121A]" />
          <span>SLA ESCALATED</span>
        </span>
      )}
    </div>
  );
};
