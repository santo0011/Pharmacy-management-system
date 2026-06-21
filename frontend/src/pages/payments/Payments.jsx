import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPharmacies } from '../../redux/slices/pharmacySlice';
import { fetchActivePlans } from '../../redux/slices/subscriptionPlanSlice';
import Drawer from '../../components/common/Drawer';

export default function Payments() {
  const dispatch = useDispatch();
  const { items, loading } = useSelector((state) => state.pharmacies);
  const { activePlans } = useSelector((state) => state.subscriptionPlans);
  const [localPlans, setLocalPlans] = useState([]);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewPlanName, setViewPlanName] = useState('');
  const [viewPharmacies, setViewPharmacies] = useState([]);
  const [viewSearch, setViewSearch] = useState('');

  useEffect(() => {
    dispatch(fetchPharmacies({ limit: 100 }));
    dispatch(fetchActivePlans()).then((res) => {
      if (res.payload?.data) {
        setLocalPlans(res.payload.data);
      }
    });
  }, [dispatch]);

  // Build a price map from dynamic active plans only
  const getPriceForPlan = (planName) => {
    const matched = localPlans.find((p) => p.planName.toLowerCase() === planName.toLowerCase());
    if (matched) return matched.price;
    return 0;
  };

  // Get plan details including duration
  const getPlanDetails = (planName) => {
    const matched = localPlans.find((p) => p.planName.toLowerCase() === planName.toLowerCase());
    if (matched) return { price: matched.price, duration: matched.duration, durationUnit: matched.durationUnit };
    return null;
  };

  const totalRevenue = items.reduce((sum, p) => {
    return sum + getPriceForPlan(p.subscriptionPlan);
  }, 0);

  // Get revenue breakdown from dynamic plans only (no hardcoded legacy plans)
  const getPlanBreakdown = () => {
    const planMap = {};

    // Add all active dynamic plans from database
    localPlans.forEach((plan) => {
      const key = plan.planName.toLowerCase();
      planMap[key] = { name: plan.planName, price: plan.price, duration: plan.duration, durationUnit: plan.durationUnit, count: 0 };
    });

    // Count pharmacies per plan (only match against active dynamic plans)
    items.forEach((p) => {
      const rawPlan = (p.subscriptionPlan || '').toLowerCase();
      // Try matching by planName or by subscriptionPlanId
      const matched = localPlans.find(
        (lp) => lp.planName.toLowerCase() === rawPlan || (p.subscriptionPlanId && lp._id === p.subscriptionPlanId)
      );
      if (matched) {
        const key = matched.planName.toLowerCase();
        if (planMap[key]) {
          planMap[key].count += 1;
        }
      }
    });

    return Object.values(planMap).sort((a, b) => b.price - a.price);
  };

  const planBreakdown = getPlanBreakdown();

  const openViewDrawer = (planName) => {
    const plan = localPlans.find((p) => p.planName.toLowerCase() === planName.toLowerCase());
    const planId = plan?._id;
    // Find all pharmacies using this plan
    const filtered = items.filter((p) => {
      const rawPlan = (p.subscriptionPlan || '').toLowerCase();
      return rawPlan === planName.toLowerCase() || (p.subscriptionPlanId && planId && p.subscriptionPlanId === planId);
    });
    setViewPlanName(planName);
    setViewPharmacies(filtered);
    setViewSearch('');
    setViewDrawerOpen(true);
  };

  const closeViewDrawer = () => {
    setViewDrawerOpen(false);
    setViewPlanName('');
    setViewPharmacies([]);
    setViewSearch('');
  };

  const filteredViewPharmacies = viewPharmacies.filter((p) => {
    if (!viewSearch) return true;
    const s = viewSearch.toLowerCase();
    return (
      p.pharmacyName?.toLowerCase().includes(s) ||
      p.ownerName?.toLowerCase().includes(s) ||
      p.email?.toLowerCase().includes(s) ||
      p.phone?.includes(s)
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Payment Management</h2>
          <p>View payment history and revenue</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon green"><i className="fa-solid fa-indian-rupee-sign"></i></div>
          <div className="stat-info"><h3>₹{totalRevenue.toLocaleString()}</h3><p>Estimated Revenue</p></div>
        </div>
        <div className="stat-card">
        <div className="stat-icon blue"><i className="fa-solid fa-building-columns"></i></div>
          <div className="stat-info"><h3>{items.filter((p) => p.subscriptionPlan !== 'free' && getPriceForPlan(p.subscriptionPlan) > 0).length}</h3><p>Paid Subscriptions</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><i className="fa-solid fa-credit-card"></i></div>
          <div className="stat-info"><h3>{items.length}</h3><p>Total Pharmacies</p></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header"><h5>Revenue by Plan</h5></div>
        <div className="card-body">
          {loading ? (
            <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Plan</th><th>Count</th><th>Price</th><th>Revenue</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {planBreakdown.map(({ name, price, duration, durationUnit, count }) => (
                    <tr key={name}>
                      <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>{name}</td>
                      <td>{count}</td>
                      <td>₹{price.toLocaleString()} ({duration} {durationUnit})</td>
                      <td style={{ fontWeight: 600 }}>₹{(count * price).toLocaleString()}</td>
                      <td>
                        <button className="btn btn-info btn-sm" onClick={() => openViewDrawer(name)} title="View Pharmacies">
                          <i className="fa-solid fa-eye"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header"><h5>Payment History</h5></div>
        <div className="card-body">
          <div className="empty-state" style={{ padding: '40px' }}>
            <i className="fa-solid fa-money-bill-wave" style={{ fontSize: '48px', color: 'var(--gray-400)', marginBottom: '16px' }}></i>
            <h4>Payment Gateway Integration</h4>
            <p>Payment history will be available after integrating a payment gateway.</p>
          </div>
        </div>
      </div>

      {/* View Pharmacies Drawer */}
      <Drawer
        isOpen={viewDrawerOpen}
        onClose={closeViewDrawer}
        title={viewPlanName ? `Pharmacies - ${viewPlanName} Plan` : 'Pharmacies'}
        footer={
          <button type="button" className="btn btn-secondary" onClick={closeViewDrawer}>Close</button>
        }
      >
        <div style={{ marginBottom: '16px' }}>
          <div className="search-bar" style={{ marginBottom: '0' }}>
            <div className="search-input">
              <i className="fa-solid fa-search"></i>
              <input
                type="text"
                placeholder="Search pharmacies..."
                value={viewSearch}
                onChange={(e) => setViewSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {filteredViewPharmacies.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredViewPharmacies.map((pharmacy) => (
              <div
                key={pharmacy._id}
                className="card"
                style={{
                  border: '1px solid var(--gray-200)',
                  margin: 0,
                }}
              >
                <div className="card-body" style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '15px' }}>{pharmacy.pharmacyName}</strong>
                      <p style={{ margin: '2px 0', fontSize: '13px', color: '#666' }}>{pharmacy.ownerName}</p>
                    </div>
                    <span className={`badge ${pharmacy.status === 'active' ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'capitalize', fontSize: '11px' }}>
                      {pharmacy.status}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: '#888' }}>Email:</span>
                      <div>{pharmacy.email}</div>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>Phone:</span>
                      <div>{pharmacy.phone}</div>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>Plan:</span>
                      <div style={{ textTransform: 'capitalize' }}>{pharmacy.subscriptionPlan}</div>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>Start Date:</span>
                      <div>{pharmacy.subscriptionStartDate ? new Date(pharmacy.subscriptionStartDate).toLocaleDateString() : '-'}</div>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>End Date:</span>
                      <div>{pharmacy.subscriptionEndDate ? new Date(pharmacy.subscriptionEndDate).toLocaleDateString() : 'No end date'}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '30px' }}>
            <i className="fa-solid fa-hospital"></i>
            <p>{viewSearch ? 'No pharmacies match your search.' : 'No pharmacies found on this plan.'}</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
