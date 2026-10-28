import React, { useState, useEffect } from 'react';
import { CheckSquare, Save, CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { apiRequest } from '../api/client';
import { ComplianceNormRule } from '../types';
import { LoadingState, ErrorState } from '../components/States';

export const ComplianceRulesPage: React.FC = () => {
  const [rules, setRules] = useState<ComplianceNormRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ComplianceNormRule[]>('/compliance/rules');
      setRules(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load handbook rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleUpdate = async (rule: ComplianceNormRule) => {
    setSavingId(rule.id);
    setSuccessMsg(null);
    try {
      await apiRequest(`/config/compliance-rules/${rule.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: rule.name,
          standard_value: rule.standard_value,
          threshold_margin_percent: rule.threshold_margin_percent,
          severity: rule.severity,
        }),
      });
      setSuccessMsg(`APH Norm Rule "${rule.rule_code}" updated. Audit log recorded per Rule #1.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <LoadingState message="Loading AICTE Approval Process Handbook (APH) norm rules..." />;
  if (error) return <ErrorState message={error} onRetry={fetchRules} />;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-700" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Rule #3: Dynamic AICTE Handbook Norms & Compliance Engine
            </h2>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Configure statutory parameters such as Faculty-to-Student Ratio (FSR), minimum land area, computing terminals, and mandatory anti-ragging/ICC committees.
          </p>
        </div>
        <span className="px-2.5 py-1 bg-emerald-700 text-white rounded text-xs font-semibold self-start md:self-auto">
          APH Standards 2026-27
        </span>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Rules Table */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900">Active Regulatory Norm Rules</h3>
          <p className="text-xs text-slate-500">Edit standard values and allowable margin thresholds</p>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Rule Code</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Norm Name & Description</th>
                <th className="py-2.5 px-3">Standard Norm Value</th>
                <th className="py-2.5 px-3">Margin (%)</th>
                <th className="py-2.5 px-3">Deficiency Severity</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((rule, idx) => (
                <tr key={rule.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-3 font-mono font-bold text-slate-800">{rule.rule_code}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
                      {rule.category}
                    </span>
                  </td>
                  <td className="py-3 px-3 max-w-xs">
                    <div className="font-semibold text-slate-900">{rule.name}</div>
                    <div className="text-[11px] text-slate-500 line-clamp-1">{rule.description}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="any"
                        value={rule.standard_value}
                        onChange={(e) => {
                          const updated = [...rules];
                          updated[idx].standard_value = parseFloat(e.target.value) || 0;
                          setRules(updated);
                        }}
                        className="p-1 border border-slate-300 rounded text-xs w-20 font-bold text-slate-800"
                      />
                      <span className="text-slate-500 text-[11px]">{rule.unit}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      step="any"
                      value={rule.threshold_margin_percent}
                      onChange={(e) => {
                        const updated = [...rules];
                        updated[idx].threshold_margin_percent = parseFloat(e.target.value) || 0;
                        setRules(updated);
                      }}
                      className="p-1 border border-slate-300 rounded text-xs w-16"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <select
                      value={rule.severity}
                      onChange={(e) => {
                        const updated = [...rules];
                        updated[idx].severity = e.target.value as any;
                        setRules(updated);
                      }}
                      className={`p-1 border rounded text-xs font-bold ${
                        rule.severity === 'CRITICAL' ? 'bg-red-50 text-red-800 border-red-300' : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="MAJOR">MAJOR</option>
                      <option value="MINOR">MINOR</option>
                    </select>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => handleUpdate(rule)}
                      disabled={savingId === rule.id}
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
