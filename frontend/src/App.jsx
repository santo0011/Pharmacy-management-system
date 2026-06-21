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

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" /> : children;
}

function SuperAdminRoute({ children }) {
  const { isAuthenticated, isSuperAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!isSuperAdmin) return <Navigate to="/" />;
  return children;
}

function PharmacyRoute({ children }) {
  const { isAuthenticated, isSuperAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (isSuperAdmin) return <Navigate to="/" />;
  return children;
}

export default function App() {
  const { isSuperAdmin } = useAuth();

  const getHomePath = () => {
    if (isSuperAdmin) return '/';
    return '/';
  };

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

      {/* Super Admin Routes */}
      <Route
        path="/"
        element={
          <SuperAdminRoute>
            <SuperAdminLayout />
          </SuperAdminRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="pharmacies" element={<Pharmacies />} />
        <Route path="subscriptions" element={<Dashboard />} />
        <Route path="payments" element={<Dashboard />} />
        <Route path="settings" element={<Dashboard />} />
        <Route path="profile" element={<Dashboard />} />
      </Route>

      {/* Pharmacy User Routes (Admin, Pharmacist, Cashier) */}
      <Route
        path="/pharmacy"
        element={
          <PharmacyRoute>
            <MainLayout />
          </PharmacyRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="categories" element={<Categories />} />
        <Route path="brands" element={<Brands />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="medicines" element={<Dashboard />} />
        <Route path="purchases" element={<Dashboard />} />
        <Route path="sales" element={<Dashboard />} />
        <Route path="customers" element={<Dashboard />} />
        <Route path="reports" element={<Dashboard />} />
        <Route path="staff" element={<Staff />} />
        <Route path="settings" element={<Dashboard />} />
      </Route>

      <Route path="*" element={<Navigate to={getHomePath()} />} />
    </Routes>
  );
}