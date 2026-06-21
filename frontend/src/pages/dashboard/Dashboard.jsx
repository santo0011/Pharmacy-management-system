import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchCategories } from '../../redux/slices/categorySlice';
import { fetchBrands } from '../../redux/slices/brandSlice';
import { fetchSuppliers } from '../../redux/slices/supplierSlice';
import { fetchMedicineStats } from '../../redux/slices/medicineSlice';
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
  const { superAdmin: saData, loading: saLoading } = useSelector((state) => state.dashboard);

  useEffect(() => {
    if (isSuperAdmin) {
      dispatch(fetchSuperAdminDashboard());
    } else {
      dispatch(fetchCategories({ limit: 5 }));
      dispatch(fetchBrands({ limit: 5 }));
      dispatch(fetchSuppliers({ limit: 5 }));
      dispatch(fetchMedicineStats());
    }
  }, [dispatch, isSuperAdmin]);

  // SUPER ADMIN DASHBOARD
  if (isSuperAdmin) {
    const subscriptionChartData = {
      labels: saData?.subscriptionStats?.map((s) => s.plan.charAt(0).toUpperCase() + s.plan.slice(1)) || [],
      datasets: [{
        data: saData?.subscriptionStats?.map((s) => s.count) || [],
        backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'],
        borderWidth: 0,
      }],
    };

    const statusChartData = {
      labels: saData?.statusDistribution?.map((s) => s.status.charAt(0).toUpperCase() + s.status.slice(1)) || [],
      datasets: [{
        data: saData?.statusDistribution?.map((s) => s.count) || [],
        backgroundColor: ['#22c55e', '#ef4444', '#f59e0b'],
        borderWidth: 0,
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
          <div className="card">
            <div className="card-header"><h5>Subscription Plans</h5></div>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
              {saData?.subscriptionStats?.length > 0 ? (
                <div style={{ width: '250px' }}>
                  <Doughnut data={subscriptionChartData} options={{ cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }} />
                </div>
              ) : <p style={{ color: 'var(--gray-500)' }}>No subscription data</p>}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h5>Pharmacy Status</h5></div>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
              {saData?.statusDistribution?.length > 0 ? (
                <div style={{ width: '250px' }}>
                  <Doughnut data={statusChartData} options={{ cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }} />
                </div>
              ) : <p style={{ color: 'var(--gray-500)' }}>No status data</p>}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header"><h5>Monthly Registrations</h5></div>
          <div className="card-body">
            {saData?.monthlyRegistrations?.length > 0 ? (
              <Bar data={registrationChartData} options={{
                responsive: true,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } },
              }} />
            ) : <p style={{ color: 'var(--gray-500)', textAlign: 'center', padding: '20px' }}>No registration data</p>}
          </div>
        </div>

        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header"><h5>Recent Pharmacies</h5></div>
          <div className="card-body" style={{ padding: 0 }}>
            {saData?.recentPharmacies?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Pharmacy</th><th>Owner</th><th>Email</th><th>Plan</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {saData.recentPharmacies.map((p) => (
                      <tr key={p._id} style={{ cursor: 'pointer' }} onClick={() => navigate('/pharmacies')}>
                        <td style={{ fontWeight: 500 }}>{p.pharmacyName}</td>
                        <td>{p.ownerName}</td>
                        <td>{p.email}</td>
                        <td><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{p.subscriptionPlan}</span></td>
                        <td><span className={`badge ${p.status === 'active' ? 'badge-success' : p.status === 'suspended' ? 'badge-danger' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>{p.status}</span></td>
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

  // PHARMACY USER DASHBOARD
  const pharmacyStats = [
    { label: 'Total Medicines', value: medicineStats.totalMedicines || 0, icon: 'fa-solid fa-pills', color: 'blue' },
    { label: 'Active Medicines', value: medicineStats.activeMedicines || 0, icon: 'fa-solid fa-circle-check', color: 'green' },
    { label: 'Low Stock', value: medicineStats.lowStockMedicines || 0, icon: 'fa-solid fa-triangle-exclamation', color: 'yellow' },
    { label: 'Expired', value: medicineStats.expiredMedicines || 0, icon: 'fa-solid fa-calendar-xmark', color: 'red' },
    { label: 'Near Expiry', value: medicineStats.nearExpiryMedicines || 0, icon: 'fa-solid fa-clock', color: 'orange' },
  ];

  const medicineChartData = {
    labels: ['Active', 'Low Stock', 'Expired', 'Near Expiry'],
    datasets: [{
      data: [
        medicineStats.activeMedicines || 0,
        medicineStats.lowStockMedicines || 0,
        medicineStats.expiredMedicines || 0,
        medicineStats.nearExpiryMedicines || 0,
      ],
      backgroundColor: ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6'],
      borderWidth: 0,
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

      <div className="stats-grid">
        {pharmacyStats.map((stat, i) => (
          <div className="stat-card" key={i}>
            <div className={`stat-icon ${stat.color}`}><i className={stat.icon}></i></div>
            <div className="stat-info"><h3>{stat.value}</h3><p>{stat.label}</p></div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
        <div className="card">
          <div className="card-header"><h5>Medicine Overview</h5></div>
          <div className="card-body" style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            {medicineStats.totalMedicines > 0 ? (
              <div style={{ width: '250px' }}>
                <Doughnut data={medicineChartData} options={{ cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }} />
              </div>
            ) : <p style={{ color: 'var(--gray-500)' }}>No medicines yet</p>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h5>Recent Categories</h5></div>
          <div className="card-body" style={{ padding: 0 }}>
            {categories.loading ? (
              <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
            ) : categories.items?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead><tr><th>Name</th><th>Status</th></tr></thead>
                  <tbody>
                    {categories.items.slice(0, 5).map((item) => (
                      <tr key={item._id}>
                        <td>{item.name}</td>
                        <td><span className={`badge ${item.status ? 'badge-success' : 'badge-danger'}`}>{item.status ? 'Active' : 'Inactive'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty-state" style={{ padding: '30px' }}><p>No categories</p></div>}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        <div className="card">
          <div className="card-header"><h5>Recent Brands</h5></div>
          <div className="card-body" style={{ padding: 0 }}>
            {brands.loading ? (
              <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
            ) : brands.items?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead><tr><th>Name</th><th>Status</th></tr></thead>
                  <tbody>
                    {brands.items.slice(0, 5).map((item) => (
                      <tr key={item._id}>
                        <td>{item.name}</td>
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
          <div className="card-header"><h5>Recent Suppliers</h5></div>
          <div className="card-body" style={{ padding: 0 }}>
            {suppliers.loading ? (
              <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
            ) : suppliers.items?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead><tr><th>Name</th><th>Status</th></tr></thead>
                  <tbody>
                    {suppliers.items.slice(0, 5).map((item) => (
                      <tr key={item._id}>
                        <td>{item.supplierName || item.companyName}</td>
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