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
  CheckCircle2,
  Scale
} from 'lucide-react';
import { CaseSummaryData } from '../types';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-100">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="gov-header-gradient text-white px-6 py-4 flex items-center justify-between border-b border-blue-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-300 flex items-center justify-center text-amber-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">
                  Electronic Case Summary (ECS)
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 font-mono shadow-xs">
                  {summary.watermark}
                </span>
              </div>
              <div className="text-[11px] text-blue-200/90 font-mono mt-0.5">
                Ref No: {summary.ref_no} • Generated: {new Date(summary.generated_at).toLocaleString()}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Formatted Summary Document */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700 bg-slate-50/50">
          {/* Official Disclaimer Banner */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-900 text-xs">
                Official AICTE Review Document • Non-Negotiable Human Decision Gate
              </div>
              <p className="text-[11px] text-amber-800 mt-0.5">
                This case summary is automatically compiled by IntelliApprove from statutory database records.
                Final grant or refusal of Extension of Approval (EoA) is strictly reserved for human competent authorities.
              </p>
            </div>
          </div>

          {/* Section 1: Institution Particulars */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-100 pb-2">
              <Building2 className="w-4 h-4 text-blue-900" />
              <span>1. Institution Profile</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Institution Name</span>
                <span className="font-semibold text-slate-900">{summary.institution.name}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">AICTE Permanent ID</span>
                <span className="font-mono font-semibold text-slate-800">{summary.institution.aicte_id}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Discipline / Stream</span>
                <span className="font-semibold text-slate-800">{summary.institution.type}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Jurisdiction & Region</span>
                <span className="text-slate-800">
                  {summary.institution.state} ({summary.institution.region} Region)
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Campus Status</span>
                <span className="text-slate-800">
                  {summary.institution.is_new ? 'Newly Established Campus' : 'Existing Operating Campus'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Nodal Contact</span>
                <span className="font-mono text-slate-700">{summary.institution.contact_email}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Prescribed Approval Route */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-100 pb-2">
              <Scale className="w-4 h-4 text-blue-900" />
              <span>2. Prescribed Approval Route & Current Status</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Route Template</span>
                <span className="font-bold text-[#0B2240] text-xs font-mono">
                  {summary.workflow_route.template_name}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Current Stage</span>
                <span className="font-bold text-slate-900">{summary.workflow_route.current_stage}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Governance Status</span>
                <span className="font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-[11px]">
                  {summary.workflow_route.status}
                </span>
              </div>
            </div>
            <div className="pt-2">
              <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Defined Stage Sequence</span>
              <div className="flex items-center gap-1.5 flex-wrap text-xs font-medium">
                {summary.workflow_route.stages.map((st, i) => (
                  <React.Fragment key={st}>
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                        st === summary.workflow_route.current_stage
                          ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {st}
                    </span>
                    {i < summary.workflow_route.stages.length - 1 && (
                      <span className="text-slate-300 font-bold">→</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Progression Timeline Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-100 pb-2">
              <Clock className="w-4 h-4 text-blue-900" />
              <span>3. Stage Progression Timeline</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-100">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Stage</th>
                    <th className="py-2 px-3">Action</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Officer</th>
                    <th className="py-2 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.stage_timeline.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-bold text-slate-900">{item.stage}</td>
                      <td className="py-2 px-3 text-slate-700">{item.action}</td>
                      <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">
                        {item.entered_at ? new Date(item.entered_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-medium">{item.officer}</td>
                      <td className="py-2 px-3 text-slate-500">{item.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Observations & Deficiencies */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-100 pb-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>4. Observations & Committee Findings</span>
            </div>
            {summary.observations.length === 0 ? (
              <p className="text-slate-400 text-xs italic py-1">
                No negative observations or deficiency notices recorded to date.
              </p>
            ) : (
              <div className="space-y-2">
                {summary.observations.map((obs, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 text-xs">
                    <span className="font-bold text-amber-900">[{obs.stage}] {obs.action}: </span>
                    <span className="text-slate-700">{obs.notes}</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">Recorded by: {obs.officer}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Compliance & Undertakings Status */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-100 pb-2">
              <FileCheck2 className="w-4 h-4 text-emerald-700" />
              <span>5. Statutory Undertakings & Documents</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 text-[10px] block">Total Undertakings</span>
                <span className="text-base font-bold text-slate-900">{summary.pending_items.undertakings_total}</span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-lg">
                <span className="text-amber-800 text-[10px] block">Pending Verification</span>
                <span className="text-base font-bold text-amber-900">{summary.pending_items.undertakings_pending}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-500 text-[10px] block">Total Documents</span>
                <span className="text-base font-bold text-slate-900">{summary.pending_items.documents_total}</span>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-lg">
                <span className="text-blue-800 text-[10px] block">Pending Documents</span>
                <span className="text-base font-bold text-blue-900">{summary.pending_items.documents_pending}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400">
            IntelliApprove Governance Engine • Section A Problem Statement 26262
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
              <span>{copied ? 'Copied Markdown!' : 'Copy Summary'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#0B2240] hover:bg-[#12335C] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

