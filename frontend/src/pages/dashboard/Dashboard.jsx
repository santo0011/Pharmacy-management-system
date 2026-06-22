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
import { Bar, Line } from 'react-chartjs-2';

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
    return (
      <div>
        <div className="page-header">
          <div>
            <h2>Platform Dashboard</h2>
            <p>Overview of your entire pharmacy platform</p>
          </div>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><i className="fa-solid fa-hospital"></i></div>
            <div className="stat-info"><h3>{saData?.totalPharmacies || 0}</h3><p>Total Pharmacies</p></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><i className="fa-solid fa-check-circle"></i></div>
            <div className="stat-info"><h3>{saData?.activePharmacies || 0}</h3><p>Active Pharmacies</p></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><i className="fa-solid fa-ban"></i></div>
            <div className="stat-info"><h3>{saData?.suspendedPharmacies || 0}</h3><p>Suspended</p></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><i className="fa-solid fa-users"></i></div>
            <div className="stat-info"><h3>{saData?.totalUsers || 0}</h3><p>Total Users</p></div>
          </div>
        </div>
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <h5><i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Recent Pharmacies</h5>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/pharmacies')}><i className="fa-solid fa-arrow-right"></i> View All</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {saData?.recentPharmacies?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead><tr><th>Pharmacy</th><th>Owner</th><th>Email</th><th>Plan</th><th>Status</th><th>Joined</th></tr></thead>
                  <tbody>
                    {saData.recentPharmacies.map((p) => (
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
  const topMedicinesChart = topMedicines.length > 0 ? {
    labels: topMedicines.map(m => m._id?.length > 20 ? m._id?.substring(0, 20) + '...' : m._id),
    datasets: [{
      label: 'Qty Sold',
      data: topMedicines.map(m => m.totalQty),
      backgroundColor: 'rgba(59, 130, 246, 0.7)',
      borderColor: '#3b82f6',
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
          <div className="stat-icon red"><i className="fa-solid fa-calendar-xmark"></i></div>
          <div className="stat-info"><h3>{expiredCount}</h3><p>Expired</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon yellow"><i className="fa-solid fa-clock"></i></div>
          <div className="stat-info"><h3>{nearExpiryCount}</h3><p>Upcoming Expiry</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon yellow"><i className="fa-solid fa-triangle-exclamation"></i></div>
          <div className="stat-info"><h3>{lowStockCount}</h3><p>Low Stock</p></div>
        </div>
      </div>

      {/* Sales Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-chart-line" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Daily Sales Trend</h5>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{saleStats?.todaySales || 0} today</span>
          </div>
          <div className="card-body" style={{ padding: '20px', minHeight: '250px' }}>
            {dailySalesChart ? <Line data={dailySalesChart} options={chartOptions} />
            : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}><i className="fa-solid fa-chart-line" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i><p>Sales data will appear here</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-coins" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Monthly Revenue</h5>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>₹{(saleStats?.monthlyAmount || 0).toFixed(2)} this month</span>
          </div>
          <div className="card-body" style={{ padding: '20px', minHeight: '250px' }}>
            {monthlyRevenueChart ? <Bar data={monthlyRevenueChart} options={chartOptions} />
            : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}><i className="fa-solid fa-coins" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i><p>Revenue data will appear here</p></div>}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-cart-shopping" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Monthly Purchase vs Sales</h5>
          </div>
          <div className="card-body" style={{ padding: '20px', minHeight: '250px' }}>
            {purchaseVsSaleChart ? <Bar data={purchaseVsSaleChart} options={chartOptions} />
            : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}><i className="fa-solid fa-chart-bar" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i><p>Purchase & sale data will appear here</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-star" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Top Selling Medicines</h5>
          </div>
          <div className="card-body" style={{ padding: '20px', minHeight: '250px' }}>
            {topMedicinesChart ? <Bar data={topMedicinesChart} options={{ ...chartOptions, indexAxis: 'y', plugins: { ...chartOptions.plugins, legend: { display: false } } }} />
            : <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}><i className="fa-solid fa-star" style={{ fontSize: '36px', marginBottom: '8px', color: 'var(--gray-300)' }}></i><p>Sales data needed for top medicines</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-credit-card" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Sales by Payment Method</h5>
          </div>
          <div className="card-body" style={{ padding: '20px', minHeight: '250px' }}>
            {paymentMethodChart ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {paymentMethodStats.map((p, i) => {
                  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];
                  const pct = saleStats?.totalAmount > 0 ? ((p.total / saleStats.totalAmount) * 100).toFixed(1) : 0;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{p.method}</span>
                        <span>₹{p.total.toFixed(2)} ({pct}%)</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--gray-100)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: colors[i % colors.length], borderRadius: '3px', transition: 'width 0.5s' }}></div>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px', color: '#f59e0b' }}></i>Low Stock Items</h5>
            {lowStockItems.length > 0 && <button className="btn btn-warning btn-sm" onClick={() => navigate('/medicines')}><i className="fa-solid fa-eye"></i> View All</button>}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {lowStockItems.length > 0 ? (
              <div className="table-container">
                <table>
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
              <div className="table-container">
                <table>
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
            <h5><i className="fa-solid fa-receipt" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Recent Sales</h5>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/sales')}><i className="fa-solid fa-arrow-right"></i> View All</button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-container">
              <table>
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
          </div>
        </div>
      )}
    </div>
  );
}