import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsListPage } from './pages/ApplicationsListPage';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { NewApplicationPage } from './pages/NewApplicationPage';
import { EVCPage } from './pages/EVCPage';
import { UndertakingsPage } from './pages/UndertakingsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { AlertsPage } from './pages/AlertsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditExplorerPage } from './pages/AuditExplorerPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';
import { WorkflowConfigPage } from './pages/WorkflowConfigPage';
import { EscalationLadderPage } from './pages/EscalationLadderPage';
import { ComplianceRulesPage } from './pages/ComplianceRulesPage';
import { LoadingState } from './components/States';

const AppShell: React.FC = () => {
  const { loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingState message="Initializing IntelliApprove Gov Portal..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex w-full">
        {/* App Shell Sidebar Navigation */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/applications" element={<ApplicationsListPage />} />
            <Route path="/applications/new" element={<NewApplicationPage />} />
            <Route path="/applications/:id" element={<ApplicationDetailPage />} />
            <Route path="/evc" element={<EVCPage />} />
            <Route path="/undertakings" element={<UndertakingsPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/audit" element={<AuditExplorerPage />} />
            <Route path="/admin" element={<AdminSettingsPage />} />
            <Route path="/config/workflow" element={<WorkflowConfigPage />} />
            <Route path="/config/escalations" element={<EscalationLadderPage />} />
            <Route path="/config/compliance" element={<ComplianceRulesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <footer className="bg-white border-t border-slate-200 py-4 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">IntelliApprove</span>
            <span>•</span>
            <span>Smart India Hackathon 2026 (PS 26262)</span>
          </div>
          <div className="text-[11px] text-slate-400 text-center sm:text-right">
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
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
