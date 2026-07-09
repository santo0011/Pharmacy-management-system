import { useSelector, useDispatch } from 'react-redux';
import { logout as logoutAction } from '../redux/slices/authSlice';
import { showSuccess } from '../utils/sweetAlert';

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, loading } = useSelector((state) => state.auth);

  const logout = () => {
    dispatch(logoutAction());
    showSuccess('Logged out successfully.');
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === 'super_admin',
    isAdmin: user?.role === 'admin',
    isPharmacist: user?.role === 'pharmacist',
    isCashier: user?.role === 'cashier',
    isPharmacyUser: user?.role && user.role !== 'super_admin',
    canViewUserManagement: user?.role === 'super_admin',
    canManageUsers: user?.role === 'super_admin',
    canManagePharmacy: user?.role === 'super_admin',
    canManageCategories: user?.role === 'admin' || user?.role === 'pharmacist',
    canManageBrands: user?.role === 'admin',
    canManageSuppliers: user?.role === 'admin',
    canManageMedicines: user?.role === 'admin' || user?.role === 'pharmacist',
    canManagePurchases: user?.role === 'admin',
    canManageSales: user?.role === 'admin' || user?.role === 'pharmacist' || user?.role === 'cashier',
    canViewCustomers: user?.role === 'admin' || user?.role === 'pharmacist' || user?.role === 'cashier',
    canViewReports: user?.role === 'admin',
    canAccessSettings: user?.role === 'admin' || user?.role === 'super_admin',
    logout,
  };
};
