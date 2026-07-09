import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSubscriptionStatus } from '../redux/slices/dashboardSlice';
import { confirmAction } from '../utils/sweetAlert';
import { notificationService } from '../services/notificationService';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const { user, logout } = useAuth();
  const dispatch = useDispatch();
  const location = useLocation();
  const { subscriptionStatus } = useSelector((state) => state.dashboard);

  // Smart auto-open: determine which section should be open based on current route
  const getInitialSection = (pathname) => {
    if (pathname === '/') return null; // Dashboard — all collapsed
    const inventoryPaths = ['/medicines', '/categories', '/brands', '/suppliers'];
    const salesPaths = ['/purchases', '/sales', '/customers'];
    const managementPaths = ['/subscriptions', '/reports', '/staff', '/settings'];
    if (inventoryPaths.some(p => pathname.startsWith(p))) return 'inventory';
    if (salesPaths.some(p => pathname.startsWith(p))) return 'sales';
    if (managementPaths.some(p => pathname.startsWith(p))) return 'management';
    return null;
  };

  const [openSection, setOpenSection] = useState(() => getInitialSection(location.pathname));

  // Update open section when route changes
  useEffect(() => {
    const section = getInitialSection(location.pathname);
    if (section !== undefined) {
      setOpenSection(section);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (user?.role === 'admin') {
      dispatch(fetchSubscriptionStatus());
      const interval = setInterval(() => {
        dispatch(fetchSubscriptionStatus());
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [dispatch, user]);

  // Fetch unread notification count
  useEffect(() => {
    const fetchNotifCount = async () => {
      try {
        const res = await notificationService.getUnreadCount();
        setNotifCount(res.data?.data?.count || 0);
      } catch (err) {
        // Silently fail
      }
    };
    fetchNotifCount();
    const interval = setInterval(fetchNotifCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleSection = (section) => {
    setOpenSection(prev => prev === section ? null : section);
  };

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
        <div className="sub-banner sub-banner-expired">
          <i className="fa-solid fa-circle-exclamation" style={{ color: '#e53935' }}></i>
          <span style={{ color: '#c62828' }}>
            <strong>Subscription Expired.</strong> Your subscription has ended. Please renew to access all features.
          </span>
          {location.pathname !== '/subscriptions' && (
            <a href="/subscriptions" className="sub-banner-link">
              Renew Now →
            </a>
          )}
        </div>
      );
    }

    if (isExpiringSoon && subscriptionStatus.daysRemaining > 0) {
      const daysLeft = subscriptionStatus.daysRemaining;
      const isUrgent = daysLeft <= 3;
      return (
        <div className={`sub-banner ${isUrgent ? 'sub-banner-urgent' : 'sub-banner-warning'}`}>
          <i className="fa-solid fa-clock" style={{ color: isUrgent ? '#e65100' : '#f57f17' }}></i>
          <span style={{ color: isUrgent ? '#e65100' : '#f57f17' }}>
            <strong>Subscription Expiring Soon.</strong> Your subscription will end in {daysLeft} day{daysLeft > 1 ? 's' : ''}. Please renew to avoid interruption.
          </span>
          <a href="/subscriptions" className="sub-banner-link" style={{ color: '#1565c0' }}>
            Renew Now →
          </a>
        </div>
      );
    }

    return null;
  };

  const renderNavGroup = (key, label, items, icon) => {
    if (items.length === 0) return null;
    const isOpen = openSection === key;
    return (
      <div className="sidebar-group">
        <div
          className={`sidebar-group-header ${isOpen ? 'sidebar-group-header-open' : ''}`}
          onClick={() => toggleSection(key)}
        >
          <div className="sidebar-group-header-left">
            <i className={icon}></i>
            <span>{label}</span>
          </div>
          <i className={`fa-solid fa-chevron-${isOpen ? 'down' : 'right'} sidebar-group-chevron`}></i>
        </div>
        <div className={`sidebar-group-items ${isOpen ? 'sidebar-group-items-open' : ''}`}>
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              className={({ isActive }) => (isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link')}
              onClick={() => setSidebarOpen(false)}
            >
              <i className={item.icon}></i>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    );
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
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link')} onClick={() => setSidebarOpen(false)}>
              <i className="fa-solid fa-chart-pie"></i><span>Dashboard</span>
            </NavLink>
            <NavLink to="/subscriptions" className={({ isActive }) => (isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link')} onClick={() => setSidebarOpen(false)}>
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
          <div className="sidebar-header-logo">
            <i className="fa-solid fa-prescription-bottle-medical"></i>
          </div>
          <div className="sidebar-header-text">
            <h3>Pharmacy</h3>
            <span>Management System</span>
          </div>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <nav className="sidebar-nav">
          {/* Dashboard Link */}
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link')} onClick={() => setSidebarOpen(false)}>
            <i className="fa-solid fa-chart-pie"></i>
            <span>Dashboard</span>
          </NavLink>

          <div className="sidebar-divider"></div>

          {/* Inventory Group */}
          {renderNavGroup('inventory', 'Inventory', filteredItems.inventory, 'fa-solid fa-warehouse')}

          {/* Sales Group */}
          {renderNavGroup('sales', 'Sales & Customers', filteredItems.sales, 'fa-solid fa-cash-register')}

          {/* Management Group */}
          {renderNavGroup('management', 'Management', filteredItems.management, 'fa-solid fa-building')}

          <div className="sidebar-divider"></div>

          {/* Account & Logout */}
          <div className="sidebar-account-section">
            <div className="sidebar-account-header">
              <i className="fa-solid fa-user"></i>
              <span>Account</span>
            </div>
            <a className="sidebar-logout-link" onClick={async (e) => { e.preventDefault(); const confirmed = await confirmAction('Logout', 'Are you sure you want to logout?', 'Logout'); if (confirmed) logout(); }}>
              <i className="fa-solid fa-right-from-bracket"></i>
              <span>Logout</span>
            </a>
          </div>
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
            <NavLink to="/notifications" className="notification-bell" style={{ position: 'relative', marginRight: '8px', color: 'var(--gray-500)', fontSize: '18px' }}>
              <i className="fa-solid fa-bell"></i>
              {notifCount > 0 && (
                <span className="notif-badge">
                  {notifCount > 99 ? '99+' : notifCount}
                </span>
              )}
            </NavLink>
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
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}