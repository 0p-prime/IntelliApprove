import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, CheckCircle2, Clock, MapPin, Building2, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiRequest } from '../api/client';
import { Application } from '../types';
import { StatusPill } from '../components/StatusPill';
import { LoadingState, EmptyState, ErrorState } from '../components/States';
import { HumanOversightBadge } from '../components/HumanOversightBadge';
import { useAuth } from '../context/AuthContext';

export const EVCPage: React.FC = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEVCApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<Application[]>('/applications');
      // Filter applications that are in or have completed EVC inspection
      const evcApps = data.filter(
        (a) =>
          a.status === 'EVC_SCHEDULED' ||
          a.status === 'EVC_COMPLETED' ||
          a.status === 'SHC_REVIEW' ||
          a.status === 'PENDING_AUTHORITY_DECISION'
      );
      setApplications(evcApps);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch EVC applications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEVCApplications();
  }, []);

  if (loading) return <LoadingState message="Loading Expert Visit Committee (EVC) schedule..." />;
  if (error) return <ErrorState message={error} onRetry={fetchEVCApplications} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Expert Visit Committee (EVC) Inspection Portal
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Physical & Virtual verification of campus land, instructional built-up area, lab equipment, and faculty attendance.
          </p>
        </div>
        <HumanOversightBadge size="sm" showSubtitle={false} />
      </div>

      {applications.length === 0 ? (
        <EmptyState
          title="No Scheduled EVC Inspections"
          description="There are currently no applications pending Expert Visit Committee inspections."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {applications.map((app) => (
            <div
              key={app.id}
              className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3 hover:border-slate-300 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-bold text-[#0B2240]">
                    {app.application_number}
                  </span>
                  <h3 className="font-bold text-sm text-slate-900 mt-0.5">
                    {app.institution?.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {app.institution?.district}, {app.institution?.state} ({app.institution?.region} Region)
                  </div>
                </div>
                <StatusPill status={app.status} isEscalated={app.is_escalated} />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Land Area:</span>
                  <span className="font-semibold text-slate-800">{app.institution?.total_land_acres} Acres</span>
                </div>
                <div className="flex justify-between">
                  <span>Built-up Area:</span>
                  <span className="font-semibold text-slate-800">{app.institution?.total_builtup_sqm} Sqm</span>
                </div>
                <div className="flex justify-between">
                  <span>Computer Terminals:</span>
                  <span className="font-semibold text-slate-800">{app.institution?.total_computers} PCs</span>
                </div>
                {app.evc_recommendation && (
                  <div className="pt-2 border-t border-slate-200 text-xs">
                    <span className="font-semibold text-slate-700 block">EVC Verdict:</span>
                    <span className="font-bold text-blue-800">{app.evc_recommendation}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  AY {app.academic_year} • AICTE ID: {app.institution?.aicte_id}
                </span>
                <Link
                  to={`/applications/${app.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0B2240] hover:bg-[#07172C] text-white rounded-md text-xs font-semibold shadow-2xs transition-colors"
                >
                  Inspection Details
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
