import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  toggleStaffStatus,
} from '../../redux/slices/staffSlice';
import Drawer from '../../components/common/Drawer';
import { showSuccess, showError, confirmDelete } from '../../utils/sweetAlert';

const initialFormState = {
  name: '',
  email: '',
  password: '',
  role: 'pharmacist',
  phone: '',
};

export default function Staff() {
  const dispatch = useDispatch();
  const { items, total, loading } = useSelector((state) => state.staff);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);

  const loadStaff = useCallback(() => {
    const params = { page: currentPage, limit: 10 };
    if (search) params.search = search;
    dispatch(fetchStaff(params));
  }, [dispatch, currentPage, search]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleSearch = (e) => setSearch(e.target.value);

  const openCreateDrawer = () => {
    setEditing(null);
    setFormData(initialFormState);
    setDrawerOpen(true);
  };

  const openEditDrawer = (staff) => {
    setEditing(staff);
    setFormData({
      name: staff.name,
      email: staff.email,
      password: '',
      role: staff.role,
      phone: staff.phone || '',
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
    if (!formData.name.trim() || !formData.email.trim()) {
      showError('Name and email are required');
      return;
    }
    if (!editing && !formData.password.trim()) {
      showError('Password is required for new staff');
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        const updateData = { name: formData.name, role: formData.role, phone: formData.phone };
        await dispatch(updateStaff({ id: editing._id, ...updateData })).unwrap();
        showSuccess('Staff updated successfully');
      } else {
        await dispatch(createStaff(formData)).unwrap();
        showSuccess('Staff created successfully');
      }
      closeDrawer();
    } catch (error) {
      showError(error || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmDelete('this staff member');
    if (!confirmed) return;
    try {
      await dispatch(deleteStaff(id)).unwrap();
      showSuccess('Staff deleted successfully');
    } catch (error) {
      showError(error || 'Delete failed');
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await dispatch(toggleStaffStatus(id)).unwrap();
      showSuccess('Staff status updated');
    } catch (error) {
      showError(error || 'Failed to update status');
    }
  };

  const drawerFooter = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closeDrawer}>Cancel</button>
      <button type="submit" form="staffForm" className="btn btn-primary" disabled={submitting}>
        {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
        {editing ? 'Update' : 'Create'}
      </button>
    </>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Staff Management</h2>
          <p>Manage pharmacists and cashiers</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateDrawer}>
          <i className="fa-solid fa-plus"></i> Add Staff
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h5>All Staff</h5>
          <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>Total: {total}</span>
        </div>
        <div className="card-body">
          <div className="search-bar">
            <div className="search-input">
              <i className="fa-solid fa-search"></i>
              <input type="text" placeholder="Search staff..." value={search} onChange={handleSearch} />
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
          ) : items?.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((staff) => (
                    <tr key={staff._id}>
                      <td style={{ fontWeight: 500 }}>{staff.name}</td>
                      <td>{staff.email}</td>
                      <td><span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{staff.role}</span></td>
                      <td>{staff.phone || '-'}</td>
                      <td>
                        <label className="status-toggle">
                          <input type="checkbox" checked={staff.isActive} onChange={() => handleToggleStatus(staff._id)} />
                          <span className="slider"></span>
                        </label>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn btn-warning btn-sm" onClick={() => openEditDrawer(staff)}>
                            <i className="fa-solid fa-edit"></i>
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(staff._id)}>
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
              <i className="fa-solid fa-user-md"></i>
              <h4>No Staff Found</h4>
              <p>Get started by adding staff members.</p>
              <button className="btn btn-primary" onClick={openCreateDrawer}>
                <i className="fa-solid fa-plus"></i> Add Staff
              </button>
            </div>
          )}
        </div>
      </div>

      <Drawer isOpen={drawerOpen} onClose={closeDrawer} title={editing ? 'Edit Staff' : 'Add Staff'} footer={drawerFooter}>
        <form id="staffForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name *</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Enter full name" required />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter email" required={!editing} disabled={!!editing} />
          </div>
          {!editing && (
            <div className="form-group">
              <label>Password *</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Enter password" required />
            </div>
          )}
          <div className="form-group">
            <label>Role *</label>
            <select name="role" value={formData.role} onChange={handleChange} required>
              <option value="pharmacist">Pharmacist</option>
              <option value="cashier">Cashier</option>
            </select>
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="Enter phone number" />
          </div>
        </form>
      </Drawer>
    </div>
  );
}