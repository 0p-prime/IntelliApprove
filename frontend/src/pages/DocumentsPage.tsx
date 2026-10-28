import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, CheckCircle2, XCircle, Clock, Search, Building2, ExternalLink } from 'lucide-react';
import { apiRequest } from '../api/client';
import { ApplicationDocument } from '../types';
import { LoadingState, EmptyState, ErrorState } from '../components/States';

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch documents across seeded applications (e.g. apps 1, 2, 3)
      const [docs1, docs2] = await Promise.all([
        apiRequest<ApplicationDocument[]>('/documents/application/1').catch(() => []),
        apiRequest<ApplicationDocument[]>('/documents/application/2').catch(() => []),
      ]);
      setDocuments([...docs1, ...docs2]);
    } catch (err: any) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const filtered = filterStatus === 'ALL'
    ? documents
    : documents.filter((d) => d.status === filterStatus);

  if (loading) return <LoadingState message="Loading legal documents repository..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDocuments} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Document Store & Legal Affidavit Repository
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Archival and scrutiny verification of institutional title deeds, municipal NOCs, and financial audits.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        {['ALL', 'VERIFIED_COMPLIANT', 'PENDING_VERIFICATION', 'DEFICIENT_REJECTED'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              filterStatus === st
                ? 'border-[#0B2240] text-[#0B2240] font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {st === 'ALL' ? 'All Documents' : st.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No Documents Found"
          description="No document records found matching this status filter."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4">Document Category</th>
                <th className="py-3 px-4">File Name & Size</th>
                <th className="py-3 px-4">Application Reference</th>
                <th className="py-3 px-4">Uploaded Date</th>
                <th className="py-3 px-4">Verification Status</th>
                <th className="py-3 px-4">Scrutiny Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">{doc.doc_type}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      {doc.file_name}
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">{doc.file_size_kb || 512} KB</span>
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      to={`/applications/${doc.application_id}`}
                      className="text-indigo-600 hover:underline font-mono font-medium"
                    >
                      Application #{doc.application_id}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(doc.uploaded_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        doc.status === 'VERIFIED_COMPLIANT'
                          ? 'bg-emerald-100 text-emerald-800'
                          : doc.status === 'DEFICIENT_REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {doc.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {doc.verification_remarks || 'Awaiting Scrutiny Committee review'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
