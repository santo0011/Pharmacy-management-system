import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
} from '../../redux/slices/userSlice';
import Drawer from '../../components/common/Drawer';
import { showSuccess, showError, confirmAction } from '../../utils/sweetAlert';

const initialFormState = {
  name: '',
  email: '',
  password: '',
  phone: '',
  role: 'pharmacist',
};

export default function Users() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { canViewUserManagement, user: currentUser } = useAuth();
  const { items, total, page, totalPages, loading } = useSelector(
    (state) => state.users
  );

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);

  // Password reset modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Redirect if not super admin
  useEffect(() => {
    if (!canViewUserManagement) {
      navigate('/', { replace: true });
    }
  }, [canViewUserManagement, navigate]);

  const loadUsers = useCallback(() => {
    const params = { page: currentPage, limit: 10 };
    if (search) params.search = search;
    if (roleFilter) params.role = roleFilter;
    dispatch(fetchUsers(params));
  }, [dispatch, currentPage, search, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter]);

  const handleSearch = (e) => setSearch(e.target.value);
  const handleRoleFilter = (e) => setRoleFilter(e.target.value);

  const openCreateDrawer = () => {
    setEditing(null);
    setFormData(initialFormState);
    setDrawerOpen(true);
  };

  const openEditDrawer = (userItem) => {
    setEditing(userItem);
    setFormData({
      name: userItem.name,
      email: userItem.email,
      password: '',
      phone: userItem.phone || '',
      role: userItem.role,
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
      showError('Password is required for new users');
      return;
    }
    if (!editing && formData.password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        const updateData = {
          name: formData.name,
          phone: formData.phone,
          role: formData.role,
        };
        await dispatch(updateUser({ id: editing._id, userData: updateData })).unwrap();
        showSuccess('User updated successfully');
      } else {
        await dispatch(createUser(formData)).unwrap();
        showSuccess('User created successfully');
      }
      closeDrawer();
    } catch (error) {
      showError(error || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, userRole) => {
    if (userRole === 'super_admin') {
      showError('Cannot delete Super Admin');
      return;
    }
    const confirmed = await confirmAction('Delete User', 'This action cannot be undone.');
    if (!confirmed) return;
    try {
      await dispatch(deleteUser(id)).unwrap();
      showSuccess('User deleted successfully');
    } catch (error) {
      showError(error || 'Delete failed');
    }
  };

  const handleToggleActive = async (userItem) => {
    const newStatus = !userItem.isActive;
    const action = newStatus ? 'activate' : 'deactivate';
    const confirmed = await confirmAction(
      `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      `Are you sure you want to ${action} ${userItem.name}?`
    );
    if (!confirmed) return;
    try {
      await dispatch(updateUser({ id: userItem._id, userData: { isActive: newStatus } })).unwrap();
      showSuccess(`User ${action}d successfully`);
    } catch (error) {
      showError(error || `Failed to ${action} user`);
    }
  };

  const openResetPassword = (userItem) => {
    setResetTargetUser(userItem);
    setNewPassword('');
    setResetModalOpen(true);
  };

  const closeResetPassword = () => {
    setResetModalOpen(false);
    setResetTargetUser(null);
    setNewPassword('');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim() || newPassword.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }
    setResetting(true);
    try {
      await dispatch(resetUserPassword({ id: resetTargetUser._id, newPassword })).unwrap();
      showSuccess(`Password reset for ${resetTargetUser.name}`);
      closeResetPassword();
    } catch (error) {
      showError(error || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const roleColors = {
    super_admin: 'badge-info',
    admin: 'badge-warning',
    pharmacist: 'badge-success',
    cashier: 'badge-danger',
  };

  if (!canViewUserManagement) return null;

  const drawerFooter = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closeDrawer}>Cancel</button>
      <button type="submit" form="userForm" className="btn btn-primary" disabled={submitting}>
        {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
        {editing ? 'Update' : 'Create'}
      </button>
    </>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>User Management</h2>
          <p>Manage system users and roles (Super Admin only)</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateDrawer}>
          <i className="fa-solid fa-plus"></i> Add User
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h5>All Users</h5>
          <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>Total: {total}</span>
        </div>
        <div className="card-body">
          <div className="search-bar">
            <div className="search-input">
              <i className="fa-solid fa-search"></i>
              <input type="text" placeholder="Search users..." value={search} onChange={handleSearch} />
            </div>
            <div className="filter-group">
              <select className="form-select" value={roleFilter} onChange={handleRoleFilter}>
                <option value="">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="pharmacist">Pharmacist</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
          ) : items?.length > 0 ? (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((userItem) => (
                      <tr key={userItem._id}>
                        <td style={{ fontWeight: 500 }}>{userItem.name}</td>
                        <td>{userItem.email}</td>
                        <td>{userItem.phone || '-'}</td>
                        <td>
                          <span className={`badge ${roleColors[userItem.role] || 'badge-info'}`}>
                            {userItem.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${userItem.isActive ? 'badge-success' : 'badge-danger'}`}>
                            {userItem.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          {userItem.role !== 'super_admin' ? (
                            <div className="action-buttons">
                              <button className="btn btn-warning btn-sm" onClick={() => openEditDrawer(userItem)} title="Edit">
                                <i className="fa-solid fa-edit"></i>
                              </button>
                              <button
                                className={`btn btn-sm ${userItem.isActive ? 'btn-secondary' : 'btn-success'}`}
                                onClick={() => handleToggleActive(userItem)}
                                title={userItem.isActive ? 'Deactivate' : 'Activate'}
                              >
                                <i className={`fa-solid ${userItem.isActive ? 'fa-ban' : 'fa-check'}`}></i>
                              </button>
                              <button className="btn btn-info btn-sm" onClick={() => openResetPassword(userItem)} title="Reset Password">
                                <i className="fa-solid fa-key"></i>
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(userItem._id, userItem.role)} title="Delete">
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Protected</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <span>Showing page {page} of {totalPages} ({total} total)</span>
                <div className="page-buttons">
                  <button disabled={page <= 1} onClick={() => setCurrentPage(page - 1)}>
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} className={p === page ? 'active' : ''} onClick={() => setCurrentPage(p)}>{p}</button>
                  ))}
                  <button disabled={page >= totalPages} onClick={() => setCurrentPage(page + 1)}>
                    <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <i className="fa-solid fa-users-gear"></i>
              <h4>No Users Found</h4>
              <p>Create admin, pharmacist, and cashier accounts.</p>
              <button className="btn btn-primary" onClick={openCreateDrawer}>
                <i className="fa-solid fa-plus"></i> Add User
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right-side Drawer for Create/Edit */}
      <Drawer isOpen={drawerOpen} onClose={closeDrawer} title={editing ? 'Edit User' : 'Add User'} footer={drawerFooter}>
        <form id="userForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name *</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Enter name" required />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter email" required={!editing} disabled={!!editing} />
          </div>
          {!editing && (
            <div className="form-group">
              <label>Password *</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Min 6 characters" minLength={6} required={!editing} />
            </div>
          )}
          <div className="form-group">
            <label>Phone</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Enter phone" />
          </div>
          <div className="form-group">
            <label>Role *</label>
            <select name="role" value={formData.role} onChange={handleChange}>
              <option value="admin">Admin</option>
              <option value="pharmacist">Pharmacist</option>
              <option value="cashier">Cashier</option>
            </select>
          </div>
        </form>
      </Drawer>

      {/* Reset Password Modal */}
      {resetModalOpen && (
        <div className="modal-overlay" onClick={closeResetPassword}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reset Password</h3>
              <button className="btn-close" onClick={closeResetPassword}>&times;</button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body">
                <p style={{ marginBottom: '16px', color: 'var(--gray-500)' }}>
                  Resetting password for <strong>{resetTargetUser?.name}</strong> ({resetTargetUser?.email})
                </p>
                <div className="form-group">
                  <label>New Password *</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    minLength={6}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeResetPassword}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={resetting}>
                  {resetting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}