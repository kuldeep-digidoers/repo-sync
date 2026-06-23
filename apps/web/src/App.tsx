import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/auth-context";
import { LoginPage } from "./pages/login";
import { SignupPage } from "./pages/signup";
import { DashboardPage } from "./pages/dashboard";
import { RepositoriesPage } from "./pages/repositories";
import { RepositoryDetailPage } from "./pages/repository-detail";
import { PushEventDetailPage } from "./pages/push-event-detail";
import { HistoryPage } from "./pages/history";
import { SettingsPage } from "./pages/settings";
import { ManualSyncPage } from "./pages/manual-sync";
import { DashboardLayout } from "./components/layouts/dashboard-layout";
import { LoadingScreen } from "./components/ui/loading-screen";

export function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="repositories" element={<RepositoriesPage />} />
        <Route path="repositories/:id" element={<RepositoryDetailPage />} />
        <Route path="sync" element={<ManualSyncPage />} />
        <Route path="push-events/:id" element={<PushEventDetailPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
