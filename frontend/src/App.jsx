import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import MainLayout from './layouts/MainLayout';
import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';
import Categories from './pages/categories/Categories';
import Brands from './pages/brands/Brands';
import Suppliers from './pages/suppliers/Suppliers';
import Pharmacies from './pages/pharmacies/Pharmacies';
import Staff from './pages/staff/Staff';
import Medicines from './pages/medicines/Medicines';
import MedicineForm from './pages/medicines/MedicineForm';
import MedicineDetail from './pages/medicines/MedicineDetail';
import Subscriptions from './pages/subscriptions/Subscriptions';
import Payments from './pages/payments/Payments';
import Settings from './pages/settings/Settings';
import Profile from './pages/profile/Profile';

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
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="payments" element={<Payments />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />

        {/* Pharmacy User routes */}
        <Route path="categories" element={<Categories />} />
        <Route path="brands" element={<Brands />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="purchases" element={<Dashboard />} />
        <Route path="sales" element={<Dashboard />} />
        <Route path="customers" element={<Dashboard />} />
        <Route path="reports" element={<Dashboard />} />
        <Route path="medicines" element={<Medicines />} />
        <Route path="medicines/new" element={<MedicineForm />} />
        <Route path="medicines/:id" element={<MedicineDetail />} />
        <Route path="medicines/:id/edit" element={<MedicineForm />} />
        <Route path="staff" element={<Staff />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}