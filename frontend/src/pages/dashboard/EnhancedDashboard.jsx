import { useEffect, useState } from 'react';
import AnimatedCounter from '../../components/common/AnimatedCounter';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchSuperAdminDashboard, fetchPharmacyDashboard } from '../../redux/slices/dashboardSlice';
import { fetchSaleStats } from '../../redux/slices/saleSlice';
import { fetchPurchaseStats } from '../../redux/slices/purchaseSlice';
import { fetchMedicines } from '../../redux/slices/medicineSlice';
import { notificationService } from '../../services/notificationService';
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

export default function EnhancedDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isSuperAdmin, user } = useAuth();
  const { superAdmin: saData, pharmacy: phData } = useSelector((state) => state.dashboard);
  const saleStats = useSelector((state) => state.sales?.stats);
  const purchaseStats = useSelector((state) => state.purchases?.stats);
  const { items: medicines } = useSelector((state) => state.medicines);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [expandedInvoice, setExpandedInvoice] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (isSuperAdmin) {
      dispatch(fetchSuperAdminDashboard());
    } else {
      dispatch(fetchPharmacyDashboard());
      dispatch(fetchSaleStats());
      dispatch(fetchPurchaseStats());
      dispatch(fetchMedicines({ limit: 200, expired: '', expiringSoon: '' }));
      // Fetch unread notification count
      notificationService.getUnreadCount().then(res => {
        setUnreadNotifications(res.data?.data?.count || 0);
      }).catch(() => { });
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
    const deactivated = saData?.deactivatedPharmacies || 0;
    const users = saData?.totalUsers || 0;

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
            <h2><i className="fa-solid fa-chart-simple" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>Platform Dashboard</h2>
            <p>Overview of your entire pharmacy platform</p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div className="stat-icon blue"><i className="fa-solid fa-hospital"></i></div>
            <div className="stat-info"><h3><AnimatedCounter value={total} /></h3><p>Total Pharmacies</p></div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #22c55e' }}>
            <div className="stat-icon green"><i className="fa-solid fa-check-circle"></i></div>
            <div className="stat-info"><h3><AnimatedCounter value={active} /></h3><p>Active Pharmacies</p></div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
            <div className="stat-icon" style={{ background: '#fef2f2', color: '#ef4444' }}><i className="fa-solid fa-ban"></i></div>
            <div className="stat-info"><h3><AnimatedCounter value={deactivated} /></h3><p>Deactivated</p></div>
          </div>
          {/* <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div className="stat-icon" style={{ background: '#f3e8ff', color: '#8b5cf6' }}><i className="fa-solid fa-users"></i></div>
            <div className="stat-info"><h3><AnimatedCounter value={users} /></h3><p>Total Users</p></div>
          </div> */}
        </div>

        <div className="dashboard-charts-row">
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
          <div className="card">
            <div className="card-header">
              <h5><i className="fa-solid fa-credit-card" style={{ marginRight: '8px', color: '#22c55e' }}></i>Subscription Distribution</h5>
              <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{subStats.length} plan types</span>
            </div>
            <div className="card-body card-body-chart card-body-center">
              {subscriptionChartData ? (
                <div className="chart-doughnut-wrapper">
                  <Doughnut data={subscriptionChartData} options={{ cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 10, font: { size: 11 }, boxWidth: 12 } } } }} />
                  <div className="chart-total-label"><strong>{total}</strong> total pharmacies</div>
                </div>
              ) : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}><i className="fa-solid fa-pie-chart" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i><p>Subscription data will appear here</p></div>}
            </div>
          </div>
        </div>

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
  const totalMedicines = phData?.totalMedicines || 0;
  const lowStockCount = phData?.lowStockMedicines || 0;
  const expiredCount = phData?.expiredMedicines || 0;
  const lowStockItems = phData?.lowStockItems || [];
  const expiredMedicinesList = phData?.expiredMedicinesList || [];

  // Sale stats
  const dailySales = saleStats?.dailySales || [];
  const monthlyRevenue = saleStats?.monthlyRevenue || [];
  const topMedicines = saleStats?.topMedicines || [];
  const paymentMethodStats = saleStats?.paymentMethodStats || [];
  const monthlyPurchaseVsSale = saleStats?.monthlyPurchaseVsSale || [];

  // Profit/Loss calculations
  const totalRevenue = saleStats?.totalAmount || 0;
  const totalSales = saleStats?.totalSales || 0;
  const monthlyAmount = saleStats?.monthlyAmount || 0;
  const monthlyProfit = saleStats?.monthlyProfit || 0;
  const todayAmount = saleStats?.todayAmount || 0;
  const todaySales = saleStats?.todaySales || 0;
  const weeklyAmount = saleStats?.weeklyAmount || 0;
  const weeklyProfit = saleStats?.weeklyProfit || 0;

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
  const topMedChartColors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'];
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
          <h2><i className="fa-solid fa-chart-pie" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>Dashboard</h2>
          <p>Business analytics & inventory overview</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/notifications')} style={{ position: 'relative' }}>
            <i className="fa-solid fa-bell"></i> Alerts
            {unreadNotifications > 0 && (
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px',
                background: '#ef4444', color: 'white', borderRadius: '50%',
                width: '18px', height: '18px', fontSize: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 600,
              }}>{unreadNotifications}</span>
            )}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/sales/new')}>
            <i className="fa-solid fa-plus"></i> New Sale
          </button>
        </div>
      </div>

      {/* Stats Cards - 7 cards in grid, Low Stock & Expired combined */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon blue"><i className="fa-solid fa-pills"></i></div>
          <div className="stat-info"><h3><AnimatedCounter value={totalMedicines} /></h3><p>Total Products</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #22c55e' }}>
          <div className="stat-icon green"><i className="fa-solid fa-coins"></i></div>
          <div className="stat-info"><h3>₹<AnimatedCounter value={totalRevenue} decimals={2} compact /></h3><p>Total Revenue</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon blue"><i className="fa-solid fa-receipt"></i></div>
          <div className="stat-info"><h3><AnimatedCounter value={totalSales} /></h3><p>Total Sales Count</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #22c55e' }}>
          <div className="stat-icon green"><i className="fa-solid fa-indian-rupee-sign"></i></div>
          <div className="stat-info"><h3>₹<AnimatedCounter value={todayAmount} decimals={2} compact /></h3><p>Today's Sales ({todaySales})</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <div className="stat-icon" style={{ background: '#f3e8ff', color: '#8b5cf6' }}><i className="fa-solid fa-chart-line"></i></div>
          <div className="stat-info"><h3>₹<AnimatedCounter value={monthlyAmount} decimals={2} compact /></h3><p>Monthly Revenue</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}><i className="fa-solid fa-triangle-exclamation"></i></div>
          <div className="stat-info">
            <h3 style={{ fontSize: '20px', whiteSpace: 'nowrap' }}>
              <AnimatedCounter value={lowStockCount} /> / <span style={{ color: '#ef4444' }}><AnimatedCounter value={expiredCount} /></span>
            </h3>
            <p>Low Stock / Expired</p>
          </div>
        </div>
      </div>

      {/* Sales Charts Row */}
      <div className="dashboard-charts-row">
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-chart-line" style={{ marginRight: '8px', color: '#3b82f6' }}></i>Daily Sales Trend</h5>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{todaySales} today</span>
          </div>
          <div className="card-body card-body-chart">
            {dailySalesChart ? <Line data={dailySalesChart} options={chartOptions} />
              : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}><i className="fa-solid fa-chart-line" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i><p>Sales data will appear here</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-coins" style={{ marginRight: '8px', color: '#22c55e' }}></i>Monthly Revenue</h5>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>₹{monthlyAmount.toFixed(2)} this month</span>
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
                  const pct = totalRevenue > 0 ? ((p.total / totalRevenue) * 100).toFixed(1) : 0;
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

      {/* Inventory Alerts Section - Professional 2+1 Layout */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '4px', height: '24px', background: 'linear-gradient(180deg, #f59e0b, #ef4444)', borderRadius: '2px' }}></div>
          <h5 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
            <i className="fa-solid fa-bell" style={{ marginRight: '8px', color: '#f59e0b' }}></i>Inventory Alerts
          </h5>
        </div>

        <div className="dashboard-tables-row" style={{ marginBottom: '16px' }}>
          {/* Low Stock Card */}
          <div className="card" style={{ flex: '1', minWidth: '280px' }}>
            <div className="card-header" style={{ borderBottom: '2px solid #fef3c7' }}>
              <h5 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                Low Stock Items
                {lowStockItems.length > 0 && (
                  <span className="badge badge-warning" style={{ fontSize: '10px', marginLeft: '4px' }}>{lowStockItems.length}</span>
                )}
              </h5>
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

          {/* Upcoming Expiry Card */}
          <div className="card" style={{ flex: '1', minWidth: '280px' }}>
            <div className="card-header" style={{ borderBottom: '2px solid #fef3c7' }}>
              <h5 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                Upcoming Expiry (30 days)
                {expiringSoon.length > 0 && (
                  <span className="badge badge-warning" style={{ fontSize: '10px', marginLeft: '4px' }}>{expiringSoon.length}</span>
                )}
              </h5>
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

        {/* Expired Medicines - Full Width with Summary Widgets */}
        <div className="card" style={{ border: '1px solid #fecaca', borderTop: '3px solid #ef4444' }}>
          <div className="card-header" style={{ background: '#fef2f2' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h5 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <i className="fa-solid fa-clock" style={{ color: '#ef4444' }}></i>
                Expired Medicines
                {expiredMedicinesList.length > 0 && (
                  <span className="badge" style={{ background: '#ef4444', color: '#fff', fontSize: '10px' }}>{expiredMedicinesList.length}</span>
                )}
              </h5>
            </div>
            {expiredMedicinesList.length > 0 && <button className="btn btn-danger btn-sm" onClick={() => navigate('/medicines?expired=true')}><i className="fa-solid fa-eye"></i> View All</button>}
          </div>

          {/* Summary Widgets Row */}
          {expiredMedicinesList.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', padding: '14px 16px', background: '#fafafa', borderBottom: '1px solid #fecaca' }}>
              <div style={{ textAlign: 'center', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Total Expired</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#dc2626', marginTop: '2px' }}><AnimatedCounter value={expiredMedicinesList.length} duration={800} /></div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Total Stock Lost</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#dc2626', marginTop: '2px' }}>
                  <AnimatedCounter value={expiredMedicinesList.reduce((sum, m) => sum + (m.currentStock || 0), 0)} duration={800} />
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Worst Case</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#dc2626', marginTop: '2px' }}>
                  {expiredMedicinesList.length > 0 ? (
                    <span>{Math.max(...expiredMedicinesList.map(m => Math.floor((new Date() - new Date(m.expiryDate)) / (1000 * 60 * 60 * 24))))} days</span>
                  ) : '0'}
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Affected Items</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#dc2626', marginTop: '2px' }}>
                  <AnimatedCounter value={expiredMedicinesList.filter(m => m.currentStock > 0).length} duration={800} />
                </div>
              </div>
            </div>
          )}

          <div className="card-body" style={{ padding: 0 }}>
            {expiredMedicinesList.length > 0 ? (
              <>
                {/* Desktop table */}
                <div className="dashboard-expired-desktop-table">
                  <div className="table-container">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Medicine</th>
                          <th>Batch</th>
                          <th>Expiry Date</th>
                          <th>Stock</th>
                          <th>Days Expired</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expiredMedicinesList.map((item) => {
                          const expiryDate = new Date(item.expiryDate);
                          const daysExpired = Math.floor((new Date() - expiryDate) / (1000 * 60 * 60 * 24));
                          const isCritical = daysExpired > 90;
                          const isWarning = daysExpired > 30;
                          return (
                            <tr key={item._id} style={{ cursor: 'pointer', background: isCritical ? '#fef2f2' : isWarning ? '#fffbeb' : 'transparent' }} onClick={() => navigate(`/medicines/${item._id}`)}>
                              <td style={{ fontWeight: 500, fontSize: '13px' }}>{item.medicineName}</td>
                              <td style={{ fontSize: '12px', color: '#64748b' }}>{item.batchNumber || '-'}</td>
                              <td><span className="badge badge-danger">{expiryDate.toLocaleDateString()}</span></td>
                              <td style={{ fontWeight: 600, color: item.currentStock > 0 ? '#dc2626' : '#94a3b8' }}>{item.currentStock} {item.unit || 'units'}</td>
                              <td>
                                <span className="badge" style={{
                                  background: isCritical ? '#fef2f2' : isWarning ? '#fffbeb' : '#f0fdf4',
                                  color: isCritical ? '#dc2626' : isWarning ? '#d97706' : '#16a34a',
                                  border: `1px solid ${isCritical ? '#fecaca' : isWarning ? '#fde68a' : '#bbf7d0'}`,
                                  fontWeight: 600,
                                }}>
                                  {daysExpired} day{daysExpired !== 1 ? 's' : ''}
                                </span>
                              </td>
                              <td>
                                {isCritical ? (
                                  <span className="badge badge-danger">Critical</span>
                                ) : isWarning ? (
                                  <span className="badge badge-warning">Warning</span>
                                ) : (
                                  <span className="badge badge-info">Recent</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile expandable rows */}
                <div className="dashboard-expired-mobile-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Days Expired</th>
                        <th className="sales-expand-th"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiredMedicinesList.map((item, idx) => {
                        const expiryDate = new Date(item.expiryDate);
                        const daysExpired = Math.floor((new Date() - expiryDate) / (1000 * 60 * 60 * 24));
                        const isCritical = daysExpired > 90;
                        const isWarning = daysExpired > 30;
                        const expanded = expandedInvoice === `expired-${idx}`;
                        return (
                          <>
                            <tr key={`mobile-${item._id}`} className="sales-mobile-row" onClick={() => setExpandedInvoice(prev => prev === `expired-${idx}` ? null : `expired-${idx}`)}>
                              <td>
                                <span style={{ fontWeight: 500, fontSize: '13px' }}>{item.medicineName}</span>
                              </td>
                              <td>
                                <span className="badge" style={{
                                  background: isCritical ? '#fef2f2' : isWarning ? '#fffbeb' : '#f0fdf4',
                                  color: isCritical ? '#dc2626' : isWarning ? '#d97706' : '#16a34a',
                                  border: `1px solid ${isCritical ? '#fecaca' : isWarning ? '#fde68a' : '#bbf7d0'}`,
                                  fontWeight: 600, fontSize: '12px',
                                }}>
                                  {daysExpired}d
                                </span>
                              </td>
                              <td className="sales-expand-cell">
                                <button className="sales-expand-btn">
                                  <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`}></i>
                                </button>
                              </td>
                            </tr>
                            <tr className={`sales-detail-row ${expanded ? 'sales-detail-row-open' : ''}`}>
                              <td colSpan={3} className="sales-detail-cell">
                                <div className="sales-detail-inner">
                                  <div className="sales-detail-item">
                                    <span className="sales-detail-label">Batch</span>
                                    <span className="sales-detail-value" style={{ fontSize: '12px', color: '#64748b' }}>{item.batchNumber || '-'}</span>
                                  </div>
                                  <div className="sales-detail-item">
                                    <span className="sales-detail-label">Expiry</span>
                                    <span className="sales-detail-value"><span className="badge badge-danger">{expiryDate.toLocaleDateString()}</span></span>
                                  </div>
                                  <div className="sales-detail-item">
                                    <span className="sales-detail-label">Stock</span>
                                    <span className="sales-detail-value" style={{ fontWeight: 600, color: item.currentStock > 0 ? '#dc2626' : '#94a3b8' }}>{item.currentStock} {item.unit || 'units'}</span>
                                  </div>
                                  <div className="sales-detail-item">
                                    <span className="sales-detail-label">Status</span>
                                    <span className="sales-detail-value">
                                      {isCritical ? (
                                        <span className="badge badge-danger">Critical</span>
                                      ) : isWarning ? (
                                        <span className="badge badge-warning">Warning</span>
                                      ) : (
                                        <span className="badge badge-info">Recent</span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ padding: '40px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <i className="fa-solid fa-check-circle" style={{ fontSize: '32px', color: '#22c55e' }}></i>
                </div>
                <h4 style={{ margin: '0 0 4px', color: '#166534' }}>No Expired Medicines</h4>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>All medicines in your inventory are within their expiry date.</p>
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
          <div className="card-body" style={{ padding: 0 }}>
            {/* Desktop table */}
            <div className="dashboard-recent-sales-desktop">
              <div className="table-container">
                <table>
                  <thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Paid</th><th>Due</th><th>Payment</th><th>Date</th></tr></thead>
                  <tbody>
                    {saleStats.recentSales.map((s) => (
                      <tr key={s._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/sales/${s._id}`)}>
                        <td style={{ fontWeight: 500, fontSize: '13px' }}>{s.invoiceNumber}</td>
                        <td>{s.customerName}</td>
                        <td style={{ fontWeight: 600 }}>₹{s.grandTotal?.toFixed(2)}</td>
                        <td style={{ color: '#22c55e', fontWeight: 500 }}>₹{s.paidAmount?.toFixed(2)}</td>
                        <td style={{ color: s.dueAmount > 0 ? '#ef4444' : '#22c55e', fontWeight: 500 }}>₹{s.dueAmount?.toFixed(2)}</td>
                        <td><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{s.paymentMethod}</span></td>
                        <td style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{new Date(s.saleDate).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile expandable rows */}
            <div className="dashboard-recent-sales-mobile">
              <table className="dashboard-recent-sales-mobile-table">
                <thead>
                  <tr>
                    <th>Invoice / Customer</th>
                    <th>Total</th>
                    <th className="sales-expand-th"></th>
                  </tr>
                </thead>
                <tbody>
                  {saleStats.recentSales.map((s, idx) => {
                    const expanded = expandedInvoice === `recent-sale-${idx}`;
                    return (
                      <>
                        <tr key={`mobile-${s._id}`} className="sales-mobile-row" onClick={() => setExpandedInvoice(prev => prev === `recent-sale-${idx}` ? null : `recent-sale-${idx}`)}>
                          <td>
                            <span style={{ fontWeight: 500, fontSize: '13px' }}>{s.invoiceNumber}</span>
                            <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{s.customerName}</div>
                          </td>
                          <td style={{ fontWeight: 600 }}>₹{s.grandTotal?.toFixed(2)}</td>
                          <td className="sales-expand-cell">
                            <button className="sales-expand-btn">
                              <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`}></i>
                            </button>
                          </td>
                        </tr>
                        <tr className={`sales-detail-row ${expanded ? 'sales-detail-row-open' : ''}`}>
                          <td colSpan={3} className="sales-detail-cell">
                            <div className="sales-detail-inner">
                              <div className="sales-detail-item">
                                <span className="sales-detail-label">Invoice</span>
                                <span className="sales-detail-value" style={{ fontWeight: 500 }}>{s.invoiceNumber}</span>
                              </div>
                              <div className="sales-detail-item">
                                <span className="sales-detail-label">Customer</span>
                                <span className="sales-detail-value">{s.customerName}</span>
                              </div>
                              <div className="sales-detail-item">
                                <span className="sales-detail-label">Total</span>
                                <span className="sales-detail-value" style={{ fontWeight: 600 }}>₹{s.grandTotal?.toFixed(2)}</span>
                              </div>
                              <div className="sales-detail-item">
                                <span className="sales-detail-label">Paid</span>
                                <span className="sales-detail-value" style={{ color: '#22c55e', fontWeight: 600 }}>₹{s.paidAmount?.toFixed(2)}</span>
                              </div>
                              <div className="sales-detail-item">
                                <span className="sales-detail-label">Due</span>
                                <span className="sales-detail-value" style={{ color: s.dueAmount > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>₹{s.dueAmount?.toFixed(2)}</span>
                              </div>
                              <div className="sales-detail-item">
                                <span className="sales-detail-label">Payment</span>
                                <span className="sales-detail-value"><span className="badge badge-info" style={{ textTransform: 'capitalize', fontSize: '11px' }}>{s.paymentMethod}</span></span>
                              </div>
                              <div className="sales-detail-item">
                                <span className="sales-detail-label">Date</span>
                                <span className="sales-detail-value" style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{new Date(s.saleDate).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


