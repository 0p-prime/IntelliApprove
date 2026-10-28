import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, GitFork, Flame, CheckSquare, Activity, ShieldCheck, Database, RefreshCw } from 'lucide-react';
import { apiRequest } from '../api/client';
import { LoadingState } from '../components/States';

export const AdminSettingsPage: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest('/health')
      .then(setHealth)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            System Administration & Dynamic Configurations
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Enforces Non-Negotiable Rule #3: All timelines, routes, reminder offsets, and ladders are configurable in the database.
          </p>
        </div>
      </div>

      {/* System Status Banner */}
      <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-600" />
          Engine Health & Scheduler Diagnostics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500 block">FastAPI Backend Status</span>
            <span className="font-bold text-emerald-600 text-sm mt-0.5 block">
              {health?.status === 'healthy' ? 'Operational (200 OK)' : 'Connecting...'}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500 block">APScheduler SLA Monitor</span>
            <span className="font-bold text-blue-800 text-sm mt-0.5 block">
              {health?.scheduler_enabled ? 'Active (Running every 30s)' : 'Disabled'}
            </span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-slate-500 block">Persistence Storage</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block">
              PostgreSQL / SQLite Fallback Connected
            </span>
          </div>
        </div>
      </div>

      {/* Admin Quick Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center mb-3">
              <GitFork className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">Workflow Stages & Routes</h4>
            <p className="text-xs text-slate-500 mt-1">
              Configure lifecycle stages, max SLA hours, assigned roles, and transition permissions.
            </p>
          </div>
          <Link
            to="/config/workflow"
            className="px-3 py-2 bg-[#0B2240] hover:bg-[#07172C] text-white rounded text-xs font-semibold text-center transition-colors"
          >
            Manage Stage Routes
          </Link>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-orange-50 text-orange-800 flex items-center justify-center mb-3">
              <Flame className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">Escalation Ladders & Reminders</h4>
            <p className="text-xs text-slate-500 mt-1">
              Configure T-24h and T-6h reminder offsets, stage timeouts, and escalation recipient roles.
            </p>
          </div>
          <Link
            to="/config/escalations"
            className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-semibold text-center transition-colors"
          >
            Manage Escalation Ladders
          </Link>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center mb-3">
              <CheckSquare className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">AICTE Handbook Norms</h4>
            <p className="text-xs text-slate-500 mt-1">
              Configure statutory minimums for FSR, land area, built-up area, computing, and committees.
            </p>
          </div>
          <Link
            to="/config/compliance"
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold text-center transition-colors"
          >
            Manage APH Norms
          </Link>
        </div>
      </div>
    </div>
  );
};
