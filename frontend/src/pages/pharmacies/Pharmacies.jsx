import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPharmacies,
  createPharmacy,
  updatePharmacy,
  deletePharmacy,
} from '../../redux/slices/pharmacySlice';
import Drawer from '../../components/common/Drawer';
import { showSuccess, showError, confirmDelete } from '../../utils/sweetAlert';

const initialFormState = {
  pharmacyName: '',
  ownerName: '',
  email: '',
  phone: '',
  address: '',
  licenseNumber: '',
};

export default function Pharmacies() {
  const dispatch = useDispatch();
  const { items, total, loading } = useSelector((state) => state.pharmacies);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);

  const loadPharmacies = useCallback(() => {
    const params = { page: currentPage, limit: 10 };
    if (search) params.search = search;
    dispatch(fetchPharmacies(params));
  }, [dispatch, currentPage, search]);

  useEffect(() => {
    loadPharmacies();
  }, [loadPharmacies]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleSearch = (e) => setSearch(e.target.value);

  const openCreateDrawer = () => {
    setEditing(null);
    setFormData(initialFormState);
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
      showError('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await dispatch(updatePharmacy({ id: editing._id, ...formData })).unwrap();
        showSuccess('Pharmacy updated successfully');
      } else {
        await dispatch(createPharmacy(formData)).unwrap();
        showSuccess('Pharmacy created successfully');
      }
      closeDrawer();
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
        {editing ? 'Update' : 'Create'}
      </button>
    </>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Pharmacy Management</h2>
          <p>Manage all registered pharmacies on the platform</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateDrawer}>
          <i className="fa-solid fa-plus"></i> Add Pharmacy
        </button>
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

      <Drawer isOpen={drawerOpen} onClose={closeDrawer} title={editing ? 'Edit Pharmacy' : 'Add Pharmacy'} footer={drawerFooter}>
        <form id="pharmacyForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Pharmacy Name *</label>
            <input type="text" name="pharmacyName" value={formData.pharmacyName} onChange={handleChange} placeholder="Enter pharmacy name" required />
          </div>
          <div className="form-group">
            <label>Owner Name *</label>
            <input type="text" name="ownerName" value={formData.ownerName} onChange={handleChange} placeholder="Enter owner name" required />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter email" required />
          </div>
          <div className="form-group">
            <label>Phone *</label>
            <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="Enter phone number" required />
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea name="address" value={formData.address} onChange={handleChange} placeholder="Enter address" />
          </div>
          <div className="form-group">
            <label>License Number</label>
            <input type="text" name="licenseNumber" value={formData.licenseNumber} onChange={handleChange} placeholder="Enter license number" />
          </div>
        </form>
      </Drawer>
    </div>
  );
}