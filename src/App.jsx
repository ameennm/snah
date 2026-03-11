import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import CrmToast from './components/crm/CrmToast';

// Lazy-load all pages — they are only downloaded when first visited
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const TrackingPage = lazy(() => import('./pages/TrackingPage'));
const LedgerPage = lazy(() => import('./pages/LedgerPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage'));
const ActivityLogsPage = lazy(() => import('./pages/ActivityLogsPage'));
const FollowupsPage = lazy(() => import('./pages/FollowupsPage'));
const DeliveryPartnersPage = lazy(() => import('./pages/DeliveryPartnersPage'));
const CrmDashboardPage = lazy(() => import('./pages/crm/CrmDashboardPage'));
const CrmLeadsPage = lazy(() => import('./pages/crm/CrmLeadsPage'));
const CrmRemindersPage = lazy(() => import('./pages/crm/CrmRemindersPage'));
const CrmMissedPage = lazy(() => import('./pages/crm/CrmMissedPage'));
const CustomMessagesPage = lazy(() => import('./pages/crm/CustomMessagesPage'));

// Minimal spinner shown while a lazy page chunk is loading
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '60vh', flexDirection: 'column', gap: '12px',
      color: 'var(--text-tertiary)',
    }}>
      <div style={{
        width: '32px', height: '32px', border: '3px solid var(--border-light)',
        borderTop: '3px solid var(--primary-600)', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <span style={{ fontSize: '0.875rem' }}>Loading...</span>
    </div>
  );
}

function ProtectedRoute({ children, permission }) {
  const { user, hasPermission } = useApp();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    const fallbacks = ['orders', 'customers', 'tracking', 'dashboard'];
    for (const fb of fallbacks) {
      if (hasPermission(fb)) {
        return <Navigate to={`/${fb}`} replace />;
      }
    }
    return <Navigate to="/login" replace />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  );
}

function AppRoutes() {
  const { user, hasPermission } = useApp();
  const getDefaultRoute = () => {
    if (!user) return '/login';
    const fallbacks = ['dashboard', 'orders', 'tracking', 'crm', 'customers'];
    for (const fb of fallbacks) {
      if (hasPermission(fb)) {
        return fb === 'crm' ? '/crm/dashboard' : `/${fb}`;
      }
    }
    return '/login';
  };

  return (
    <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to={getDefaultRoute()} replace /> : <LoginPage />}
        />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<ProtectedRoute permission="dashboard"><DashboardPage /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute permission="customers"><CustomersPage /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute permission="products"><ProductsPage /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute permission="orders"><OrdersPage /></ProtectedRoute>} />
          <Route path="/tracking" element={<ProtectedRoute permission="tracking"><TrackingPage /></ProtectedRoute>} />
          <Route path="/ledger" element={<ProtectedRoute permission="ledger"><LedgerPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute permission="reports"><ReportsPage /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute permission="createEmployee"><EmployeesPage /></ProtectedRoute>} />
          <Route path="/activity-logs" element={<ProtectedRoute permission="createEmployee"><ActivityLogsPage /></ProtectedRoute>} />
          <Route path="/followups" element={<ProtectedRoute permission="followups"><FollowupsPage /></ProtectedRoute>} />
          <Route path="/delivery-partners" element={<ProtectedRoute permission="deliveryPartners"><DeliveryPartnersPage /></ProtectedRoute>} />
          <Route path="/crm/dashboard" element={<ProtectedRoute permission="crm"><CrmDashboardPage /></ProtectedRoute>} />
          <Route path="/crm/leads" element={<ProtectedRoute permission="crm"><CrmLeadsPage /></ProtectedRoute>} />
          <Route path="/crm/reminders" element={<ProtectedRoute permission="crm"><CrmRemindersPage /></ProtectedRoute>} />
          <Route path="/crm/missed" element={<ProtectedRoute permission="crm"><CrmMissedPage /></ProtectedRoute>} />
          <Route path="/crm/messages" element={<ProtectedRoute permission="crm"><CustomMessagesPage /></ProtectedRoute>} />
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
