import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

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
    { path: '/pharmacies', label: 'Pharmacies', icon: 'fa-solid fa-hospital' },
    { path: '/subscriptions', label: 'Subscriptions', icon: 'fa-solid fa-credit-card' },
    { path: '/payments', label: 'Payments', icon: 'fa-solid fa-money-bill-wave' },
    { path: '/settings', label: 'Settings', icon: 'fa-solid fa-gear' },
  ];

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <i className="fa-solid fa-crown" style={{ color: '#f59e0b' }}></i>
          <div>
            <h3>Super Admin</h3>
            <span>Platform Management</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">Main Menu</div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onClick={() => setSidebarOpen(false)}
            >
              <i className={item.icon}></i>
              <span>{item.label}</span>
            </NavLink>
          ))}
          <div className="nav-label" style={{ marginTop: 'auto' }}>Account</div>
          <NavLink
            to="/profile"
            className={({ isActive }) => (isActive ? 'active' : '')}
            onClick={() => setSidebarOpen(false)}
          >
            <i className="fa-solid fa-user"></i>
            <span>Profile</span>
          </NavLink>
          <a className="sidebar-logout" onClick={logout} style={{ cursor: 'pointer' }}>
            <i className="fa-solid fa-right-from-bracket"></i>
            <span>Logout</span>
          </a>
        </nav>
      </aside>

      <div className="main-content">
        <header className="header">
          <div className="header-left">
            <button className="toggle-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <i className="fa-solid fa-bars"></i>
            </button>
            <h4>{getPageTitle()}</h4>
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
          className="modal-overlay"
          onClick={() => setSidebarOpen(false)}
          style={{ zIndex: 99 }}
        />
      )}
    </div>
  );
}