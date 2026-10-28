import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Building2, Send, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../api/client';
import { AcademicProgram } from '../types';
import { useAuth } from '../context/AuthContext';
import { HumanOversightBadge } from '../components/HumanOversightBadge';

export const NewApplicationPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [applicationType, setApplicationType] = useState('Extension of Approval (EoA)');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [programs, setPrograms] = useState<AcademicProgram[]>([
    {
      program_name: 'Computer Science & Engineering',
      level: 'Undergraduate',
      approved_intake_prev_year: 120,
      requested_intake: 120,
      faculty_count: 8,
      total_enrolled: 480,
      cadre_ratio: '1:2:5',
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addProgram = () => {
    setPrograms([
      ...programs,
      {
        program_name: '',
        level: 'Undergraduate',
        approved_intake_prev_year: 60,
        requested_intake: 60,
        faculty_count: 4,
        total_enrolled: 240,
        cadre_ratio: '1:1:2',
      },
    ]);
  };

  const removeProgram = (index: number) => {
    setPrograms(programs.filter((_, i) => i !== index));
  };

  const updateProgram = (index: number, field: keyof AcademicProgram, value: any) => {
    const updated = [...programs];
    updated[index] = { ...updated[index], [field]: value };
    setPrograms(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res: any = await apiRequest('/applications', {
        method: 'POST',
        body: JSON.stringify({
          institution_id: user?.institution_id || 1,
          academic_year: academicYear,
          application_type: applicationType,
          programs,
        }),
      });
      alert(`Application ${res.application_number} drafted successfully!`);
      navigate(`/applications/${res.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create application');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Submit New AICTE Approval Application
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Fill institutional programs and intake proposals for Academic Year 2026-2027.
          </p>
        </div>
        <HumanOversightBadge size="sm" showSubtitle={false} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Metadata */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            Application General Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Approval Application Type:</label>
              <select
                value={applicationType}
                onChange={(e) => setApplicationType(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-md"
              >
                <option value="Extension of Approval (EoA)">Extension of Approval (EoA)</option>
                <option value="Increase in Intake / Additional Courses">Increase in Intake / Additional Courses</option>
                <option value="Establishment of New Technical Institute">Establishment of New Technical Institute</option>
                <option value="Change of Site / Trust">Change of Site / Trust</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Academic Year:</label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-md font-mono"
              />
            </div>
          </div>
        </div>

        {/* Academic Programs List */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Academic Programs & Requested Intake</h3>
            <button
              type="button"
              onClick={addProgram}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Program
            </button>
          </div>

          <div className="space-y-3">
            {programs.map((prog, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Program #{idx + 1}</span>
                  {programs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeProgram(idx)}
                      className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Program Name:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mechanical Engineering"
                      value={prog.program_name}
                      onChange={(e) => updateProgram(idx, 'program_name', e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Level:</label>
                    <select
                      value={prog.level}
                      onChange={(e) => updateProgram(idx, 'level', e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded"
                    >
                      <option value="Undergraduate">Undergraduate (B.Tech / B.E.)</option>
                      <option value="Postgraduate">Postgraduate (M.Tech / MBA / MCA)</option>
                      <option value="Diploma">Diploma Polytechnic</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Requested Intake:</label>
                    <input
                      type="number"
                      required
                      min={30}
                      max={360}
                      step={30}
                      value={prog.requested_intake}
                      onChange={(e) => updateProgram(idx, 'requested_intake', parseInt(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-300 rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Total Enrolled Students:</label>
                    <input
                      type="number"
                      value={prog.total_enrolled}
                      onChange={(e) => updateProgram(idx, 'total_enrolled', parseInt(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Faculty Count:</label>
                    <input
                      type="number"
                      min={1}
                      value={prog.faculty_count}
                      onChange={(e) => updateProgram(idx, 'faculty_count', parseInt(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Cadre Ratio:</label>
                    <input
                      type="text"
                      value={prog.cadre_ratio}
                      onChange={(e) => updateProgram(idx, 'cadre_ratio', e.target.value)}
                      placeholder="1:2:6"
                      className="w-full p-2 bg-white border border-slate-300 rounded"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-xs font-medium">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/applications')}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-[#0B2240] hover:bg-[#07172C] text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4 text-amber-400" />
            {submitting ? 'Creating Application Draft...' : 'Create Application Draft'}
          </button>
        </div>
      </form>
    </div>
  );
};
