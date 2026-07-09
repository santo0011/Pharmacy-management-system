import { useState, useEffect, useCallback } from 'react';
import AnimatedCounter from '../../components/common/AnimatedCounter';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPharmacies } from '../../redux/slices/pharmacySlice';
import { fetchActivePlans } from '../../redux/slices/subscriptionPlanSlice';
import { pharmacyService } from '../../services/pharmacyService';
import { subscriptionHistoryService } from '../../services/subscriptionHistoryService';
import Drawer from '../../components/common/Drawer';
import { showSuccess, showError } from '../../utils/sweetAlert';

export default function Payments() {
  const dispatch = useDispatch();
  const { items, loading } = useSelector((state) => state.pharmacies);
  const { activePlans } = useSelector((state) => state.subscriptionPlans);
  const [localPlans, setLocalPlans] = useState([]);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewPlanName, setViewPlanName] = useState('');
  const [viewPharmacies, setViewPharmacies] = useState([]);
  const [viewSearch, setViewSearch] = useState('');

  // Renewal drawer state
  const [renewDrawerOpen, setRenewDrawerOpen] = useState(false);
  const [renewPharmacy, setRenewPharmacy] = useState(null);
  const [renewForm, setRenewForm] = useState({
    planId: '',
    startDate: '',
    endDate: '',
    notes: '',
  });
  const [renewSubmitting, setRenewSubmitting] = useState(false);

  // Subscription history state
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historyPharmacy, setHistoryPharmacy] = useState(null);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    dispatch(fetchPharmacies({ limit: 100 }));
    dispatch(fetchActivePlans()).then((res) => {
      if (res.payload?.data) {
        setLocalPlans(res.payload.data);
      }
    });
  }, [dispatch]);

  const getPriceForPlan = (planName) => {
    const matched = localPlans.find((p) => p.planName.toLowerCase() === planName.toLowerCase());
    if (matched) return matched.price;
    return 0;
  };

  const totalRevenue = items.reduce((sum, p) => {
    return sum + getPriceForPlan(p.subscriptionPlan);
  }, 0);

  const getPlanBreakdown = () => {
    const planMap = {};
    localPlans.forEach((plan) => {
      const key = plan.planName.toLowerCase();
      planMap[key] = { name: plan.planName, price: plan.price, duration: plan.duration, durationUnit: plan.durationUnit, count: 0 };
    });
    items.forEach((p) => {
      const rawPlan = (p.subscriptionPlan || '').toLowerCase();
      const matched = localPlans.find(
        (lp) => lp.planName.toLowerCase() === rawPlan || (p.subscriptionPlanId && lp._id === p.subscriptionPlanId)
      );
      if (matched) {
        const key = matched.planName.toLowerCase();
        if (planMap[key]) planMap[key].count += 1;
      }
    });
    return Object.values(planMap).sort((a, b) => b.price - a.price);
  };

  const planBreakdown = getPlanBreakdown();

  const openViewDrawer = (planName) => {
    const plan = localPlans.find((p) => p.planName.toLowerCase() === planName.toLowerCase());
    const planId = plan?._id;
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

  // --- Renewal Logic ---

  const calculateEndDate = (planId, startDate) => {
    const plan = localPlans.find((p) => p._id === planId);
    if (!plan || !startDate) return '';
    const start = new Date(startDate);
    let end = new Date(start);
    if (plan.durationUnit === 'days') {
      end.setDate(end.getDate() + plan.duration);
    } else if (plan.durationUnit === 'months') {
      end.setMonth(end.getMonth() + plan.duration);
    } else if (plan.durationUnit === 'years') {
      end.setFullYear(end.getFullYear() + plan.duration);
    }
    return end.toISOString().split('T')[0];
  };

  const openRenewDrawer = (pharmacy) => {
    // Close view drawer first to avoid stacking
    closeViewDrawer();
    // Small delay to let the close animation complete
    setTimeout(() => {
      const defaultPlanId = pharmacy.subscriptionPlanId || (localPlans.length > 0 ? localPlans[0]._id : '');
      // Calculate proper start date based on current subscription status
      const currentEnd = pharmacy.subscriptionEndDate ? new Date(pharmacy.subscriptionEndDate) : null;
      const now = new Date();
      let effectiveStart;
      if (currentEnd && currentEnd > now) {
        // Current sub still active - new sub starts day after current expiry
        effectiveStart = new Date(currentEnd);
        effectiveStart.setDate(effectiveStart.getDate() + 1);
      } else {
        // Current sub expired - new sub starts today
        effectiveStart = new Date();
      }
      const endDate = calculateEndDate(defaultPlanId, effectiveStart.toISOString().split('T')[0]);
      setRenewPharmacy(pharmacy);
      setRenewForm({
        planId: defaultPlanId,
        startDate: effectiveStart.toISOString().split('T')[0],
        endDate: endDate,
        notes: '',
      });
      setRenewDrawerOpen(true);
    }, 300);
  };

  const closeRenewDrawer = () => {
    setRenewDrawerOpen(false);
    setRenewPharmacy(null);
    setRenewForm({ planId: '', startDate: '', endDate: '', notes: '' });
  };

  const handleRenewFormChange = (field, value) => {
    setRenewForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'planId' || field === 'startDate') {
        updated.endDate = calculateEndDate(
          field === 'planId' ? value : prev.planId,
          field === 'startDate' ? value : prev.startDate
        );
      }
      return updated;
    });
  };

  const handleRenew = async () => {
    if (!renewForm.planId) { showError('Please select a subscription plan'); return; }
    if (!renewForm.startDate) { showError('Please select a start date'); return; }
    setRenewSubmitting(true);
    try {
      const { data } = await pharmacyService.updateSubscription(renewPharmacy._id, {
        subscriptionPlanId: renewForm.planId,
        subscriptionStartDate: renewForm.startDate,
        subscriptionEndDate: renewForm.endDate,
        notes: renewForm.notes,
      });
      showSuccess(data.message || 'Subscription renewed successfully!');
      closeRenewDrawer();
      dispatch(fetchPharmacies({ limit: 100 }));
    } catch (error) {
      showError(error || 'Failed to renew subscription');
    } finally {
      setRenewSubmitting(false);
    }
  };

  const selectedPlan = localPlans.find((p) => p._id === renewForm.planId);
  const totalAmount = selectedPlan?.price || 0;

  // Calculate new start/end dates for preview
  const getNewStartDate = () => {
    if (!renewPharmacy) return '';
    const currentEnd = renewPharmacy.subscriptionEndDate ? new Date(renewPharmacy.subscriptionEndDate) : null;
    const now = new Date();
    if (currentEnd && currentEnd > now) {
      const next = new Date(currentEnd);
      next.setDate(next.getDate() + 1);
      return next.toLocaleDateString();
    }
    return new Date().toLocaleDateString();
  };

  const renewDrawerFooter = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closeRenewDrawer}>Cancel</button>
      <button type="button" className="btn btn-primary" onClick={handleRenew} disabled={renewSubmitting}>
        {renewSubmitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
        {renewSubmitting ? 'Processing...' : 'Confirm & Renew'}
      </button>
    </>
  );

  // --- History Logic ---

  const openHistoryDrawer = (pharmacy) => {
    closeViewDrawer();
    setTimeout(() => {
      setHistoryPharmacy(pharmacy);
      setHistoryDrawerOpen(true);
      setHistoryLoading(true);
      subscriptionHistoryService.getByPharmacy(pharmacy._id, { limit: 50 })
        .then(({ data }) => setHistoryRecords(data.data || []))
        .catch(() => setHistoryRecords([]))
        .finally(() => setHistoryLoading(false));
    }, 300);
  };

  const closeHistoryDrawer = () => {
    setHistoryDrawerOpen(false);
    setHistoryPharmacy(null);
    setHistoryRecords([]);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active': return 'badge-success';
      case 'upcoming': return 'badge-info';
      case 'expired': return 'badge-danger';
      default: return 'badge-secondary';
    }
  };

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
          <div className="stat-info"><h3>₹<AnimatedCounter value={totalRevenue} /></h3><p>Estimated Revenue</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><i className="fa-solid fa-building-columns"></i></div>
          <div className="stat-info"><h3><AnimatedCounter value={items.filter((p) => p.subscriptionPlan !== 'free' && getPriceForPlan(p.subscriptionPlan) > 0).length} /></h3><p>Paid Subscriptions</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><i className="fa-solid fa-credit-card"></i></div>
          <div className="stat-info"><h3><AnimatedCounter value={items.length} /></h3><p>Total Pharmacies</p></div>
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
              <div key={pharmacy._id} className="card" style={{ border: '1px solid var(--gray-200)', margin: 0 }}>
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
                    <div><span style={{ color: '#888' }}>Plan:</span><div style={{ textTransform: 'capitalize' }}>{pharmacy.subscriptionPlan}</div></div>
                    <div><span style={{ color: '#888' }}>End Date:</span><div>{pharmacy.subscriptionEndDate ? new Date(pharmacy.subscriptionEndDate).toLocaleDateString() : 'No end date'}</div></div>
                  </div>
                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-info btn-sm" onClick={() => openHistoryDrawer(pharmacy)} title="View History">
                      <i className="fa-solid fa-clock-rotate-left"></i> History
                    </button>
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

      {/* Renew Subscription Drawer (standalone - view drawer is closed first) */}
      <Drawer
        isOpen={renewDrawerOpen}
        onClose={closeRenewDrawer}
        title={renewPharmacy ? `Renew Subscription - ${renewPharmacy.pharmacyName}` : 'Renew Subscription'}
        footer={renewDrawerFooter}
      >
        {renewPharmacy && (
          <div className="renew-drawer-content">
            {/* Current Plan Info */}
            <div className="card renew-current-plan-card">
              <div className="card-body" style={{ padding: '14px' }}>
                <h5 style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <i className="fa-solid fa-info-circle"></i> Current Subscription
                </h5>
                <div className="renew-info-grid">
                  <div className="renew-info-item">
                    <span className="renew-info-label">Plan</span>
                    <span className="renew-info-value" style={{ textTransform: 'capitalize' }}>{renewPharmacy.subscriptionPlan || 'Free'}</span>
                  </div>
                  <div className="renew-info-item">
                    <span className="renew-info-label">Expiry Date</span>
                    <span className="renew-info-value" style={{ color: renewPharmacy.subscriptionEndDate && new Date(renewPharmacy.subscriptionEndDate) < new Date() ? 'var(--danger)' : 'var(--success)' }}>
                      {renewPharmacy.subscriptionEndDate ? new Date(renewPharmacy.subscriptionEndDate).toLocaleDateString() : 'No end date'}
                      {renewPharmacy.subscriptionEndDate && new Date(renewPharmacy.subscriptionEndDate) < new Date() ? ' (Expired)' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Renewal Form */}
            <div style={{ marginTop: '16px' }}>
              <h5 style={{ fontSize: '14px', color: 'var(--primary)', marginBottom: '14px', fontWeight: 600 }}>
                <i className="fa-solid fa-rotate"></i> New Subscription Details
              </h5>

              <div className="form-group">
                <label>Select Plan *</label>
                <select value={renewForm.planId} onChange={(e) => handleRenewFormChange('planId', e.target.value)} required>
                  <option value="">-- Select Plan --</option>
                  {localPlans.map((plan) => (
                    <option key={plan._id} value={plan._id}>
                      {plan.planName} - ₹{plan.price.toLocaleString()} ({plan.duration} {plan.durationUnit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Start Date</label>
                <input type="date" value={renewForm.startDate} onChange={(e) => handleRenewFormChange('startDate', e.target.value)} />
                <small style={{ color: 'var(--gray-500)', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                  {renewPharmacy.subscriptionEndDate && new Date(renewPharmacy.subscriptionEndDate) > new Date()
                    ? `Current subscription is active until ${new Date(renewPharmacy.subscriptionEndDate).toLocaleDateString()}. New subscription will start after that.`
                    : 'Current subscription has expired. New subscription starts from the selected date.'}
                </small>
              </div>

              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea value={renewForm.notes} onChange={(e) => handleRenewFormChange('notes', e.target.value)} placeholder="Add any notes..." rows={2} />
              </div>

              {/* Renewal Preview */}
              {selectedPlan && (
                <div className="renew-preview-card">
                  <h5 style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <i className="fa-solid fa-file-invoice"></i> Renewal Preview
                  </h5>
                  <div className="renew-preview-grid">
                    <div className="renew-preview-item">
                      <span className="renew-preview-label">Current Expiry</span>
                      <span className="renew-preview-value">
                        {renewPharmacy.subscriptionEndDate ? new Date(renewPharmacy.subscriptionEndDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="renew-preview-item">
                      <span className="renew-preview-label">New Start Date</span>
                      <span className="renew-preview-value" style={{ color: 'var(--success)', fontWeight: 700 }}>
                        {getNewStartDate()}
                      </span>
                    </div>
                    <div className="renew-preview-item">
                      <span className="renew-preview-label">New Expiry Date</span>
                      <span className="renew-preview-value" style={{ fontWeight: 700 }}>
                        {renewForm.endDate ? new Date(renewForm.endDate).toLocaleDateString() : '-'}
                      </span>
                    </div>
                    <div className="renew-preview-item">
                      <span className="renew-preview-label">Selected Plan</span>
                      <span className="renew-preview-value" style={{ textTransform: 'capitalize' }}>{selectedPlan.planName}</span>
                    </div>
                  </div>
                  <div className="renew-preview-divider"></div>
                  <div className="renew-preview-total">
                    <span>Total Amount</span>
                    <span>₹{totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Subscription History Drawer (standalone) */}
      <Drawer
        isOpen={historyDrawerOpen}
        onClose={closeHistoryDrawer}
        title={historyPharmacy ? `Subscription History - ${historyPharmacy.pharmacyName}` : 'Subscription History'}
        footer={<button type="button" className="btn btn-secondary" onClick={closeHistoryDrawer}>Close</button>}
      >
        {historyLoading ? (
          <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
        ) : historyRecords.length > 0 ? (
          <div className="renew-drawer-content">
            {/* Current active subscription summary */}
            <div className="card renew-current-plan-card" style={{ marginBottom: '16px' }}>
              <div className="card-body" style={{ padding: '14px' }}>
                <h5 style={{ fontSize: '14px', color: 'var(--primary)', marginBottom: '10px', fontWeight: 600 }}>
                  <i className="fa-solid fa-circle-check"></i> Current Status
                </h5>
                {(() => {
                  const active = historyRecords.find(r => r.status === 'active');
                  const upcoming = historyRecords.find(r => r.status === 'upcoming');
                  if (active) {
                    return (
                      <div className="renew-info-grid">
                        <div className="renew-info-item">
                          <span className="renew-info-label">Plan</span>
                          <span className="renew-info-value" style={{ textTransform: 'capitalize' }}>{active.planName}</span>
                        </div>
                        <div className="renew-info-item">
                          <span className="renew-info-label">Start</span>
                          <span className="renew-info-value">{new Date(active.startDate).toLocaleDateString()}</span>
                        </div>
                        <div className="renew-info-item">
                          <span className="renew-info-label">Expiry</span>
                          <span className="renew-info-value" style={{ color: new Date(active.endDate) < new Date() ? 'var(--danger)' : 'var(--success)' }}>
                            {new Date(active.endDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="renew-info-item">
                          <span className="renew-info-label">Amount</span>
                          <span className="renew-info-value">₹{active.amount.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  } else if (upcoming) {
                    return <p style={{ fontSize: '13px', color: 'var(--gray-500)' }}>Upcoming subscription starts on {new Date(upcoming.startDate).toLocaleDateString()}</p>;
                  }
                  return <p style={{ fontSize: '13px', color: 'var(--gray-500)' }}>No active subscription found.</p>;
                })()}
              </div>
            </div>

            {/* All history records */}
            <h5 style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <i className="fa-solid fa-clock-rotate-left"></i> All Records ({historyRecords.length})
            </h5>
            <div className="history-table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Renewed</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRecords.map((record) => (
                    <tr key={record._id}>
                      <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>{record.planName}</td>
                      <td style={{ fontSize: '12px' }}>{new Date(record.startDate).toLocaleDateString()}</td>
                      <td style={{ fontSize: '12px' }}>{new Date(record.endDate).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600 }}>₹{record.amount.toLocaleString()}</td>
                      <td>
                        <span className={`badge ${getStatusBadge(record.status)}`} style={{ textTransform: 'capitalize', fontSize: '11px' }}>
                          {record.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px' }}>{new Date(record.renewalDate).toLocaleDateString()}</td>
                      <td style={{ fontSize: '12px' }}>{record.createdByName || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '30px' }}>
            <i className="fa-solid fa-clock-rotate-left"></i>
            <h4>No History Found</h4>
            <p>No subscription history records available for this pharmacy.</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}