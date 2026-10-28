import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
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
import { IntegrationPage } from './pages/IntegrationPage';
import { AIAssistantWidget } from './components/AIAssistantWidget';
import { LanguageProvider } from './context/LanguageContext';
import { LoadingState } from './components/States';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles,
}) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingState message="Verifying session and security clearance..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user.role;
    const hasRole =
      userRole === 'ADMIN' ||
      allowedRoles.includes(userRole) ||
      (userRole === 'BUREAU_OFFICER' && allowedRoles.includes('COMPETENT_AUTHORITY')) ||
      (userRole === 'REGIONAL_OFFICER' && allowedRoles.includes('SCRUTINY_OFFICER')) ||
      (userRole === 'EVC_MEMBER' && allowedRoles.includes('EVC_INSPECTOR'));

    if (!hasRole) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

const AppShell: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingState message="Initializing IntelliApprove Gov Portal..." />
      </div>
    );
  }

  // If on /login page, render it directly without AppShell framing
  if (location.pathname === '/login') {
    if (isAuthenticated) {
      return <Navigate to="/" replace />;
    }
    return <LoginPage />;
  }

  // If unauthenticated on any other route, redirect to /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex w-full">
        {/* Role-based App Shell Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/applications"
              element={
                <ProtectedRoute>
                  <ApplicationsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/applications/new"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'INSTITUTION']}>
                  <NewApplicationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/applications/:id"
              element={
                <ProtectedRoute>
                  <ApplicationDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/evc"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'BUREAU_OFFICER', 'REGIONAL_HEAD', 'REGIONAL_OFFICER', 'EVC_MEMBER']}>
                  <EVCPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/undertakings"
              element={
                <ProtectedRoute>
                  <UndertakingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <DocumentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute>
                  <AlertsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'BUREAU_OFFICER', 'REGIONAL_HEAD', 'REGIONAL_OFFICER']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'BUREAU_OFFICER', 'REGIONAL_HEAD']}>
                  <AuditExplorerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/config/workflow"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'BUREAU_OFFICER']}>
                  <WorkflowConfigPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/config/escalations"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'BUREAU_OFFICER']}>
                  <EscalationLadderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/config/compliance"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'BUREAU_OFFICER']}>
                  <ComplianceRulesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/integration"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'BUREAU_OFFICER']}>
                  <IntegrationPage />
                </ProtectedRoute>
              }
            />
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

      {/* Role-Scoped AI Statutory Query & Drafting Assistant */}
      <AIAssistantWidget />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
