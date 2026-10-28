import React, { useState, useEffect } from 'react';
import { Flame, Clock, ShieldAlert, Save, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { apiRequest } from '../api/client';
import { EscalationLadder } from '../types';
import { LoadingState, ErrorState } from '../components/States';

export const EscalationLadderPage: React.FC = () => {
  const [ladders, setLadders] = useState<EscalationLadder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchLadders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<EscalationLadder[]>('/config/escalation-ladders');
      setLadders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load escalation ladders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLadders();
  }, []);

  const handleUpdate = async (ladder: EscalationLadder) => {
    setSavingId(ladder.id);
    setSuccessMsg(null);
    try {
      await apiRequest(`/config/escalation-ladders/${ladder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          sla_hours: ladder.sla_hours,
          first_reminder_hours_before: ladder.first_reminder_hours_before,
          second_reminder_hours_before: ladder.second_reminder_hours_before,
          escalate_to_role: ladder.escalate_to_role,
        }),
      });
      setSuccessMsg(`Escalation ladder #${ladder.id} updated. Audit log written per Rule #1.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <LoadingState message="Loading escalation ladder configurations..." />;
  if (error) return <ErrorState message={error} onRetry={fetchLadders} />;

  return (
    <div className="space-y-6">
      {/* Rule #3 Banner */}
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Rule #3: Configurable Escalation Ladders & Reminder Offsets
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            APScheduler continuously monitors pending applications. When deadlines approach or lapse, configurable reminder offsets and escalation ladders are triggered automatically.
          </p>
        </div>
        <span className="px-2.5 py-1 bg-orange-600 text-white rounded text-xs font-semibold self-start md:self-auto">
          Active SLA Engine
        </span>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Escalation Ladders Table */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Stage Escalation Ladder Definitions</h3>
          <p className="text-xs text-slate-500">Configure reminder offsets and escalation targets per stage</p>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Stage</th>
                <th className="py-2.5 px-3">Max SLA Window</th>
                <th className="py-2.5 px-3">1st Reminder (T-Minus)</th>
                <th className="py-2.5 px-3">2nd Reminder (T-Minus)</th>
                <th className="py-2.5 px-3">Escalate To Role</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ladders.map((ladder, idx) => (
                <tr key={ladder.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-3 font-semibold text-slate-900">
                    {ladder.stage_name || `Stage #${ladder.stage_id}`}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        value={ladder.sla_hours}
                        onChange={(e) => {
                          const updated = [...ladders];
                          updated[idx].sla_hours = parseInt(e.target.value) || 0;
                          setLadders(updated);
                        }}
                        className="p-1 border border-slate-300 rounded text-xs w-20 font-bold text-slate-800"
                      />
                      <span className="text-slate-500 text-[11px]">hours</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        value={ladder.first_reminder_hours_before}
                        onChange={(e) => {
                          const updated = [...ladders];
                          updated[idx].first_reminder_hours_before = parseInt(e.target.value) || 0;
                          setLadders(updated);
                        }}
                        className="p-1 border border-slate-300 rounded text-xs w-20 text-slate-700"
                      />
                      <span className="text-slate-500 text-[11px]">hours before</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        value={ladder.second_reminder_hours_before}
                        onChange={(e) => {
                          const updated = [...ladders];
                          updated[idx].second_reminder_hours_before = parseInt(e.target.value) || 0;
                          setLadders(updated);
                        }}
                        className="p-1 border border-slate-300 rounded text-xs w-20 text-slate-700"
                      />
                      <span className="text-slate-500 text-[11px]">hours before</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <select
                      value={ladder.escalate_to_role}
                      onChange={(e) => {
                        const updated = [...ladders];
                        updated[idx].escalate_to_role = e.target.value as any;
                        setLadders(updated);
                      }}
                      className="p-1.5 border border-slate-300 rounded text-xs font-semibold text-red-800 bg-red-50/50"
                    >
                      <option value="REGIONAL_OFFICER">REGIONAL_OFFICER (Regional Director)</option>
                      <option value="COMPETENT_AUTHORITY">COMPETENT_AUTHORITY (Member Secretary)</option>
                      <option value="ADMIN">ADMIN (Executive Committee Chairman)</option>
                    </select>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleUpdate(ladder)}
                      disabled={savingId === ladder.id}
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
    </div>
  );
};
