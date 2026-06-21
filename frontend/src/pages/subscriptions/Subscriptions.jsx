import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPharmacies } from '../../redux/slices/pharmacySlice';
import {
  fetchPlans,
  fetchActivePlans,
  createPlan,
  updatePlan,
  togglePlanStatus,
  deletePlan,
} from '../../redux/slices/subscriptionPlanSlice';
import { showSuccess, showError, confirmDelete, showConfirm } from '../../utils/sweetAlert';
import { pharmacyService } from '../../services/pharmacyService';
import Drawer from '../../components/common/Drawer';

const initialPlanFormState = {
  planName: '',
  price: '',
  duration: '',
  durationUnit: 'months',
  description: '',
  features: '',
  maxStaff: '',
  maxBranches: '',
};

export default function Subscriptions() {
  const dispatch = useDispatch();
  const { items: pharmacies, total: pharmacyTotal, loading: pharmacyLoading } = useSelector((state) => state.pharmacies);
  const { items: plans, total: planTotal, loading: planLoading } = useSelector((state) => state.subscriptionPlans);

  const activePlans = useSelector((state) => state.subscriptionPlans.activePlans);

  const [activeTab, setActiveTab] = useState('plans');

  // ------ Plans State ------
  const [planSearch, setPlanSearch] = useState('');
  const [planPage, setPlanPage] = useState(1);
  const [planDrawerOpen, setPlanDrawerOpen] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [planFormData, setPlanFormData] = useState(initialPlanFormState);
  const [planSubmitting, setPlanSubmitting] = useState(false);

  // ------ Subscriptions State ------
  const [subSearch, setSubSearch] = useState('');
  const [subPage, setSubPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ subscriptionPlanId: '', subscriptionPlan: '', subscriptionEndDate: '' });
  const [calculatedEndDate, setCalculatedEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load active plans for dropdown
  useEffect(() => {
    dispatch(fetchActivePlans());
  }, [dispatch]);

  // ------ Plans handlers ------
  const loadPlans = useCallback(() => {
    const params = { page: planPage, limit: 10 };
    if (planSearch) params.search = planSearch;
    dispatch(fetchPlans(params));
  }, [dispatch, planPage, planSearch]);

  useEffect(() => {
    if (activeTab === 'plans') loadPlans();
  }, [loadPlans, activeTab]);

  useEffect(() => {
    setPlanPage(1);
  }, [planSearch]);

  const openCreatePlanDrawer = () => {
    setEditPlan(null);
    setPlanFormData(initialPlanFormState);
    setPlanDrawerOpen(true);
  };

  const openEditPlanDrawer = (plan) => {
    setEditPlan(plan);
    setPlanFormData({
      planName: plan.planName || '',
      price: plan.price !== undefined && plan.price !== null ? String(plan.price) : '',
      duration: plan.duration !== undefined && plan.duration !== null ? String(plan.duration) : '',
      durationUnit: plan.durationUnit || 'months',
      description: plan.description || '',
      features: plan.features?.join('\n') || '',
      maxStaff: plan.maxStaff !== undefined && plan.maxStaff !== null ? String(plan.maxStaff) : '',
      maxBranches: plan.maxBranches !== undefined && plan.maxBranches !== null ? String(plan.maxBranches) : '',
    });
    setPlanDrawerOpen(true);
  };

  const closePlanDrawer = () => {
    setPlanDrawerOpen(false);
    setEditPlan(null);
    setPlanFormData(initialPlanFormState);
  };

  const handlePlanChange = (e) => {
    setPlanFormData({ ...planFormData, [e.target.name]: e.target.value });
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    if (!planFormData.planName.trim() || !planFormData.price || !planFormData.duration) {
      showError('Plan name, price, and duration are required');
      return;
    }
    setPlanSubmitting(true);
    try {
      const planData = {
        planName: planFormData.planName.trim(),
        price: Number(planFormData.price),
        duration: Number(planFormData.duration),
        durationUnit: planFormData.durationUnit,
        description: planFormData.description.trim(),
        features: planFormData.features ? planFormData.features.split('\n').filter((f) => f.trim()).map((f) => f.trim()) : [],
        maxStaff: planFormData.maxStaff ? Number(planFormData.maxStaff) : null,
        maxBranches: planFormData.maxBranches ? Number(planFormData.maxBranches) : null,
      };

      if (editPlan) {
        await dispatch(updatePlan({ id: editPlan._id, ...planData })).unwrap();
        // Refresh active plans after update
        dispatch(fetchActivePlans());
        showSuccess('Plan updated successfully');
      } else {
        await dispatch(createPlan(planData)).unwrap();
        // Refresh active plans after create
        dispatch(fetchActivePlans());
        showSuccess('Plan created successfully');
      }
      closePlanDrawer();
      loadPlans();
    } catch (error) {
      showError(error || 'Operation failed');
    } finally {
      setPlanSubmitting(false);
    }
  };

  const handleTogglePlanStatus = async (id, planName, isActive) => {
    const action = isActive ? 'deactivate' : 'activate';
    const confirmed = await showConfirm(
      `${action === 'deactivate' ? 'Deactivate' : 'Activate'} Plan`,
      `Are you sure you want to ${action} "${planName}"? ${action === 'deactivate' ? 'This plan will no longer be available for new subscriptions.' : 'This plan will become available for new subscriptions.'}`,
      'question'
    );
    if (!confirmed) return;

    try {
      await dispatch(togglePlanStatus(id)).unwrap();
      // The Redux slice reducer handles updating both items and activePlans instantly
      showSuccess(`Plan ${action}d successfully`);
    } catch (error) {
      showError(error || 'Failed to toggle status');
    }
  };

  const handleDeletePlan = async (id) => {
    const confirmed = await confirmDelete('this subscription plan');
    if (!confirmed) return;
    try {
      await dispatch(deletePlan(id)).unwrap();
      dispatch(fetchActivePlans());
      showSuccess('Plan deleted successfully');
    } catch (error) {
      showError(error || 'Delete failed');
    }
  };

  // ------ Subscription handlers (fixed edit modal) ------
  const loadPharmacies = useCallback(() => {
    const params = { page: subPage, limit: 10 };
    if (subSearch) params.search = subSearch;
    dispatch(fetchPharmacies(params));
  }, [dispatch, subPage, subSearch]);

  useEffect(() => {
    if (activeTab === 'subscriptions') loadPharmacies();
  }, [loadPharmacies, activeTab]);

  useEffect(() => {
    setSubPage(1);
  }, [subSearch]);

  // Helper to calculate end date based on plan duration
  const calculateEndDate = (planId, startDate) => {
    if (!planId || !startDate) return '';
    const plan = activePlans.find((p) => p._id === planId);
    if (!plan || !plan.duration) return '';
    const start = new Date(startDate);
    let end = new Date(start);
    switch (plan.durationUnit) {
      case 'days':
        end.setDate(end.getDate() + plan.duration);
        break;
      case 'months':
        end.setMonth(end.getMonth() + plan.duration);
        break;
      case 'years':
        end.setFullYear(end.getFullYear() + plan.duration);
        break;
      default:
        end.setMonth(end.getMonth() + plan.duration);
    }
    return end.toISOString().split('T')[0];
  };

  // Helper to check if a value looks like a MongoDB ObjectId
  const isObjectId = (val) => /^[0-9a-fA-F]{24}$/.test(val);

  // Helper to get the display-friendly plan name
  const getPlanDisplayName = (planName) => {
    if (!planName) return 'N/A';
    // If it's an ObjectId, try to find the name from active plans
    if (isObjectId(planName)) {
      const plan = activePlans.find((p) => p._id === planName);
      return plan ? plan.planName : 'Unknown Plan';
    }
    return planName;
  };

  const openEdit = (pharmacy) => {
    // Determine if subscriptionPlan is an ObjectId or a name string
    const rawPlan = pharmacy.subscriptionPlan || 'free';
    let planId = pharmacy.subscriptionPlanId || '';
    let planName = rawPlan;

    if (isObjectId(rawPlan) && !planId) {
      planId = rawPlan;
      const matched = activePlans.find((p) => p._id === rawPlan);
      planName = matched ? matched.planName : 'free';
    }

    setFormData({
      subscriptionPlanId: planId,
      subscriptionPlan: planName,
      subscriptionEndDate: pharmacy.subscriptionEndDate ? pharmacy.subscriptionEndDate.split('T')[0] : '',
    });
    setEditing(pharmacy);
  };

  const closeEdit = () => {
    setEditing(null);
    setFormData({ subscriptionPlanId: '', subscriptionPlan: '', subscriptionEndDate: '' });
    setCalculatedEndDate('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setSubmitting(true);
    try {
      const updateData = {};
      if (formData.subscriptionPlanId) {
        updateData.subscriptionPlanId = formData.subscriptionPlanId;
      } else if (formData.subscriptionPlan) {
        updateData.subscriptionPlan = formData.subscriptionPlan;
      }
      if (formData.subscriptionEndDate) {
        updateData.subscriptionEndDate = formData.subscriptionEndDate;
      }

      await pharmacyService.updateSubscription(editing._id, updateData);
      showSuccess('Subscription updated successfully');
      // Reset and close
      closeEdit();
      loadPharmacies();
      // Refresh active plans for next time
      dispatch(fetchActivePlans());
    } catch (error) {
      showError(error.response?.data?.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const getPlanBadge = (plan) => {
    const colors = { free: 'badge-secondary', basic: 'badge-info', premium: 'badge-success', enterprise: 'badge-warning' };
    return colors[plan] || 'badge-secondary';
  };

  // ------ Plan Drawer Footer ------
  const planDrawerFooter = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closePlanDrawer}>Cancel</button>
      <button type="submit" form="planForm" className="btn btn-primary" disabled={planSubmitting}>
        {planSubmitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
        {editPlan ? 'Update Plan' : 'Create Plan'}
      </button>
    </>
  );

  // ------ Subscription Drawer Footer ------
  const subscriptionDrawerFooter = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closeEdit}>Cancel</button>
      <button type="submit" form="subscriptionForm" className="btn btn-primary" disabled={submitting}>
        {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null} Update
      </button>
    </>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Subscription Management</h2>
          <p>Manage subscription plans and pharmacy subscriptions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '2px solid var(--gray-200)' }}>
        <button
          className={`tab-btn ${activeTab === 'plans' ? 'active' : ''}`}
          onClick={() => setActiveTab('plans')}
          style={{
            padding: '10px 24px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'plans' ? '600' : '400',
            color: activeTab === 'plans' ? 'var(--primary-color)' : 'var(--gray-500)',
            borderBottom: activeTab === 'plans' ? '2px solid var(--primary-color)' : '2px solid transparent',
            marginBottom: '-2px',
            fontSize: '15px',
          }}
        >
          <i className="fa-solid fa-layer-group"></i> Plans
        </button>
        <button
          className={`tab-btn ${activeTab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscriptions')}
          style={{
            padding: '10px 24px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'subscriptions' ? '600' : '400',
            color: activeTab === 'subscriptions' ? 'var(--primary-color)' : 'var(--gray-500)',
            borderBottom: activeTab === 'subscriptions' ? '2px solid var(--primary-color)' : '2px solid transparent',
            marginBottom: '-2px',
            fontSize: '15px',
          }}
        >
          <i className="fa-solid fa-credit-card"></i> Subscriptions
        </button>
      </div>

      {/* ============ TAB 1: Plans Management ============ */}
      {activeTab === 'plans' && (
        <div>
          <div className="card">
            <div className="card-header">
              <h5>Subscription Plans</h5>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>Total: {planTotal}</span>
                <button className="btn btn-primary btn-sm" onClick={openCreatePlanDrawer}>
                  <i className="fa-solid fa-plus"></i> Add Plan
                </button>
              </div>
            </div>
            <div className="card-body">
              <div className="search-bar">
                <div className="search-input">
                  <i className="fa-solid fa-search"></i>
                  <input type="text" placeholder="Search plans..." value={planSearch} onChange={(e) => setPlanSearch(e.target.value)} />
                </div>
              </div>

              {planLoading ? (
                <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
              ) : plans?.length > 0 ? (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Plan Name</th>
                        <th>Price</th>
                        <th>Duration</th>
                        <th>Max Staff</th>
                        <th>Max Branches</th>
                        <th>Features</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((plan) => (
                        <tr key={plan._id}>
                          <td style={{ fontWeight: 500 }}>{plan.planName}</td>
                          <td>₹{plan.price?.toFixed(2)}</td>
                          <td>{plan.duration} {plan.durationUnit}</td>
                          <td>{plan.maxStaff ?? 'Unlimited'}</td>
                          <td>{plan.maxBranches ?? 'Unlimited'}</td>
                          <td>
                            {plan.features?.length > 0 ? (
                              <span style={{ cursor: 'pointer', color: 'var(--primary-color)' }} title={plan.features.join(', ')}>
                                {plan.features.length} feature{plan.features.length > 1 ? 's' : ''}
                              </span>
                            ) : '-'}
                          </td>
                          <td>
                            <span className={`badge ${plan.isActive ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'capitalize' }}>
                              {plan.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button className="btn btn-warning btn-sm" onClick={() => openEditPlanDrawer(plan)} title="Edit">
                                <i className="fa-solid fa-edit"></i>
                              </button>
                              <button
                                className={`btn btn-sm ${plan.isActive ? 'btn-secondary' : 'btn-success'}`}
                                onClick={() => handleTogglePlanStatus(plan._id, plan.planName, plan.isActive)}
                                title={plan.isActive ? 'Deactivate' : 'Activate'}
                              >
                                <i className={`fa-solid ${plan.isActive ? 'fa-pause' : 'fa-play'}`}></i>
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeletePlan(plan._id)} title="Delete">
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <i className="fa-solid fa-layer-group"></i>
                  <h4>No Plans Found</h4>
                  <p>Create your first subscription plan.</p>
                  <button className="btn btn-primary" onClick={openCreatePlanDrawer}>
                    <i className="fa-solid fa-plus"></i> Add Plan
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Plan Drawer - using reusable Drawer component */}
          <Drawer
            isOpen={planDrawerOpen}
            onClose={closePlanDrawer}
            title={editPlan ? 'Edit Subscription Plan' : 'Add Subscription Plan'}
            footer={planDrawerFooter}
          >
            <form id="planForm" onSubmit={handlePlanSubmit}>
              <div className="form-group">
                <label>Plan Name *</label>
                <input type="text" name="planName" value={planFormData.planName} onChange={handlePlanChange} placeholder="e.g. Gold, Silver" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Price (₹) *</label>
                  <input type="number" name="price" value={planFormData.price} onChange={handlePlanChange} placeholder="0.00" min="0" step="0.01" required />
                </div>
                <div className="form-group">
                  <label>Duration *</label>
                  <input type="number" name="duration" value={planFormData.duration} onChange={handlePlanChange} placeholder="e.g. 30" min="1" required />
                </div>
              </div>
              <div className="form-group">
                <label>Duration Unit</label>
                <select name="durationUnit" value={planFormData.durationUnit} onChange={handlePlanChange}>
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea name="description" value={planFormData.description} onChange={handlePlanChange} placeholder="Brief description of the plan" rows="2" />
              </div>
              <div className="form-group">
                <label>Features (one per line)</label>
                <textarea name="features" value={planFormData.features} onChange={handlePlanChange} placeholder="Enter features, one per line&#10;e.g. Unlimited medicines&#10;Basic reporting" rows="4" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Max Staff (leave empty for unlimited)</label>
                  <input type="number" name="maxStaff" value={planFormData.maxStaff} onChange={handlePlanChange} placeholder="Unlimited" min="1" />
                </div>
                <div className="form-group">
                  <label>Max Branches (leave empty for unlimited)</label>
                  <input type="number" name="maxBranches" value={planFormData.maxBranches} onChange={handlePlanChange} placeholder="Unlimited" min="1" />
                </div>
              </div>
            </form>
          </Drawer>
        </div>
      )}

      {/* ============ TAB 2: All Subscriptions (Fixed Edit Modal) ============ */}
      {activeTab === 'subscriptions' && (
        <div>
          <div className="card">
            <div className="card-header">
              <h5>All Subscriptions</h5>
              <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>Total: {pharmacyTotal}</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ padding: '16px 16px 0' }}>
                <div className="search-bar" style={{ marginBottom: '0' }}>
                  <div className="search-input">
                    <i className="fa-solid fa-search"></i>
                    <input type="text" placeholder="Search pharmacies..." value={subSearch} onChange={(e) => setSubSearch(e.target.value)} />
                  </div>
                </div>
              </div>
              {pharmacyLoading ? (
                <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
              ) : pharmacies?.length > 0 ? (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr><th>Pharmacy</th><th>Plan</th><th>Start Date</th><th>End Date</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {pharmacies.map((p) => (
                        <tr key={p._id}>
                          <td style={{ fontWeight: 500 }}>{p.pharmacyName}</td>
                          <td><span className={`badge ${getPlanBadge(p.subscriptionPlan)}`} style={{ textTransform: 'capitalize' }}>{getPlanDisplayName(p.subscriptionPlan)}</span></td>
                          <td>{p.subscriptionStartDate ? new Date(p.subscriptionStartDate).toLocaleDateString() : '-'}</td>
                          <td>{p.subscriptionEndDate ? new Date(p.subscriptionEndDate).toLocaleDateString() : 'No end date'}</td>
                          <td><span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'capitalize' }}>{p.status}</span></td>
                          <td><button className="btn btn-warning btn-sm" onClick={() => openEdit(p)}><i className="fa-solid fa-edit"></i></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="empty-state" style={{ padding: '30px' }}><p>No pharmacies found</p></div>}
            </div>
          </div>

          {/* Edit Subscription Drawer */}
          <Drawer
            isOpen={!!editing}
            onClose={closeEdit}
            title={editing ? `Edit Subscription - ${editing.pharmacyName}` : 'Edit Subscription'}
            footer={subscriptionDrawerFooter}
          >
            {editing && (
              <form id="subscriptionForm" onSubmit={handleUpdate}>
                <div className="form-group">
                  <label>Subscription Plan</label>
                  <select
                    value={formData.subscriptionPlanId || formData.subscriptionPlan}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Check if selected value matches an active plan ID
                      const selectedPlan = activePlans.find((p) => p._id === val);
                      if (selectedPlan) {
                        // Auto-calculate end date based on plan duration
                        const startDate = editing?.subscriptionStartDate ? new Date(editing.subscriptionStartDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                        const endDate = calculateEndDate(val, startDate);
                        setFormData({ ...formData, subscriptionPlanId: val, subscriptionPlan: selectedPlan.planName, subscriptionEndDate: endDate });
                        setCalculatedEndDate(endDate);
                      } else {
                        setFormData({ ...formData, subscriptionPlanId: '', subscriptionPlan: val, subscriptionEndDate: '' });
                        setCalculatedEndDate('');
                      }
                    }}
                    required
                  >
                    <option value="">-- Select Plan --</option>
                    {/* Dynamic plans from database only - no hardcoded options */}
                    {activePlans.map((plan) => (
                      <option key={plan._id} value={plan._id}>
                        {plan.planName} (₹{plan.price} / {plan.duration} {plan.durationUnit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>End Date (auto-calculated)</label>
                  <input
                    type="date"
                    value={formData.subscriptionEndDate}
                    readOnly
                    className="form-control"
                    style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                  />
                  <small style={{ color: '#888', fontSize: '12px' }}>
                    End date is calculated automatically based on the selected plan's duration.
                  </small>
                </div>
              </form>
            )}
          </Drawer>
        </div>
      )}
    </div>
  );
}