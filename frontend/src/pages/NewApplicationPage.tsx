import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Trash2,
  Send
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { HumanOversightBadge } from '../components/HumanOversightBadge';
import { Button } from '../components/ui/Button';

interface ProgramForm {
  name: string;
  level: string;
  intake: number;
  enrolled_students: number;
  faculty_count: number;
  cadre_ratio: string;
}

export const NewApplicationPage: React.FC = () => {
  const navigate = useNavigate();
  const [applicationType, setApplicationType] = useState<string>('Extension of Approval (EoA)');
  const [academicYear, setAcademicYear] = useState<string>('2026-2027');
  const [programs, setPrograms] = useState<ProgramForm[]>([
    {
      name: 'Computer Science and Engineering',
      level: 'UG',
      intake: 120,
      enrolled_students: 450,
      faculty_count: 24,
      cadre_ratio: '1:2:6'
    }
  ]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const addProgram = () => {
    setPrograms([
      ...programs,
      {
        name: '',
        level: 'UG',
        intake: 60,
        enrolled_students: 0,
        faculty_count: 4,
        cadre_ratio: '1:2:6'
      }
    ]);
  };

  const removeProgram = (index: number) => {
    if (programs.length <= 1) return;
    setPrograms(programs.filter((_, i) => i !== index));
  };

  const updateProgram = (index: number, field: keyof ProgramForm, value: any) => {
    const updated = [...programs];
    updated[index] = { ...updated[index], [field]: value };
    setPrograms(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        application_type: applicationType,
        academic_year: academicYear,
        programs: programs
      };

      const res = await apiRequest<{ id: number }>('/applications', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      navigate(`/applications/${res.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to submit application proposal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl font-sans text-[#111111]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#111111] tracking-tight">
            Submit New Approval Application
          </h2>
          <p className="text-xs text-[#595959] mt-1">
            Fill institutional programs and intake proposals for Academic Year 2026-2027.
          </p>
        </div>
        <HumanOversightBadge size="sm" showSubtitle={false} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Metadata */}
        <div className="bg-white p-5 rounded-[8px] border border-[#E6E6E6] space-y-4">
          <h3 className="font-bold text-sm text-[#111111] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#595959]" />
            Application General Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-[#111111] block mb-1">Approval Application Type:</label>
              <select
                value={applicationType}
                onChange={(e) => setApplicationType(e.target.value)}
                className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[8px] text-[#111111]"
              >
                <option value="Extension of Approval (EoA)">Extension of Approval (EoA)</option>
                <option value="Increase in Intake / Additional Courses">Increase in Intake / Additional Courses</option>
                <option value="Establishment of New Technical Institute">Establishment of New Technical Institute</option>
                <option value="Change of Site / Trust">Change of Site / Trust</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-[#111111] block mb-1">Academic Year:</label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[8px] text-[#111111] font-mono"
              />
            </div>
          </div>
        </div>

        {/* Academic Programs List */}
        <div className="bg-white p-5 rounded-[8px] border border-[#E6E6E6] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#111111]">Academic Programs & Requested Intake</h3>
            <Button type="button" variant="secondary" size="sm" onClick={addProgram}>Add</Button>
          </div>

          <div className="space-y-4">
            {programs.map((prog, idx) => (
              <div key={idx} className="p-4 bg-[#F4F4F5] rounded-[8px] border border-[#E6E6E6] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#111111]">Program #{idx + 1}</span>
                  {programs.length > 1 && (
                    <Button type="button" size="sm" onClick={() => removeProgram(idx)}><Trash2 className="w-3.5 h-3.5 mr-1 text-white" />Delete</Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-[#595959] block mb-1">Program Name:</label>
                    <input
                      type="text"
                      value={prog.name}
                      onChange={(e) => updateProgram(idx, 'name', e.target.value)}
                      placeholder="e.g. Computer Science & Engineering"
                      className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[8px] text-[#111111]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#595959] block mb-1">Level:</label>
                    <select
                      value={prog.level}
                      onChange={(e) => updateProgram(idx, 'level', e.target.value)}
                      className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[8px] text-[#111111]"
                    >
                      <option value="UG">UG (B.Tech / B.E. / B.Pharm)</option>
                      <option value="PG">PG (M.Tech / MBA / MCA)</option>
                      <option value="Diploma">Diploma (Polytechnic)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#595959] block mb-1">Requested Intake:</label>
                    <input
                      type="number"
                      value={prog.intake}
                      onChange={(e) => updateProgram(idx, 'intake', parseInt(e.target.value) || 0)}
                      className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[8px] text-[#111111]"
                      min="0"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-[#595959] block mb-1">Total Enrolled Students:</label>
                    <input
                      type="number"
                      value={prog.enrolled_students}
                      onChange={(e) => updateProgram(idx, 'enrolled_students', parseInt(e.target.value) || 0)}
                      className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[8px] text-[#111111]"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#595959] block mb-1">Faculty Count:</label>
                    <input
                      type="number"
                      value={prog.faculty_count}
                      onChange={(e) => updateProgram(idx, 'faculty_count', parseInt(e.target.value) || 0)}
                      className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[8px] text-[#111111]"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#595959] block mb-1">Cadre Ratio:</label>
                    <input
                      type="text"
                      value={prog.cadre_ratio}
                      onChange={(e) => updateProgram(idx, 'cadre_ratio', e.target.value)}
                      placeholder="1:2:6"
                      className="w-full p-2 bg-white border border-[#E6E6E6] rounded-[8px] text-[#111111]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-white text-[#B5121A] border border-[#E0202A] rounded-[8px] text-xs font-medium">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate("/applications")}>Cancel</Button>
          <Button type="submit" variant="brand" loading={submitting}>Send for scrutiny</Button>
        </div>
      </form>
    </div>
  );
};
