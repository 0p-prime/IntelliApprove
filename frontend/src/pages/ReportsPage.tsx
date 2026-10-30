import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  Printer,
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  TrendingUp,
  Clock,
  Eye
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { StatutoryReportData } from '../types';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

interface ReportDefinition {
  id: string;
  title: string;
  subtitle: string;
}

const STATUTORY_REPORTS_LIST: ReportDefinition[] = [
  {
    id: 'application-pendency',
    title: 'Application pendency',
    subtitle: 'By stage, region and ageing'
  },
  {
    id: 'evc-status',
    title: 'EVC status',
    subtitle: 'Queued, scheduled, overdue and completed'
  },
  {
    id: 'undertaking-compliance',
    title: 'Undertaking compliance',
    subtitle: 'By institution and region'
  },
  {
    id: 'document-validity',
    title: 'Document validity',
    subtitle: 'Expiring, expired and renewed'
  },
  {
    id: 'overdue-escalations',
    title: 'Overdue cases and escalations',
    subtitle: 'With escalation level and age'
  },
  {
    id: 'region-performance',
    title: 'Region-wise performance',
    subtitle: 'Average processing days per region'
  }
];

const AICTE_REGIONS = [
  { id: '', name: 'All regions' },
  { id: '1', name: 'Northern Region' },
  { id: '2', name: 'Southern Region' },
  { id: '3', name: 'Western Region' },
  { id: '4', name: 'Eastern Region' },
  { id: '5', name: 'Central Region' },
  { id: '6', name: 'South-Western Region' },
  { id: '7', name: 'North-Western Region' },
  { id: '8', name: 'South-Central Region' }
];

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();

  // Filters matching screenshot
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<string>('30'); // '30', '7', '90', 'all'

  // Export & preview states
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live Pendency Preview Data
  const [pendencyData, setPendencyData] = useState<StatutoryReportData | null>(null);
  const [loadingPendency, setLoadingPendency] = useState<boolean>(false);

  // Modal Preview State for PDF / Full Inspection
  const [previewModalReport, setPreviewModalReport] = useState<StatutoryReportData | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  // Compute date range from period
  const getDateRange = () => {
    if (periodFilter === 'all') return { from_date: '', to_date: '' };
    const days = parseInt(periodFilter, 10) || 30;
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    return {
      from_date: from.toISOString().split('T')[0],
      to_date: to.toISOString().split('T')[0]
    };
  };

  // Fetch pendency data for the stage preview chart
  useEffect(() => {
    const fetchPendency = async () => {
      setLoadingPendency(true);
      try {
        const { from_date, to_date } = getDateRange();
        const params = new URLSearchParams();
        if (regionFilter) params.append('region_id', regionFilter);
        if (from_date) params.append('from_date', from_date);
        if (to_date) params.append('to_date', to_date);

        const data = await apiRequest<StatutoryReportData>(
          `/reports/application-pendency?${params.toString()}`
        );
        setPendencyData(data);
      } catch (err) {
        // Fallback gracefully without breaking UI
      } finally {
        setLoadingPendency(false);
      }
    };

    fetchPendency();
  }, [regionFilter, periodFilter]);

  // Dynamic or Seeded Heights for the 5 Stage Bars: Scrutiny, EVC, SAC/SHC, Decision, Overdue
  const stageBarMetrics = useMemo(() => {
    if (pendencyData && pendencyData.table_data && pendencyData.table_data.length > 0) {
      const rows = pendencyData.table_data;
      const scrutiny = rows.filter((r) => r.current_stage === 'SCRUTINY').length;
      const evc = rows.filter((r) => r.current_stage === 'EVC').length;
      const sac = rows.filter((r) => ['SAC', 'SHC', 'SAC/SHC'].includes(r.current_stage)).length;
      const decision = rows.filter((r) => ['DECISION', 'APPROVAL', 'COMMISSION'].includes(r.current_stage)).length;
      const overdue = rows.filter((r) => r.is_overdue).length;

      const maxVal = Math.max(scrutiny, evc, sac, decision, overdue, 1);
      return [
        { label: 'Scrutiny', count: scrutiny, percent: Math.max(15, Math.round((scrutiny / maxVal) * 88)), color: '#18181B' },
        { label: 'EVC', count: evc, percent: Math.max(20, Math.round((evc / maxVal) * 88)), color: '#18181B' },
        { label: 'SAC/SHC', count: sac, percent: Math.max(12, Math.round((sac / maxVal) * 88)), color: '#8E8E93' },
        { label: 'Decision', count: decision, percent: Math.max(10, Math.round((decision / maxVal) * 88)), color: '#8E8E93' },
        { label: 'Overdue', count: overdue, percent: Math.max(15, Math.round((overdue / maxVal) * 88)), color: '#E0202A' }
      ];
    }

    // Default exact visual heights matching screenshot:
    // Scrutiny: ~65%, EVC: ~88%, SAC/SHC: ~46%, Decision: ~28%, Overdue: ~58%
    return [
      { label: 'Scrutiny', count: 42, percent: 65, color: '#18181B' },
      { label: 'EVC', count: 58, percent: 88, color: '#18181B' },
      { label: 'SAC/SHC', count: 28, percent: 46, color: '#8E8E93' },
      { label: 'Decision', count: 18, percent: 28, color: '#8E8E93' },
      { label: 'Overdue', count: 36, percent: 58, color: '#E0202A' }
    ];
  }, [pendencyData]);

  // Export to Excel (CSV compatible)
  const handleExportExcel = async (reportId: string, title: string) => {
    setExportingId(`${reportId}-excel`);
    try {
      const token = localStorage.getItem('token');
      const { from_date, to_date } = getDateRange();
      const params = new URLSearchParams();
      if (regionFilter) params.append('region_id', regionFilter);
      if (from_date) params.append('from_date', from_date);
      if (to_date) params.append('to_date', to_date);

      let response = await fetch(`/api/v1/reports/${reportId}/export-csv?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        response = await fetch(`/reports/${reportId}/export-csv?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      if (!response.ok) throw new Error('Failed to generate Excel/CSV export');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IntelliApprove_${reportId}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setToastMessage(`Exported ${title} to Excel. Immutable audit trail recorded.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExportingId(null);
    }
  };

  // Export to PDF / Printable View
  const handleExportPDF = async (reportId: string, title: string) => {
    setExportingId(`${reportId}-pdf`);
    setPreviewLoading(true);
    try {
      const { from_date, to_date } = getDateRange();
      const params = new URLSearchParams();
      if (regionFilter) params.append('region_id', regionFilter);
      if (from_date) params.append('from_date', from_date);
      if (to_date) params.append('to_date', to_date);

      const data = await apiRequest<StatutoryReportData>(
        `/reports/${reportId}?${params.toString()}`
      );
      setPreviewModalReport(data);
    } catch (err: any) {
      // Fallback: trigger standard browser print dialog
      window.print();
    } finally {
      setPreviewLoading(false);
      setExportingId(null);
    }
  };

  return (
    <div className="font-sans antialiased text-[#18181B] bg-white">
      {/* SECTION 1: HEADER & SUBTITLE */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B]">
          Statutory reports
        </h1>
        <p className="text-sm text-[#595959] mt-1 font-normal">
          Preview, then export
        </p>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="p-3 mb-6 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] text-xs text-[#18181B] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#18181B] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* SECTION 2: REGION & PERIOD DROPDOWNS */}
      <div className="flex items-center gap-4 mb-8">
        {/* Region Selector */}
        <div>
          <label className="block text-xs text-[#595959] font-normal mb-1">
            Region
          </label>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-[#E6E6E6] rounded-[8px] text-sm text-[#18181B] focus:outline-none focus:border-[#18181B] cursor-pointer"
          >
            {AICTE_REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Period Selector */}
        <div>
          <label className="block text-xs text-[#595959] font-normal mb-1">
            Period
          </label>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-[#E6E6E6] rounded-[8px] text-sm text-[#18181B] focus:outline-none focus:border-[#18181B] cursor-pointer"
          >
            <option value="30">Last 30 days</option>
            <option value="7">Last 7 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* SECTION 3: TWO-COLUMN MAIN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: 6 STATUTORY REPORTS LIST */}
        <div className="lg:col-span-7 xl:col-span-8 divide-y divide-[#E6E6E6]">
          {STATUTORY_REPORTS_LIST.map((rep) => {
            const isPdfExporting = exportingId === `${rep.id}-pdf`;
            const isExcelExporting = exportingId === `${rep.id}-excel`;

            return (
              <div
                key={rep.id}
                className="py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 first:pt-0"
              >
                <div>
                  <h3 className="text-base font-bold text-[#18181B]">
                    {rep.title}
                  </h3>
                  <p className="text-sm text-[#595959] mt-0.5 font-normal">
                    {rep.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {/* Download PDF Button */}
                  <Button
                    variant="primary"
                    size="sm"
                    loading={isPdfExporting}
                    disabled={isExcelExporting}
                    onClick={() => handleExportPDF(rep.id, rep.title)}
                  >
                    Download report
                  </Button>

                  {/* Download Excel Button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={isExcelExporting}
                    disabled={isPdfExporting}
                    onClick={() => handleExportExcel(rep.id, rep.title)}
                  >
                    Download report
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT COLUMN: PREVIEW PENDENCY BY STAGE CARD */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="bg-white border border-[#E6E6E6] rounded-[8px] p-6">
            <h4 className="text-xs font-semibold text-[#595959] tracking-wider uppercase mb-8">
              PREVIEW: PENDENCY BY STAGE
            </h4>

            {/* Vertical Bar Chart Container */}
            <div className="h-56 flex items-end justify-between gap-3 sm:gap-4 px-1 pb-2 border-b border-[#E6E6E6]/60">
              {stageBarMetrics.map((col, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                  {/* Vertical bar */}
                  <div
                    className="w-full max-w-[42px] rounded-t-[4px] transition-all duration-300 relative"
                    style={{
                      height: `${col.percent}%`,
                      backgroundColor: col.color
                    }}
                    title={`${col.label}: ${col.count} cases`}
                  />
                  {/* Label */}
                  <span className="text-[11px] sm:text-xs text-[#595959] mt-2.5 text-center truncate w-full font-normal">
                    {col.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Subtitle Caption */}
            <div className="text-xs text-[#595959] mt-4">
              Sample data
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL: STATUTORY REPORT PREVIEW & PRINTABLE PDF EXPORT */}
      {/* ============================================================== */}
      {previewModalReport && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6E6E6] rounded-[8px] max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#E6E6E6] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-[#18181B]">
                  {previewModalReport.title}
                </h3>
                <p className="text-xs text-[#595959] mt-0.5">
                  {previewModalReport.subtitle} • Generated: {new Date(previewModalReport.generated_at).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="w-3.5 h-3.5 mr-1" />Print</Button>
                <Button variant="secondary" size="sm" onClick={() => handleExportExcel(previewModalReport.report_id, previewModalReport.title)}><Download className="w-3.5 h-3.5 mr-1" />Download report</Button>
                <Button variant="quiet" size="icon" aria-label="Close" onClick={() => setPreviewModalReport(null)}><X className="w-5 h-5" /></Button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary KPIs */}
              {previewModalReport.summary_kpis && previewModalReport.summary_kpis.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {previewModalReport.summary_kpis.map((kpi, idx) => (
                    <div key={idx} className="p-3 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px]">
                      <div className="text-xs text-[#595959] font-medium">{kpi.label}</div>
                      <div className="text-xl font-bold text-[#18181B] mt-1">{kpi.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Data Table */}
              <div className="border border-[#E6E6E6] rounded-[8px] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#F4F4F5] border-b border-[#E6E6E6] text-[#595959] font-semibold uppercase">
                        {previewModalReport.table_columns.map((col) => (
                          <th key={col.key} className="py-2.5 px-3 whitespace-nowrap">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E6E6]">
                      {previewModalReport.table_data && previewModalReport.table_data.length > 0 ? (
                        previewModalReport.table_data.slice(0, 50).map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-[#FAFAFA]">
                            {previewModalReport.table_columns.map((col) => {
                              const val = row[col.key];
                              return (
                                <td key={col.key} className="py-2.5 px-3 text-[#18181B] whitespace-nowrap">
                                  {val !== undefined && val !== null ? String(val) : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={previewModalReport.table_columns.length}
                            className="py-8 text-center text-[#595959]"
                          >
                            No records found for the selected scope.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E6E6E6] text-[11px] text-[#595959] flex items-center justify-between">
              <span>Generated by IntelliApprove • Official Statutory Document</span>
              <span>Showing up to 50 preview rows</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
