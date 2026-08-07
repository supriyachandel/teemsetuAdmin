import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';
import { store } from '@/store';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchMe } from '@/store/slices/authSlice';
import { initTheme } from '@/store/slices/themeSlice';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { EmployeesPage } from '@/pages/employees/EmployeesPage';
import { JobsPage } from '@/pages/jobs/JobsPage';
import { BirthdaysPage } from '@/pages/employees/BirthdaysPage';
import { AttendancePage } from '@/pages/attendance/AttendancePage';
import { LeavesPage } from '@/pages/leaves/LeavesPage';
import { HolidaysPage } from '@/pages/leaves/HolidaysPage';
import { ProjectsPage } from '@/pages/projects/ProjectsPage';
import { TasksPage } from '@/pages/tasks/TasksPage';
import { PayrollPage } from '@/pages/payroll/PayrollPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';
import { ChatPage } from '@/pages/chat/ChatPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { RolesPage } from '@/pages/admin/RolesPage';
import { SubscriptionsPage } from '@/pages/subscriptions/SubscriptionsPage';
import { CompanyBrandingPage } from '@/pages/company/CompanyBrandingPage';
import { CompaniesPage } from '@/pages/platform/CompaniesPage';
import { ROLES } from '@crm/shared';
import { useSocket } from '@/hooks/useSocket';

function AppRoutes() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isInitialized } = useAppSelector((s) => s.auth);

  useEffect(() => {
    dispatch(initTheme());
    dispatch(fetchMe());
  }, [dispatch]);

  useSocket();

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" /> : <RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route
          path="employees"
          element={
            <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.HR, ROLES.MANAGER]}>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="jobs"
          element={
            <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.HR]}>
              <JobsPage />
            </ProtectedRoute>
          }
        />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="birthdays" element={<BirthdaysPage />} />
        <Route path="leaves" element={<LeavesPage />} />
        <Route path="holidays" element={<HolidaysPage />} />
        <Route
          path="payroll"
          element={
            <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.HR]}>
              <PayrollPage />
            </ProtectedRoute>
          }
        />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route
          path="reports"
          element={
            <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.HR, ROLES.MANAGER]}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute roles={[ROLES.SUPER_ADMIN]}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/roles"
          element={
            <ProtectedRoute roles={[ROLES.SUPER_ADMIN]}>
              <RolesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="subscriptions"
          element={
            <ProtectedRoute roles={[ROLES.SUPER_ADMIN]}>
              <SubscriptionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="company/branding"
          element={
            <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.HR]}>
              <CompanyBrandingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute roles={[ROLES.SUPER_ADMIN, ROLES.HR]}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="platform/companies"
          element={
            <ProtectedRoute roles={[ROLES.SYSTEM_ADMIN]}>
              <CompaniesPage />
            </ProtectedRoute>
          }
        />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster richColors position="top-right" closeButton duration={3000} />
      </BrowserRouter>
    </Provider>
  );
}
