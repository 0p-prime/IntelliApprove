import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  Building2,
  FileText,
  Clock,
  ShieldCheck,
  AlertCircle,
  FileCheck2,
  Scale
} from 'lucide-react';
import { CaseSummaryData } from '../types';
import { Button } from './ui/Button';

interface CaseSummaryModalProps {
  summary: CaseSummaryData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CaseSummaryModal: React.FC<CaseSummaryModalProps> = ({
  summary,
  isOpen,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !summary) return null;

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(summary.markdown_summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      // ignore
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-in fade-in duration-100">
      <div className="bg-white rounded-[8px] border border-[#E6E6E6] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-white text-[#111111] px-6 py-4 flex items-center justify-between border-b border-[#E6E6E6] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] flex items-center justify-center text-[#111111]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[#111111]">
                  Electronic Case Summary (ECS)
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-[4px] bg-[#F4F4F5] text-[#111111] border border-[#E6E6E6] font-mono">
                  {summary.watermark}
                </span>
              </div>
              <div className="text-[11px] text-[#595959] font-mono mt-0.5">
                Ref No: {summary.ref_no} • Generated: {new Date(summary.generated_at).toLocaleString()}
              </div>
            </div>
          </div>
          <Button variant="quiet" size="icon" aria-label="Close" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-[#111111] bg-white">
          {/* Official Disclaimer Banner */}
          <div className="p-3.5 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#111111] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[#111111] text-xs">
                Official Review Document • Human Decision Gate
              </div>
              <p className="text-[11px] text-[#595959] mt-0.5">
                This case summary is automatically compiled by IntelliApprove from statutory records.
                Final grant or refusal of Extension of Approval is strictly reserved for human competent authorities.
              </p>
            </div>
          </div>

          {/* Section 1: Institution Particulars */}
          <div className="bg-white rounded-[8px] border border-[#E6E6E6] p-4 space-y-3">
            <div className="flex items-center gap-2 font-bold text-[#111111] border-b border-[#E6E6E6] pb-2">
              <Building2 className="w-4 h-4 text-[#111111]" />
              <span>1. Institution Profile</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[#595959] text-[10px] uppercase font-bold block">Institution Name</span>
                <span className="font-semibold text-[#111111]">{summary.institution.name}</span>
              </div>
              <div>
                <span className="text-[#595959] text-[10px] uppercase font-bold block">Permanent ID</span>
                <span className="font-mono font-semibold text-[#111111]">{summary.institution.aicte_id}</span>
              </div>
              <div>
                <span className="text-[#595959] text-[10px] uppercase font-bold block">Discipline / Stream</span>
                <span className="font-semibold text-[#111111]">{summary.institution.type}</span>
              </div>
              <div>
                <span className="text-[#595959] text-[10px] uppercase font-bold block">Jurisdiction & Region</span>
                <span className="text-[#111111]">
                  {summary.institution.state} ({summary.institution.region} Region)
                </span>
              </div>
              <div>
                <span className="text-[#595959] text-[10px] uppercase font-bold block">Campus Status</span>
                <span className="text-[#111111]">
                  {summary.institution.is_new ? 'Newly Established Campus' : 'Existing Operating Campus'}
                </span>
              </div>
              <div>
                <span className="text-[#595959] text-[10px] uppercase font-bold block">Nodal Contact</span>
                <span className="font-mono text-[#111111]">{summary.institution.contact_email}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Prescribed Approval Route */}
          <div className="bg-white rounded-[8px] border border-[#E6E6E6] p-4 space-y-3">
            <div className="flex items-center gap-2 font-bold text-[#111111] border-b border-[#E6E6E6] pb-2">
              <Scale className="w-4 h-4 text-[#111111]" />
              <span>2. Prescribed Approval Route & Current Status</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[#595959] text-[10px] uppercase font-bold block">Route Template</span>
                <span className="font-bold text-[#111111] text-xs font-mono">
                  {summary.workflow_route.template_name}
                </span>
              </div>
              <div>
                <span className="text-[#595959] text-[10px] uppercase font-bold block">Current Stage</span>
                <span className="font-bold text-[#111111]">{summary.workflow_route.current_stage}</span>
              </div>
              <div>
                <span className="text-[#595959] text-[10px] uppercase font-bold block">Governance Status</span>
                <span className="font-semibold px-2 py-0.5 rounded-[4px] bg-[#F4F4F5] border border-[#E6E6E6] text-[#111111] text-[11px] inline-block mt-0.5">
                  {summary.workflow_route.status}
                </span>
              </div>
            </div>
            <div className="pt-2">
              <span className="text-[#595959] text-[10px] uppercase font-bold block mb-1">Defined Stage Sequence</span>
              <div className="flex items-center gap-1.5 flex-wrap text-xs font-medium">
                {summary.workflow_route.stages.map((st, i) => (
                  <React.Fragment key={st}>
                    <span
                      className={`px-2 py-0.5 rounded-[4px] font-mono text-[11px] ${
                        st === summary.workflow_route.current_stage
                          ? 'bg-[#18181B] text-white font-bold'
                          : 'bg-[#F4F4F5] text-[#111111] border border-[#E6E6E6]'
                      }`}
                    >
                      {st}
                    </span>
                    {i < summary.workflow_route.stages.length - 1 && (
                      <span className="text-[#595959] font-bold">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Progression Timeline Table */}
          <div className="bg-white rounded-[8px] border border-[#E6E6E6] p-4 space-y-3">
            <div className="flex items-center gap-2 font-bold text-[#111111] border-b border-[#E6E6E6] pb-2">
              <Clock className="w-4 h-4 text-[#111111]" />
              <span>3. Stage Progression Timeline</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-[#E6E6E6]">
                <thead className="bg-[#F4F4F5] text-[#595959] font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Stage</th>
                    <th className="py-2 px-3">Action</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Officer</th>
                    <th className="py-2 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E6]">
                  {summary.stage_timeline.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#FAFAFA]">
                      <td className="py-2 px-3 font-bold text-[#111111]">{item.stage}</td>
                      <td className="py-2 px-3 text-[#111111]">{item.action}</td>
                      <td className="py-2 px-3 text-[#595959] font-mono text-[11px]">
                        {item.entered_at ? new Date(item.entered_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2 px-3 text-[#111111] font-medium">{item.officer}</td>
                      <td className="py-2 px-3 text-[#595959]">{item.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Observations & Findings */}
          <div className="bg-white rounded-[8px] border border-[#E6E6E6] p-4 space-y-2">
            <div className="flex items-center gap-2 font-bold text-[#111111] border-b border-[#E6E6E6] pb-2">
              <AlertCircle className="w-4 h-4 text-[#111111]" />
              <span>4. Observations & Committee Findings</span>
            </div>
            {summary.observations.length === 0 ? (
              <p className="text-[#595959] text-xs py-1">
                No negative observations or deficiency notices recorded to date.
              </p>
            ) : (
              <div className="space-y-2">
                {summary.observations.map((obs, idx) => (
                  <div key={idx} className="p-2.5 rounded-[8px] bg-[#F4F4F5] border border-[#E6E6E6] text-xs">
                    <span className="font-bold text-[#111111]">[{obs.stage}] {obs.action}: </span>
                    <span className="text-[#111111]">{obs.notes}</span>
                    <div className="text-[10px] text-[#595959] mt-0.5">Recorded by: {obs.officer}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Compliance & Undertakings Status */}
          <div className="bg-white rounded-[8px] border border-[#E6E6E6] p-4 space-y-3">
            <div className="flex items-center gap-2 font-bold text-[#111111] border-b border-[#E6E6E6] pb-2">
              <FileCheck2 className="w-4 h-4 text-[#111111]" />
              <span>5. Statutory Undertakings & Documents</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px]">
                <span className="text-[#595959] text-[10px] block">Total Undertakings</span>
                <span className="text-base font-bold text-[#111111]">{summary.pending_items.undertakings_total}</span>
              </div>
              <div className="p-2.5 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px]">
                <span className="text-[#595959] text-[10px] block">Pending Verification</span>
                <span className="text-base font-bold text-[#111111]">{summary.pending_items.undertakings_pending}</span>
              </div>
              <div className="p-2.5 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px]">
                <span className="text-[#595959] text-[10px] block">Total Documents</span>
                <span className="text-base font-bold text-[#111111]">{summary.pending_items.documents_total}</span>
              </div>
              <div className="p-2.5 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px]">
                <span className="text-[#595959] text-[10px] block">Pending Documents</span>
                <span className="text-base font-bold text-[#111111]">{summary.pending_items.documents_pending}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-white border-t border-[#E6E6E6] px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-[#595959]">
            Generated by IntelliApprove
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleCopyMarkdown}>
              {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Download className="w-3.5 h-3.5 mr-1 text-white" />Download report
            </Button>
            <Button size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
