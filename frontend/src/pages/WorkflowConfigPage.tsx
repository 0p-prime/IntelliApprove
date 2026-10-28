import React, { useState, useEffect } from 'react';
import { GitFork, Clock, Shield, Save, CheckCircle2, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { apiRequest } from '../api/client';
import { StageConfig, WorkflowRoute, UserRole } from '../types';
import { LoadingState, ErrorState } from '../components/States';
import { useAuth } from '../context/AuthContext';

export const WorkflowConfigPage: React.FC = () => {
  const { user } = useAuth();
  const [stages, setStages] = useState<StageConfig[]>([]);
  const [routes, setRoutes] = useState<WorkflowRoute[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStageId, setSavingStageId] = useState<number | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // New Route Form
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [fromStageId, setFromStageId] = useState<number>(1);
  const [toStageId, setToStageId] = useState<number>(2);
  const [newActionName, setNewActionName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('SCRUTINY_OFFICER');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stagesData, routesData] = await Promise.all([
        apiRequest<StageConfig[]>('/config/stages'),
        apiRequest<WorkflowRoute[]>('/config/routes'),
      ]);
      setStages(stagesData);
      setRoutes(routesData);
      if (stagesData.length > 1) {
        setFromStageId(stagesData[0].id);
        setToStageId(stagesData[1].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStage = async (stage: StageConfig) => {
    setSavingStageId(stage.id);
    setSaveSuccess(null);
    try {
      await apiRequest(`/config/stages/${stage.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: stage.name,
          sla_hours: stage.sla_hours,
          assigned_role: stage.assigned_role,
        }),
      });
      setSaveSuccess(`Stage "${stage.name}" SLA and role updated. Audit log recorded.`);
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      alert(`Failed to update stage: ${err.message}`);
    } finally {
      setSavingStageId(null);
    }
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/config/routes', {
        method: 'POST',
        body: JSON.stringify({
          from_stage_id: fromStageId,
          to_stage_id: toStageId,
          action_name: newActionName,
          required_role: newRole,
          requires_human_badge: true,
        }),
      });
      alert('New transition route added successfully! Audit trail written.');
      setNewActionName('');
      setShowAddRoute(false);
      await fetchData();
    } catch (err: any) {
      alert(`Failed to add route: ${err.message}`);
    }
  };

  if (loading) return <LoadingState message="Loading configurable workflow stages and routes..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <GitFork className="w-5 h-5 text-[#0B2240]" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Rule #3: Dynamic Workflow Stages & SLA Timelines
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            All stage routes, SLA hours, and authorized roles are stored as configurable database records, never hardcoded. Changes trigger immediate audit logging.
          </p>
        </div>
        <span className="px-2.5 py-1 bg-[#0B2240] text-white rounded text-xs font-semibold self-start md:self-auto">
          Database Driven
        </span>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {saveSuccess}
        </div>
      )}

      {/* Section 1: Stages & Configurable SLA Windows */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Configurable Approval Stages & SLAs</h3>
          <p className="text-xs text-slate-500">Edit stage timeout hours (SLA) and responsible role</p>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Sequence</th>
                <th className="py-2.5 px-3">Stage Key</th>
                <th className="py-2.5 px-3">Stage Display Name</th>
                <th className="py-2.5 px-3">SLA Hours</th>
                <th className="py-2.5 px-3">Assigned Role</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stages.map((stage, idx) => (
                <tr key={stage.id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-400">#{stage.order_sequence}</td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">{stage.stage_key}</td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) => {
                        const updated = [...stages];
                        updated[idx].name = e.target.value;
                        setStages(updated);
                      }}
                      className="p-1 border border-slate-200 rounded text-xs w-56 font-semibold"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={720}
                        value={stage.sla_hours}
                        onChange={(e) => {
                          const updated = [...stages];
                          updated[idx].sla_hours = parseInt(e.target.value) || 0;
                          setStages(updated);
                        }}
                        className="p-1 border border-slate-200 rounded text-xs w-20 font-bold text-blue-800"
                      />
                      <span className="text-slate-400 text-[11px]">hours</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <select
                      value={stage.assigned_role}
                      onChange={(e) => {
                        const updated = [...stages];
                        updated[idx].assigned_role = e.target.value as any;
                        setStages(updated);
                      }}
                      className="p-1 border border-slate-200 rounded text-xs"
                    >
                      <option value="INSTITUTION">INSTITUTION</option>
                      <option value="SCRUTINY_OFFICER">SCRUTINY_OFFICER</option>
                      <option value="EVC_INSPECTOR">EVC_INSPECTOR</option>
                      <option value="REGIONAL_OFFICER">REGIONAL_OFFICER</option>
                      <option value="COMPETENT_AUTHORITY">COMPETENT_AUTHORITY</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => handleUpdateStage(stage)}
                      disabled={savingStageId === stage.id}
                      className="px-2.5 py-1 bg-[#0B2240] hover:bg-[#07172C] text-white rounded text-[11px] font-semibold flex items-center gap-1 ml-auto cursor-pointer"
                    >
                      <Save className="w-3 h-3" />
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Configurable Workflow Transition Routes */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Allowed Stage Transition Routes</h3>
            <p className="text-xs text-slate-500">
              Defines which roles can advance applications between specific lifecycle stages
            </p>
          </div>
          <button
            onClick={() => setShowAddRoute(!showAddRoute)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {showAddRoute ? 'Cancel' : 'Add Transition Route'}
          </button>
        </div>

        {showAddRoute && (
          <form onSubmit={handleCreateRoute} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <h4 className="font-bold text-xs text-slate-900 uppercase">Create Dynamic Transition Route</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">From Stage:</label>
                <select
                  value={fromStageId}
                  onChange={(e) => setFromStageId(parseInt(e.target.value))}
                  className="w-full p-2 bg-white border border-slate-300 rounded"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">To Stage:</label>
                <select
                  value={toStageId}
                  onChange={(e) => setToStageId(parseInt(e.target.value))}
                  className="w-full p-2 bg-white border border-slate-300 rounded"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Action Button Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Recommend to Hearing"
                  value={newActionName}
                  onChange={(e) => setNewActionName(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Authorized Role:</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full p-2 bg-white border border-slate-300 rounded"
                >
                  <option value="INSTITUTION">INSTITUTION</option>
                  <option value="SCRUTINY_OFFICER">SCRUTINY_OFFICER</option>
                  <option value="EVC_INSPECTOR">EVC_INSPECTOR</option>
                  <option value="REGIONAL_OFFICER">REGIONAL_OFFICER</option>
                  <option value="COMPETENT_AUTHORITY">COMPETENT_AUTHORITY</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-[#0B2240] hover:bg-[#07172C] text-white rounded text-xs font-semibold cursor-pointer"
              >
                Create Transition Route
              </button>
            </div>
          </form>
        )}

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Route ID</th>
                <th className="py-2.5 px-3">From Stage</th>
                <th className="py-2.5 px-3">To Stage</th>
                <th className="py-2.5 px-3">Action Name</th>
                <th className="py-2.5 px-3">Required Role</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routes.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-400">#{r.id}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                    {r.from_stage?.name || `Stage #${r.from_stage_id}`}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-blue-900">
                    {r.to_stage?.name || `Stage #${r.to_stage_id}`}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{r.action_name}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold">
                      {r.required_role}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      ACTIVE
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
