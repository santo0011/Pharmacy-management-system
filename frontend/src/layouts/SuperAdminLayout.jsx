import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { confirmAction } from '../utils/sweetAlert';

export default function SuperAdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    const titles = {
      '/': 'Dashboard',
      '/pharmacies': 'Pharmacy Management',
      '/subscriptions': 'Subscription Management',
      '/payments': 'Payment Management',
      '/settings': 'Platform Settings',
      '/profile': 'Profile',
    };
    return titles[path] || path.charAt(1).toUpperCase() + path.slice(2);
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'fa-solid fa-chart-pie' },
    { path: '/analytics', label: 'Analytics', icon: 'fa-solid fa-chart-simple' },
    { path: '/system-health', label: 'System Health', icon: 'fa-solid fa-heart-pulse' },
    { path: '/pharmacies', label: 'Pharmacies', icon: 'fa-solid fa-hospital' },
    { path: '/subscriptions', label: 'Subscriptions', icon: 'fa-solid fa-credit-card' },
    { path: '/payments', label: 'Payments', icon: 'fa-solid fa-money-bill-wave' },
    { path: '/activity-logs', label: 'Activity Logs', icon: 'fa-solid fa-clock-rotate-left' },
    { path: '/settings', label: 'Settings', icon: 'fa-solid fa-gear' },
  ];

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-logo" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}>
            <i className="fa-solid fa-crown"></i>
          </div>
          <div className="sidebar-header-text">
            <h3>Super Admin</h3>
            <span>Platform Management</span>
          </div>
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <nav className="sidebar-nav">
          {/* Dashboard Link */}
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link')}
            onClick={() => setSidebarOpen(false)}
          >
            <i className="fa-solid fa-chart-pie"></i>
            <span>Dashboard</span>
          </NavLink>

          <div className="sidebar-divider"></div>

          {navItems.slice(1).map((item) => (
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

          <div className="sidebar-divider"></div>

          {/* Account & Logout */}
          <div className="sidebar-account-section">
            <div className="sidebar-account-header">
              <i className="fa-solid fa-user"></i>
              <span>Account</span>
            </div>
            <NavLink
              to="/profile"
              className={({ isActive }) => (isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link')}
              onClick={() => setSidebarOpen(false)}
            >
              <i className="fa-solid fa-user-gear"></i>
              <span>Profile</span>
            </NavLink>
            <a className="sidebar-logout-link" onClick={async (e) => { e.preventDefault(); const confirmed = await confirmAction('Logout', 'Are you sure you want to logout?', 'Logout'); if (confirmed) logout(); }}>
              <i className="fa-solid fa-right-from-bracket"></i>
              <span>Logout</span>
            </a>
          </div>
        </nav>
      </aside>

      <div className="main-content">
        <header className="header">
          <div className="header-left">
            <button className="toggle-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <i className="fa-solid fa-bars"></i>
            </button>
            <h4 className="header-title">
              {user?.pharmacy?.pharmacyName || getPageTitle()}
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
                  Super Admin
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