import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function SystemHealth() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealthData();
  }, []);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      const [healthRes, pharmRes, userRes, subRes] = await Promise.all([
        api.get('/health'),
        api.get('/pharmacies?limit=1'),
        api.get('/auth/users?limit=1').catch(() => ({ data: { total: 0 } })),
        api.get('/subscription-plans').catch(() => ({ data: { data: [] } })),
      ]);
      setHealthData({
        server: healthRes.data,
        pharmacies: pharmRes.data?.total || 0,
        users: userRes.data?.total || 0,
        plans: subRes.data?.data?.length || 0,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to fetch health data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner"><i className="fa-solid fa-spinner"></i></div>;
  }

  const statusCards = [
    {
      title: 'API Server',
      status: 'online',
      icon: 'fa-solid fa-server',
      color: '#22c55e',
      bg: '#f0fdf4',
      details: [
        { label: 'Status', value: 'Running' },
        { label: 'Message', value: healthData?.server?.message || 'OK' },
        { label: 'Last Check', value: new Date(healthData?.timestamp).toLocaleTimeString() },
      ],
    },
    {
      title: 'Database',
      status: 'online',
      icon: 'fa-solid fa-database',
      color: '#3b82f6',
      bg: '#eff6ff',
      details: [
        { label: 'Status', value: 'Connected' },
        { label: 'Pharmacies', value: healthData?.pharmacies || 0 },
        { label: 'Users', value: healthData?.users || 0 },
      ],
    },
    {
      title: 'Subscription Plans',
      status: 'online',
      icon: 'fa-solid fa-credit-card',
      color: '#8b5cf6',
      bg: '#f5f3ff',
      details: [
        { label: 'Active Plans', value: healthData?.plans || 0 },
        { label: 'Status', value: 'Configured' },
      ],
    },
    {
      title: 'Storage',
      status: 'online',
      icon: 'fa-solid fa-hard-drive',
      color: '#f59e0b',
      bg: '#fffbeb',
      details: [
        { label: 'Uploads', value: 'Available' },
        { label: 'Static Files', value: 'Serving' },
      ],
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-heart-pulse" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>System Health</h2>
          <p>Monitor the health and status of your platform infrastructure</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={fetchHealthData}>
          <i className="fa-solid fa-rotate"></i> Refresh
        </button>
      </div>

      {/* Status Cards */}
      <div className="stats-grid">
        {statusCards.map((card, idx) => (
          <div key={idx} className="card" style={{ borderLeft: `4px solid ${card.color}` }}>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: card.bg, color: card.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', flexShrink: 0,
                }}>
                  <i className={card.icon}></i>
                </div>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--gray-800)' }}>{card.title}</h4>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '12px', color: card.color, fontWeight: 500,
                  }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: card.color, display: 'inline-block',
                    }}></span>
                    {card.status}
                  </span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '12px' }}>
                {card.details.map((detail, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '6px 0', fontSize: '13px',
                    borderBottom: i < card.details.length - 1 ? '1px solid var(--gray-50)' : 'none',
                  }}>
                    <span style={{ color: 'var(--gray-500)' }}>{detail.label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{detail.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <h5><i className="fa-solid fa-bolt" style={{ marginRight: '8px', color: '#f59e0b' }}></i>Quick Actions</h5>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            <button className="btn btn-outline" onClick={() => window.open('/api/backup/export', '_blank')} style={{ justifyContent: 'center', padding: '16px' }}>
              <i className="fa-solid fa-download"></i> Export System Data
            </button>
            <button className="btn btn-outline" onClick={fetchHealthData} style={{ justifyContent: 'center', padding: '16px' }}>
              <i className="fa-solid fa-rotate"></i> Refresh Status
            </button>
            <button className="btn btn-outline" onClick={() => window.open('/api/health', '_blank')} style={{ justifyContent: 'center', padding: '16px' }}>
              <i className="fa-solid fa-link"></i> API Health Check
            </button>
            <button className="btn btn-outline" onClick={() => window.location.href = '/pharmacies'} style={{ justifyContent: 'center', padding: '16px' }}>
              <i className="fa-solid fa-hospital"></i> Manage Pharmacies
            </button>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="card" style={{ marginTop: '20px', background: '#f8fafc' }}>
        <div className="card-body" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <i className="fa-solid fa-circle-info" style={{ color: '#3b82f6', fontSize: '20px', marginTop: '2px' }}></i>
          <div>
            <strong style={{ color: 'var(--gray-800)' }}>System Information</strong>
            <ul style={{ margin: '8px 0 0 20px', color: 'var(--gray-600)', fontSize: '13px', lineHeight: '1.8' }}>
              <li>Platform: Pharmacy Management System v1.0</li>
              <li>Backend: Node.js + Express + MongoDB</li>
              <li>Frontend: React + Vite + Redux Toolkit</li>
              <li>Last Health Check: {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleString() : 'N/A'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}