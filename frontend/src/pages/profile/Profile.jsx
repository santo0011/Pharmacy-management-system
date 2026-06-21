import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useAuth } from '../../hooks/useAuth';
import { updateProfile } from '../../redux/slices/authSlice';
import { showSuccess, showError } from '../../utils/sweetAlert';

export default function Profile() {
  const dispatch = useDispatch();
  const { user, isSuperAdmin } = useAuth();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await dispatch(updateProfile({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
      })).unwrap();
      showSuccess('Profile updated successfully');
      setEditing(false);
    } catch (error) {
      showError(error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>My Profile</h2>
          <p>Manage your account information</p>
        </div>
        {!editing && (
          <button className="btn btn-primary" onClick={() => setEditing(true)}>
            <i className="fa-solid fa-edit"></i> Edit Profile
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '30px' }}>
            <div className="avatar" style={{ width: '80px', height: '80px', fontSize: '32px', margin: '0 auto 16px', background: 'var(--primary-color)', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <h4>{user?.name}</h4>
            <p style={{ color: 'var(--gray-500)' }}>{user?.email}</p>
            <span className={`badge ${isSuperAdmin ? 'badge-warning' : 'badge-info'}`} style={{ textTransform: 'capitalize', marginTop: '8px', display: 'inline-block' }}>
              {isSuperAdmin ? 'Super Admin' : user?.role?.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h5>Account Information</h5></div>
          <div className="card-body">
            {editing ? (
              <form onSubmit={handleSave}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Enter phone number" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
                  <small style={{ color: 'var(--gray-500)' }}>Email cannot be changed</small>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-save"></i>} Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <div style={{ width: '150px', fontWeight: 500, color: 'var(--gray-600)' }}>Full Name</div>
                  <div>{user?.name}</div>
                </div>
                <div style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <div style={{ width: '150px', fontWeight: 500, color: 'var(--gray-600)' }}>Email</div>
                  <div>{user?.email}</div>
                </div>
                <div style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <div style={{ width: '150px', fontWeight: 500, color: 'var(--gray-600)' }}>Phone</div>
                  <div>{user?.phone || '-'}</div>
                </div>
                <div style={{ display: 'flex', padding: '12px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <div style={{ width: '150px', fontWeight: 500, color: 'var(--gray-600)' }}>Role</div>
                  <div style={{ textTransform: 'capitalize' }}>{isSuperAdmin ? 'Super Admin' : user?.role?.replace('_', ' ')}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}