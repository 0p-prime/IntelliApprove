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
import { NotFoundPage } from './pages/NotFoundPage';
import { AIAssistantWidget } from './components/AIAssistantWidget';
import { GuidedTourModal } from './components/GuidedTourModal';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './context/ToastContext';
import { LoadingState } from './components/States';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({
  children,
  allowedRoles,
}) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <LoadingState message="Verifying session clearance..." />
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
  const { isAuthenticated, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <LoadingState message="Initializing IntelliApprove Portal..." />
      </div>
    );
  }

  if (location.pathname === '/login') {
    if (isAuthenticated) {
      return <Navigate to="/" replace />;
    }
    return <LoginPage />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex w-full font-sans antialiased text-[#18181B]">
      {/* 250px Left Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#FAFAFA]">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenTour={() => setTourOpen(true)}
        />

        <main className="flex-1 min-w-0 px-6 sm:px-10 lg:px-12 pt-6 pb-20 max-w-7xl w-full mx-auto">
          <div key={location.pathname} className="animate-page-enter">
            <Routes location={location}>
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
                <ProtectedRoute>
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
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </div>
        </main>
      </div>

      {/* AI Governance Assistant */}
      <AIAssistantWidget />

      {/* Guided Tour Modal */}
      <GuidedTourModal isOpen={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </ToastProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
