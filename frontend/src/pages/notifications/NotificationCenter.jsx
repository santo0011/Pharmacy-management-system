import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../../services/notificationService';
import toast from 'react-hot-toast';

const NOTIFICATION_ICONS = {
  low_stock: 'fa-solid fa-triangle-exclamation',
  expiry: 'fa-solid fa-clock',
  payment_due: 'fa-solid fa-credit-card',
  subscription: 'fa-solid fa-crown',
  sale: 'fa-solid fa-receipt',
  purchase: 'fa-solid fa-cart-shopping',
  system: 'fa-solid fa-gear',
  alert: 'fa-solid fa-bell',
};

const SEVERITY_COLORS = {
  info: { bg: '#e0f2fe', color: '#0284c7' },
  warning: { bg: '#fef3c7', color: '#d97706' },
  danger: { bg: '#fef2f2', color: '#dc2626' },
  success: { bg: '#dcfce7', color: '#16a34a' },
};

export default function NotificationCenter() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (filter !== 'all') params.type = filter;
      const res = await notificationService.getAll(params);
      const data = res.data;
      setNotifications(data.data || []);
      setTotalPages(Math.ceil((data.total || 0) / 20));
      setUnreadCount(data.meta?.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDismiss = async (id) => {
    try {
      await notificationService.dismiss(id);
      setNotifications(prev => prev.filter(n => n._id !== id));
      toast.success('Notification dismissed');
    } catch (err) {
      toast.error('Failed to dismiss notification');
    }
  };

  const handleGenerate = async () => {
    try {
      const res = await notificationService.generate();
      toast.success(res.data?.message || 'Notifications generated');
      fetchNotifications();
    } catch (err) {
      toast.error('Failed to generate notifications');
    }
  };

  const handleNotificationClick = (notification) => {
    if (!notification.isRead) {
      handleMarkAsRead(notification._id);
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const filters = [
    { value: 'all', label: 'All', icon: 'fa-solid fa-bell' },
    { value: 'low_stock', label: 'Low Stock', icon: 'fa-solid fa-triangle-exclamation' },
    { value: 'expiry', label: 'Expiry', icon: 'fa-solid fa-clock' },
    { value: 'payment_due', label: 'Payments', icon: 'fa-solid fa-credit-card' },
    { value: 'subscription', label: 'Subscription', icon: 'fa-solid fa-crown' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-bell" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>Notification Center</h2>
          <p>Stay updated with important alerts and reminders</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {unreadCount > 0 && (
            <button className="btn btn-primary btn-sm" onClick={handleMarkAllAsRead}>
              <i className="fa-solid fa-check-double"></i> Mark All Read ({unreadCount})
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={handleGenerate}>
            <i className="fa-solid fa-rotate"></i> Generate Alerts
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button
            key={f.value}
            className={`btn btn-sm ${filter === f.value ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setFilter(f.value); setPage(1); }}
          >
            <i className={f.icon}></i> {f.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="loading-spinner"><i className="fa-solid fa-spinner"></i></div>
      ) : notifications.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <i className="fa-solid fa-bell-slash" style={{ fontSize: '48px', color: 'var(--gray-300)' }}></i>
            <h4>No Notifications</h4>
            <p>You're all caught up! No new notifications to show.</p>
          </div>
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map(notification => {
            const severity = SEVERITY_COLORS[notification.severity] || SEVERITY_COLORS.info;
            return (
              <div
                key={notification._id}
                className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(notification)}
                style={{
                  cursor: 'pointer',
                  background: notification.isRead ? 'white' : '#f8fafc',
                  borderLeft: `4px solid ${severity.color}`,
                  marginBottom: '8px',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: severity.bg,
                  color: severity.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0,
                }}>
                  <i className={NOTIFICATION_ICONS[notification.type] || 'fa-solid fa-bell'}></i>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: 'var(--gray-800)' }}>
                        {notification.title}
                        {!notification.isRead && (
                          <span style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            marginLeft: '8px',
                            verticalAlign: 'middle',
                          }}></span>
                        )}
                      </strong>
                      <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '4px' }}>{notification.message}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', color: 'var(--gray-400)', whiteSpace: 'nowrap', marginTop: '4px' }}>
                        {getTimeAgo(notification.createdAt)}
                      </span>
                      <button
                        className="btn btn-sm"
                        style={{ background: 'transparent', border: 'none', color: 'var(--gray-400)', padding: '4px', fontSize: '14px' }}
                        onClick={(e) => { e.stopPropagation(); handleDismiss(notification._id); }}
                        title="Dismiss"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <span>Page {page} of {totalPages}</span>
          <div className="page-buttons">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}