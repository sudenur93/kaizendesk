import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import CustomerTicketsPage from './pages/CustomerTicketsPage';
import CustomerNewTicketPage from './pages/CustomerNewTicketPage';
import CustomerTicketDetailPage from './pages/CustomerTicketDetailPage';
import AgentTicketsPage from './pages/AgentTicketsPage';
import AgentTicketDetailPage from './pages/AgentTicketDetailPage';
import ManagerDashboardPage from './pages/ManagerDashboardPage';
import ManagerSLAPage from './pages/ManagerSLAPage';
import ManagerTeamPage from './pages/ManagerTeamPage';
import ManagerApprovalsPage from './pages/ManagerApprovalsPage';
import PortalShell from './components/PortalShell';
import AccountSettingsPage from './pages/AccountSettingsPage';
import { getRole, isLoggedIn } from './services/api';

function ProtectedRoute({ children, allowedRoles }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  const role = getRole();
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />;
  return children;
}

function RoleRedirect() {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  const role = getRole();
  if (role === 'MANAGER') return <Navigate to="/manager/dashboard" replace />;
  if (role === 'AGENT') return <Navigate to="/agent/tickets" replace />;
  return <Navigate to="/customer/tickets" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route
          element={
            <ProtectedRoute allowedRoles={['CUSTOMER', 'AGENT', 'MANAGER']}>
              <PortalShell />
            </ProtectedRoute>
          }
        >
          <Route
            path="/customer/tickets"
            element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}>
                <CustomerTicketsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/tickets/new"
            element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}>
                <CustomerNewTicketPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customer/tickets/:id"
            element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}>
                <CustomerTicketDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agent/tickets"
            element={
              <ProtectedRoute allowedRoles={['AGENT', 'MANAGER']}>
                <AgentTicketsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agent/tickets/:id"
            element={
              <ProtectedRoute allowedRoles={['AGENT', 'MANAGER']}>
                <AgentTicketDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/dashboard"
            element={
              <ProtectedRoute allowedRoles={['MANAGER']}>
                <ManagerDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/sla"
            element={
              <ProtectedRoute allowedRoles={['MANAGER']}>
                <ManagerSLAPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/team"
            element={
              <ProtectedRoute allowedRoles={['MANAGER']}>
                <ManagerTeamPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/approvals"
            element={
              <ProtectedRoute allowedRoles={['MANAGER']}>
                <ManagerApprovalsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['CUSTOMER', 'AGENT', 'MANAGER']}>
                <AccountSettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="/" element={<RoleRedirect />} />
        <Route path="*" element={<RoleRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
