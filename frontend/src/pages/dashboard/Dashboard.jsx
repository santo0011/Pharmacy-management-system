import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchCategories } from '../../redux/slices/categorySlice';
import { fetchBrands } from '../../redux/slices/brandSlice';
import { fetchSuppliers } from '../../redux/slices/supplierSlice';
import { fetchMedicineStats } from '../../redux/slices/medicineSlice';
import { fetchSuperAdminDashboard, fetchPharmacyDashboard } from '../../redux/slices/dashboardSlice';
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
import { Doughnut, Bar, Line } from 'react-chartjs-2';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isSuperAdmin, isPharmacyUser } = useAuth();
  const categories = useSelector((state) => state.categories);
  const brands = useSelector((state) => state.brands);
  const suppliers = useSelector((state) => state.suppliers);
  const { stats: medicineStats } = useSelector((state) => state.medicines);
  const { superAdmin: saData, pharmacy: phData, loading: saLoading } = useSelector((state) => state.dashboard);
  const [timeRange, setTimeRange] = useState('all');

  useEffect(() => {
    if (isSuperAdmin) {
      dispatch(fetchSuperAdminDashboard());
    } else {
      dispatch(fetchPharmacyDashboard());
      dispatch(fetchCategories({ limit: 100 }));
      dispatch(fetchBrands({ limit: 100 }));
      dispatch(fetchSuppliers({ limit: 100 }));
      dispatch(fetchMedicineStats());
    }
  }, [dispatch, isSuperAdmin]);

  // SUPER ADMIN DASHBOARD
  if (isSuperAdmin) {
    const subscriptionChartData = {
      labels: saData?.subscriptionStats?.map((s) => s.plan.charAt(0).toUpperCase() + s.plan.slice(1)) || [],
      datasets: [{
        data: saData?.subscriptionStats?.map((s) => s.count) || [],
        backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    };

    const statusChartData = {
      labels: saData?.statusDistribution?.map((s) => s.status.charAt(0).toUpperCase() + s.status.slice(1)) || [],
      datasets: [{
        data: saData?.statusDistribution?.map((s) => s.count) || [],
        backgroundColor: ['#22c55e', '#ef4444', '#f59e0b'],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    };

    const registrationChartData = {
      labels: saData?.monthlyRegistrations?.map((m) => {
        const [y, mo] = m.month.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[parseInt(mo) - 1]} ${y}`;
      }) || [],
      datasets: [{
        label: 'New Pharmacies',
        data: saData?.monthlyRegistrations?.map((m) => m.count) || [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#3b82f6',
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    };

    return (
      <div>
        <div className="page-header">
          <div>
            <h2>Platform Dashboard</h2>
            <p>Overview of your entire pharmacy platform</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><i className="fa-solid fa-hospital"></i></div>
            <div className="stat-info"><h3>{saData?.totalPharmacies || 0}</h3><p>Total Pharmacies</p></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><i className="fa-solid fa-check-circle"></i></div>
            <div className="stat-info"><h3>{saData?.activePharmacies || 0}</h3><p>Active Pharmacies</p></div>
            <div style={{ fontSize: '12px', color: '#22c55e', marginTop: '4px' }}>
              {saData?.totalPharmacies > 0 ? Math.round((saData.activePharmacies / saData.totalPharmacies) * 100) : 0}% of total
            </div>
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

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
          <div className="card">
            <div className="card-header">
              <h5><i className="fa-solid fa-layer-group" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Subscription Plans</h5>
            </div>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
              {saData?.subscriptionStats?.length > 0 ? (
                <div style={{ width: '260px' }}>
                  <Doughnut data={subscriptionChartData} options={{
                    cutout: '65%',
                    plugins: {
                      legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12, font: { size: 12 } } },
                    },
                  }} />
                  <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', color: '#94a3b8' }}>
                    {saData.subscriptionStats.reduce((sum, s) => sum + s.count, 0)} total subscriptions
                  </div>
                </div>
              ) : <p style={{ color: 'var(--gray-500)' }}>No subscription data</p>}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h5><i className="fa-solid fa-circle-check" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Pharmacy Status</h5>
            </div>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
              {saData?.statusDistribution?.length > 0 ? (
                <div style={{ width: '260px' }}>
                  <Doughnut data={statusChartData} options={{
                    cutout: '65%',
                    plugins: {
                      legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12, font: { size: 12 } } },
                    },
                  }} />
                </div>
              ) : <p style={{ color: 'var(--gray-500)' }}>No status data</p>}
            </div>
          </div>
        </div>

        {/* Monthly Registrations */}
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <h5><i className="fa-solid fa-chart-line" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Monthly Registrations</h5>
          </div>
          <div className="card-body" style={{ padding: '24px' }}>
            {saData?.monthlyRegistrations?.length > 0 ? (
              <Line data={registrationChartData} options={{
                responsive: true,
                plugins: {
                  legend: { labels: { color: '#94a3b8' } },
                  tooltip: { backgroundColor: '#1f2937', titleColor: '#fff', bodyColor: '#94a3b8' },
                },
                scales: {
                  x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
                  y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,0.1)' }, beginAtZero: true },
                },
                interaction: { intersect: false, mode: 'index' },
              }} />
            ) : <p style={{ color: 'var(--gray-500)', textAlign: 'center', padding: '20px' }}>No registration data yet</p>}
          </div>
        </div>

        {/* Recent Pharmacies */}
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <h5><i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Recent Pharmacies</h5>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/pharmacies')}>
              <i className="fa-solid fa-arrow-right"></i> View All
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {saData?.recentPharmacies?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Pharmacy</th><th>Owner</th><th>Email</th><th>Plan</th><th>Status</th><th>Joined</th></tr>
                  </thead>
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

  // PHARMACY USER DASHBOARD - Professional
  const totalMedicines = phData?.totalMedicines || medicineStats.totalMedicines || 0;
  const activeMedicines = phData?.activeMedicines || medicineStats.activeMedicines || 0;
  const lowStockCount = phData?.lowStockMedicines || medicineStats.lowStockMedicines || 0;
  const expiredCount = medicineStats.expiredMedicines || 0;
  const nearExpiryCount = medicineStats.nearExpiryMedicines || 0;
  const lowStockItems = phData?.lowStockItems || [];

  const medicineChartData = {
    labels: ['Active', 'Low Stock', 'Expired', 'Near Expiry'],
    datasets: [{
      data: [activeMedicines, lowStockCount, expiredCount, nearExpiryCount],
      backgroundColor: ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6'],
      borderWidth: 0,
      hoverOffset: 8,
    }],
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Overview of your pharmacy</p>
        </div>
      </div>

      {/* Low Stock Alert Banner */}
      {lowStockItems.length > 0 && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '10px',
          marginBottom: '20px',
          backgroundColor: '#fff3e0',
          border: '1px solid #ffcc80',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            backgroundColor: '#ff9800', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '18px', color: '#fff' }}></i>
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#e65100', fontSize: '15px' }}>
              {lowStockItems.length} Product{lowStockItems.length > 1 ? 's' : ''} Low on Stock
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#666' }}>
              These products are running low. <a href="/medicines" style={{ color: 'var(--primary-color)', fontWeight: 500 }}>View inventory →</a>
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon blue"><i className="fa-solid fa-pills"></i></div>
          <div className="stat-info"><h3>{totalMedicines}</h3><p>Total Products</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #22c55e' }}>
          <div className="stat-icon green"><i className="fa-solid fa-circle-check"></i></div>
          <div className="stat-info"><h3>{activeMedicines}</h3><p>Active Products</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="stat-icon yellow"><i className="fa-solid fa-triangle-exclamation"></i></div>
          <div className="stat-info"><h3>{lowStockCount}</h3><p>Low Stock</p></div>
          {lowStockCount > 0 && <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px' }}>Needs attention</div>}
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div className="stat-icon red"><i className="fa-solid fa-calendar-xmark"></i></div>
          <div className="stat-info"><h3>{expiredCount}</h3><p>Expired</p></div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-icon purple"><i className="fa-solid fa-clock"></i></div>
          <div className="stat-info"><h3>{nearExpiryCount}</h3><p>Near Expiry</p></div>
        </div>
      </div>

      {/* Charts & Tables Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
        {/* Medicine Overview Chart */}
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-chart-pie" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Medicine Overview</h5>
          </div>
          <div className="card-body" style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
            {totalMedicines > 0 ? (
              <div style={{ width: '260px' }}>
                <Doughnut data={medicineChartData} options={{
                  cutout: '65%',
                  plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12, font: { size: 12 } } },
                  },
                }} />
                <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', color: '#94a3b8' }}>
                  {totalMedicines} total products in inventory
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <i className="fa-solid fa-pills" style={{ fontSize: '40px', color: 'var(--gray-400)', marginBottom: '12px' }}></i>
                <p style={{ color: 'var(--gray-500)' }}>No medicines yet.</p>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/medicines/new')} style={{ marginTop: '8px' }}>
                  <i className="fa-solid fa-plus"></i> Add Medicine
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px', color: '#f59e0b' }}></i>Low Stock Items</h5>
            {lowStockItems.length > 0 && (
              <button className="btn btn-warning btn-sm" onClick={() => navigate('/medicines')}>
                <i className="fa-solid fa-eye"></i> View All
              </button>
            )}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {lowStockItems.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead><tr><th>Medicine</th><th>Stock</th><th>Min Alert</th><th>Price</th></tr></thead>
                  <tbody>
                    {lowStockItems.map((item) => (
                      <tr key={item._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/medicines/${item._id}`)}>
                        <td style={{ fontWeight: 500 }}>{item.medicineName}</td>
                        <td>
                          <span className="badge badge-danger" style={{ fontWeight: 600 }}>
                            {item.currentStock} {item.unit || 'units'}
                          </span>
                        </td>
                        <td style={{ color: '#94a3b8' }}>{item.minStockAlert}</td>
                        <td style={{ fontWeight: 600 }}>₹{item.sellingPrice?.toFixed(2)}</td>
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
      </div>

      {/* Recent & Reference Data */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Recent Products</h5>
            {phData?.recentMedicines?.length > 0 && (
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/medicines')}>
                <i className="fa-solid fa-arrow-right"></i> View All
              </button>
            )}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {phData?.recentMedicines?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead><tr><th>Name</th><th>Category</th><th>Stock</th><th>Price</th></tr></thead>
                  <tbody>
                    {phData.recentMedicines.map((item) => (
                      <tr key={item._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/medicines/${item._id}`)}>
                        <td style={{ fontWeight: 500 }}>
                          {item.medicineName}
                          {item.expiryDate && new Date(item.expiryDate) < new Date() && (
                            <span className="badge badge-danger" style={{ marginLeft: '6px', fontSize: '10px' }}>Expired</span>
                          )}
                        </td>
                        <td style={{ color: '#94a3b8', fontSize: '13px' }}>{item.category?.name || '-'}</td>
                        <td>
                          <span className={`badge ${item.currentStock <= item.minStockAlert ? 'badge-danger' : 'badge-success'}`}>
                            {item.currentStock}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>₹{item.sellingPrice?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '30px' }}>
                <i className="fa-solid fa-box-open" style={{ fontSize: '36px', color: 'var(--gray-400)', marginBottom: '10px' }}></i>
                <p style={{ color: 'var(--gray-500)' }}>No products yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-tags" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Categories</h5>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/categories')}>
              <i className="fa-solid fa-arrow-right"></i> View All
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {categories.loading ? (
              <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
            ) : categories.items?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead><tr><th>Name</th><th>Status</th><th>Items</th></tr></thead>
                  <tbody>
                    {categories.items.slice(0, 6).map((item) => (
                      <tr key={item._id}>
                        <td style={{ fontWeight: 500 }}>{item.name}</td>
                        <td><span className={`badge ${item.status ? 'badge-success' : 'badge-danger'}`}>{item.status ? 'Active' : 'Inactive'}</span></td>
                        <td style={{ color: '#94a3b8' }}>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state" style={{ padding: '30px' }}><p>No categories</p></div>}
          </div>
        </div>
      </div>

      {/* Bottom Row: Brands & Suppliers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-copyright" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Brands</h5>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/brands')}>
              <i className="fa-solid fa-arrow-right"></i> View All
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {brands.loading ? (
              <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
            ) : brands.items?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead><tr><th>Name</th><th>Status</th></tr></thead>
                  <tbody>
                    {brands.items.slice(0, 6).map((item) => (
                      <tr key={item._id}>
                        <td style={{ fontWeight: 500 }}>{item.name}</td>
                        <td><span className={`badge ${item.status ? 'badge-success' : 'badge-danger'}`}>{item.status ? 'Active' : 'Inactive'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state" style={{ padding: '30px' }}><p>No brands</p></div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-truck" style={{ marginRight: '8px', color: 'var(--primary-color)' }}></i>Suppliers</h5>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/suppliers')}>
              <i className="fa-solid fa-arrow-right"></i> View All
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {suppliers.loading ? (
              <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
            ) : suppliers.items?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead><tr><th>Company</th><th>Contact</th><th>Status</th></tr></thead>
                  <tbody>
                    {suppliers.items.slice(0, 6).map((item) => (
                      <tr key={item._id}>
                        <td style={{ fontWeight: 500 }}>{item.companyName || item.supplierName}</td>
                        <td style={{ fontSize: '13px', color: '#94a3b8' }}>{item.phone || '-'}</td>
                        <td><span className={`badge ${item.status ? 'badge-success' : 'badge-danger'}`}>{item.status ? 'Active' : 'Inactive'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state" style={{ padding: '30px' }}><p>No suppliers</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}