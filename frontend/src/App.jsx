import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import MainLayout from './layouts/MainLayout';
import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/EnhancedDashboard';
import Categories from './pages/categories/Categories';
import Brands from './pages/brands/Brands';
import Suppliers from './pages/suppliers/Suppliers';
import Pharmacies from './pages/pharmacies/Pharmacies';
import Staff from './pages/staff/Staff';
import Medicines from './pages/medicines/Medicines';
import MedicineForm from './pages/medicines/MedicineForm';
import MedicineDetail from './pages/medicines/MedicineDetail';
import Purchases from './pages/purchases/Purchases';
import PurchaseForm from './pages/purchases/PurchaseForm';
import PurchaseDetail from './pages/purchases/PurchaseDetail';
import Sales from './pages/sales/Sales';
import SaleForm from './pages/sales/SaleForm';
import SaleDetail from './pages/sales/SaleDetail';
import Invoice from './pages/sales/Invoice';
import Customers from './pages/customers/Customers';
import Reports from './pages/reports/Reports';
import Subscriptions from './pages/subscriptions/Subscriptions';
import Payments from './pages/payments/Payments';
import Settings from './pages/settings/Settings';
import Profile from './pages/profile/Profile';
import NotificationCenter from './pages/notifications/NotificationCenter';
import ActivityLogs from './pages/activity-logs/ActivityLogs';
import BackupRestore from './pages/backup/BackupRestore';
import BulkImport from './pages/medicines/BulkImport';
import AdvancedAnalytics from './pages/super-admin/AdvancedAnalytics';
import SystemHealth from './pages/super-admin/SystemHealth';

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" /> : children;
}

function AppLayout() {
  const { isAuthenticated, isSuperAdmin } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" />;

  // Super Admin uses SuperAdminLayout
  if (isSuperAdmin) {
    return (
      <SuperAdminLayout />
    );
  }

  // Pharmacy users (admin, pharmacist, cashier) use MainLayout
  return (
    <MainLayout />
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* All authenticated routes under one path, layout switches by role */}
      <Route path="/" element={<AppLayout />}>
        {/* Common routes */}
        <Route index element={<Dashboard />} />

        {/* Super Admin routes */}
        <Route path="pharmacies" element={<Pharmacies />} />
        <Route path="payments" element={<Payments />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
        <Route path="analytics" element={<AdvancedAnalytics />} />
        <Route path="system-health" element={<SystemHealth />} />

        {/* Pharmacy User routes */}
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="categories" element={<Categories />} />
        <Route path="brands" element={<Brands />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="customers" element={<Customers />} />
        <Route path="reports" element={<Reports />} />
        <Route path="medicines" element={<Medicines />} />
        <Route path="medicines/new" element={<MedicineForm />} />
        <Route path="medicines/bulk-import" element={<BulkImport />} />
        <Route path="medicines/:id" element={<MedicineDetail />} />
        <Route path="medicines/:id/edit" element={<MedicineForm />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="purchases/new" element={<PurchaseForm />} />
        <Route path="purchases/:id" element={<PurchaseDetail />} />
        <Route path="purchases/:id/edit" element={<PurchaseForm />} />
        <Route path="sales" element={<Sales />} />
        <Route path="sales/new" element={<SaleForm />} />
        <Route path="sales/:id" element={<SaleDetail />} />
        <Route path="sales/:id/edit" element={<SaleForm />} />
        <Route path="sales/:id/invoice" element={<Invoice />} />
        <Route path="staff" element={<Staff />} />
        <Route path="notifications" element={<NotificationCenter />} />
        <Route path="activity-logs" element={<ActivityLogs />} />
        <Route path="backup" element={<BackupRestore />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}