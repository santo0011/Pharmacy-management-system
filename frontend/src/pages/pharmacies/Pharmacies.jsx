import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPharmacies,
  createPharmacy,
  updatePharmacy,
  deletePharmacy,
} from '../../redux/slices/pharmacySlice';
import { fetchActivePlans } from '../../redux/slices/subscriptionPlanSlice';
import Drawer from '../../components/common/Drawer';
import { showSuccess, showError, confirmDelete } from '../../utils/sweetAlert';

const initialFormState = {
  pharmacyName: '',
  ownerName: '',
  email: '',
  phone: '',
  address: '',
  licenseNumber: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  adminPhone: '',
  subscriptionPlan: '',
};

export default function Pharmacies() {
  const dispatch = useDispatch();
  const { items, total, loading } = useSelector((state) => state.pharmacies);
  const { activePlans } = useSelector((state) => state.subscriptionPlans);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [localActivePlans, setLocalActivePlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const loadPharmacies = useCallback(() => {
    const params = { page: currentPage, limit: 10 };
    if (search) params.search = search;
    dispatch(fetchPharmacies(params));
  }, [dispatch, currentPage, search]);

  useEffect(() => {
    loadPharmacies();
  }, [loadPharmacies]);

  useEffect(() => {
    setPlansLoading(true);
    dispatch(fetchActivePlans()).then((res) => {
      if (res.payload?.data) {
        setLocalActivePlans(res.payload.data);
      }
      setPlansLoading(false);
    });
  }, [dispatch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleSearch = (e) => setSearch(e.target.value);

  const openCreateDrawer = () => {
    setEditing(null);
    setFormData({
      ...initialFormState,
      subscriptionPlan: localActivePlans.length > 0 ? localActivePlans[0]._id : (activePlans.length > 0 ? activePlans[0]._id : ''),
    });
    setDrawerOpen(true);
  };

  const openEditDrawer = (pharmacy) => {
    setEditing(pharmacy);
    setFormData({
      pharmacyName: pharmacy.pharmacyName,
      ownerName: pharmacy.ownerName,
      email: pharmacy.email,
      phone: pharmacy.phone,
      address: pharmacy.address || '',
      licenseNumber: pharmacy.licenseNumber || '',
      adminName: '',
      adminEmail: '',
      adminPassword: '',
      adminPhone: '',
      subscriptionPlan: pharmacy.subscriptionPlanId || pharmacy.subscriptionPlan || 'free',
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.pharmacyName.trim() || !formData.ownerName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      showError('Please fill in all pharmacy required fields');
      return;
    }
    if (!editing && (!formData.adminName.trim() || !formData.adminEmail.trim() || !formData.adminPassword.trim())) {
      showError('Please fill in all Pharmacy Admin fields');
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        const pharmacyData = {
          pharmacyName: formData.pharmacyName,
          ownerName: formData.ownerName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          licenseNumber: formData.licenseNumber,
        };
        await dispatch(updatePharmacy({ id: editing._id, ...pharmacyData })).unwrap();
        showSuccess('Pharmacy updated successfully');
      } else {
        await dispatch(createPharmacy(formData)).unwrap();
        showSuccess('Pharmacy created with Admin account successfully');
      }
      closeDrawer();
      loadPharmacies();
    } catch (error) {
      showError(error || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmDelete('this pharmacy');
    if (!confirmed) return;
    try {
      await dispatch(deletePharmacy(id)).unwrap();
      showSuccess('Pharmacy deleted successfully');
    } catch (error) {
      showError(error || 'Delete failed');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'badge-success',
      inactive: 'badge-warning',
      suspended: 'badge-danger',
    };
    return badges[status] || 'badge-secondary';
  };

  const drawerFooter = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closeDrawer}>Cancel</button>
      <button type="submit" form="pharmacyForm" className="btn btn-primary" disabled={submitting}>
        {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
        {editing ? 'Update Pharmacy' : 'Create Pharmacy'}
      </button>
    </>
  );

  const noPlansMessage = (
    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--gray-500)' }}>
      <i className="fa-solid fa-exclamation-circle"></i>
      <p>No subscription plans available. Please create a subscription plan first in <a href="/subscriptions" style={{ color: 'var(--primary-color)' }}>Subscription Management</a>.</p>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Pharmacy Management</h2>
          <p>Manage all registered pharmacies on the platform</p>
        </div>
        {localActivePlans.length === 0 && !plansLoading ? (
          <button className="btn btn-primary" disabled title="Create a subscription plan first">
            <i className="fa-solid fa-plus"></i> Add Pharmacy
          </button>
        ) : (
          <button className="btn btn-primary" onClick={openCreateDrawer}>
            <i className="fa-solid fa-plus"></i> Add Pharmacy
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h5>All Pharmacies</h5>
          <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>Total: {total}</span>
        </div>
        <div className="card-body">
          <div className="search-bar">
            <div className="search-input">
              <i className="fa-solid fa-search"></i>
              <input type="text" placeholder="Search pharmacies..." value={search} onChange={handleSearch} />
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
          ) : items?.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Pharmacy Name</th>
                    <th>Owner</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>License</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((pharmacy) => (
                    <tr key={pharmacy._id}>
                      <td style={{ fontWeight: 500 }}>{pharmacy.pharmacyName}</td>
                      <td>{pharmacy.ownerName}</td>
                      <td>{pharmacy.email}</td>
                      <td>{pharmacy.phone}</td>
                      <td>{pharmacy.licenseNumber || '-'}</td>
                      <td><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{pharmacy.subscriptionPlan}</span></td>
                      <td>
                        <span className={`badge ${getStatusBadge(pharmacy.status)}`} style={{ textTransform: 'capitalize' }}>
                          {pharmacy.status}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn btn-warning btn-sm" onClick={() => openEditDrawer(pharmacy)}>
                            <i className="fa-solid fa-edit"></i>
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(pharmacy._id)}>
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
              <i className="fa-solid fa-hospital"></i>
              <h4>No Pharmacies Found</h4>
              <p>Get started by creating a new pharmacy.</p>
              <button className="btn btn-primary" onClick={openCreateDrawer}>
                <i className="fa-solid fa-plus"></i> Add Pharmacy
              </button>
            </div>
          )}
        </div>
      </div>

      <Drawer
        isOpen={drawerOpen}
        onClose={closeDrawer}
        title={editing ? 'Edit Pharmacy' : 'Create New Pharmacy'}
        footer={drawerFooter}
      >
        <form id="pharmacyForm" onSubmit={handleSubmit}>
          <h4 style={{ color: 'var(--primary-color)', marginBottom: '16px' }}>
            <i className="fa-solid fa-hospital"></i> Pharmacy Information
          </h4>
          <div className="form-group">
            <label>Pharmacy Name *</label>
            <input type="text" name="pharmacyName" value={formData.pharmacyName} onChange={handleChange} placeholder="Enter pharmacy name" required />
          </div>
          <div className="form-group">
            <label>Owner Name *</label>
            <input type="text" name="ownerName" value={formData.ownerName} onChange={handleChange} placeholder="Enter owner name" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Pharmacy email" required />
            </div>
            <div className="form-group">
              <label>Phone *</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="Phone number" required />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea name="address" value={formData.address} onChange={handleChange} placeholder="Enter address" />
          </div>
          <div className="form-group">
            <label>License Number</label>
            <input type="text" name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} placeholder="Enter license number" />
          </div>

          {localActivePlans.length === 0 && !plansLoading ? (
            noPlansMessage
          ) : (
            <>
              {!editing && (
                <>
                  <hr style={{ margin: '20px 0', borderColor: 'var(--gray-200)' }} />
                  <h4 style={{ color: 'var(--primary-color)', marginBottom: '16px' }}>
                    <i className="fa-solid fa-user-shield"></i> Pharmacy Admin Account
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '16px' }}>
                    An admin account will be automatically created and linked to this pharmacy.
                  </p>
                  <div className="form-group">
                    <label>Admin Full Name *</label>
                    <input type="text" name="adminName" value={formData.adminName} onChange={handleChange} placeholder="Enter admin name" required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label>Admin Email *</label>
                      <input type="email" name="adminEmail" value={formData.adminEmail} onChange={handleChange} placeholder="Admin login email" required />
                    </div>
                    <div className="form-group">
                      <label>Admin Password *</label>
                      <input type="password" name="adminPassword" value={formData.adminPassword} onChange={handleChange} placeholder="Admin password" required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Admin Phone</label>
                    <input type="text" name="adminPhone" value={formData.adminPhone} onChange={handleChange} placeholder="Admin phone number" />
                  </div>

                  <hr style={{ margin: '20px 0', borderColor: 'var(--gray-200)' }} />
                  <h4 style={{ color: 'var(--primary-color)', marginBottom: '16px' }}>
                    <i className="fa-solid fa-credit-card"></i> Subscription Plan
                  </h4>
                  <div className="form-group">
                    <label>Subscription Plan</label>
                    <select name="subscriptionPlan" value={formData.subscriptionPlan} onChange={handleChange} required>
                      <option value="">-- Select Plan --</option>
                      {localActivePlans.map((plan) => (
                        <option key={plan._id} value={plan._id}>
                          {plan.planName} (₹{plan.price} / {plan.duration} {plan.durationUnit})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </>
          )}
        </form>
      </Drawer>
    </div>
  );
}