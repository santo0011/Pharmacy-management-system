import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSubscriptionStatus } from '../redux/slices/dashboardSlice';
import { confirmAction } from '../utils/sweetAlert';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(true);
  const [managementOpen, setManagementOpen] = useState(() => window.innerWidth > 768);
  const { user, logout } = useAuth();
  const dispatch = useDispatch();
  const location = useLocation();
  const { subscriptionStatus } = useSelector((state) => state.dashboard);

  useEffect(() => {
    // Fetch subscription status on mount and periodically
    if (user?.role === 'admin') {
      dispatch(fetchSubscriptionStatus());
      const interval = setInterval(() => {
        dispatch(fetchSubscriptionStatus());
      }, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [dispatch, user]);

  const getPageTitle = () => {
    const path = location.pathname;
    const titles = {
      '/': 'Dashboard',
      '/categories': 'Categories',
      '/brands': 'Brands',
      '/suppliers': 'Suppliers',
      '/medicines': 'Medicines',
      '/purchases': 'Purchases',
      '/sales': 'Sales',
      '/customers': 'Customers',
      '/reports': 'Reports',
      '/staff': 'Staff',
      '/settings': 'Settings',
    };
    return titles[path] || path.charAt(1).toUpperCase() + path.slice(2);
  };

  // Check if subscription is expired - only allow Dashboard, Subscriptions, and Logout
  const isExpired = subscriptionStatus?.status === 'expired';
  const isExpiringSoon = subscriptionStatus?.status === 'expiring_soon';
  const isSubRoute = (path) => location.pathname === path || location.pathname.startsWith(path + '/');
  const isAllowedRoute = location.pathname === '/' || location.pathname === '/subscriptions' || location.pathname === '/profile';

  // Filter nav items based on user role
  const getFilteredNavItems = () => {
    const inventoryItems = [
      { path: '/medicines', label: 'Medicines', icon: 'fa-solid fa-pills' },
      { path: '/categories', label: 'Categories', icon: 'fa-solid fa-tags' },
      { path: '/brands', label: 'Brands', icon: 'fa-solid fa-copyright' },
      { path: '/suppliers', label: 'Suppliers', icon: 'fa-solid fa-truck' },
    ];

    const salesItems = [
      { path: '/purchases', label: 'Purchases', icon: 'fa-solid fa-cart-plus' },
      { path: '/sales', label: 'Sales', icon: 'fa-solid fa-cash-register' },
      { path: '/customers', label: 'Customers', icon: 'fa-solid fa-users' },
    ];

    const managementItems = [
      { path: '/subscriptions', label: 'Subscription', icon: 'fa-solid fa-credit-card' },
      { path: '/reports', label: 'Reports', icon: 'fa-solid fa-chart-bar' },
      { path: '/staff', label: 'Staff', icon: 'fa-solid fa-user-md' },
      { path: '/settings', label: 'Settings', icon: 'fa-solid fa-gear' },
    ];

    if (user?.role === 'admin') {
      return { inventory: inventoryItems, sales: salesItems, management: managementItems };
    }
    if (user?.role === 'pharmacist') {
      return {
        inventory: inventoryItems,
        sales: salesItems.filter((item) => ['/sales', '/customers'].includes(item.path)),
        management: [],
      };
    }
    if (user?.role === 'cashier') {
      return {
        inventory: [],
        sales: salesItems.filter((item) => ['/sales', '/customers'].includes(item.path)),
        management: [],
      };
    }
    return { inventory: [], sales: [], management: [] };
  };

  const filteredItems = getFilteredNavItems();

  // When expired, show only allowed sidebar items
  const getExpiredNavItems = () => {
    return [
      { path: '/', label: 'Dashboard', icon: 'fa-solid fa-chart-pie' },
      { path: '/subscriptions', label: 'Subscription', icon: 'fa-solid fa-credit-card' },
    ];
  };

  // Show subscription expiry/expired banner
  const renderSubscriptionBanner = () => {
    if (!subscriptionStatus) return null;

    if (isExpired) {
      return (
        <div style={{
          padding: '10px 16px',
          backgroundColor: '#fce4ec',
          borderBottom: '1px solid #ef9a9a',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
        }}>
          <i className="fa-solid fa-circle-exclamation" style={{ color: '#e53935' }}></i>
          <span style={{ color: '#c62828' }}>
            <strong>Subscription Expired.</strong> Your subscription has ended. Please renew to access all features.
          </span>
          {location.pathname !== '/subscriptions' && (
            <a href="/subscriptions" style={{ color: '#1565c0', marginLeft: 'auto', fontWeight: 500, textDecoration: 'underline' }}>
              Renew Now →
            </a>
          )}
        </div>
      );
    }

    if (isExpiringSoon && subscriptionStatus.daysRemaining > 0) {
      const color = subscriptionStatus.daysRemaining <= 3 ? '#e65100' : '#f57f17';
      const bgColor = subscriptionStatus.daysRemaining <= 3 ? '#fff3e0' : '#fff8e1';
      const borderColor = subscriptionStatus.daysRemaining <= 3 ? '#ffcc80' : '#ffe082';
      return (
        <div style={{
          padding: '10px 16px',
          backgroundColor: bgColor,
          borderBottom: `1px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13px',
        }}>
          <i className="fa-solid fa-clock" style={{ color }}></i>
          <span style={{ color }}>
            <strong>Subscription Expiring Soon.</strong> Your subscription will end in {subscriptionStatus.daysRemaining} day{subscriptionStatus.daysRemaining > 1 ? 's' : ''}. Please renew to avoid interruption.
          </span>
          <a href="/subscriptions" style={{ color: '#1565c0', marginLeft: 'auto', fontWeight: 500, textDecoration: 'underline' }}>
            Renew Now →
          </a>
        </div>
      );
    }

    return null;
  };

  // If expired and not on allowed routes, block content
  if (isExpired && !isAllowedRoute && user?.role === 'admin') {
    return (
      <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <i className="fa-solid fa-prescription-bottle-medical"></i>
          <div>
            <h3>Pharmacy</h3>
            <span>Management System</span>
          </div>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
          <nav className="sidebar-nav">
            <div className="nav-label">Main Menu</div>
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setSidebarOpen(false)}>
              <i className="fa-solid fa-chart-pie"></i><span>Dashboard</span>
            </NavLink>
            <NavLink to="/subscriptions" className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setSidebarOpen(false)}>
              <i className="fa-solid fa-credit-card"></i><span>Subscription</span>
            </NavLink>
            <div className="nav-label" style={{ marginTop: 'auto' }}>Account</div>
            <a className="sidebar-logout" onClick={async (e) => { e.preventDefault(); const confirmed = await confirmAction('Logout', 'Are you sure you want to logout?', 'Logout'); if (confirmed) logout(); }} style={{ cursor: 'pointer' }}>
              <i className="fa-solid fa-right-from-bracket"></i><span>Logout</span>
            </a>
          </nav>
        </aside>
        <div className="main-content">
          <header className="header">
            <div className="header-left">
              <button className="toggle-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>
                <i className="fa-solid fa-bars"></i>
              </button>
              <h4>Subscription Expired</h4>
            </div>
          </header>
          <div className="page-content">
            <div className="empty-state" style={{ padding: '60px' }}>
              <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '64px', color: '#ef4444', marginBottom: '16px' }}></i>
              <h4>Subscription Expired</h4>
              <p>Your pharmacy subscription has expired. Please renew your subscription to continue using all features.</p>
              <a href="/subscriptions" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                <i className="fa-solid fa-credit-card"></i> Renew Subscription
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <i className="fa-solid fa-prescription-bottle-medical"></i>
          <div>
            <h3>Pharmacy</h3>
            <span>Management System</span>
          </div>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">Main Menu</div>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setSidebarOpen(false)}>
            <i className="fa-solid fa-chart-pie"></i><span>Dashboard</span>
          </NavLink>

          {/* Inventory Group */}
          {filteredItems.inventory.length > 0 && (
            <>
              <div className="nav-group-header" onClick={() => setInventoryOpen(!inventoryOpen)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span>Inventory</span>
                <i className={`fa-solid fa-chevron-${inventoryOpen ? 'down' : 'right'}`} style={{ fontSize: '10px' }}></i>
              </div>
              {inventoryOpen && filteredItems.inventory.map((item) => (
                <NavLink key={item.path} to={item.path} end className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setSidebarOpen(false)}>
                  <i className={item.icon}></i><span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}

          {/* Sales Group */}
          {filteredItems.sales.length > 0 && (
            <>
              <div className="nav-group-header" onClick={() => setSalesOpen(!salesOpen)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span>Sales & Customers</span>
                <i className={`fa-solid fa-chevron-${salesOpen ? 'down' : 'right'}`} style={{ fontSize: '10px' }}></i>
              </div>
              {salesOpen && filteredItems.sales.map((item) => (
                <NavLink key={item.path} to={item.path} end className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setSidebarOpen(false)}>
                  <i className={item.icon}></i><span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}

          {/* Management Group */}
          {filteredItems.management.length > 0 && (
            <>
              <div className="nav-group-header" onClick={() => setManagementOpen(!managementOpen)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span>Management</span>
                <i className={`fa-solid fa-chevron-${managementOpen ? 'down' : 'right'}`} style={{ fontSize: '10px' }}></i>
              </div>
              {managementOpen && filteredItems.management.map((item) => (
                <NavLink key={item.path} to={item.path} end className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setSidebarOpen(false)}>
                  <i className={item.icon}></i><span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}

          <div className="nav-label" style={{ marginTop: 'auto' }}>Account</div>
          <a className="sidebar-logout" onClick={async (e) => { e.preventDefault(); const confirmed = await confirmAction('Logout', 'Are you sure you want to logout?', 'Logout'); if (confirmed) logout(); }} style={{ cursor: 'pointer' }}>
            <i className="fa-solid fa-right-from-bracket"></i><span>Logout</span>
          </a>
        </nav>
      </aside>

      <div className="main-content">
        {renderSubscriptionBanner()}
        <header className="header">
          <div className="header-left">
            <button className="toggle-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <i className="fa-solid fa-bars"></i>
            </button>
            <h4 className="header-title">
              {user?.pharmacy?.pharmacyName || (user?.role === 'super_admin' ? 'Super Admin' : getPageTitle())}
            </h4>
          </div>
          <div className="header-right">
            <div className="user-info">
              <div className="avatar">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="user-details">
                <div className="user-name">{user?.name || 'User'}</div>
                <div className="user-role" style={{ textTransform: 'capitalize' }}>
                  {user?.role?.replace('_', ' ') || ''}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="modal-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}