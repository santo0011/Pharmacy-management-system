import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useAuth } from '../../hooks/useAuth';
import { updateProfile } from '../../redux/slices/authSlice';
import { profileService } from '../../services/profileService';
import { dashboardService } from '../../services/dashboardService';
import { showSuccess, showError } from '../../utils/sweetAlert';
import Drawer from '../../components/common/Drawer';
import { getCurrentSymbol } from '../../utils/currency';

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR (₹)', symbol: '₹' },
  { value: 'USD', label: 'USD ($)', symbol: '$' },
  { value: 'EUR', label: 'EUR (€)', symbol: '€' },
  { value: 'GBP', label: 'GBP (£)', symbol: '£' },
  { value: 'AED', label: 'AED (د.إ)', symbol: 'د.إ' },
  { value: 'BDT', label: 'BDT (৳)', symbol: '৳' },
  { value: 'PKR', label: 'PKR (₨)', symbol: '₨' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (UTC+5:30)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC+4:00)' },
  { value: 'Asia/Dhaka', label: 'Asia/Dhaka (UTC+6:00)' },
  { value: 'UTC', label: 'UTC' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'bn', label: 'Bengali' },
];

const WEEKLY_OFF_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Profile() {
  const { user, isSuperAdmin } = useAuth();
  const dispatch = useDispatch();
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editSection, setEditSection] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [userEditing, setUserEditing] = useState(false);
  const [userForm, setUserForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [userSaving, setUserSaving] = useState(false);

  const [dashboardStats, setDashboardStats] = useState(null);
  const statsSymbolRef = useRef('₹');

  useEffect(() => {
    if (isSuperAdmin) {
      setLoading(false);
    } else {
      loadProfile();
      loadDashboardStats();
    }
  }, []);

  const loadDashboardStats = async () => {
    try {
      const { data } = await dashboardService.getPharmacyDashboard();
      if (data.data) {
        setDashboardStats(data.data);
      }
    } catch (err) {
      // Dashboard stats are non-critical
    }
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data } = await profileService.getPharmacyProfile();
      if (data.data) {
        setPharmacy(data.data);
      }
    } catch (err) {
      showError('Failed to load pharmacy profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSave = async (e) => {
    e.preventDefault();
    setUserSaving(true);
    try {
      await dispatch(updateProfile({
        name: userForm.name.trim(),
        phone: userForm.phone.trim(),
      })).unwrap();
      showSuccess('Profile updated successfully');
      setUserEditing(false);
    } catch (error) {
      showError(error || 'Failed to update profile');
    } finally {
      setUserSaving(false);
    }
  };

  const openEdit = (section) => {
    // Admin cannot edit settings (currency, timezone, etc.) — those are Super Admin only
    if (section === 'settings') {
      showError('Currency and localization settings can only be changed by the Super Admin.');
      return;
    }
    setEditForm({ ...pharmacy });
    setEditSection(section);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await profileService.updatePharmacyProfile(editForm);
      if (data.data) {
        setPharmacy(data.data);
        showSuccess('Profile updated successfully');
        setEditSection(null);
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Convert to base64 for simplicity (production would use upload service)
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const { data } = await profileService.updatePharmacyProfile({ logo: reader.result });
        if (data.data) {
          setPharmacy(data.data);
          showSuccess('Logo updated');
        }
      } catch (err) {
        showError('Failed to update logo');
      }
    };
    reader.readAsDataURL(file);
  };

  // Format date for display
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '-';
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN') : '-';

  // Compute days remaining
  const daysRemaining = pharmacy?.subscriptionEndDate
    ? Math.ceil((new Date(pharmacy.subscriptionEndDate) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  if (loading) {
    return (
      <div className="loading-spinner">
        <i className="fa-solid fa-spinner fa-spin"></i>
      </div>
    );
  }

  const renderValue = (val, fallback = '-') => val || fallback;

  const renderCard = (title, icon, children, sectionKey, extra) => (
    <div className="card" style={{ marginBottom: '20px', border: '1px solid var(--gray-200)' }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <h5><i className={`fa-solid ${icon}`} style={{ marginRight: '8px', color: 'var(--primary)' }}></i>{title}</h5>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {extra}
          {sectionKey && (
            <button className="btn btn-outline btn-sm" onClick={() => openEdit(sectionKey)}>
              <i className="fa-solid fa-pen"></i> Edit
            </button>
          )}
        </div>
      </div>
      <div className="card-body">
        {children}
      </div>
    </div>
  );

  const renderInfoRow = (label, value, col = '1/2') => (
    <div style={{ gridColumn: col, marginBottom: '12px' }}>
      <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '2px', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '14px', color: 'var(--gray-800)', fontWeight: 500 }}>{renderValue(value)}</div>
    </div>
  );

  const renderEditDrawer = () => {
    if (!editSection) return null;

    const fields = {
      general: [
        { name: 'pharmacyName', label: 'Pharmacy Name', type: 'text', required: true },
        { name: 'ownerName', label: 'Owner Name', type: 'text', required: true },
        { name: 'contactPerson', label: 'Contact Person', type: 'text' },
        { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
        { name: 'email', label: 'Email Address', type: 'email', required: true },
        { name: 'address', label: 'Business Address', type: 'textarea' },
        { name: 'city', label: 'City', type: 'text' },
        { name: 'state', label: 'State', type: 'text' },
        { name: 'country', label: 'Country', type: 'text' },
        { name: 'postalCode', label: 'Postal Code', type: 'text' },
      ],
      settings: [
        { name: 'currency', label: 'Currency', type: 'select', options: CURRENCY_OPTIONS },
        { name: 'currencySymbol', label: 'Currency Symbol', type: 'text' },
        { name: 'timezone', label: 'Time Zone', type: 'select', options: TIMEZONE_OPTIONS },
        { name: 'dateFormat', label: 'Date Format', type: 'text' },
        { name: 'language', label: 'Language', type: 'select', options: LANGUAGES },
        { name: 'financialYearStart', label: 'Financial Year Start', type: 'text' },
      ],
      license: [
        { name: 'licenseNumber', label: 'Drug License Number', type: 'text' },
        { name: 'gstNumber', label: 'GST Number / Tax Number', type: 'text' },
        { name: 'registrationNumber', label: 'Registration Number', type: 'text' },
        { name: 'licenseExpiryDate', label: 'License Expiry Date', type: 'date' },
      ],
      store: [
        { name: 'storeOpenTime', label: 'Store Opening Time', type: 'time' },
        { name: 'storeCloseTime', label: 'Store Closing Time', type: 'time' },
        { name: 'weeklyOffDay', label: 'Weekly Off Day', type: 'select', options: WEEKLY_OFF_DAYS.map(d => ({ value: d, label: d })) },
        { name: 'emergencyContact', label: 'Emergency Contact', type: 'tel' },
      ],
      invoice: [
        { name: 'invoiceHeaderName', label: 'Invoice Header Name', type: 'text' },
        { name: 'invoiceFooterText', label: 'Invoice Footer Text', type: 'textarea' },
        { name: 'invoiceAddress', label: 'Invoice Address', type: 'textarea' },
        { name: 'invoiceContactInfo', label: 'Invoice Contact Info', type: 'text' },
      ],
    };

    const currentFields = fields[editSection] || [];
    const sectionTitles = {
      general: 'Business Information',
      settings: 'Business Settings',
      license: 'License & Compliance',
      store: 'Store Information',
      invoice: 'Invoice & Branding',
    };

    return (
      <Drawer
        isOpen={!!editSection}
        onClose={() => setEditSection(null)}
        title={<><i className="fa-solid fa-pen" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>Edit {sectionTitles[editSection]}</>}
        width="600px"
        footer={
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setEditSection(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</> : <><i className="fa-solid fa-save"></i> Save Changes</>}
            </button>
          </div>
        }
      >
        <div style={{ padding: '4px 0' }}>
          {currentFields.map(field => (
            <div className="form-group" key={field.name} style={{ marginBottom: '16px' }}>
              <label style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px', display: 'block' }}>
                {field.label}{field.required && ' *'}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  name={field.name}
                  value={editForm[field.name] || ''}
                  onChange={handleChange}
                  rows={3}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical' }}
                />
              ) : field.type === 'select' ? (
                <select
                  name={field.name}
                  value={editForm[field.name] || field.options?.[0]?.value || ''}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' }}
                >
                  {field.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  name={field.name}
                  value={editForm[field.name] || ''}
                  onChange={handleChange}
                  required={field.required}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' }}
                />
              )}
            </div>
          ))}
        </div>
      </Drawer>
    );
  };

  // ---------- Section: Subscription Info ----------
  const renderSubscription = () => {
    const plan = pharmacy?.subscriptionPlan || 'Free';
    const status = daysRemaining !== null ? (daysRemaining > 0 ? 'Active' : 'Expired') : 'Active';
    const statusColor = daysRemaining !== null ? (daysRemaining > 3 ? '#16a34a' : daysRemaining > 0 ? '#f59e0b' : '#dc2626') : '#16a34a';

    return renderCard(
      'Subscription Information',
      'fa-credit-card',
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--gray-800)', marginBottom: '4px', textTransform: 'capitalize' }}>{plan}</div>
            <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Current Plan</div>
          </div>
          <div style={{ padding: '16px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: statusColor }}>{status}</div>
            <div style={{ fontSize: '12px', color: statusColor }}>Status</div>
          </div>
          {daysRemaining !== null && (
            <div style={{ padding: '16px', borderRadius: '8px', background: daysRemaining > 3 ? '#f8fafc' : '#fff7ed', border: `1px solid ${daysRemaining > 3 ? '#e2e8f0' : '#fed7aa'}`, textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: daysRemaining > 3 ? 'var(--gray-800)' : '#ea580c' }}>{daysRemaining > 0 ? daysRemaining : 0}</div>
              <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Days Remaining</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--gray-500)' }}>
          <span><strong>Start:</strong> {fmtDate(pharmacy?.subscriptionStartDate)}</span>
          <span><strong>Expiry:</strong> {fmtDate(pharmacy?.subscriptionEndDate)}</span>
        </div>
      </div>,
      null,
      <a href="/subscriptions" className="btn btn-outline btn-sm">
        <i className="fa-solid fa-clock-rotate-left"></i> History
      </a>
    );
  };

  // ---------- Section: Business Statistics ----------
  const renderStats = () => {
    const sym = getCurrentSymbol();
    const ds = dashboardStats || {};
    const stats = [
      { icon: 'fa-pills', label: 'Total Medicines', count: ds.totalMedicines ?? '—', color: '#3b82f6', bg: '#eff6ff', link: '/medicines' },
      { icon: 'fa-users', label: 'Total Customers', count: ds.totalCustomers ?? '—', color: '#16a34a', bg: '#f0fdf4', link: '/customers' },
      { icon: 'fa-truck', label: 'Total Suppliers', count: ds.totalSuppliers ?? '—', color: '#f59e0b', bg: '#fff7ed', link: '/suppliers' },
      { icon: 'fa-cash-register', label: 'Total Sales', count: ds.totalSales ?? '—', color: '#8b5cf6', bg: '#f5f3ff', link: '/sales' },
      { icon: 'fa-cart-plus', label: 'Total Purchases', count: ds.totalPurchases ?? '—', color: '#ec4899', bg: '#fdf2f8', link: '/purchases' },
      { icon: 'fa-coins', label: 'Total Revenue', count: ds.totalRevenue ? `${sym}${Number(ds.totalRevenue).toLocaleString('en-IN')}` : '—', color: '#06b6d4', bg: '#ecfeff', link: '/reports' },
      { icon: 'fa-chart-line', label: 'Total Profit', count: ds.totalProfit ? `${sym}${Number(ds.totalProfit).toLocaleString('en-IN')}` : '—', color: '#10b981', bg: '#ecfdf5', link: '/reports' },
    ];

    return renderCard(
      'Business Statistics',
      'fa-chart-bar',
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
        {stats.map((s, i) => (
          <a key={i} href={s.link} style={{ textDecoration: 'none', padding: '14px', borderRadius: '8px', background: s.bg, textAlign: 'center', transition: 'transform 0.15s', display: 'block' }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'none'}
          >
            <i className={`fa-solid ${s.icon}`} style={{ fontSize: '22px', color: s.color, marginBottom: '6px' }}></i>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gray-800)' }}>{s.count}</div>
            <div style={{ fontSize: '11px', color: 'var(--gray-500)', marginTop: '2px' }}>{s.label}</div>
          </a>
        ))}
      </div>
    );
  };

  // ---------- Section: Backup & Security ----------
  const renderSecurity = () => renderCard(
    'Backup & Security',
    'fa-shield-halved',
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <i className="fa-solid fa-database" style={{ color: 'var(--primary)' }}></i>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Last Backup</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: pharmacy?.lastBackupDate ? 'var(--gray-700)' : 'var(--gray-400)', fontStyle: !pharmacy?.lastBackupDate ? 'italic' : 'normal' }}>
              {pharmacy?.lastBackupDate ? fmtDateTime(pharmacy.lastBackupDate) : 'No backup available'}
            </div>
          </div>
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <i className="fa-solid fa-user-lock" style={{ color: 'var(--gray-500)' }}></i>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Account Role</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gray-700)', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <i className="fa-solid fa-clock" style={{ color: 'var(--gray-500)' }}></i>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Last Login</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: user?.lastLogin ? 'var(--gray-700)' : 'var(--gray-400)', fontStyle: !user?.lastLogin ? 'italic' : 'normal' }}>
              {user?.lastLogin ? fmtDateTime(user.lastLogin) : 'No login history available'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const InfoGrid = ({ children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px 24px' }}>
      {children}
    </div>
  );

  // ===== SUPER ADMIN: Simple user profile =====
  if (isSuperAdmin) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h2><i className="fa-solid fa-user-shield" style={{ marginRight: '10px', color: '#f59e0b' }}></i>My Profile</h2>
            <p>Manage your account information</p>
          </div>
          {!userEditing && (
            <button className="btn btn-primary" onClick={() => setUserEditing(true)}>
              <i className="fa-solid fa-edit"></i> Edit Profile
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '30px' }}>
              <div className="avatar" style={{ width: '80px', height: '80px', fontSize: '32px', margin: '0 auto 16px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <h4>{user?.name}</h4>
              <p style={{ color: 'var(--gray-500)' }}>{user?.email}</p>
              <span className="badge badge-warning" style={{ textTransform: 'capitalize', marginTop: '8px', display: 'inline-block' }}>
                Super Admin
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h5>Account Information</h5></div>
            <div className="card-body">
              {userEditing ? (
                <form onSubmit={handleUserSave}>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input type="text" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} placeholder="Enter phone number" />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
                    <small style={{ color: 'var(--gray-500)' }}>Email cannot be changed</small>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setUserEditing(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={userSaving}>
                      {userSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-save"></i>} Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="profile-info-row">
                    <div className="profile-info-label">Full Name</div>
                    <div>{user?.name}</div>
                  </div>
                  <div className="profile-info-row">
                    <div className="profile-info-label">Email</div>
                    <div>{user?.email}</div>
                  </div>
                  <div className="profile-info-row">
                    <div className="profile-info-label">Phone</div>
                    <div>{user?.phone || '-'}</div>
                  </div>
                  <div className="profile-info-row">
                    <div className="profile-info-label">Role</div>
                    <div style={{ textTransform: 'capitalize' }}>Super Admin</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== ADMIN: Full pharmacy profile =====
  if (!pharmacy) {
    return (
      <div className="empty-state" style={{ padding: '60px' }}>
        <i className="fa-solid fa-building" style={{ fontSize: '48px', color: 'var(--gray-300)', marginBottom: '16px' }}></i>
        <h4>No Profile Data</h4>
        <p>Pharmacy profile data is not available for your account type.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={handleLogoUpload}>
            {pharmacy.logo ? (
              <img src={pharmacy.logo} alt="Logo" style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--gray-200)' }} />
            ) : (
              <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: 'var(--primary)', border: '2px dashed var(--primary)' }}>
                <i className="fa-solid fa-building"></i>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>{pharmacy.pharmacyName}</h2>
            <p style={{ color: 'var(--gray-500)', margin: '4px 0 0' }}>{pharmacy.address}, {pharmacy.city} {pharmacy.state} — {renderValue(pharmacy.postalCode)}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        {/* Left Column */}
        <div>
          {/* Business Information */}
          {renderCard(
            'Business Information',
            'fa-building',
            <InfoGrid>
              {renderInfoRow('Pharmacy Name', pharmacy.pharmacyName)}
              {renderInfoRow('Owner Name', pharmacy.ownerName)}
              {renderInfoRow('Contact Person', pharmacy.contactPerson)}
              {renderInfoRow('Phone Number', pharmacy.phone)}
              {renderInfoRow('Email Address', pharmacy.email)}
              {renderInfoRow('Address', pharmacy.address, '1/3')}
              {renderInfoRow('City', pharmacy.city)}
              {renderInfoRow('State', pharmacy.state)}
              {renderInfoRow('Country', pharmacy.country)}
              {renderInfoRow('Postal Code', pharmacy.postalCode)}
            </InfoGrid>,
            'general'
          )}

          {/* License & Compliance */}
          {renderCard(
            'License & Compliance',
            'fa-certificate',
            <InfoGrid>
              {renderInfoRow('Drug License Number', pharmacy.licenseNumber)}
              {renderInfoRow('GST Number', pharmacy.gstNumber)}
              {renderInfoRow('Registration Number', pharmacy.registrationNumber)}
              {renderInfoRow('License Expiry Date', fmtDate(pharmacy.licenseExpiryDate))}
              {renderInfoRow('Registration Certificate', pharmacy.registrationCertificate ? 'Uploaded' : null)}
            </InfoGrid>,
            'license'
          )}

          {/* Subscription */}
          {renderSubscription()}
        </div>

        {/* Right Column */}
        <div>
          {/* Business Settings */}
          {renderCard(
            'Business Settings',
            'fa-sliders',
            <InfoGrid>
              {renderInfoRow('Currency', `${pharmacy.currency} (${pharmacy.currencySymbol})`)}
              {renderInfoRow('Time Zone', pharmacy.timezone)}
              {renderInfoRow('Date Format', pharmacy.dateFormat)}
              {renderInfoRow('Language', pharmacy.language)}
              {renderInfoRow('Financial Year Start', pharmacy.financialYearStart)}
            </InfoGrid>,
            // 'settings'
          )}

          {/* Store Information */}
          {renderCard(
            'Store Information',
            'fa-clock',
            <InfoGrid>
              {renderInfoRow('Opening Time', pharmacy.storeOpenTime)}
              {renderInfoRow('Closing Time', pharmacy.storeCloseTime)}
              {renderInfoRow('Weekly Off Day', pharmacy.weeklyOffDay)}
              {renderInfoRow('Emergency Contact', pharmacy.emergencyContact)}
            </InfoGrid>,
            'store'
          )}

          {/* Invoice & Branding */}
          {renderCard(
            'Invoice & Branding',
            'fa-file-invoice',
            <InfoGrid>
              {renderInfoRow('Invoice Header Name', pharmacy.invoiceHeaderName || pharmacy.pharmacyName)}
              {renderInfoRow('Invoice Footer Text', pharmacy.invoiceFooterText)}
              {renderInfoRow('Invoice Address', pharmacy.invoiceAddress || pharmacy.address)}
              {renderInfoRow('Invoice Contact', pharmacy.invoiceContactInfo || pharmacy.phone)}
              {renderInfoRow('Invoice Template', pharmacy.invoiceSettings?.invoiceTemplate || 'Classic')}
              {renderInfoRow('Print Format', pharmacy.invoiceSettings?.printFormat || 'A4')}
            </InfoGrid>,
            'invoice'
          )}

          {/* Statistics */}
          {renderStats()}

          {/* Backup & Security */}
          {renderSecurity()}
        </div>
      </div>

      {renderEditDrawer()}
    </div>
  );
}