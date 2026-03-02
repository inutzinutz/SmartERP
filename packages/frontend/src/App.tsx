import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import MainLayout from '@/layouts/MainLayout';
import AuthLayout from '@/layouts/AuthLayout';
import LoginPage from '@/modules/auth/LoginPage';
import RegisterPage from '@/modules/auth/RegisterPage';
import DashboardPage from '@/modules/dashboard/DashboardPage';
import ProductsPage from '@/modules/products/ProductsPage';
import ProductDetailPage from '@/modules/products/ProductDetailPage';
import InventoryPage from '@/modules/inventory/InventoryPage';
import WarehousesPage from '@/modules/inventory/WarehousesPage';
import SalesOrdersPage from '@/modules/sales/SalesOrdersPage';
import CustomersPage from '@/modules/sales/CustomersPage';
import PurchaseOrdersPage from '@/modules/purchases/PurchaseOrdersPage';
import SuppliersPage from '@/modules/purchases/SuppliersPage';
import AccountsPage from '@/modules/finance/AccountsPage';
import JournalEntriesPage from '@/modules/finance/JournalEntriesPage';
import FinancialReportsPage from '@/modules/finance/FinancialReportsPage';
import ExpensesPage from '@/modules/expenses/ExpensesPage';
import UsersPage from '@/modules/users/UsersPage';
import SettingsPage from '@/modules/settings/SettingsPage';

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
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
