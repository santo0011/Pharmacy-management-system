import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPharmacies } from '../../redux/slices/pharmacySlice';
import { fetchActivePlans } from '../../redux/slices/subscriptionPlanSlice';

export default function Payments() {
  const dispatch = useDispatch();
  const { items, loading } = useSelector((state) => state.pharmacies);
  const { activePlans } = useSelector((state) => state.subscriptionPlans);
  const [localPlans, setLocalPlans] = useState([]);

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

  const totalRevenue = items.reduce((sum, p) => {
    return sum + getPriceForPlan(p.subscriptionPlan);
  }, 0);

  // Get revenue breakdown from dynamic plans only (no hardcoded legacy plans)
  const getPlanBreakdown = () => {
    const planMap = {};

    // Add all active dynamic plans from database
    localPlans.forEach((plan) => {
      const key = plan.planName.toLowerCase();
      planMap[key] = { name: plan.planName, price: plan.price, count: 0 };
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
          <div className="stat-info"><h3>₹{totalRevenue.toLocaleString()}/mo</h3><p>Estimated Monthly Revenue</p></div>
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
                  <tr><th>Plan</th><th>Count</th><th>Price/Month</th><th>Revenue</th></tr>
                </thead>
                <tbody>
                  {planBreakdown.map(({ name, price, count }) => (
                    <tr key={name}>
                      <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>{name}</td>
                      <td>{count}</td>
                      <td>₹{price.toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>₹{(count * price).toLocaleString()}/mo</td>
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
    </div>
  );
}