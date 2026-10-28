import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsListPage } from './pages/ApplicationsListPage';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { NewApplicationPage } from './pages/NewApplicationPage';
import { WorkflowConfigPage } from './pages/WorkflowConfigPage';
import { EscalationLadderPage } from './pages/EscalationLadderPage';
import { ComplianceRulesPage } from './pages/ComplianceRulesPage';
import { UndertakingsPage } from './pages/UndertakingsPage';
import { AuditExplorerPage } from './pages/AuditExplorerPage';
import { LoadingState } from './components/States';

const MainLayout: React.FC = () => {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingState message="Initializing IntelliApprove Gov Portal..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <Header />
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/applications" element={<ApplicationsListPage />} />
          <Route path="/applications/new" element={<NewApplicationPage />} />
          <Route path="/applications/:id" element={<ApplicationDetailPage />} />
          <Route path="/config/workflow" element={<WorkflowConfigPage />} />
          <Route path="/config/escalations" element={<EscalationLadderPage />} />
          <Route path="/config/compliance" element={<ComplianceRulesPage />} />
          <Route path="/undertakings" element={<UndertakingsPage />} />
          <Route path="/audit" element={<AuditExplorerPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">IntelliApprove</span>
            <span>•</span>
            <span>Smart India Hackathon 2026 (PS 26262)</span>
          </div>
          <div className="text-[11px] text-center sm:text-right text-slate-400">
            AICTE Regulatory Compliance & Vigilance Assurance • Strict Human Oversight Mandated
          </div>
        </div>
      </footer>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MainLayout />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
