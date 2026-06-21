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
        <Route path="subscriptions" element={<Dashboard />} />
        <Route path="payments" element={<Dashboard />} />
        <Route path="settings" element={<Dashboard />} />
        <Route path="profile" element={<Dashboard />} />

        {/* Pharmacy User routes */}
        <Route path="categories" element={<Categories />} />
        <Route path="brands" element={<Brands />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="medicines" element={<Dashboard />} />
        <Route path="purchases" element={<Dashboard />} />
        <Route path="sales" element={<Dashboard />} />
        <Route path="customers" element={<Dashboard />} />
        <Route path="reports" element={<Dashboard />} />
        <Route path="staff" element={<Staff />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}