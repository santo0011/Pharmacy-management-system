import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchMedicineStats } from '../../redux/slices/medicineSlice';
import { fetchSuperAdminDashboard, fetchPharmacyDashboard } from '../../redux/slices/dashboardSlice';
import { fetchSaleStats } from '../../redux/slices/saleSlice';
import { fetchPurchaseStats } from '../../redux/slices/purchaseSlice';
import { fetchMedicines } from '../../redux/slices/medicineSlice';
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
  interaction: { intersect: false, mode: 'index' },
};

const chartOptionsMobile = {
  ...chartOptions,
  maintainAspectRatio: true,
  plugins: {
    ...chartOptions.plugins,
    legend: { ...chartOptions.plugins.legend, labels: { ...chartOptions.plugins.legend.labels, font: { size: 10 }, padding: 8, boxWidth: 10, boxHeight: 10 } },
  },
  scales: {
    x: { ...chartOptions.scales.x, ticks: { ...chartOptions.scales.x.ticks, font: { size: 10 } } },
    y: { ...chartOptions.scales.y, ticks: { ...chartOptions.scales.y.ticks, font: { size: 10 } } },
  },
};

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const { stats: medicineStats } = useSelector((state) => state.medicines);
  const { superAdmin: saData, pharmacy: phData } = useSelector((state) => state.dashboard);
  const saleStats = useSelector((state) => state.sales?.stats);
  const purchaseStats = useSelector((state) => state.purchases?.stats);
  const { items: medicines } = useSelector((state) => state.medicines);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);

  useEffect(() => {
    if (isSuperAdmin) {
      dispatch(fetchSuperAdminDashboard());
    } else {
      dispatch(fetchPharmacyDashboard());
      dispatch(fetchMedicineStats());
      dispatch(fetchSaleStats());
      dispatch(fetchPurchaseStats());
      dispatch(fetchMedicines({ limit: 200, expired: '', expiringSoon: '' }));
    }
  }, [dispatch, isSuperAdmin]);

  useEffect(() => {
    if (medicines?.length > 0) {
      const now = new Date();
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expiring = medicines.filter(m => {
        const exp = new Date(m.expiryDate);
        return exp >= now && exp <= thirtyDaysLater;
      }).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)).slice(0, 10);
      setExpiringSoon(expiring);
    }
  }, [medicines]);

  // ===== SUPER ADMIN DASHBOARD =====
  if (isSuperAdmin) {
    const total = saData?.totalPharmacies || 0;
    const active = saData?.activePharmacies || 0;
    const suspended = saData?.suspendedPharmacies || 0;
    const users = saData?.totalUsers || 0;
    const inactive = total - active - suspended;

    const planColors = { free: '#94a3b8', basic: '#3b82f6', premium: '#22c55e', enterprise: '#f59e0b' };
    const subStats = saData?.subscriptionStats || [];
    const subscriptionChartData = subStats.length > 0 ? {
      labels: subStats.map(s => s.plan.charAt(0).toUpperCase() + s.plan.slice(1)),
      datasets: [{
        data: subStats.map(s => s.count),
        backgroundColor: subStats.map(s => planColors[s.plan] || '#94a3b8'),
        borderWidth: 0,
      }],
    } : null;

    const statusDist = saData?.statusDistribution || [];
    const statusChartData = statusDist.length > 0 ? {
      labels: statusDist.map(s => s.status.charAt(0).toUpperCase() + s.status.slice(1)),
      datasets: [{
        data: statusDist.map(s => s.count),
        backgroundColor: ['#22c55e', '#ef4444', '#f59e0b'],
        borderWidth: 0,
      }],
    } : null;

    const monthlyReg = saData?.monthlyRegistrations || [];
    const registrationChartData = monthlyReg.length > 0 ? {
      labels: monthlyReg.map(m => {
        const p = m.month.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[parseInt(p[1]) - 1] || m.month;
      }),
      datasets: [{
        label: 'New Pharmacies',
        data: monthlyReg.map(m => m.count),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: '#3b82f6',
        borderWidth: 1,
        borderRadius: 4,
      }],
    } : null;

    const recentPharmacies = saData?.recentPharmacies || [];

    return (
      <div>
        <div className="page-header">
          <div>
            <h2>Platform Dashboard</h2>
            <p>Overview of your entire pharmacy platform</p>
          </div>
        </div>

        {/* Stats Cards with accent border (matching Admin panel style) */}
        <div className="stats-grid">
          <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div className="stat-icon blue"><i className="fa-solid fa-hospital"></i></div>
            <div className="stat-info"><h3>{total}</h3><p>Total Pharmacies</p></div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #22c55e' }}>
            <div className="stat-icon green"><i className="fa-solid fa-check-circle"></i></div>
            <div className="stat-info"><h3>{active}</h3><p>Active Pharmacies</p></div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
            <div className="stat-icon" style={{ background: '#fef2f2', color: '#ef4444' }}><i className="fa-solid fa-ban"></i></div>
            <div className="stat-info"><h3>{suspended}</h3><p>Suspended</p></div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div className="stat-icon" style={{ background: '#f3e8ff', color: '#8b5cf6' }}><i className="fa-solid fa-users"></i></div>
            <div className="stat-info"><h3>{users}</h3><p>Total Users</p></div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="dashboard-charts-row">
          {/* Monthly Registrations */}
          <div className="card">
            <div className="card-header">
              <h5><i className="fa-solid fa-chart-bar" style={{ marginRight: '8px', color: '#3b82f6' }}></i>Monthly Registrations</h5>
              <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Last 6 months</span>
            </div>
            <div className="card-body card-body-chart">
              {registrationChartData ? <Bar data={registrationChartData} options={chartOptions} />
              : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}><i className="fa-solid fa-chart-line" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i><p>Registration data will appear here</p></div>}
            </div>
          </div>
          {/* Subscription Distribution */}
          <div className="card">
            <div className="card-header">
              <h5><i className="fa-solid fa-credit-card" style={{ marginRight: '8px', color: '#22c55e' }}></i>Subscription Distribution</h5>
              <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{subStats.length} plan types</span>
            </div>
            <div className="card-body card-body-chart card-body-center">
              {subscriptionChartData ? (
                <div className="chart-doughnut-wrapper">
                  <Doughnut data={subscriptionChartData} options={{ cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 10, font: { size: 11 }, boxWidth: 12 } } } }} />
                  <div className="chart-total-label">
                    <strong>{total}</strong> total pharmacies
                  </div>
                </div>
              ) : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}><i className="fa-solid fa-pie-chart" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i><p>Subscription data will appear here</p></div>}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="dashboard-charts-row">
          {/* Status Distribution */}
          <div className="card">
            <div className="card-header">
              <h5><i className="fa-solid fa-circle-check" style={{ marginRight: '8px', color: '#22c55e' }}></i>Pharmacy Status</h5>
              <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{active} active of {total}</span>
            </div>
            <div className="card-body card-body-chart card-body-center">
              {statusChartData ? (
                <div className="chart-doughnut-wrapper chart-doughnut-small">
                  <Doughnut data={statusChartData} options={{ cutout: '60%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 8, font: { size: 11 }, boxWidth: 12 } } } }} />
                </div>
              ) : <div style={{ textAlign: 'center', padding: '30px', color: 'var(--gray-500)' }}><p>Status data will appear here</p></div>}
            </div>
          </div>
          {/* Summary Cards */}
          <div className="card">
            <div className="card-header">
              <h5><i className="fa-solid fa-chart-simple" style={{ marginRight: '8px', color: '#f59e0b' }}></i>Quick Summary</h5>
            </div>
            <div className="card-body">
              <div className="dashboard-summary-grid">
                <div className="summary-item summary-item-green">
                  <div className="summary-label">Active Rate</div>
                  <div className="summary-value summary-value-green">
                    {total > 0 ? ((active / total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="summary-item summary-item-red">
                  <div className="summary-label">Suspended Rate</div>
                  <div className="summary-value summary-value-red">
                    {total > 0 ? ((suspended / total) * 100).toFixed(1) : 0}%
                  </div>
                </div>
                <div className="summary-item summary-item-gray">
                  <div className="summary-label">Avg Users/Pharmacy</div>
                  <div className="summary-value summary-value-dark">
                    {total > 0 ? (users / total).toFixed(1) : 0}
                  </div>
                </div>
                <div className="summary-item summary-item-blue">
                  <div className="summary-label">Inactive</div>
                  <div className="summary-value summary-value-blue">
                    {inactive}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Pharmacies */}
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <h5><i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '8px', color: '#3b82f6' }}></i>Recent Pharmacies</h5>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/pharmacies')}><i className="fa-solid fa-arrow-right"></i> View All</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {recentPharmacies.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead><tr><th>Pharmacy</th><th>Owner</th><th>Email</th><th>Plan</th><th>Status</th><th>Joined</th></tr></thead>
                  <tbody>
                    {recentPharmacies.map((p) => (
                      <tr key={p._id} style={{ cursor: 'pointer' }} onClick={() => navigate('/pharmacies')}>
                        <td style={{ fontWeight: 500 }}>{p.pharmacyName}</td>
                        <td>{p.ownerName}</td>
                        <td>{p.email}</td>
                        <td><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{p.subscriptionPlan}</span></td>
                        <td><span className={`badge ${p.status === 'active' ? 'badge-success' : p.status === 'suspended' ? 'badge-danger' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>{p.status}</span></td>
                        <td style={{ fontSize: '13px', color: '#94a3b8' }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state" style={{ padding: '30px' }}><p>No pharmacies yet</p></div>}
          </div>
        </div>
      </div>
    );
  }

  // ===== PHARMACY DASHBOARD =====
  const totalMedicines = phData?.totalMedicines || medicineStats.totalMedicines || 0;
  const lowStockCount = phData?.lowStockMedicines || medicineStats.lowStockMedicines || 0;
  const expiredCount = medicineStats.expiredMedicines || 0;
  const nearExpiryCount = medicineStats.nearExpiryMedicines || 0;
  const lowStockItems = phData?.lowStockItems || [];

  // Sale stats
  const dailySales = saleStats?.dailySales || [];
  const monthlyRevenue = saleStats?.monthlyRevenue || [];
  const topMedicines = saleStats?.topMedicines || [];
  const paymentMethodStats = saleStats?.paymentMethodStats || [];
  const monthlyPurchaseVsSale = saleStats?.monthlyPurchaseVsSale || [];

  // Daily Sales Trend Chart
  const dailySalesChart = dailySales.length > 0 ? {
    labels: dailySales.map(d => { const p = d.date.split('-'); return `${p[2]}/${p[1]}`; }),
    datasets: [{
      label: 'Sales (₹)',
      data: dailySales.map(d => d.amount),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 3,
    }],
  } : null;

  // Monthly Revenue Chart
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const revenueByMonth = monthlyRevenue.map(m => ({ month: months[m.month - 1] || `M${m.month}`, amount: m.amount }));
  const monthlyRevenueChart = revenueByMonth.length > 0 ? {
    labels: revenueByMonth.map(m => m.month),
    datasets: [{
      label: 'Revenue (₹)',
      data: revenueByMonth.map(m => m.amount),
      backgroundColor: 'rgba(34, 197, 94, 0.7)',
      borderColor: '#22c55e',
      borderWidth: 1,
      borderRadius: 4,
    }],
  } : null;

  // Monthly Purchase vs Sale
  const purchaseVsSaleChart = monthlyPurchaseVsSale.length > 0 ? {
    labels: monthlyPurchaseVsSale.map(m => m.month),
    datasets: [
      { label: 'Purchases', data: monthlyPurchaseVsSale.map(m => m.purchaseTotal), backgroundColor: 'rgba(239, 68, 68, 0.7)', borderColor: '#ef4444', borderWidth: 1, borderRadius: 4 },
      { label: 'Sales', data: monthlyPurchaseVsSale.map(m => m.saleTotal), backgroundColor: 'rgba(34, 197, 94, 0.7)', borderColor: '#22c55e', borderWidth: 1, borderRadius: 4 },
    ],
  } : null;

  // Top Selling Medicines
  const topMedChartColors = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
  ];
  const topMedicinesChart = topMedicines.length > 0 ? {
    labels: topMedicines.map(m => m._id?.length > 20 ? m._id?.substring(0, 20) + '...' : m._id),
    datasets: [{
      label: 'Qty Sold',
      data: topMedicines.map(m => m.totalQty),
      backgroundColor: topMedicines.map((_, i) => topMedChartColors[i % topMedChartColors.length]),
      borderColor: topMedicines.map((_, i) => topMedChartColors[i % topMedChartColors.length]),
      borderWidth: 1,
      borderRadius: 4,
    }],
  } : null;

  // Payment Method Chart
  const paymentMethodChart = paymentMethodStats.length > 0 ? {
    labels: paymentMethodStats.map(p => p.method.charAt(0).toUpperCase() + p.method.slice(1)),
    datasets: [{
      data: paymentMethodStats.map(p => p.total),
      backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'],
      borderWidth: 0,
    }],
  } : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Business analytics & inventory overview</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon blue"><i className="fa-solid fa-pills"></i></div>
          <div className="stat-info"><h3>{totalMedicines}</h3><p>Total Products</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-icon" style={{ background: '#fef2f2', color: '#ef4444' }}><i className="fa-solid fa-calendar-xmark"></i></div>
          <div className="stat-info"><h3>{expiredCount}</h3><p>Expired</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}><i className="fa-solid fa-clock"></i></div>
          <div className="stat-info"><h3>{nearExpiryCount}</h3><p>Upcoming Expiry</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}><i className="fa-solid fa-triangle-exclamation"></i></div>
          <div className="stat-info"><h3>{lowStockCount}</h3><p>Low Stock</p></div>
        </div>
      </div>

      {/* Sales Charts Row */}
      <div className="dashboard-charts-row">
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-chart-line" style={{ marginRight: '8px', color: '#3b82f6' }}></i>Daily Sales Trend</h5>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{saleStats?.todaySales || 0} today</span>
          </div>
          <div className="card-body card-body-chart">
            {dailySalesChart ? <Line data={dailySalesChart} options={chartOptions} />
            : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}><i className="fa-solid fa-chart-line" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i><p>Sales data will appear here</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-coins" style={{ marginRight: '8px', color: '#22c55e' }}></i>Monthly Revenue</h5>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>₹{(saleStats?.monthlyAmount || 0).toFixed(2)} this month</span>
          </div>
          <div className="card-body card-body-chart">
            {monthlyRevenueChart ? <Bar data={monthlyRevenueChart} options={chartOptions} />
            : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}><i className="fa-solid fa-coins" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i><p>Revenue data will appear here</p></div>}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="dashboard-charts-row-three">
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-cart-shopping" style={{ marginRight: '8px', color: '#ef4444' }}></i>Monthly Purchase vs Sales</h5>
          </div>
          <div className="card-body card-body-chart">
            {purchaseVsSaleChart ? <Bar data={purchaseVsSaleChart} options={chartOptions} />
            : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}><i className="fa-solid fa-chart-bar" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i><p>Purchase & sale data will appear here</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-star" style={{ marginRight: '8px', color: '#f59e0b' }}></i>Top Selling Medicines</h5>
          </div>
          <div className="card-body card-body-chart">
            {topMedicinesChart ? <Bar data={topMedicinesChart} options={{ ...chartOptions, indexAxis: 'y', plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
            : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}><i className="fa-solid fa-star" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i><p>Sales data needed for top medicines</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-credit-card" style={{ marginRight: '8px', color: '#8b5cf6' }}></i>Sales by Payment Method</h5>
          </div>
          <div className="card-body card-body-chart">
            {paymentMethodChart ? (
              <div className="payment-method-list">
                {paymentMethodStats.map((p, i) => {
                  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];
                  const pct = saleStats?.totalAmount > 0 ? ((p.total / saleStats.totalAmount) * 100).toFixed(1) : 0;
                  return (
                    <div key={i} className="payment-method-item">
                      <div className="payment-method-row">
                        <span className="payment-method-name">{p.method}</span>
                        <span className="payment-method-amount">₹{p.total.toFixed(2)} ({pct}%)</span>
                      </div>
                      <div className="payment-progress-bar">
                        <div className="payment-progress-fill" style={{ width: `${pct}%`, background: colors[i % colors.length] }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}><i className="fa-solid fa-credit-card" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i><p>Payment data will appear here</p></div>}
          </div>
        </div>
      </div>

      {/* Low Stock & Upcoming Expiry Tables */}
      <div className="dashboard-tables-row">
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px', color: '#f59e0b' }}></i>Low Stock Items</h5>
            {lowStockItems.length > 0 && <button className="btn btn-warning btn-sm" onClick={() => navigate('/medicines')}><i className="fa-solid fa-eye"></i> View All</button>}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {lowStockItems.length > 0 ? (
              <div className="table-container dashboard-table-scroll">
                <table className="dashboard-table">
                  <thead><tr><th>Medicine</th><th>Stock</th><th>Price</th></tr></thead>
                  <tbody>
                    {lowStockItems.slice(0, 8).map((item) => (
                      <tr key={item._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/medicines/${item._id}`)}>
                        <td style={{ fontWeight: 500, fontSize: '13px' }}>{item.medicineName}</td>
                        <td><span className="badge badge-danger">{item.currentStock} {item.unit || 'units'}</span></td>
                        <td style={{ fontWeight: 600, fontSize: '13px' }}>₹{item.sellingPrice?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '30px' }}>
                <i className="fa-solid fa-check-circle" style={{ fontSize: '36px', color: '#22c55e', marginBottom: '10px' }}></i>
                <p style={{ color: '#22c55e', fontWeight: 500 }}>All products are well stocked</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-clock" style={{ marginRight: '8px', color: '#f59e0b' }}></i>Upcoming Expiry (30 days)</h5>
            {expiringSoon.length > 0 && <button className="btn btn-warning btn-sm" onClick={() => navigate('/medicines')}><i className="fa-solid fa-eye"></i> View All</button>}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {expiringSoon.length > 0 ? (
              <div className="table-container dashboard-table-scroll">
                <table className="dashboard-table">
                  <thead><tr><th>Medicine</th><th>Expiry</th><th>Stock</th></tr></thead>
                  <tbody>
                    {expiringSoon.map((item) => (
                      <tr key={item._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/medicines/${item._id}`)}>
                        <td style={{ fontWeight: 500, fontSize: '13px' }}>{item.medicineName}</td>
                        <td><span className="badge badge-warning">{new Date(item.expiryDate).toLocaleDateString()}</span></td>
                        <td style={{ fontWeight: 600 }}>{item.currentStock} {item.unit || 'units'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '30px' }}>
                <i className="fa-solid fa-calendar-check" style={{ fontSize: '36px', color: '#22c55e', marginBottom: '10px' }}></i>
                <p style={{ color: '#22c55e', fontWeight: 500 }}>No medicines expiring soon</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      {saleStats?.recentSales?.length > 0 && (
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <h5><i className="fa-solid fa-receipt" style={{ marginRight: '8px', color: '#3b82f6' }}></i>Recent Sales</h5>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/sales')}><i className="fa-solid fa-arrow-right"></i> View All</button>
          </div>
          <div className="card-body dashboard-recent-sales-body">
            {/* Desktop table view */}
            <div className="table-container dashboard-table-scroll recent-sales-table">
              <table className="dashboard-table">
                <thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Payment</th><th>Date</th></tr></thead>
                <tbody>
                  {saleStats.recentSales.map((s) => (
                    <tr key={s._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/sales/${s._id}`)}>
                      <td style={{ fontWeight: 500, fontSize: '13px' }}>{s.invoiceNumber}</td>
                      <td>{s.customerName}</td>
                      <td style={{ fontWeight: 600 }}>₹{s.grandTotal?.toFixed(2)}</td>
                      <td><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{s.paymentMethod}</span></td>
                      <td style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{new Date(s.saleDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile card view */}
            <div className="recent-sales-mobile">
              {saleStats.recentSales.slice(0, 5).map((s) => (
                <div key={s._id} className="sale-card-item">
                  <div className="sale-card-main">
                    <div className="sale-card-info">
                      <div className="sale-card-customer">{s.customerName}</div>
                      <div className="sale-card-amount">₹{s.grandTotal?.toFixed(2)}</div>
                    </div>
                    <button className="btn btn-sm btn-outline view-details-btn" onClick={() => setSelectedSale(s)}>
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="modal-overlay" onClick={() => setSelectedSale(null)} style={{ opacity: 1, visibility: 'visible' }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="fa-solid fa-receipt" style={{ marginRight: '8px', color: '#3b82f6' }}></i>Sale Details</h3>
              <button className="close-btn" onClick={() => setSelectedSale(null)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="sale-detail-grid">
                <div className="sale-detail-field">
                  <span className="sale-detail-label">Invoice</span>
                  <span className="sale-detail-value">{selectedSale.invoiceNumber}</span>
                </div>
                <div className="sale-detail-field">
                  <span className="sale-detail-label">Customer</span>
                  <span className="sale-detail-value">{selectedSale.customerName}</span>
                </div>
                <div className="sale-detail-field">
                  <span className="sale-detail-label">Total</span>
                  <span className="sale-detail-value sale-detail-amount">₹{selectedSale.grandTotal?.toFixed(2)}</span>
                </div>
                <div className="sale-detail-field">
                  <span className="sale-detail-label">Payment</span>
                  <span className="sale-detail-value"><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{selectedSale.paymentMethod}</span></span>
                </div>
                <div className="sale-detail-field">
                  <span className="sale-detail-label">Date</span>
                  <span className="sale-detail-value">{new Date(selectedSale.saleDate).toLocaleDateString()}</span>
                </div>
                {selectedSale.discount > 0 && (
                  <div className="sale-detail-field">
                    <span className="sale-detail-label">Discount</span>
                    <span className="sale-detail-value">₹{selectedSale.discount?.toFixed(2)}</span>
                  </div>
                )}
                {selectedSale.tax > 0 && (
                  <div className="sale-detail-field">
                    <span className="sale-detail-label">Tax</span>
                    <span className="sale-detail-value">₹{selectedSale.tax?.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedSale(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => { setSelectedSale(null); navigate(`/sales/${selectedSale._id}`); }}>
                <i className="fa-solid fa-external-link-alt"></i> Full Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
