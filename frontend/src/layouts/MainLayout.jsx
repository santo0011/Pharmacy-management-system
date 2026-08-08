import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSubscriptionStatus } from '../redux/slices/dashboardSlice';
import { fetchSettings } from '../redux/slices/settingSlice';
import { confirmAction } from '../utils/sweetAlert';
import { notificationService } from '../services/notificationService';
import { profileService } from '../services/profileService';
import { setPharmacyCurrency, getCurrencyFromCountry, getCurrencySymbol } from '../utils/currency';
import GlobalSearch from '../components/common/GlobalSearch';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const { user, logout } = useAuth();
  const dispatch = useDispatch();
  const location = useLocation();
  const { subscriptionStatus } = useSelector((state) => state.dashboard);

  // Track when subscription status has been loaded at least once
  useEffect(() => {
    if (subscriptionStatus !== null) {
      setSubscriptionLoaded(true);
    }
  }, [subscriptionStatus]);

  useEffect(() => {
    // Load platform settings (currency, etc.)
    dispatch(fetchSettings());
    
    if (user?.role === 'admin') {
      dispatch(fetchSubscriptionStatus());
      const interval = setInterval(() => {
        dispatch(fetchSubscriptionStatus());
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [dispatch, user]);

  // Load pharmacy profile to set the pharmacy-level currency
  useEffect(() => {
    if (user?.role === 'admin') {
      const loadPharmacyCurrency = async () => {
        try {
          const { data } = await profileService.getPharmacyProfile();
          if (data?.data) {
            const p = data.data;
            // Set pharmacy-level currency (overrides platform default)
            const currency = p.currency || 'INR';
            const symbol = p.currencySymbol || getCurrencySymbol(currency);
            setPharmacyCurrency(currency, symbol);
          }
        } catch (err) {
          // Silently fail — platform default will be used
        }
      };
      loadPharmacyCurrency();
    }
  }, [user]);

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

  const getPageTitle = () => {
    const path = location.pathname;
    const titles = {
      '/': 'Dashboard',
      '/categories': 'Categories',
      '/brands': 'Brands',
      '/suppliers': 'Suppliers',
      '/medicines': 'Medicines',
      '/medicines/new': 'New Medicine',
      '/purchases': 'Purchases',
      '/purchases/new': 'New Purchase',
      '/purchases': 'Purchases',
      '/sales': 'Sales',
      '/sales/new': 'New Sale',
      '/customers': 'Customers',
      '/reports': 'Reports',
      '/reports/gst': 'GST Report',
      '/staff': 'Staff',
      '/settings': 'Settings',
      '/profile': 'Profile',
      '/subscriptions': 'Subscription',
      '/notifications': 'Notifications',
    };
    return titles[path] || path.charAt(1).toUpperCase() + path.slice(2);
  };

  // Determine if subscription is expired:
  // - status is 'expired', OR
  // - daysRemaining is defined AND <= 0, OR
  // - status is 'no_subscription' (no active records at all)
  const isExpired = subscriptionStatus?.status === 'expired' 
    || (subscriptionStatus?.daysRemaining !== undefined && subscriptionStatus?.daysRemaining <= 0)
    || subscriptionStatus?.status === 'no_subscription';
    
  const isExpiringSoon = subscriptionStatus?.status === 'expiring_soon';

  // Only Dashboard and Subscription pages are allowed when expired
  const isAllowedRoute = location.pathname === '/' || location.pathname === '/subscriptions' || location.pathname === '/subscription-expired';
  
  // Redirect to subscription-expired page if subscription is expired and on a restricted route
  useEffect(() => {
    if (subscriptionLoaded && isExpired && !isAllowedRoute && user?.role === 'admin') {
      // Use window.location to force a full redirect (works across refresh/login/logout)
      if (location.pathname !== '/subscription-expired') {
        window.location.href = '/subscription-expired';
      }
    }
  }, [subscriptionLoaded, isExpired, isAllowedRoute, user, location.pathname]);

  // Show loading spinner while subscription status is being fetched on initial load
  // This prevents users from seeing restricted pages before the check completes
  if (user?.role === 'admin' && !subscriptionLoaded) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f8fafc',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid #e2e8f0',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }}></div>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Checking subscription status...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ============================================================
  // Flat sidebar navigation (no dropdowns / collapsible sections)
  // ============================================================

  // Build nav sections filtered by role. Each item can include a query string
  // (e.g. '/sales?status=returned') to target a specific view on the page.
  const getNavSections = () => {
    const inventoryItems = [
      { path: '/medicines', label: 'Medicines', icon: 'fa-solid fa-pills' },
      { path: '/categories', label: 'Categories', icon: 'fa-solid fa-tags' },
      { path: '/brands', label: 'Brands', icon: 'fa-solid fa-copyright' },
      { path: '/suppliers', label: 'Suppliers', icon: 'fa-solid fa-truck' },
    ];

    const salesItems = [
      { path: '/sales/new', label: 'New Sale', icon: 'fa-solid fa-square-plus' },
      { path: '/sales', label: 'Sales', icon: 'fa-solid fa-cash-register' },
      { path: '/sales?status=returned', label: 'Returns', icon: 'fa-solid fa-rotate-left' },
    ];

    const purchaseItems = [
      { path: '/purchases/new', label: 'New Purchase', icon: 'fa-solid fa-square-plus' },
      { path: '/purchases', label: 'Purchases', icon: 'fa-solid fa-cart-plus' },
      { path: '/purchases?status=returned', label: 'Purchase Returns', icon: 'fa-solid fa-rotate-left' },
    ];

    const customerItems = [
      { path: '/customers', label: 'Customers', icon: 'fa-solid fa-users' },
    ];

    const reportItems = [
      { path: '/reports', label: 'Report', icon: 'fa-solid fa-chart-bar' },
      { path: '/reports/gst', label: 'GST Report', icon: 'fa-solid fa-percent' },
    ];

    const settingsItems = [
      { path: '/settings', label: 'Settings', icon: 'fa-solid fa-gear' },
    ];

    const dashboardSection = {
      key: 'dashboard',
      label: null,
      items: [{ path: '/', label: 'Dashboard', icon: 'fa-solid fa-chart-pie' }],
    };

    if (user?.role === 'admin') {
      return [
        dashboardSection,
        { key: 'inventory', label: 'Inventory', items: inventoryItems },
        { key: 'sales', label: 'Sales', items: salesItems },
        { key: 'purchases', label: 'Purchases', items: purchaseItems },
        { key: 'customers', label: 'Customers', items: customerItems },
        { key: 'reports', label: 'Reports', items: reportItems },
        { key: 'settings', label: 'Settings', items: settingsItems },
      ];
    }
    if (user?.role === 'pharmacist') {
      return [
        dashboardSection,
        { key: 'inventory', label: 'Inventory', items: inventoryItems },
        { key: 'sales', label: 'Sales', items: salesItems },
        { key: 'customers', label: 'Customers', items: customerItems },
      ];
    }
    if (user?.role === 'cashier') {
      return [
        dashboardSection,
        { key: 'sales', label: 'Sales', items: salesItems },
        { key: 'customers', label: 'Customers', items: customerItems },
      ];
    }
    return [dashboardSection];
  };

  // Determine which item in a section is currently active.
  // - Query-string items (e.g. '/sales?status=returned') only match when the
  //   pathname AND query params match — they take priority over plain paths.
  // - Plain paths match themselves or their sub-routes; longer (more specific)
  //   paths take priority so e.g. '/sales/new' highlights "New Sale", not "Sales".
  const getActiveItemPath = (items) => {
    let best = null;
    let bestScore = -1;
    for (const item of items) {
      const path = item.path;
      if (path.includes('?')) {
        const [pathname, query] = path.split('?');
        if (location.pathname !== pathname) continue;
        const params = new URLSearchParams(query);
        const currentParams = new URLSearchParams(location.search);
        if (![...params].every(([k, v]) => currentParams.get(k) === v)) continue;
        const score = 1000;
        if (score > bestScore) { best = path; bestScore = score; }
      } else {
        if (path === '/') {
          if (location.pathname === '/') {
            const score = 1;
            if (score > bestScore) { best = path; bestScore = score; }
          }
        } else if (location.pathname === path || location.pathname.startsWith(path + '/')) {
          const score = 100 + path.length;
          if (score > bestScore) { best = path; bestScore = score; }
        }
      }
    }
    return best;
  };

  const renderSection = (section) => {
    const activeItemPath = getActiveItemPath(section.items);
    return (
      <div className="sidebar-section" key={section.key}>
        {section.label && <div className="sidebar-section-label">{section.label}</div>}
        {section.items.map((item) => (
          <NavLink
            key={`${item.path}-${item.label}`}
            to={item.path}
            className={`sidebar-link ${activeItemPath === item.path ? 'sidebar-link-active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <i className={item.icon}></i>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    );
  };

  const navSections = getNavSections();

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

  const handleLogout = async (e) => {
    e.preventDefault();
    const confirmed = await confirmAction('Logout', 'Are you sure you want to logout?', 'Logout');
    if (confirmed) logout();
  };

  // If expired and not on allowed routes, block content
  if (isExpired && !isAllowedRoute && user?.role === 'admin') {
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
            <div className="nav-label">Main Menu</div>
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link')} onClick={() => setSidebarOpen(false)}>
              <i className="fa-solid fa-chart-pie"></i><span>Dashboard</span>
            </NavLink>
            <NavLink to="/subscriptions" className={({ isActive }) => (isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link')} onClick={() => setSidebarOpen(false)}>
              <i className="fa-solid fa-credit-card"></i><span>Subscription</span>
            </NavLink>
            <div className="nav-label" style={{ marginTop: 'auto' }}>Account</div>
            <a className="sidebar-logout" onClick={handleLogout} style={{ cursor: 'pointer' }}>
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
          {navSections.map((section) => renderSection(section))}

          <div className="sidebar-divider"></div>

          {/* Logout pinned to bottom */}
          <div className="sidebar-footer">
            <a className="sidebar-logout-link" onClick={handleLogout}>
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
          <div className="header-right" style={{ gap: '12px' }}>
            <GlobalSearch />
            <NavLink to="/notifications" className="notification-bell" style={{ position: 'relative', color: 'var(--gray-500)', fontSize: '18px' }}>
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