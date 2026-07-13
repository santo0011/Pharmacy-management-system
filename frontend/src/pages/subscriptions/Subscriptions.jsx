import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../../hooks/useAuth';
import { fetchPharmacies } from '../../redux/slices/pharmacySlice';
import {
  fetchPlans,
  fetchActivePlans,
  createPlan,
  updatePlan,
  togglePlanStatus,
  deletePlan,
} from '../../redux/slices/subscriptionPlanSlice';
import { fetchSubscriptionStatus, clearSubscriptionStatus } from '../../redux/slices/dashboardSlice';
import { showSuccess, showError, confirmDelete, showConfirm } from '../../utils/sweetAlert';
import { pharmacyService } from '../../services/pharmacyService';
import { subscriptionHistoryService } from '../../services/subscriptionHistoryService';
import Drawer from '../../components/common/Drawer';
import Swal from 'sweetalert2';

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

// Status badge configuration
const STATUS_CONFIG = {
  active: { class: 'badge-success', icon: 'fa-check-circle', label: 'Active' },
  upcoming: { class: 'badge-info', icon: 'fa-clock', label: 'Upcoming' },
  expired: { class: 'badge-danger', icon: 'fa-times-circle', label: 'Expired' },
  cancelled: { class: 'badge-secondary', icon: 'fa-ban', label: 'Cancelled' },
};

// Action badge configuration
const ACTION_CONFIG = {
  created: { class: 'badge-success', icon: 'fa-plus-circle', label: 'Created' },
  extended: { class: 'badge-info', icon: 'fa-arrow-right', label: 'Extended' },
  cancelled: { class: 'badge-danger', icon: 'fa-ban', label: 'Cancelled' },
  reactivated: { class: 'badge-warning', icon: 'fa-rotate', label: 'Reactivated' },
  expired: { class: 'badge-secondary', icon: 'fa-clock', label: 'Expired' },
  renewed: { class: 'badge-primary', icon: 'fa-refresh', label: 'Renewed' },
};

export default function Subscriptions() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const { items: pharmacies, total: pharmacyTotal, loading: pharmacyLoading } = useSelector((state) => state.pharmacies);
  const { items: plans, total: planTotal, loading: planLoading } = useSelector((state) => state.subscriptionPlans);
  const activePlans = useSelector((state) => state.subscriptionPlans.activePlans);
  const { subscriptionStatus } = useSelector((state) => state.dashboard);

  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'plans' : 'my-subscription');

  // ------ My Subscription (Admin view) ------
  const [myHistory, setMyHistory] = useState([]);
  const [myHistoryLoading, setMyHistoryLoading] = useState(false);

  const fetchMyHistory = useCallback(async () => {
    if (isSuperAdmin) return;
    setMyHistoryLoading(true);
    try {
      const { data } = await subscriptionHistoryService.getMyHistory({ limit: 50 });
      setMyHistory(data.data || []);
    } catch (err) {
      setMyHistory([]);
    } finally {
      setMyHistoryLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (activeTab === 'my-subscription' && !isSuperAdmin) {
      fetchMyHistory();
    }
  }, [activeTab, isSuperAdmin, fetchMyHistory]);

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status];
    if (!config) return 'badge-secondary';
    return config.class;
  };

  const getStatusIcon = (status) => {
    const config = STATUS_CONFIG[status];
    return config ? config.icon : 'fa-circle';
  };

  const getStatusLabel = (status) => {
    const config = STATUS_CONFIG[status];
    return config ? config.label : status;
  };

  const getActionBadge = (action) => {
    const config = ACTION_CONFIG[action];
    if (!config) return 'badge-secondary';
    return config.class;
  };

  const getActionIcon = (action) => {
    const config = ACTION_CONFIG[action];
    return config ? config.icon : 'fa-circle';
  };

  const getActionLabel = (action) => {
    const config = ACTION_CONFIG[action];
    return config ? config.label : action;
  };

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

  // Renew drawer state for subscriptions tab
  const [renewDrawerOpen, setRenewDrawerOpen] = useState(false);
  const [renewPharmacy, setRenewPharmacy] = useState(null);
  const [renewForm, setRenewForm] = useState({ planId: '', startDate: '', endDate: '', notes: '' });
  const [renewSubmitting, setRenewSubmitting] = useState(false);

  // History drawer for subscriptions tab
  const [subHistoryDrawerOpen, setSubHistoryDrawerOpen] = useState(false);
  const [subHistoryPharmacy, setSubHistoryPharmacy] = useState(null);
  const [subHistoryRecords, setSubHistoryRecords] = useState([]);
  const [subHistoryLoading, setSubHistoryLoading] = useState(false);

  // Expandable rows for mobile tables
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRow = (tableKey, rowIdx) => {
    const key = `${tableKey}-${rowIdx}`;
    setExpandedRows(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // ------ Expandable Row Renderers ------
  const renderExpandableRow = (item, idx, tableKey, isExpanded, onToggle, mainCols, detailRows) => {
    return (
      <tbody key={idx}>
        <tr className="customer-mobile-row" onClick={onToggle}>
          {mainCols.map((col, ci) => (
            <td key={ci} className={col.className || ''} style={col.style || {}}>
              {col.render(item)}
            </td>
          ))}
          <td className="customer-expand-cell">
            <button className="customer-expand-btn">
              <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
            </button>
          </td>
        </tr>
        <tr className={`customer-detail-row ${isExpanded ? 'customer-detail-row-open' : ''}`}>
          <td colSpan={mainCols.length + 1} className="customer-detail-cell">
            <div className="customer-detail-inner">
              {detailRows.map((detail, di) => (
                <div key={di} className="customer-detail-item">
                  <span className="customer-detail-label">{detail.label}</span>
                  <span className="customer-detail-value" style={detail.style || {}}>
                    {detail.render(item)}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      </tbody>
    );
  };

  // ------ Cancel Subscription (Super Admin) ------
  const handleCancelSubscription = async (recordId) => {
    const { value: reason } = await Swal.fire({
      title: 'Cancel Subscription',
      text: 'Please provide a reason for cancellation:',
      input: 'textarea',
      inputPlaceholder: 'Enter cancellation reason...',
      inputAttributes: {
        'aria-label': 'Cancellation reason',
      },
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, cancel it!',
      cancelButtonText: 'Go Back',
      background: '#1f2937',
      color: '#fff',
      iconColor: '#f59e0b',
      reverseButtons: true,
      inputValidator: (value) => {
        if (!value) {
          return 'Please provide a reason for cancellation';
        }
      },
    });

    if (!reason) return;

    try {
      const { data } = await subscriptionHistoryService.cancelSubscription(recordId, { cancellationReason: reason });
      showSuccess(data.message || 'Subscription cancelled successfully');
      // Refresh the drawer list
      if (subHistoryDrawerOpen) {
        setSubHistoryRecords(prev => prev.map(r => 
          r._id === recordId 
            ? { ...r, status: 'cancelled', action: 'cancelled', cancelledDate: new Date(), cancellationReason: reason }
            : r
        ));
      }
      // Reload the pharmacy list to reflect updated subscription end date
      loadPharmacies();
      // Also refresh the admin's subscription status if they are viewing their own subscription
      if (!isSuperAdmin) {
        dispatch(fetchSubscriptionStatus());
      }
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to cancel subscription');
    }
  };

  // ------ Reactivate Subscription ------
  const handleReactivateSubscription = async (recordId) => {
    const confirmed = await showConfirm(
      'Reactivate Subscription',
      'Are you sure you want to reactivate this cancelled subscription? This will restore it as an active subscription.',
      'question'
    );
    if (!confirmed) return;

    try {
      const { data } = await subscriptionHistoryService.reactivateSubscription(recordId);
      showSuccess(data.message || 'Subscription reactivated successfully');
      // Refresh the drawer list
      if (subHistoryDrawerOpen) {
        setSubHistoryRecords(prev => prev.map(r => 
          r._id === recordId 
            ? { ...r, status: 'active', action: 'reactivated', cancelledDate: null, cancellationReason: '' }
            : r
        ));
      }
      loadPharmacies();
      if (!isSuperAdmin) {
        dispatch(fetchSubscriptionStatus());
      }
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to reactivate subscription');
    }
  };

  // Load active plans for dropdown
  useEffect(() => {
    dispatch(fetchActivePlans());
    if (!isSuperAdmin) {
      dispatch(fetchSubscriptionStatus());
    }
    return () => {
      if (!isSuperAdmin) dispatch(clearSubscriptionStatus());
    };
  }, [dispatch, isSuperAdmin]);

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
        dispatch(fetchActivePlans());
        showSuccess('Plan updated successfully');
      } else {
        await dispatch(createPlan(planData)).unwrap();
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

  // ------ Subscription handlers ------
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

  const calculateEndDate = (planId, startDate) => {
    if (!planId || !startDate) return '';
    const plan = activePlans.find((p) => p._id === planId);
    if (!plan || !plan.duration) return '';
    const start = new Date(startDate);
    let end = new Date(start);
    switch (plan.durationUnit) {
      case 'days': end.setDate(end.getDate() + plan.duration); break;
      case 'months': end.setMonth(end.getMonth() + plan.duration); break;
      case 'years': end.setFullYear(end.getFullYear() + plan.duration); break;
      default: end.setMonth(end.getMonth() + plan.duration);
    }
    return end.toISOString().split('T')[0];
  };

  const isObjectId = (val) => /^[0-9a-fA-F]{24}$/.test(val);

  const getPlanDisplayName = (planName) => {
    if (!planName) return 'N/A';
    if (isObjectId(planName)) {
      const plan = activePlans.find((p) => p._id === planName);
      return plan ? plan.planName : 'Unknown Plan';
    }
    return planName;
  };

  const openEdit = (pharmacy) => {
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
      if (formData.subscriptionPlanId) updateData.subscriptionPlanId = formData.subscriptionPlanId;
      else if (formData.subscriptionPlan) updateData.subscriptionPlan = formData.subscriptionPlan;
      if (formData.subscriptionEndDate) updateData.subscriptionEndDate = formData.subscriptionEndDate;
      await pharmacyService.updateSubscription(editing._id, updateData);
      showSuccess('Subscription updated successfully');
      closeEdit();
      loadPharmacies();
      dispatch(fetchActivePlans());
    } catch (error) {
      showError(error.response?.data?.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Renew handlers for subscriptions tab - with confirmation alert
  const openSubRenewDrawer = (pharmacy) => {
    const defaultPlanId = pharmacy.subscriptionPlanId || (activePlans.length > 0 ? activePlans[0]._id : '');
    const currentEnd = pharmacy.subscriptionEndDate ? new Date(pharmacy.subscriptionEndDate) : null;
    const now = new Date();
    let effectiveStart;
    if (currentEnd && currentEnd > now) {
      effectiveStart = new Date(currentEnd);
      effectiveStart.setDate(effectiveStart.getDate() + 1);
    } else {
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
  };

  const closeSubRenewDrawer = () => {
    setRenewDrawerOpen(false);
    setRenewPharmacy(null);
    setRenewForm({ planId: '', startDate: '', endDate: '', notes: '' });
  };

  const handleSubRenewFormChange = (field, value) => {
    setRenewForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'planId' || field === 'startDate') {
        const planId = field === 'planId' ? value : prev.planId;
        const startDate = field === 'startDate' ? value : prev.startDate;
        const plan = (activePlans || []).find((p) => p._id === planId);
        if (plan && startDate) {
          const start = new Date(startDate);
          let end = new Date(start);
          if (plan.durationUnit === 'days') end.setDate(end.getDate() + plan.duration);
          else if (plan.durationUnit === 'months') end.setMonth(end.getMonth() + plan.duration);
          else if (plan.durationUnit === 'years') end.setFullYear(end.getFullYear() + plan.duration);
          updated.endDate = end.toISOString().split('T')[0];
        }
      }
      return updated;
    });
  };

  const handleSubRenew = async () => {
    if (!renewForm.planId) { showError('Please select a subscription plan'); return; }

    // Show confirmation alert with preview
    try {
      const previewRes = await subscriptionHistoryService.previewSubscription({
        pharmacyId: renewPharmacy._id,
        planId: renewForm.planId,
        startDate: renewForm.startDate,
        endDate: renewForm.endDate,
      });
      const preview = previewRes.data.data;

      const confirmResult = await Swal.fire({
        title: 'Confirm Subscription Addition',
        html: `
          <div style="text-align: left; font-size: 14px; color: #1e293b;">
            <div style="margin-bottom: 16px; padding: 12px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
              <strong style="color: #16a34a;">🏥 ${preview.pharmacyName}</strong>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 12px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Current Plan</td>
                <td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0; text-transform: capitalize; color: #1e293b;">${preview.currentPlan}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; color: #64748b; border-bottom: 1px solid #e2e8f0;">New Plan</td>
                <td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${preview.newPlan}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Current Remaining Days</td>
                <td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${preview.currentRemainingDays} days</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; color: #64748b; border-bottom: 1px solid #e2e8f0;">New Subscription Duration</td>
                <td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${preview.newDuration} ${preview.newDurationUnit}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; color: #64748b; border-bottom: 1px solid #e2e8f0;">New Start Date</td>
                <td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${new Date(preview.newStartDate).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; color: #64748b; border-bottom: 1px solid #e2e8f0;">New End Date</td>
                <td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${new Date(preview.newEndDate).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Amount</td>
                <td style="padding: 8px 12px; font-weight: 700; border-bottom: 1px solid #e2e8f0; color: #2563eb;">₹${preview.amount?.toLocaleString()}</td>
              </tr>
            </table>
            <div style="margin-top: 16px; padding: 12px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe; text-align: center;">
              <strong style="color: #1d4ed8; font-size: 16px;">
                Final Remaining Days After Activation: ${preview.finalRemainingDays} days
              </strong>
            </div>
          </div>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'Yes, Add Subscription',
        cancelButtonText: 'Cancel',
        background: '#ffffff',
        color: '#1e293b',
        iconColor: '#2563eb',
        reverseButtons: true,
        width: '550px',
      });

      if (!confirmResult.isConfirmed) return;
    } catch (err) {
      showError('Failed to get subscription preview');
      return;
    }

    setRenewSubmitting(true);
    try {
      const { data } = await subscriptionHistoryService.addSubscription({
        pharmacyId: renewPharmacy._id,
        planId: renewForm.planId,
        startDate: renewForm.startDate,
        endDate: renewForm.endDate,
        notes: renewForm.notes,
      });
      showSuccess(data.message || 'Subscription added successfully!');
      closeSubRenewDrawer();
      loadPharmacies();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to add subscription');
    } finally {
      setRenewSubmitting(false);
    }
  };

  // History handlers for subscriptions tab
  const openSubHistoryDrawer = (pharmacy) => {
    setSubHistoryPharmacy(pharmacy);
    setSubHistoryDrawerOpen(true);
    setSubHistoryLoading(true);
    subscriptionHistoryService.getByPharmacy(pharmacy._id, { limit: 50 })
      .then(({ data }) => setSubHistoryRecords(data.data || []))
      .catch(() => setSubHistoryRecords([]))
      .finally(() => setSubHistoryLoading(false));
  };

  const closeSubHistoryDrawer = () => {
    setSubHistoryDrawerOpen(false);
    setSubHistoryPharmacy(null);
    setSubHistoryRecords([]);
  };

  const getPlanBadge = (plan) => {
    const colors = { free: 'badge-secondary', basic: 'badge-info', premium: 'badge-success', enterprise: 'badge-warning' };
    return colors[plan] || 'badge-secondary';
  };

  const planDrawerFooter = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closePlanDrawer}>Cancel</button>
      <button type="submit" form="planForm" className="btn btn-primary" disabled={planSubmitting}>
        {planSubmitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
        {editPlan ? 'Update Plan' : 'Create Plan'}
      </button>
    </>
  );

  const subscriptionDrawerFooter = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closeEdit}>Cancel</button>
      <button type="submit" form="subscriptionForm" className="btn btn-primary" disabled={submitting}>
        {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null} Update
      </button>
    </>
  );

  // ------ Timeline View Component ------
  const renderTimelineView = (records) => {
    if (!records || records.length === 0) return null;

    return (
      <div className="timeline-container" style={{ padding: '16px' }}>
        <h6 style={{ marginBottom: '16px', color: 'var(--gray-600)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <i className="fa-solid fa-timeline"></i> Subscription Timeline
        </h6>
        <div style={{ position: 'relative', paddingLeft: '30px' }}>
          {/* Vertical line */}
          <div style={{
            position: 'absolute',
            left: '12px',
            top: '0',
            bottom: '0',
            width: '2px',
            background: 'var(--gray-200)',
          }}></div>
          
          {records.map((record, index) => {
            const actionConfig = ACTION_CONFIG[record.action] || ACTION_CONFIG.created;
            const statusConfig = STATUS_CONFIG[record.status] || STATUS_CONFIG.expired;
            const isLatest = index === 0;
            
            return (
              <div key={record._id} style={{
                position: 'relative',
                marginBottom: '20px',
                paddingLeft: '20px',
              }}>
                {/* Timeline dot */}
                <div style={{
                  position: 'absolute',
                  left: '-26px',
                  top: '4px',
                  width: isLatest ? '16px' : '12px',
                  height: isLatest ? '16px' : '12px',
                  borderRadius: '50%',
                  background: record.status === 'active' ? '#22c55e' 
                    : record.status === 'upcoming' ? '#0ea5e9'
                    : record.status === 'cancelled' ? '#ef4444'
                    : '#64748b',
                  border: isLatest ? '3px solid #fff' : '2px solid #fff',
                  boxShadow: isLatest ? '0 0 0 2px #22c55e' : '0 0 0 1px var(--gray-300)',
                  zIndex: 1,
                }}></div>
                
                {/* Card */}
                <div style={{
                  padding: '12px',
                  background: isLatest ? '#f0fdf4' : '#f8fafc',
                  borderRadius: '8px',
                  border: isLatest ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <strong style={{ textTransform: 'capitalize', fontSize: '14px' }}>{record.planName}</strong>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span className={`badge ${getStatusBadge(record.status)}`} style={{ fontSize: '10px' }}>
                          <i className={`fa-solid ${getStatusIcon(record.status)}`} style={{ marginRight: '3px' }}></i>
                          {getStatusLabel(record.status)}
                        </span>
                        <span className={`badge ${getActionBadge(record.action)}`} style={{ fontSize: '10px' }}>
                          <i className={`fa-solid ${getActionIcon(record.action)}`} style={{ marginRight: '3px' }}></i>
                          {getActionLabel(record.action)}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--gray-500)' }}>
                      <div>{new Date(record.createdAt).toLocaleDateString()}</div>
                      <div style={{ fontSize: '10px' }}>{new Date(record.createdAt).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', color: 'var(--gray-600)' }}>
                    <div><strong>Start:</strong> {new Date(record.startDate).toLocaleDateString()}</div>
                    <div><strong>End:</strong> {new Date(record.endDate).toLocaleDateString()}</div>
                    <div><strong>Duration:</strong> {record.duration} {record.durationUnit}</div>
                    <div><strong>Amount:</strong> ₹{record.amount?.toLocaleString()}</div>
                    {record.createdByName && (
                      <div style={{ gridColumn: '1 / -1' }}><strong>By:</strong> {record.createdByName}</div>
                    )}
                    {record.cancelledDate && (
                      <div style={{ gridColumn: '1 / -1', color: '#ef4444' }}>
                        <strong>Cancelled:</strong> {new Date(record.cancelledDate).toLocaleDateString()} 
                        {record.cancellationReason ? ` - ${record.cancellationReason}` : ''}
                        {record.cancelledByName ? ` (by ${record.cancelledByName})` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ------ Admin Subscription Status Card ------
  const renderMySubscription = () => {
    if (!subscriptionStatus) {
      return (
        <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
      );
    }

    const statusColor = subscriptionStatus.status === 'active' ? '#22c55e' : subscriptionStatus.status === 'expiring_soon' ? '#f59e0b' : '#ef4444';
    const statusBg = subscriptionStatus.status === 'active' ? '#f0fdf4' : subscriptionStatus.status === 'expiring_soon' ? '#fffbeb' : '#fef2f2';
    const statusBorder = subscriptionStatus.status === 'active' ? '#bbf7d0' : subscriptionStatus.status === 'expiring_soon' ? '#fde68a' : '#fecaca';

    const endDate = subscriptionStatus.endDate ? new Date(subscriptionStatus.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A';
    const daysRemaining = subscriptionStatus.daysRemaining !== undefined ? subscriptionStatus.daysRemaining : 'N/A';

    // Desktop column definitions for history
    const desktopCols = ['Plan Name', 'Start Date', 'Expiry Date', 'Duration', 'Amount', 'Status', 'Action', 'Renewal Date', 'Payment Method'];

    return (
      <>
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="card-header">
          <h5><i className="fa-solid fa-credit-card"></i> My Subscription</h5>
        </div>
        <div className="card-body">
          {/* Status Banner */}
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            background: statusBg,
            border: `1px solid ${statusBorder}`,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: statusColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <i className={`fa-solid ${subscriptionStatus.status === 'active' ? 'fa-check' : 'fa-exclamation'}`} style={{ color: '#fff', fontSize: '18px' }}></i>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '16px', color: statusColor, textTransform: 'capitalize' }}>
                {subscriptionStatus.status === 'active' ? 'Active' : subscriptionStatus.status === 'expiring_soon' ? 'Expiring Soon' : 'Expired'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                {subscriptionStatus.status === 'active'
                  ? `Your subscription is active with ${daysRemaining} days remaining`
                  : subscriptionStatus.status === 'expiring_soon'
                    ? `Your subscription will expire in ${daysRemaining} days. Please renew soon.`
                    : 'Your subscription has expired. Please renew to access all features.'}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>Current Plan</div>
              <div style={{ fontWeight: 700, fontSize: '18px', marginTop: '4px', color: 'var(--gray-900)', textTransform: 'capitalize' }}>
                {subscriptionStatus.plan || 'Free'}
              </div>
            </div>
            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>Days Remaining</div>
              <div style={{ fontWeight: 700, fontSize: '18px', marginTop: '4px', color: daysRemaining <= 7 && daysRemaining !== 'N/A' ? '#ef4444' : 'var(--gray-900)' }}>
                {daysRemaining !== 'N/A' ? `${daysRemaining} day${daysRemaining > 1 ? 's' : ''}` : 'N/A'}
              </div>
            </div>
            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>Start Date</div>
              <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '4px', color: 'var(--gray-700)' }}>
                {subscriptionStatus.startDate ? new Date(subscriptionStatus.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
              </div>
            </div>
            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>Expiry Date</div>
              <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '4px', color: subscriptionStatus.status === 'expired' ? '#ef4444' : 'var(--gray-700)' }}>
                {endDate}
              </div>
            </div>
          </div>

          {subscriptionStatus.status === 'expired' && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--gray-500)', fontSize: '14px', marginBottom: '12px' }}>
                To continue using all features, please renew your subscription.
              </p>
              <button className="btn btn-primary" disabled style={{ opacity: 0.7, cursor: 'not-allowed' }}>
                <i className="fa-solid fa-credit-card"></i> Contact Support to Renew
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Subscription History Section */}
      <div className="card" style={{ maxWidth: '900px', margin: '24px auto 0' }}>
        <div className="card-header">
          <h5><i className="fa-solid fa-clock-rotate-left"></i> Subscription History</h5>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {myHistoryLoading ? (
            <div className="loading-spinner" style={{ padding: '30px' }}><i className="fa-solid fa-spinner fa-spin"></i></div>
          ) : myHistory.length > 0 ? (
            <>
              {/* Timeline View */}
              {renderTimelineView(myHistory)}
              
              {/* Desktop table */}
              <div className="customer-desktop-table">
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Plan Name</th>
                        <th>Start Date</th>
                        <th>Expiry Date</th>
                        <th>Duration</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Action</th>
                        <th>Renewal Date</th>
                        <th>Payment Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myHistory.map((record) => (
                        <tr key={record._id}>
                          <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>{record.planName}</td>
                          <td>{new Date(record.startDate).toLocaleDateString()}</td>
                          <td>{new Date(record.endDate).toLocaleDateString()}</td>
                          <td>{record.duration} {record.durationUnit}</td>
                          <td style={{ fontWeight: 600 }}>₹{record.amount.toLocaleString()}</td>
                          <td>
                            <span className={`badge ${getStatusBadge(record.status)}`} style={{ textTransform: 'capitalize' }}>
                              <i className={`fa-solid ${getStatusIcon(record.status)}`} style={{ marginRight: '3px' }}></i>
                              {getStatusLabel(record.status)}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${getActionBadge(record.action)}`} style={{ textTransform: 'capitalize', fontSize: '10px' }}>
                              <i className={`fa-solid ${getActionIcon(record.action)}`} style={{ marginRight: '3px' }}></i>
                              {getActionLabel(record.action)}
                            </span>
                          </td>
                          <td>{new Date(record.renewalDate).toLocaleDateString()}</td>
                          <td style={{ textTransform: 'capitalize' }}>{record.paymentMethod || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Mobile table */}
              <div className="customer-mobile-table">
                <table>
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th className="customer-expand-th"></th>
                    </tr>
                  </thead>
                  {myHistory.map((record, idx) => {
                    const expanded = isRowExpanded('admin', idx);
                    const mainCols = [
                      { render: (r) => <span style={{ fontWeight: 500, textTransform: 'capitalize', fontSize: '13px' }}>{r.planName}</span> },
                      { render: (r) => <span style={{ fontWeight: 600 }}>₹{r.amount.toLocaleString()}</span> },
                      { render: (r) => <span className={`badge ${getStatusBadge(r.status)}`} style={{ textTransform: 'capitalize', fontSize: '10px' }}>{getStatusLabel(r.status)}</span> },
                    ];
                    const detailRows = [
                      { label: 'Start', render: (r) => new Date(r.startDate).toLocaleDateString() },
                      { label: 'Expiry', render: (r) => new Date(r.endDate).toLocaleDateString() },
                      { label: 'Duration', render: (r) => `${r.duration} ${r.durationUnit}` },
                      { label: 'Action', render: (r) => <span className={`badge ${getActionBadge(r.action)}`} style={{ fontSize: '10px' }}>{getActionLabel(r.action)}</span> },
                      { label: 'Renewed', render: (r) => new Date(r.renewalDate).toLocaleDateString() },
                      { label: 'Payment', render: (r) => <span style={{ textTransform: 'capitalize' }}>{r.paymentMethod || '-'}</span> },
                    ];
                    return renderExpandableRow(record, idx, 'admin', expanded, () => toggleRow('admin', idx), mainCols, detailRows);
                  })}
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ padding: '30px' }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '36px', color: 'var(--gray-400)', marginBottom: '12px' }}></i>
              <h4>No Subscription History</h4>
              <p>Your subscription history will appear here once you have renewed.</p>
            </div>
          )}
        </div>
      </div>
      </>
    );
  };

  const isRowExpanded = (tableKey, rowIdx) => {
    return !!expandedRows[`${tableKey}-${rowIdx}`];
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Subscription Management</h2>
          <p>{isSuperAdmin ? 'Manage subscription plans and pharmacy subscriptions' : 'View your subscription details'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '2px solid var(--gray-200)' }}>
        {!isSuperAdmin && (
          <button
            className={`tab-btn ${activeTab === 'my-subscription' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-subscription')}
            style={{
              padding: '10px 24px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === 'my-subscription' ? '600' : '400',
              color: activeTab === 'my-subscription' ? 'var(--primary)' : 'var(--gray-500)',
              borderBottom: activeTab === 'my-subscription' ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px', fontSize: '15px',
            }}
          >
            <i className="fa-solid fa-credit-card"></i> My Subscription
          </button>
        )}
        {isSuperAdmin && (
          <button
            className={`tab-btn ${activeTab === 'plans' ? 'active' : ''}`}
            onClick={() => setActiveTab('plans')}
            style={{
              padding: '10px 24px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === 'plans' ? '600' : '400',
              color: activeTab === 'plans' ? 'var(--primary)' : 'var(--gray-500)',
              borderBottom: activeTab === 'plans' ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px', fontSize: '15px',
            }}
          >
            <i className="fa-solid fa-layer-group"></i> Plans
          </button>
        )}
        {isSuperAdmin && (
          <button
            className={`tab-btn ${activeTab === 'subscriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('subscriptions')}
            style={{
              padding: '10px 24px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === 'subscriptions' ? '600' : '400',
              color: activeTab === 'subscriptions' ? 'var(--primary)' : 'var(--gray-500)',
              borderBottom: activeTab === 'subscriptions' ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px', fontSize: '15px',
            }}
          >
            <i className="fa-solid fa-credit-card"></i> Subscriptions
          </button>
        )}
      </div>

      {/* ===== My Subscription (Admin) ===== */}
      {activeTab === 'my-subscription' && renderMySubscription()}

      {/* ===== Plans Management (Super Admin) ===== */}
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
                <>
                  {/* Desktop table */}
                  <div className="customer-desktop-table">
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
                              <td>{plan.features?.length > 0 ? (<span style={{ cursor: 'pointer', color: 'var(--primary)' }} title={plan.features.join(', ')}>{plan.features.length} feature{plan.features.length > 1 ? 's' : ''}</span>) : '-'}</td>
                              <td><span className={`badge ${plan.isActive ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'capitalize' }}>{plan.isActive ? 'Active' : 'Inactive'}</span></td>
                              <td>
                                <div className="action-buttons">
                                  <button className="btn btn-warning btn-sm" onClick={() => openEditPlanDrawer(plan)} title="Edit"><i className="fa-solid fa-edit"></i></button>
                                  <button className={`btn btn-sm ${plan.isActive ? 'btn-secondary' : 'btn-success'}`} onClick={() => handleTogglePlanStatus(plan._id, plan.planName, plan.isActive)} title={plan.isActive ? 'Deactivate' : 'Activate'}><i className={`fa-solid ${plan.isActive ? 'fa-pause' : 'fa-play'}`}></i></button>
                                  <button className="btn btn-danger btn-sm" onClick={() => handleDeletePlan(plan._id)} title="Delete"><i className="fa-solid fa-trash"></i></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {/* Mobile table */}
                  <div className="customer-mobile-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Plan Name</th>
                          <th>Price</th>
                          <th>Status</th>
                          <th className="customer-expand-th"></th>
                        </tr>
                      </thead>
                      {plans.map((plan, idx) => {
                        const expanded = isRowExpanded('plan', idx);
                        const mainCols = [
                          { render: (p) => <span style={{ fontWeight: 500, fontSize: '13px' }}>{p.planName}</span> },
                          { render: (p) => <span style={{ fontWeight: 600, color: 'var(--primary)' }}>₹{p.price?.toFixed(2)}</span> },
                          { render: (p) => <span className={`badge ${p.isActive ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'capitalize', fontSize: '10px' }}>{p.isActive ? 'Active' : 'Inactive'}</span> },
                        ];
                        const detailRows = [
                          { label: 'Duration', render: (p) => `${p.duration} ${p.durationUnit}` },
                          { label: 'Max Staff', render: (p) => p.maxStaff ?? 'Unlimited' },
                          { label: 'Max Branches', render: (p) => p.maxBranches ?? 'Unlimited' },
                          { label: 'Features', render: (p) => p.features?.length > 0 ? p.features.join(', ') : '-' },
                          { label: 'Actions', render: (p) => (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button className="btn btn-warning btn-sm" onClick={(e) => { e.stopPropagation(); openEditPlanDrawer(p); }} title="Edit"><i className="fa-solid fa-edit"></i></button>
                              <button className={`btn btn-sm ${p.isActive ? 'btn-secondary' : 'btn-success'}`} onClick={(e) => { e.stopPropagation(); handleTogglePlanStatus(p._id, p.planName, p.isActive); }} title={p.isActive ? 'Deactivate' : 'Activate'}><i className={`fa-solid ${p.isActive ? 'fa-pause' : 'fa-play'}`}></i></button>
                              <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDeletePlan(p._id); }} title="Delete"><i className="fa-solid fa-trash"></i></button>
                            </div>
                          )},
                        ];
                        return renderExpandableRow(plan, idx, 'plan', expanded, () => toggleRow('plan', idx), mainCols, detailRows);
                      })}
                    </table>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <i className="fa-solid fa-layer-group"></i>
                  <h4>No Plans Found</h4>
                  <p>Create your first subscription plan.</p>
                  <button className="btn btn-primary" onClick={openCreatePlanDrawer}><i className="fa-solid fa-plus"></i> Add Plan</button>
                </div>
              )}
            </div>
          </div>
          <Drawer isOpen={planDrawerOpen} onClose={closePlanDrawer} title={editPlan ? 'Edit Subscription Plan' : 'Add Subscription Plan'} footer={planDrawerFooter}>
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
                <textarea name="description" value={planFormData.description} onChange={handlePlanChange} placeholder="Brief description" rows="2" />
              </div>
              <div className="form-group">
                <label>Features (one per line)</label>
                <textarea name="features" value={planFormData.features} onChange={handlePlanChange} placeholder="Enter features, one per line" rows="4" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Max Staff</label>
                  <input type="number" name="maxStaff" value={planFormData.maxStaff} onChange={handlePlanChange} placeholder="Unlimited" min="1" />
                </div>
                <div className="form-group">
                  <label>Max Branches</label>
                  <input type="number" name="maxBranches" value={planFormData.maxBranches} onChange={handlePlanChange} placeholder="Unlimited" min="1" />
                </div>
              </div>
            </form>
          </Drawer>
        </div>
      )}

      {/* ===== All Subscriptions (Super Admin) ===== */}
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
                <>
                  {/* Desktop table */}
                  <div className="customer-desktop-table">
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
                              <td>
                                <div className="action-buttons">
                                  <button className="btn btn-warning btn-sm" onClick={() => openEdit(p)} title="Edit"><i className="fa-solid fa-edit"></i></button>
                                  <button className="btn btn-primary btn-sm" onClick={() => openSubRenewDrawer(p)} title="Add/Renew Subscription"><i className="fa-solid fa-plus"></i></button>
                                  <button className="btn btn-info btn-sm" onClick={() => openSubHistoryDrawer(p)} title="History"><i className="fa-solid fa-clock-rotate-left"></i></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {/* Mobile table */}
                  <div className="customer-mobile-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Pharmacy</th>
                          <th>Plan</th>
                          <th>Status</th>
                          <th className="customer-expand-th"></th>
                        </tr>
                      </thead>
                      {pharmacies.map((p, idx) => {
                        const expanded = isRowExpanded('sub', idx);
                        const mainCols = [
                          { render: () => <span style={{ fontWeight: 500, fontSize: '13px' }}>{p.pharmacyName}</span> },
                          { render: () => <span className={`badge ${getPlanBadge(p.subscriptionPlan)}`} style={{ textTransform: 'capitalize' }}>{getPlanDisplayName(p.subscriptionPlan)}</span> },
                          { render: () => <span className={`badge ${p.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'capitalize' }}>{p.status}</span> },
                        ];
                        const detailRows = [
                          { label: 'Start Date', render: () => p.subscriptionStartDate ? new Date(p.subscriptionStartDate).toLocaleDateString() : '-' },
                          { label: 'End Date', render: () => p.subscriptionEndDate ? new Date(p.subscriptionEndDate).toLocaleDateString() : 'No end date' },
                          { label: 'Actions', render: () => (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button className="btn btn-warning btn-sm" onClick={(e) => { e.stopPropagation(); openEdit(p); }} title="Edit"><i className="fa-solid fa-edit"></i></button>
                              <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); openSubRenewDrawer(p); }} title="Add/Renew"><i className="fa-solid fa-plus"></i></button>
                              <button className="btn btn-info btn-sm" onClick={(e) => { e.stopPropagation(); openSubHistoryDrawer(p); }} title="History"><i className="fa-solid fa-clock-rotate-left"></i></button>
                            </div>
                          )},
                        ];
                        return renderExpandableRow(p, idx, 'sub', expanded, () => toggleRow('sub', idx), mainCols, detailRows);
                      })}
                    </table>
                  </div>
                </>
              ) : <div className="empty-state" style={{ padding: '30px' }}><p>No pharmacies found</p></div>}
            </div>
          </div>
          <Drawer isOpen={!!editing} onClose={closeEdit} title={editing ? `Edit Subscription - ${editing.pharmacyName}` : 'Edit Subscription'} footer={subscriptionDrawerFooter}>
            {editing && (
              <form id="subscriptionForm" onSubmit={handleUpdate}>
                <div className="form-group">
                  <label>Subscription Plan</label>
                  <select value={formData.subscriptionPlanId || formData.subscriptionPlan} onChange={(e) => {
                    const val = e.target.value;
                    const selectedPlan = activePlans.find((p) => p._id === val);
                    if (selectedPlan) {
                      const startDate = editing?.subscriptionStartDate ? new Date(editing.subscriptionStartDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                      const endDate = calculateEndDate(val, startDate);
                      setFormData({ ...formData, subscriptionPlanId: val, subscriptionPlan: selectedPlan.planName, subscriptionEndDate: endDate });
                      setCalculatedEndDate(endDate);
                    } else {
                      setFormData({ ...formData, subscriptionPlanId: '', subscriptionPlan: val, subscriptionEndDate: '' });
                      setCalculatedEndDate('');
                    }
                  }} required>
                    <option value="">-- Select Plan --</option>
                    {activePlans.map((plan) => (
                      <option key={plan._id} value={plan._id}>{plan.planName} (₹{plan.price} / {plan.duration} {plan.durationUnit})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>End Date (auto-calculated)</label>
                  <input type="date" value={formData.subscriptionEndDate} readOnly className="form-control" style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }} />
                  <small style={{ color: '#888', fontSize: '12px' }}>End date is calculated automatically based on the selected plan's duration.</small>
                </div>
              </form>
            )}
          </Drawer>

          {/* Renew Drawer */}
          <Drawer
            isOpen={renewDrawerOpen}
            onClose={closeSubRenewDrawer}
            title={renewPharmacy ? `Add Subscription - ${renewPharmacy.pharmacyName}` : 'Add Subscription'}
            footer={
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={closeSubRenewDrawer}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleSubRenew} disabled={renewSubmitting}>
                  {renewSubmitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
                  {renewSubmitting ? 'Processing...' : 'Review & Confirm'}
                </button>
              </div>
            }
          >
            {renewPharmacy && (
              <div className="renew-drawer-content">
                <div className="form-group">
                  <label>Select Plan *</label>
                  <select value={renewForm.planId} onChange={(e) => handleSubRenewFormChange('planId', e.target.value)} required>
                    <option value="">-- Select Plan --</option>
                    {activePlans.map((plan) => (
                      <option key={plan._id} value={plan._id}>
                        {plan.planName} - ₹{plan.price?.toLocaleString()} ({plan.duration} {plan.durationUnit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={renewForm.startDate} onChange={(e) => handleSubRenewFormChange('startDate', e.target.value)} />
                  <small style={{ color: 'var(--gray-500)', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                    {renewPharmacy.subscriptionEndDate && new Date(renewPharmacy.subscriptionEndDate) > new Date()
                      ? `Current subscription is active until ${new Date(renewPharmacy.subscriptionEndDate).toLocaleDateString()}. New subscription will start after that.`
                      : 'Current subscription has expired. New subscription starts from the selected date.'}
                  </small>
                </div>
                <div className="form-group">
                  <label>End Date (calculated)</label>
                  <input type="date" value={renewForm.endDate} readOnly style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }} />
                </div>
                <div className="form-group">
                  <label>Notes (optional)</label>
                  <textarea value={renewForm.notes} onChange={(e) => handleSubRenewFormChange('notes', e.target.value)} placeholder="Add any notes..." rows={2} />
                </div>
                {renewForm.planId && activePlans.find(p => p._id === renewForm.planId) && (
                  <div className="renew-preview-card" style={{ padding: '14px', border: '1px solid #e2e8f0', borderRadius: '10px', background: '#f8fafc', marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--gray-700)' }}>Total Amount</span>
                      <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--primary)' }}>
                        ₹{activePlans.find(p => p._id === renewForm.planId)?.price?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Drawer>

          {/* History Drawer */}
          <Drawer
            isOpen={subHistoryDrawerOpen}
            onClose={closeSubHistoryDrawer}
            title={subHistoryPharmacy ? `Subscription History - ${subHistoryPharmacy.pharmacyName}` : 'Subscription History'}
            footer={<button type="button" className="btn btn-secondary" onClick={closeSubHistoryDrawer}>Close</button>}
            style={{ width: '1050px' }}
          >
            {subHistoryLoading ? (
              <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
            ) : subHistoryRecords.length > 0 ? (
              <>
                {/* Timeline View */}
                {renderTimelineView(subHistoryRecords)}
                
                {/* Desktop table */}
                <div className="customer-desktop-table">
                  <div className="table-container">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>Plan</th>
                          <th>Start</th>
                          <th>End</th>
                          <th>Duration</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Action</th>
                          <th>Renewed</th>
                          <th>Payment</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subHistoryRecords.map((record) => (
                          <tr key={record._id}>
                            <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>{record.planName}</td>
                            <td>{new Date(record.startDate).toLocaleDateString()}</td>
                            <td>{new Date(record.endDate).toLocaleDateString()}</td>
                            <td>{record.duration} {record.durationUnit}</td>
                            <td style={{ fontWeight: 600 }}>₹{record.amount?.toLocaleString()}</td>
                            <td>
                              <span className={`badge ${getStatusBadge(record.status)}`} style={{ textTransform: 'capitalize' }}>
                                <i className={`fa-solid ${getStatusIcon(record.status)}`} style={{ marginRight: '3px' }}></i>
                                {getStatusLabel(record.status)}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${getActionBadge(record.action)}`} style={{ textTransform: 'capitalize', fontSize: '10px' }}>
                                <i className={`fa-solid ${getActionIcon(record.action)}`} style={{ marginRight: '3px' }}></i>
                                {getActionLabel(record.action)}
                              </span>
                            </td>
                            <td>{new Date(record.renewalDate).toLocaleDateString()}</td>
                            <td style={{ textTransform: 'capitalize' }}>{record.paymentMethod || '-'}</td>
                            <td>
                              <div className="action-buttons" style={{ gap: '4px' }}>
                                {(record.status === 'active' || record.status === 'upcoming') && (
                                  <button className="btn btn-danger btn-sm" onClick={() => handleCancelSubscription(record._id)} title="Cancel Subscription">
                                    <i className="fa-solid fa-ban"></i>
                                  </button>
                                )}
                                {record.status === 'cancelled' && (
                                  <button className="btn btn-success btn-sm" onClick={() => handleReactivateSubscription(record._id)} title="Reactivate Subscription">
                                    <i className="fa-solid fa-rotate"></i>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* Mobile table */}
                <div className="customer-mobile-table">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th className="customer-expand-th"></th>
                      </tr>
                    </thead>
                    {subHistoryRecords.map((record, idx) => {
                      const expanded = isRowExpanded('hist', idx);
                      const mainCols = [
                        { render: (r) => <span style={{ fontWeight: 500, textTransform: 'capitalize', fontSize: '13px' }}>{r.planName}</span> },
                        { render: (r) => <span style={{ fontWeight: 600 }}>₹{r.amount?.toLocaleString()}</span> },
                        { render: (r) => <span className={`badge ${getStatusBadge(r.status)}`} style={{ textTransform: 'capitalize', fontSize: '10px' }}>{getStatusLabel(r.status)}</span> },
                      ];
                      const detailRows = [
                        { label: 'Start', render: (r) => new Date(r.startDate).toLocaleDateString() },
                        { label: 'End', render: (r) => new Date(r.endDate).toLocaleDateString() },
                        { label: 'Duration', render: (r) => `${r.duration} ${r.durationUnit}` },
                        { label: 'Action', render: (r) => <span className={`badge ${getActionBadge(r.action)}`} style={{ fontSize: '10px' }}>{getActionLabel(r.action)}</span> },
                        { label: 'Renewed', render: (r) => new Date(r.renewalDate).toLocaleDateString() },
                        { label: 'Payment', render: (r) => <span style={{ textTransform: 'capitalize' }}>{r.paymentMethod || '-'}</span> },
                        { label: '', render: (r) => (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {(r.status === 'active' || r.status === 'upcoming') && (
                              <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleCancelSubscription(r._id); }} title="Cancel Subscription">
                                <i className="fa-solid fa-ban"></i> Cancel
                              </button>
                            )}
                            {r.status === 'cancelled' && (
                              <button className="btn btn-success btn-sm" onClick={(e) => { e.stopPropagation(); handleReactivateSubscription(r._id); }} title="Reactivate">
                                <i className="fa-solid fa-rotate"></i> Reactivate
                              </button>
                            )}
                          </div>
                        )},
                      ];
                      return renderExpandableRow(record, idx, 'hist', expanded, () => toggleRow('hist', idx), mainCols, detailRows);
                    })}
                  </table>
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ padding: '30px' }}>
                <i className="fa-solid fa-clock-rotate-left"></i>
                <h4>No History Found</h4>
                <p>No subscription history records available for this pharmacy.</p>
              </div>
            )}
          </Drawer>
        </div>
      )}
    </div>
  );
}