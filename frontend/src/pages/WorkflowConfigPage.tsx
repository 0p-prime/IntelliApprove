import React, { useState, useEffect } from 'react';
import {
  GitFork,
  Save,
  Plus,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { WorkflowStage, WorkflowRouteTransition } from '../types';
import { LoadingState, ErrorState } from '../components/States';
import { Button } from '../components/ui/Button';

export const WorkflowConfigPage: React.FC = () => {
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [routes, setRoutes] = useState<WorkflowRouteTransition[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [savingStageId, setSavingStageId] = useState<number | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // New Route Form State
  const [showAddRoute, setShowAddRoute] = useState<boolean>(false);
  const [fromStageId, setFromStageId] = useState<number>(1);
  const [toStageId, setToStageId] = useState<number>(2);
  const [newActionName, setNewActionName] = useState<string>('');
  const [newRole, setNewRole] = useState<'INSTITUTION' | 'SCRUTINY_OFFICER' | 'EVC_INSPECTOR' | 'REGIONAL_OFFICER' | 'COMPETENT_AUTHORITY' | 'ADMIN'>('REGIONAL_OFFICER');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stagesData, routesData] = await Promise.all([
        apiRequest<WorkflowStage[]>('/workflow/stages'),
        apiRequest<WorkflowRouteTransition[]>('/workflow/routes')
      ]);
      setStages(stagesData);
      setRoutes(routesData);
      if (stagesData.length >= 2) {
        setFromStageId(stagesData[0].id);
        setToStageId(stagesData[1].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch workflow configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStage = async (stage: WorkflowStage) => {
    setSavingStageId(stage.id);
    setSaveSuccess(null);
    try {
      await apiRequest(`/workflow/stages/${stage.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: stage.name,
          sla_hours: stage.sla_hours,
          assigned_role: stage.assigned_role
        })
      });
      setSaveSuccess(`Updated stage ${stage.name} SLA to ${stage.sla_hours}h.`);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSavingStageId(null);
    }
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionName.trim()) return;

    try {
      await apiRequest('/workflow/routes', {
        method: 'POST',
        body: JSON.stringify({
          from_stage_id: fromStageId,
          to_stage_id: toStageId,
          action_name: newActionName.trim(),
          required_role: newRole
        })
      });
      setShowAddRoute(false);
      setNewActionName('');
      await fetchData();
    } catch (err: any) {
      alert(`Failed to create route: ${err.message}`);
    }
  };

  if (loading) return <LoadingState message="Loading dynamic workflow configuration..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6 font-sans text-[#111111]">
      {/* Header Banner */}
      <div className="p-5 bg-white border border-[#E6E6E6] rounded-[8px] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <GitFork className="w-5 h-5 text-[#111111]" />
            <h2 className="text-lg font-bold text-[#111111] tracking-tight">
              Dynamic Workflow Stages & SLA Timelines
            </h2>
          </div>
          <p className="text-xs text-[#595959] mt-1">
            All stage routes, SLA hours, and authorized roles are stored as configurable database records. Changes trigger immutable audit logging.
          </p>
        </div>
        <span className="px-2.5 py-1 bg-[#F4F4F5] border border-[#E6E6E6] text-[#111111] rounded-[6px] text-xs font-semibold self-start md:self-auto">
          Database Driven
        </span>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] text-xs text-[#111111] flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-[#111111] shrink-0" />
          {saveSuccess}
        </div>
      )}

      {/* Section 1: Stages & Configurable SLA Windows */}
      <div className="bg-white p-5 rounded-[8px] border border-[#E6E6E6] space-y-4">
        <div>
          <h3 className="font-bold text-sm text-[#111111]">Configurable Approval Stages & SLAs</h3>
          <p className="text-xs text-[#595959]">Edit stage timeout hours (SLA) and responsible role</p>
        </div>

        <div className="border border-[#E6E6E6] rounded-[8px] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F4F4F5] border-b border-[#E6E6E6] text-[#595959] font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Sequence</th>
                <th className="py-2.5 px-3">Stage Key</th>
                <th className="py-2.5 px-3">Stage Display Name</th>
                <th className="py-2.5 px-3">SLA Hours</th>
                <th className="py-2.5 px-3">Assigned Role</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E6E6]">
              {stages.map((stage, idx) => (
                <tr key={stage.id} className="hover:bg-[#FAFAFA]">
                  <td className="py-2.5 px-3 font-mono font-bold text-[#595959]">#{stage.order_sequence}</td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-[#111111]">{stage.stage_key}</td>
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) => {
                        const updated = [...stages];
                        updated[idx].name = e.target.value;
                        setStages(updated);
                      }}
                      className="p-1.5 border border-[#E6E6E6] rounded-[6px] text-xs w-56 font-semibold text-[#111111] bg-white focus:outline-none focus:border-[#111111]"
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
                        className="p-1.5 border border-[#E6E6E6] rounded-[6px] text-xs w-20 font-bold text-[#111111] bg-white focus:outline-none focus:border-[#111111]"
                      />
                      <span className="text-[#595959] text-[11px]">hours</span>
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
                      className="p-1.5 border border-[#E6E6E6] rounded-[6px] text-xs text-[#111111] bg-white focus:outline-none focus:border-[#111111]"
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
                    <Button variant="secondary" size="sm" loading={savingStageId === stage.id} onClick={() => handleUpdateStage(stage)}>Save</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Configurable Workflow Transition Routes */}
      <div className="bg-white p-5 rounded-[8px] border border-[#E6E6E6] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[#111111]">Allowed Stage Transition Routes</h3>
            <p className="text-xs text-[#595959]">
              Defines which roles can advance applications between specific lifecycle stages
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowAddRoute(!showAddRoute)}>{showAddRoute ? "Cancel" : "Add"}</Button>
        </div>

        {showAddRoute && (
          <form onSubmit={handleCreateRoute} className="p-4 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] space-y-3">
            <h4 className="font-bold text-xs text-[#111111] uppercase">Create Dynamic Transition Route</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="font-semibold text-[#111111] block mb-1">From Stage:</label>
                <select
                  value={fromStageId}
                  onChange={(e) => setFromStageId(parseInt(e.target.value))}
                  className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[6px] text-[#111111]"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#111111] block mb-1">To Stage:</label>
                <select
                  value={toStageId}
                  onChange={(e) => setToStageId(parseInt(e.target.value))}
                  className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[6px] text-[#111111]"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#111111] block mb-1">Action Button Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Recommend to Hearing"
                  value={newActionName}
                  onChange={(e) => setNewActionName(e.target.value)}
                  className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[6px] text-[#111111]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#111111] block mb-1">Authorized Role:</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[6px] text-[#111111]"
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
              <Button type="submit" variant="primary" size="sm">Save</Button>
            </div>
          </form>
        )}

        <div className="border border-[#E6E6E6] rounded-[8px] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F4F4F5] border-b border-[#E6E6E6] text-[#595959] font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Route ID</th>
                <th className="py-2.5 px-3">From Stage</th>
                <th className="py-2.5 px-3">To Stage</th>
                <th className="py-2.5 px-3">Action Name</th>
                <th className="py-2.5 px-3">Required Role</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E6E6]">
              {routes.map((r) => (
                <tr key={r.id} className="hover:bg-[#FAFAFA]">
                  <td className="py-2.5 px-3 font-mono font-bold text-[#595959]">#{r.id}</td>
                  <td className="py-2.5 px-3 font-semibold text-[#111111]">
                    {r.from_stage?.name || `Stage #${r.from_stage_id}`}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-[#111111]">
                    {r.to_stage?.name || `Stage #${r.to_stage_id}`}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-[#111111]">{r.action_name}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-[#F4F4F5] border border-[#E6E6E6] text-[#111111] font-mono text-[10px] font-semibold">
                      {r.required_role}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded border border-[#E6E6E6] bg-white text-[#111111] text-[10px] font-bold">
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
export default WorkflowConfigPage;
