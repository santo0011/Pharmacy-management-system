import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSuperAdminDashboard } from '../../redux/slices/dashboardSlice';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12, font: { size: 11 }, boxWidth: 12, boxHeight: 12 } },
    tooltip: { backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#94a3b8', padding: 10, cornerRadius: 6 },
  },
  scales: {
    x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(148,163,184,0.08)', drawBorder: false } },
    y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(148,163,184,0.08)', drawBorder: false }, beginAtZero: true },
  },
};

export default function AdvancedAnalytics() {
  const dispatch = useDispatch();
  const { superAdmin: saData } = useSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchSuperAdminDashboard());
  }, [dispatch]);

  const total = saData?.totalPharmacies || 0;
  const active = saData?.activePharmacies || 0;
  const deactivated = saData?.deactivatedPharmacies || 0;
  const users = saData?.totalUsers || 0;
  const inactive = total - active - deactivated;

  const subscriptionStats = saData?.subscriptionStats || [];
  const statusDistribution = saData?.statusDistribution || [];
  const monthlyRegistrations = saData?.monthlyRegistrations || [];
  const recentPharmacies = saData?.recentPharmacies || [];

  // Calculate growth metrics
  const activeRate = total > 0 ? ((active / total) * 100).toFixed(1) : 0;
  const deactivatedRate = total > 0 ? ((deactivated / total) * 100).toFixed(1) : 0;
  const avgUsersPerPharmacy = total > 0 ? (users / total).toFixed(1) : 0;
  const totalRegistrations = monthlyRegistrations.reduce((sum, m) => sum + m.count, 0);
  const avgMonthlyRegistrations = monthlyRegistrations.length > 0
    ? (totalRegistrations / monthlyRegistrations.length).toFixed(1)
    : 0;

  // Charts
  const planColors = { free: '#94a3b8', basic: '#3b82f6', premium: '#22c55e', enterprise: '#f59e0b' };
  const subscriptionChartData = subscriptionStats.length > 0 ? {
    labels: subscriptionStats.map(s => s.plan.charAt(0).toUpperCase() + s.plan.slice(1)),
    datasets: [{
      data: subscriptionStats.map(s => s.count),
      backgroundColor: subscriptionStats.map(s => planColors[s.plan] || '#94a3b8'),
      borderWidth: 0,
    }],
  } : null;

  const statusChartData = statusDistribution.length > 0 ? {
    labels: statusDistribution.map(s => s.status.charAt(0).toUpperCase() + s.status.slice(1)),
    datasets: [{
      data: statusDistribution.map(s => s.count),
      backgroundColor: ['#22c55e', '#ef4444', '#f59e0b'],
      borderWidth: 0,
    }],
  } : null;

  const registrationChartData = monthlyRegistrations.length > 0 ? {
    labels: monthlyRegistrations.map(m => {
      const p = m.month.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months[parseInt(p[1]) - 1] || m.month;
    }),
    datasets: [{
      label: 'New Pharmacies',
      data: monthlyRegistrations.map(m => m.count),
      backgroundColor: 'rgba(59, 130, 246, 0.7)',
      borderColor: '#3b82f6',
      borderWidth: 1,
      borderRadius: 4,
    }, {
      label: 'Cumulative',
      data: monthlyRegistrations.map((_, i) =>
        monthlyRegistrations.slice(0, i + 1).reduce((sum, m) => sum + m.count, 0)
      ),
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      yAxisID: 'y1',
    }],
  } : null;

  const registrationOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y1: {
        position: 'right',
        grid: { display: false },
        ticks: { color: '#94a3b8', font: { size: 11 } },
        beginAtZero: true,
      },
    },
  };

  const planDistribution = subscriptionStats.reduce((acc, s) => {
    acc[s.plan] = s.count;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-chart-simple" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>Advanced Analytics</h2>
          <p>Deep insights into your pharmacy platform performance</p>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6', background: '#eff6ff' }}>
          <div className="stat-icon blue"><i className="fa-solid fa-chart-line"></i></div>
          <div className="stat-info"><h3>{activeRate}%</h3><p>Active Rate</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6', background: '#f5f3ff' }}>
          <div className="stat-icon" style={{ background: '#ede9fe', color: '#8b5cf6' }}><i className="fa-solid fa-users"></i></div>
          <div className="stat-info"><h3>{avgUsersPerPharmacy}</h3><p>Avg Users / Pharmacy</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #22c55e', background: '#f0fdf4' }}>
          <div className="stat-icon green"><i className="fa-solid fa-calendar-plus"></i></div>
          <div className="stat-info"><h3>{avgMonthlyRegistrations}</h3><p>Avg Monthly Signups</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#f59e0b' }}><i className="fa-solid fa-crown"></i></div>
          <div className="stat-info"><h3>{planDistribution.premium || 0}</h3><p>Premium Pharmacies</p></div>
        </div>
      </div>

      {/* Growth Trend Chart */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h5><i className="fa-solid fa-chart-line" style={{ marginRight: '8px', color: '#3b82f6' }}></i>Pharmacy Growth Trend</h5>
          <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Monthly new registrations + cumulative growth</span>
        </div>
        <div className="card-body card-body-chart" style={{ minHeight: '300px' }}>
          {registrationChartData ? (
            <Line data={registrationChartData} options={registrationOptions} />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
              <i className="fa-solid fa-chart-line" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i>
              <p>Registration data will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="dashboard-charts-row" style={{ marginBottom: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-credit-card" style={{ marginRight: '8px', color: '#22c55e' }}></i>Subscription Distribution</h5>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{subscriptionStats.length} plan types</span>
          </div>
          <div className="card-body card-body-chart card-body-center">
            {subscriptionChartData ? (
              <div className="chart-doughnut-wrapper">
                <Doughnut data={subscriptionChartData} options={{
                  cutout: '65%',
                  plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 10, font: { size: 11 }, boxWidth: 12 } },
                  },
                }} />
                <div className="chart-total-label"><strong>{total}</strong> total pharmacies</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
                <i className="fa-solid fa-pie-chart" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i>
                <p>Subscription data will appear here</p>
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-circle-check" style={{ marginRight: '8px', color: '#22c55e' }}></i>Pharmacy Status Overview</h5>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{active} active of {total}</span>
          </div>
          <div className="card-body card-body-chart card-body-center">
            {statusChartData ? (
              <div className="chart-doughnut-wrapper">
                <Doughnut data={statusChartData} options={{
                  cutout: '60%',
                  plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 8, font: { size: 11 }, boxWidth: 12 } },
                  },
                }} />
                <div className="chart-total-label">
                  <span style={{ color: '#22c55e' }}>● {active} Active</span>
                  &nbsp;&nbsp;
                  <span style={{ color: '#ef4444' }}>● {deactivated} Deactivated</span>
                  &nbsp;&nbsp;
                  <span style={{ color: '#f59e0b' }}>● {inactive} Inactive</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--gray-500)' }}>
                <p>Status data will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="dashboard-charts-row-three">
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-table" style={{ marginRight: '8px', color: '#3b82f6' }}></i>Plan Breakdown</h5>
          </div>
          <div className="card-body" style={{ padding: '16px' }}>
            {subscriptionStats.length > 0 ? (
              <table style={{ width: '100%', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--gray-200)' }}>Plan</th>
                    <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--gray-200)' }}>Count</th>
                    <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--gray-200)' }}>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionStats.map(s => (
                    <tr key={s.plan}>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)', textTransform: 'capitalize' }}>
                        <span style={{
                          display: 'inline-block', width: '8px', height: '8px',
                          borderRadius: '50%', background: planColors[s.plan] || '#94a3b8',
                          marginRight: '8px',
                        }}></span>
                        {s.plan}
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)', textAlign: 'right', fontWeight: 600 }}>{s.count}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)', textAlign: 'right' }}>
                        {total > 0 ? ((s.count / total) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--gray-500)', padding: '20px' }}>No data available</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-clock" style={{ marginRight: '8px', color: '#f59e0b' }}></i>Status Distribution</h5>
          </div>
          <div className="card-body" style={{ padding: '16px' }}>
            {statusDistribution.length > 0 ? (
              <table style={{ width: '100%', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--gray-200)' }}>Status</th>
                    <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--gray-200)' }}>Count</th>
                    <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--gray-200)' }}>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {statusDistribution.map(s => {
                    const colors = { active: '#22c55e', inactive: '#f59e0b', suspended: '#ef4444' };
                    return (
                      <tr key={s.status}>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)', textTransform: 'capitalize' }}>
                          <span style={{
                            display: 'inline-block', width: '8px', height: '8px',
                            borderRadius: '50%', background: colors[s.status] || '#94a3b8',
                            marginRight: '8px',
                          }}></span>
                          {s.status}
                        </td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)', textAlign: 'right', fontWeight: 600 }}>{s.count}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid var(--gray-100)', textAlign: 'right' }}>
                          {total > 0 ? ((s.count / total) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--gray-500)', padding: '20px' }}>No data available</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-chart-simple" style={{ marginRight: '8px', color: '#8b5cf6' }}></i>Quick Summary</h5>
          </div>
          <div className="card-body">
            <div className="dashboard-summary-grid">
              <div className="summary-item summary-item-green">
                <div className="summary-label">Active Rate</div>
                <div className="summary-value summary-value-green">{activeRate}%</div>
              </div>
              <div className="summary-item summary-item-red">
                <div className="summary-label">Deactivated Rate</div>
                <div className="summary-value summary-value-red">{deactivatedRate}%</div>
              </div>
              <div className="summary-item summary-item-blue">
                <div className="summary-label">Avg Users/Pharmacy</div>
                <div className="summary-value summary-value-blue">{avgUsersPerPharmacy}</div>
              </div>
              <div className="summary-item summary-item-gray">
                <div className="summary-label">Total Registrations</div>
                <div className="summary-value summary-value-dark">{totalRegistrations}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Pharmacies */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <h5><i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '8px', color: '#3b82f6' }}></i>Recent Pharmacies</h5>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {recentPharmacies.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Pharmacy</th>
                    <th>Owner</th>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPharmacies.map((p) => (
                    <tr key={p._id}>
                      <td style={{ fontWeight: 500 }}>{p.pharmacyName}</td>
                      <td>{p.ownerName}</td>
                      <td>{p.email}</td>
                      <td>
                        <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{p.subscriptionPlan}</span>
                      </td>
                      <td>
                        <span className={`badge ${p.status === 'active' ? 'badge-success' : p.status === 'suspended' ? 'badge-danger' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: '#94a3b8' }}>
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '30px' }}><p>No pharmacies yet</p></div>
          )}
        </div>
      </div>
    </div>
  );
}