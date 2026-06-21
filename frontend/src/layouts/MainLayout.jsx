import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

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

  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'fa-solid fa-chart-pie' },
    { path: '/categories', label: 'Categories', icon: 'fa-solid fa-tags' },
    { path: '/brands', label: 'Brands', icon: 'fa-solid fa-copyright' },
    { path: '/suppliers', label: 'Suppliers', icon: 'fa-solid fa-truck' },
    { path: '/medicines', label: 'Medicines', icon: 'fa-solid fa-pills' },
    { path: '/purchases', label: 'Purchases', icon: 'fa-solid fa-cart-plus' },
    { path: '/sales', label: 'Sales', icon: 'fa-solid fa-cash-register' },
    { path: '/customers', label: 'Customers', icon: 'fa-solid fa-users' },
    { path: '/reports', label: 'Reports', icon: 'fa-solid fa-chart-bar' },
    { path: '/staff', label: 'Staff', icon: 'fa-solid fa-user-md' },
    { path: '/settings', label: 'Settings', icon: 'fa-solid fa-gear' },
  ];

  // Filter nav items based on user role
  const getFilteredNavItems = () => {
    if (user?.role === 'admin') return navItems;
    if (user?.role === 'pharmacist') {
      return navItems.filter((item) =>
        ['/', '/medicines', '/sales', '/customers'].includes(item.path)
      );
    }
    if (user?.role === 'cashier') {
      return navItems.filter((item) =>
        ['/', '/sales', '/customers'].includes(item.path)
      );
    }
    return navItems;
  };

  const filteredNavItems = getFilteredNavItems();

  return (
    <div className="app-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <i className="fa-solid fa-prescription-bottle-medical"></i>
          <div>
            <h3>Pharmacy</h3>
            <span>Management System</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">Main Menu</div>
          {filteredNavItems.map((item) => (
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
          style={{ zIndex: 99 }}
        />
      )}
    </div>
  );
}