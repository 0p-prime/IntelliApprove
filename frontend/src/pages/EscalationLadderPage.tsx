import React, { useState, useEffect } from 'react';
import { Flame, Clock, ShieldAlert, Save, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { apiRequest } from '../api/client';
import { EscalationLadder } from '../types';
import { LoadingState, ErrorState } from '../components/States';
import { Button } from '../components/ui/Button';

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
      <div className="p-4 bg-[#FAFAFA] border border-[#E6E6E6] rounded-[8px] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#111111]" />
            <h2 className="text-lg font-bold text-[#111111] tracking-tight">
              Rule #3: Configurable Escalation Ladders & Reminder Offsets
            </h2>
          </div>
          <p className="text-xs text-[#595959] mt-1">
            APScheduler continuously monitors pending applications. When deadlines approach or lapse, configurable reminder offsets and escalation ladders are triggered automatically.
          </p>
        </div>
        <span className="px-2.5 py-1 bg-[#18181B] text-white rounded-[6px] text-xs font-semibold self-start md:self-auto">
          Active SLA Engine
        </span>
      </div>

      {successMsg && (
        <div className="p-3 bg-[#F4F4F5] border border-[#E6E6E6] rounded-[8px] text-xs text-[#111111] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#111111] shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Escalation Ladders Table */}
      <div className="bg-white p-5 rounded-[8px] border border-[#E6E6E6] space-y-4">
        <div>
          <h3 className="font-bold text-sm text-[#111111]">Stage Escalation Ladder Definitions</h3>
          <p className="text-xs text-[#595959]">Configure reminder offsets and escalation targets per stage</p>
        </div>

        <div className="border border-[#E6E6E6] rounded-[8px] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAFAFA] border-b border-[#E6E6E6] text-[#595959] font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Stage</th>
                <th className="py-2.5 px-3">Max SLA Window</th>
                <th className="py-2.5 px-3">1st Reminder (T-Minus)</th>
                <th className="py-2.5 px-3">2nd Reminder (T-Minus)</th>
                <th className="py-2.5 px-3">Escalate To Role</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E6E6]">
              {ladders.map((ladder, idx) => (
                <tr key={ladder.id} className="hover:bg-[#FAFAFA]">
                  <td className="py-3 px-3 font-semibold text-[#111111]">
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
                        className="p-1 border border-[#E6E6E6] rounded-[6px] text-xs w-20 font-bold text-[#111111] bg-white focus:outline-none focus:border-[#111111]"
                      />
                      <span className="text-[#595959] text-[11px]">hours</span>
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
                        className="p-1 border border-[#E6E6E6] rounded-[6px] text-xs w-20 text-[#111111] bg-white focus:outline-none focus:border-[#111111]"
                      />
                      <span className="text-[#595959] text-[11px]">hours before</span>
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
                        className="p-1 border border-[#E6E6E6] rounded-[6px] text-xs w-20 text-[#111111] bg-white focus:outline-none focus:border-[#111111]"
                      />
                      <span className="text-[#595959] text-[11px]">hours before</span>
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
                      className="p-1.5 border border-[#E0202A] rounded-[6px] text-xs font-semibold text-[#B5121A] bg-white"
                    >
                      <option value="REGIONAL_OFFICER">REGIONAL_OFFICER (Regional Director)</option>
                      <option value="COMPETENT_AUTHORITY">COMPETENT_AUTHORITY (Member Secretary)</option>
                      <option value="ADMIN">ADMIN (Executive Committee Chairman)</option>
                    </select>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <Button variant="secondary" size="sm" loading={savingId === ladder.id} onClick={() => handleUpdate(ladder)}>Save</Button>
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
