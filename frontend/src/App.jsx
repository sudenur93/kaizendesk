/**
 * Uygulamanın ana bileşeni — tüm sayfa yönlendirmelerini ve rol tabanlı erişim kontrolünü yönetir.
 *
 * Mimari:
 *   - BrowserRouter ile HTML5 history API tabanlı yönlendirme
 *   - ProtectedRoute: giriş yapılmamışsa /login'e, yanlış roldeyse /'e yönlendirir
 *   - RoleRedirect: rol'e göre doğru portale yönlendirir (MANAGER→dashboard, AGENT→tickets, CUSTOMER→tickets)
 *   - PortalShell tüm korumalı sayfaların ortak layout çerçevesi (Sidebar + Topbar)
 *
 * Route hiyerarşisi:
 *   /login, /register, /forgot-password  → giriş gerektirmez
 *   /customer/**  → yalnızca CUSTOMER rolü
 *   /agent/**     → AGENT ve MANAGER rolleri
 *   /manager/**   → yalnızca MANAGER rolü
 *   /archive, /settings → tüm roller
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { getRole, isLoggedIn } from './services/api';
import PortalShell from './components/PortalShell';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import CustomerTicketsPage from './pages/CustomerTicketsPage';
import CustomerNewTicketPage from './pages/CustomerNewTicketPage';
import CustomerTicketDetailPage from './pages/CustomerTicketDetailPage';
import AgentTicketsPage from './pages/AgentTicketsPage';
import AgentTicketDetailPage from './pages/AgentTicketDetailPage';
import AgentTeamPage from './pages/AgentTeamPage';
import ManagerDashboardPage from './pages/ManagerDashboardPage';
import ManagerSLAPage from './pages/ManagerSLAPage';
import ManagerTeamPage from './pages/ManagerTeamPage';
import ManagerApprovalsPage from './pages/ManagerApprovalsPage';
import AccountSettingsPage from './pages/AccountSettingsPage';
import ArchivePage from './pages/ArchivePage';
import FavoritesPage from './pages/FavoritesPage';

/**
 * Korumalı route sarmalayıcısı.
 * - Giriş yapılmamışsa /login'e yönlendirir
 * - allowedRoles listesinde kullanıcının rolü yoksa / 'a yönlendirir (RoleRedirect devreye girer)
 */
function ProtectedRoute({ children, allowedRoles }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  const role = getRole();
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />;
  return children;
}

/**
 * Kullanıcının rolüne göre doğru sayfaya yönlendiren bileşen.
 * Giriş sonrası veya yetkisiz sayfa erişiminde devreye girer.
 */
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
            path="/agent/team"
            element={
              <ProtectedRoute allowedRoles={['AGENT', 'MANAGER']}>
                <AgentTeamPage />
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
            path="/archive"
            element={
              <ProtectedRoute allowedRoles={['CUSTOMER', 'AGENT', 'MANAGER']}>
                <ArchivePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute allowedRoles={['CUSTOMER', 'AGENT', 'MANAGER']}>
                <FavoritesPage />
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
