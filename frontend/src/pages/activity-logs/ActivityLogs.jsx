import { useState, useEffect, useCallback } from 'react';
import { activityLogService } from '../../services/notificationService';
import toast from 'react-hot-toast';

const ACTION_ICONS = {
  create: 'fa-solid fa-plus-circle',
  update: 'fa-solid fa-pen',
  delete: 'fa-solid fa-trash',
  restore: 'fa-solid fa-undo',
  login: 'fa-solid fa-right-to-bracket',
  logout: 'fa-solid fa-right-from-bracket',
  export: 'fa-solid fa-download',
  print: 'fa-solid fa-print',
  cancel: 'fa-solid fa-ban',
  return: 'fa-solid fa-rotate-left',
  payment: 'fa-solid fa-credit-card',
  status_change: 'fa-solid fa-toggle-on',
  subscription_change: 'fa-solid fa-crown',
  backup: 'fa-solid fa-database',
  restore_data: 'fa-solid fa-cloud-upload-alt',
};

const ACTION_COLORS = {
  create: '#22c55e',
  update: '#3b82f6',
  delete: '#ef4444',
  restore: '#8b5cf6',
  login: '#06b6d4',
  logout: '#64748b',
  export: '#f59e0b',
  print: '#6366f1',
  cancel: '#ef4444',
  return: '#f59e0b',
  payment: '#22c55e',
  status_change: '#3b82f6',
  subscription_change: '#8b5cf6',
  backup: '#06b6d4',
  restore_data: '#f59e0b',
};

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    action: '',
    resource: '',
    search: '',
    startDate: '',
    endDate: '',
  });
  const [availableActions, setAvailableActions] = useState([]);
  const [availableResources, setAvailableResources] = useState([]);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (filters.action) params.action = filters.action;
      if (filters.resource) params.resource = filters.resource;
      if (filters.search) params.search = filters.search;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const res = await activityLogService.getAll(params);
      const data = res.data;
      setLogs(data.data || []);
      setTotalPages(Math.ceil((data.total || 0) / 20));
      setTotal(data.total || 0);
      if (data.meta?.actions) setAvailableActions(data.meta.actions);
      if (data.meta?.resources) setAvailableResources(data.meta.resources);
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ action: '', resource: '', search: '', startDate: '', endDate: '' });
    setPage(1);
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>Activity Logs</h2>
          <p>Track all actions performed in your pharmacy ({total} total entries)</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '200px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Search</label>
              <input
                type="text"
                className="form-select"
                placeholder="Search description, user..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group" style={{ minWidth: '140px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Action</label>
              <select
                className="form-select"
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">All Actions</option>
                {availableActions.map(a => (
                  <option key={a} value={a}>{a.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ minWidth: '140px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Resource</label>
              <select
                className="form-select"
                value={filters.resource}
                onChange={(e) => handleFilterChange('resource', e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">All Resources</option>
                {availableResources.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ minWidth: '140px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>From</label>
              <input
                type="date"
                className="form-select"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group" style={{ minWidth: '140px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>To</label>
              <input
                type="date"
                className="form-select"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <button className="btn btn-secondary btn-sm" onClick={clearFilters} style={{ marginBottom: '1px' }}>
              <i className="fa-solid fa-eraser"></i> Clear
            </button>
          </div>
        </div>
      </div>

      {/* Logs List */}
      {loading ? (
        <div className="loading-spinner"><i className="fa-solid fa-spinner"></i></div>
      ) : logs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '48px', color: 'var(--gray-300)' }}></i>
            <h4>No Activity Logs</h4>
            <p>Activity logs will appear here as you use the system.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log._id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--gray-500)' }}>
                        {getTimeAgo(log.createdAt)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: 'var(--primary-light)', color: 'var(--primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 600, flexShrink: 0,
                          }}>
                            {log.userName?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 500 }}>{log.userName || 'Unknown'}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '2px 8px', borderRadius: '4px', fontSize: '12px',
                          background: `${ACTION_COLORS[log.action] || '#64748b'}15`,
                          color: ACTION_COLORS[log.action] || '#64748b',
                          textTransform: 'capitalize',
                        }}>
                          <i className={ACTION_ICONS[log.action] || 'fa-solid fa-circle'} style={{ fontSize: '10px' }}></i>
                          {log.action.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                          {log.resource}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: 'var(--gray-600)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <span>Page {page} of {totalPages} ({total} entries)</span>
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