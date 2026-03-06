import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CustomersPage from './pages/CustomersPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import TrackingPage from './pages/TrackingPage';
import LedgerPage from './pages/LedgerPage';
import ReportsPage from './pages/ReportsPage';
import EmployeesPage from './pages/EmployeesPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import FollowupsPage from './pages/FollowupsPage';
import DeliveryPartnersPage from './pages/DeliveryPartnersPage';
import CrmDashboardPage from './pages/crm/CrmDashboardPage';
import CrmLeadsPage from './pages/crm/CrmLeadsPage';
import CrmRemindersPage from './pages/crm/CrmRemindersPage';
import CrmMissedPage from './pages/crm/CrmMissedPage';
import CustomMessagesPage from './pages/crm/CustomMessagesPage';
import CrmToast from './components/crm/CrmToast';

function ProtectedRoute({ children, permission }) {
  const { user, hasPermission } = useApp();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    // Redirect to first available page
    const fallbacks = ['orders', 'customers', 'tracking', 'dashboard'];
    for (const fb of fallbacks) {
      if (hasPermission(fb)) {
        return <Navigate to={`/${fb}`} replace />;
      }
    }
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user } = useApp();

  // Determine default route based on role
  const getDefaultRoute = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'super_admin':
        return '/dashboard';
      case 'employee_orders':
        return '/orders';
      case 'employee_tracking':
        return '/tracking';
      default:
        return '/login';
    }
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={getDefaultRoute()} replace /> : <LoginPage />}
      />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute permission="dashboard">
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute permission="customers">
              <CustomersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute permission="products">
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute permission="orders">
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tracking"
          element={
            <ProtectedRoute permission="tracking">
              <TrackingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ledger"
          element={
            <ProtectedRoute permission="ledger">
              <LedgerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute permission="reports">
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute permission="createEmployee">
              <EmployeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity-logs"
          element={
            <ProtectedRoute permission="createEmployee">
              <ActivityLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/followups"
          element={
            <ProtectedRoute permission="followups">
              <FollowupsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/delivery-partners"
          element={
            <ProtectedRoute permission="deliveryPartners">
              <DeliveryPartnersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/crm/dashboard"
          element={
            <ProtectedRoute permission="crm">
              <CrmDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/crm/leads"
          element={
            <ProtectedRoute permission="crm">
              <CrmLeadsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/crm/reminders"
          element={
            <ProtectedRoute permission="crm">
              <CrmRemindersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/crm/missed"
          element={
            <ProtectedRoute permission="crm">
              <CrmMissedPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/crm/messages"
          element={
            <ProtectedRoute permission="crm">
              <CustomMessagesPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
        <CrmToast />
      </BrowserRouter>
    </AppProvider>
  );
}
