import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Spin, Result, Button } from 'antd';
import { useAuthStore } from '@/store/authStore';
import MainLayout from '@/layouts/MainLayout';
import AuthLayout from '@/layouts/AuthLayout';

// Lazy-loaded page components for code splitting
const LoginPage = lazy(() => import('@/modules/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/modules/auth/RegisterPage'));
const DashboardPage = lazy(() => import('@/modules/dashboard/DashboardPage'));
const ProductsPage = lazy(() => import('@/modules/products/ProductsPage'));
const ProductDetailPage = lazy(() => import('@/modules/products/ProductDetailPage'));
const InventoryPage = lazy(() => import('@/modules/inventory/InventoryPage'));
const WarehousesPage = lazy(() => import('@/modules/inventory/WarehousesPage'));
const SalesOrdersPage = lazy(() => import('@/modules/sales/SalesOrdersPage'));
const QuotationsPage = lazy(() => import('@/modules/sales/QuotationsPage'));
const CustomersPage = lazy(() => import('@/modules/sales/CustomersPage'));
const PurchaseOrdersPage = lazy(() => import('@/modules/purchases/PurchaseOrdersPage'));
const SuppliersPage = lazy(() => import('@/modules/purchases/SuppliersPage'));
const AccountsPage = lazy(() => import('@/modules/finance/AccountsPage'));
const JournalEntriesPage = lazy(() => import('@/modules/finance/JournalEntriesPage'));
const FinancialReportsPage = lazy(() => import('@/modules/finance/FinancialReportsPage'));
const ExpensesPage = lazy(() => import('@/modules/expenses/ExpensesPage'));
const UsersPage = lazy(() => import('@/modules/users/UsersPage'));
const SettingsPage = lazy(() => import('@/modules/settings/SettingsPage'));

// Loading fallback
function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
      <Spin size="large" tip="Loading..." />
    </div>
  );
}

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="Something went wrong"
          subTitle={this.state.error?.message || 'An unexpected error occurred'}
          extra={
            <Button type="primary" onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}>
              Reload Page
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}

// 404 Not Found page
function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="404"
      subTitle="Sorry, the page you visited does not exist."
      extra={<Button type="primary" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>}
    />
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Auth Routes */}
          <Route element={<GuestRoute><AuthLayout /></GuestRoute>}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Protected Routes */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* Products & Inventory */}
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:id" element={<ProductDetailPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/warehouses" element={<WarehousesPage />} />

            {/* Sales */}
            <Route path="/sales/quotations" element={<QuotationsPage />} />
            <Route path="/sales/orders" element={<SalesOrdersPage />} />
            <Route path="/sales/customers" element={<CustomersPage />} />

            {/* Purchases */}
            <Route path="/purchases/orders" element={<PurchaseOrdersPage />} />
            <Route path="/purchases/suppliers" element={<SuppliersPage />} />

            {/* Finance */}
            <Route path="/finance/accounts" element={<AccountsPage />} />
            <Route path="/finance/journal" element={<JournalEntriesPage />} />
            <Route path="/finance/reports" element={<FinancialReportsPage />} />

            {/* Expenses */}
            <Route path="/expenses" element={<ExpensesPage />} />

            {/* Admin */}
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* 404 inside app layout */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
