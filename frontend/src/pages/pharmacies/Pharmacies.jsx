import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPharmacies,
  createPharmacy,
  updatePharmacy,
  deletePharmacy,
  togglePharmacyStatus,
} from '../../redux/slices/pharmacySlice';
import { fetchActivePlans } from '../../redux/slices/subscriptionPlanSlice';
import Drawer from '../../components/common/Drawer';
import { pharmacyService } from '../../services/pharmacyService';
import { countryService } from '../../services/countryService';
import { showSuccess, showError, confirmDelete, showConfirm } from '../../utils/sweetAlert';

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
  country: 'IN',
};

// Country data for auto-filling localization info
// Country data for auto-filling localization info — raw values, not display strings
const COUNTRY_LOCALE_MAP = {
  IN: { currency: 'INR', currencySymbol: '₹', timezone: 'Asia/Kolkata', dateFormat: 'DD/MM/YYYY' },
  US: { currency: 'USD', currencySymbol: '$', timezone: 'America/New_York', dateFormat: 'MM/DD/YYYY' },
  GB: { currency: 'GBP', currencySymbol: '£', timezone: 'Europe/London', dateFormat: 'DD/MM/YYYY' },
  AE: { currency: 'AED', currencySymbol: 'د.إ', timezone: 'Asia/Dubai', dateFormat: 'DD/MM/YYYY' },
  SA: { currency: 'SAR', currencySymbol: '﷼', timezone: 'Asia/Riyadh', dateFormat: 'DD/MM/YYYY' },
  EU: { currency: 'EUR', currencySymbol: '€', timezone: 'Europe/Berlin', dateFormat: 'DD/MM/YYYY' },
  PK: { currency: 'PKR', currencySymbol: '₨', timezone: 'Asia/Karachi', dateFormat: 'DD/MM/YYYY' },
  BD: { currency: 'BDT', currencySymbol: '৳', timezone: 'Asia/Dhaka', dateFormat: 'DD/MM/YYYY' },
  LK: { currency: 'LKR', currencySymbol: '₨', timezone: 'Asia/Colombo', dateFormat: 'DD/MM/YYYY' },
  NP: { currency: 'NPR', currencySymbol: '₨', timezone: 'Asia/Kathmandu', dateFormat: 'DD/MM/YYYY' },
  PH: { currency: 'PHP', currencySymbol: '₱', timezone: 'Asia/Manila', dateFormat: 'MM/DD/YYYY' },
  MY: { currency: 'MYR', currencySymbol: 'RM', timezone: 'Asia/Kuala_Lumpur', dateFormat: 'DD/MM/YYYY' },
  SG: { currency: 'SGD', currencySymbol: 'S$', timezone: 'Asia/Singapore', dateFormat: 'DD/MM/YYYY' },
  AU: { currency: 'AUD', currencySymbol: 'A$', timezone: 'Australia/Sydney', dateFormat: 'DD/MM/YYYY' },
  CA: { currency: 'CAD', currencySymbol: 'C$', timezone: 'America/Toronto', dateFormat: 'YYYY-MM-DD' },
};

export default function Pharmacies() {
  const dispatch = useDispatch();
  const { items, total, loading } = useSelector((state) => state.pharmacies);
  const { activePlans } = useSelector((state) => state.subscriptionPlans);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewPharmacy, setViewPharmacy] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [localActivePlans, setLocalActivePlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState({});
  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(true);

  const toggleRow = (tableKey, rowIdx) => {
    const key = `${tableKey}-${rowIdx}`;
    setExpandedRows(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isRowExpanded = (tableKey, rowIdx) => {
    return !!expandedRows[`${tableKey}-${rowIdx}`];
  };

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

  // Load countries for dropdown
  useEffect(() => {
    setCountriesLoading(true);
    countryService.getCountries().then((res) => {
      if (res.data?.data) {
        setCountries(res.data.data);
      }
      setCountriesLoading(false);
    }).catch(() => {
      setCountriesLoading(false);
    });
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleSearch = (e) => setSearch(e.target.value);

  const openCreateDrawer = () => {
    setEditing(null);
    setFormData({ ...initialFormState });
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
      country: pharmacy.country || 'IN',
      currency: pharmacy.currency || 'INR',
      currencySymbol: pharmacy.currencySymbol || '₹',
      timezone: pharmacy.timezone || 'Asia/Kolkata',
      dateFormat: pharmacy.dateFormat || 'DD/MM/YYYY',
    });
    setDrawerOpen(true);
  };

  const openViewDrawer = (pharmacy) => {
    // Fetch full pharmacy details including admin info
    pharmacyService.getPharmacy(pharmacy._id).then((res) => {
      if (res.data?.data) {
        setViewPharmacy(res.data.data);
      } else {
        setViewPharmacy(pharmacy);
      }
    }).catch(() => {
      setViewPharmacy(pharmacy);
    });
    setViewDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
  };

  const closeViewDrawer = () => {
    setViewDrawerOpen(false);
    setViewPharmacy(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // When country changes, auto-populate currency, symbol, timezone, and dateFormat
    if (name === 'country' && COUNTRY_LOCALE_MAP[value]) {
      const locale = COUNTRY_LOCALE_MAP[value];
      setFormData(prev => ({
        ...prev,
        country: value,
        currency: locale.currency,
        currencySymbol: locale.currencySymbol,
        timezone: locale.timezone,
        dateFormat: locale.dateFormat,
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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
          country: formData.country,
          currency: formData.currency,
          currencySymbol: formData.currencySymbol,
          timezone: formData.timezone,
          dateFormat: formData.dateFormat,
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

  const handleToggleStatus = async (pharmacy) => {
    const newStatus = pharmacy.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';

    const confirmed = await showConfirm(
      `${action === 'deactivate' ? 'Deactivate' : 'Activate'} Pharmacy`,
      action === 'deactivate'
        ? `Are you sure you want to deactivate "${pharmacy.pharmacyName}"? All users of this pharmacy will be blocked from logging in.`
        : `Are you sure you want to activate "${pharmacy.pharmacyName}"? All users will be able to log in again.`,
      action === 'deactivate' ? 'warning' : 'question'
    );
    if (!confirmed) return;

    try {
      await dispatch(togglePharmacyStatus({ id: pharmacy._id, status: newStatus })).unwrap();
      showSuccess(`Pharmacy ${action}d successfully`);
      loadPharmacies();
    } catch (error) {
      showError(error || `Failed to ${action} pharmacy`);
    }
  };

  const handleDelete = async (id, pharmacyName) => {
    const confirmed = await confirmDelete(`"${pharmacyName}" pharmacy`);
    if (!confirmed) return;
    try {
      await dispatch(deletePharmacy(id)).unwrap();
      showSuccess('Pharmacy deleted successfully');
      loadPharmacies();
    } catch (error) {
      showError(error || 'Failed to delete pharmacy');
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
            <>
              {/* Desktop table */}
              <div className="customer-desktop-table">
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
                              <button className="btn btn-info btn-sm" onClick={() => openViewDrawer(pharmacy)} title="View Details">
                                <i className="fa-solid fa-eye"></i>
                              </button>
                              <button className="btn btn-warning btn-sm" onClick={() => openEditDrawer(pharmacy)} title="Edit">
                                <i className="fa-solid fa-edit"></i>
                              </button>
                              <button
                                className={`btn btn-sm ${pharmacy.status === 'active' ? 'btn-secondary' : 'btn-success'}`}
                                onClick={() => handleToggleStatus(pharmacy)}
                                title={pharmacy.status === 'active' ? 'Deactivate' : 'Activate'}
                              >
                                <i className={`fa-solid ${pharmacy.status === 'active' ? 'fa-pause' : 'fa-play'}`}></i>
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(pharmacy._id, pharmacy.pharmacyName)} title="Delete">
                                <i className="fa-solid fa-trash"></i>
                              </button>
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
                      <th>Status</th>
                      <th className="customer-expand-th"></th>
                    </tr>
                  </thead>
                  {items.map((pharmacy, idx) => {
                    const expanded = isRowExpanded('pharmacy', idx);
                    const mainCols = [
                      { render: (p) => <span style={{ fontWeight: 500, fontSize: '13px' }}>{p.pharmacyName}</span> },
                      { render: (p) => <span className={`badge ${getStatusBadge(p.status)}`} style={{ textTransform: 'capitalize', fontSize: '10px' }}>{p.status}</span> },
                    ];
                    const detailRows = [
                      { label: 'Owner', render: (p) => p.ownerName },
                      { label: 'Email', render: (p) => p.email },
                      { label: 'Phone', render: (p) => p.phone },
                      { label: 'License', render: (p) => p.licenseNumber || '-' },
                      { label: 'Plan', render: (p) => <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{p.subscriptionPlan}</span> },
                      {
                        label: 'Actions', render: (p) => (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button className="btn btn-info btn-sm" onClick={(e) => { e.stopPropagation(); openViewDrawer(p); }} title="View Details">
                              <i className="fa-solid fa-eye"></i>
                            </button>
                            <button className="btn btn-warning btn-sm" onClick={(e) => { e.stopPropagation(); openEditDrawer(p); }} title="Edit">
                              <i className="fa-solid fa-edit"></i>
                            </button>
                            <button
                              className={`btn btn-sm ${p.status === 'active' ? 'btn-secondary' : 'btn-success'}`}
                              onClick={(e) => { e.stopPropagation(); handleToggleStatus(p); }}
                              title={p.status === 'active' ? 'Deactivate' : 'Activate'}
                            >
                              <i className={`fa-solid ${p.status === 'active' ? 'fa-pause' : 'fa-play'}`}></i>
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(p._id, p.pharmacyName); }} title="Delete">
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        )
                      },
                    ];
                    return renderExpandableRow(pharmacy, idx, 'pharmacy', expanded, () => toggleRow('pharmacy', idx), mainCols, detailRows);
                  })}
                </table>
              </div>
            </>
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

      {/* Create/Edit Drawer */}
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

          {/* Country Selection */}
          {/* Location & Localization - visible in both create and edit */}
          <hr style={{ margin: '20px 0', borderColor: 'var(--gray-200)' }} />
          <h4 style={{ color: 'var(--primary-color)', marginBottom: '16px' }}>
            <i className="fa-solid fa-globe"></i> {editing ? 'Localization Settings' : 'Location & Localization'}
          </h4>
          {!editing && (
            <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '8px' }}>
              Select the country where this pharmacy operates. Currency, timezone, and date format will be automatically configured based on your selection.
            </p>
          )}
          <div className="form-group">
            <label>Country *</label>
            <select
              name="country"
              value={formData.country}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--gray-300)' }}
            >
              {countriesLoading ? (
                <option value="">Loading countries...</option>
              ) : countries.length > 0 ? (
                countries.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))
              ) : (
                <>
                  <option value="">-- Select Country --</option>
                      {Object.entries(COUNTRY_LOCALE_MAP).map(([code, data]) => {
                        const countryNames = { IN:'India', US:'United States', GB:'United Kingdom', AE:'United Arab Emirates', SA:'Saudi Arabia', EU:'European Union', PK:'Pakistan', BD:'Bangladesh', LK:'Sri Lanka', NP:'Nepal', PH:'Philippines', MY:'Malaysia', SG:'Singapore', AU:'Australia', CA:'Canada' };
                        return (
                          <option key={code} value={code}>
                            {countryNames[code] || code} ({data.currency} {data.currencySymbol})
                          </option>
                        );
                      })}
                </>
              )}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label>Currency</label>
              <input type="text" name="currency" value={formData.currency} onChange={handleChange} placeholder="e.g. INR, BDT, USD" />
            </div>
            <div className="form-group">
              <label>Currency Symbol</label>
              <input type="text" name="currencySymbol" value={formData.currencySymbol} onChange={handleChange} placeholder="e.g. ₹, ৳, $" />
            </div>
          </div>
          <div className="form-group">
            <label>Timezone</label>
            <input type="text" name="timezone" value={formData.timezone} onChange={handleChange} placeholder="e.g. Asia/Kolkata" />
          </div>
          <div className="form-group">
            <label>Date Format</label>
            <input type="text" name="dateFormat" value={formData.dateFormat} onChange={handleChange} placeholder="e.g. DD/MM/YYYY" />
          </div>

          {!editing && COUNTRY_LOCALE_MAP[formData.country] && (
            <div style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              border: '1px solid #bae6fd',
              marginTop: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: '#3b82f6', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}>
                  <i className="fa-solid fa-coins" style={{ color: '#fff', fontSize: '16px' }}></i>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e40af', marginBottom: '6px' }}>
                    Auto-Configured Localization
                  </div>
                  <div style={{ fontSize: '13px', color: '#3b82f6', lineHeight: 1.8 }}>
                    <div><strong>Currency:</strong> {COUNTRY_LOCALE_MAP[formData.country].currency}</div>
                    <div><strong>Timezone:</strong> {COUNTRY_LOCALE_MAP[formData.country].timezone}</div>
                    <div><strong>Date Format:</strong> {COUNTRY_LOCALE_MAP[formData.country].dateFormat}</div>
                  </div>
                  {editing && (
                    <div style={{ fontSize: '11px', color: '#60a5fa', marginTop: '6px', fontStyle: 'italic' }}>
                      These values can be modified later by the platform administrator.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
            </>
          )}
        </form>
      </Drawer>

      {/* View Details Drawer */}
      <Drawer
        isOpen={viewDrawerOpen}
        onClose={closeViewDrawer}
        title={viewPharmacy ? `Pharmacy Details - ${viewPharmacy.pharmacyName}` : 'Pharmacy Details'}
        footer={
          <button type="button" className="btn btn-secondary" onClick={closeViewDrawer}>Close</button>
        }
      >
        {viewPharmacy && (
          <div style={{ padding: '4px 0' }}>
            {/* Status Banner */}
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              backgroundColor: viewPharmacy.status === 'active' ? '#e8f5e9' : '#fff3e0',
              border: `1px solid ${viewPharmacy.status === 'active' ? '#a5d6a7' : '#ffcc80'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <i className={`fa-solid ${viewPharmacy.status === 'active' ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}
                style={{ fontSize: '24px', color: viewPharmacy.status === 'active' ? '#4caf50' : '#ff9800' }}></i>
              <div>
                <strong style={{ fontSize: '15px', color: viewPharmacy.status === 'active' ? '#2e7d32' : '#e65100' }}>
                  {viewPharmacy.status === 'active' ? 'Active' : 'Inactive'}
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#666' }}>
                  {viewPharmacy.status === 'active'
                    ? 'This pharmacy is active and all users can log in.'
                    : 'This pharmacy is deactivated. Users cannot log in.'}
                </p>
              </div>
            </div>

            {/* Pharmacy Information Card */}
            <div className="card" style={{ marginBottom: '16px', border: '1px solid var(--gray-200)' }}>
              <div className="card-header" style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid var(--gray-200)' }}>
                <h6 style={{ margin: 0, color: 'var(--primary-color)' }}>
                  <i className="fa-solid fa-hospital"></i> Pharmacy Information
                </h6>
              </div>
              <div className="card-body" style={{ padding: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Pharmacy Code</label>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{viewPharmacy.pharmacyCode || viewPharmacy._id?.slice(-6).toUpperCase() || 'N/A'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Pharmacy Name</label>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{viewPharmacy.pharmacyName}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Owner Name</label>
                    <span style={{ fontSize: '14px' }}>{viewPharmacy.ownerName}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Email</label>
                    <span style={{ fontSize: '14px' }}>{viewPharmacy.email}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Phone</label>
                    <span style={{ fontSize: '14px' }}>{viewPharmacy.phone}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>License Number</label>
                    <span style={{ fontSize: '14px' }}>{viewPharmacy.licenseNumber || 'N/A'}</span>
                  </div>
                </div>
                <div style={{ marginTop: '12px' }}>
                  <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Address</label>
                  <span style={{ fontSize: '14px' }}>{viewPharmacy.address || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Pharmacy Admin Card */}
            <div className="card" style={{ marginBottom: '16px', border: '1px solid var(--gray-200)' }}>
              <div className="card-header" style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid var(--gray-200)' }}>
                <h6 style={{ margin: 0, color: 'var(--primary-color)' }}>
                  <i className="fa-solid fa-user-shield"></i> Pharmacy Admin
                </h6>
              </div>
              <div className="card-body" style={{ padding: '16px' }}>
                {viewPharmacy.pharmacyAdmin ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Admin Name</label>
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>{viewPharmacy.pharmacyAdmin.name}</span>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Admin Email</label>
                      <span style={{ fontSize: '14px' }}>{viewPharmacy.pharmacyAdmin.email}</span>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>No admin assigned</p>
                )}
              </div>
            </div>

            {/* Localization Card */}
            <div className="card" style={{ marginBottom: '16px', border: '1px solid var(--gray-200)' }}>
              <div className="card-header" style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid var(--gray-200)' }}>
                <h6 style={{ margin: 0, color: 'var(--primary-color)' }}>
                  <i className="fa-solid fa-globe"></i> Localization Settings
                </h6>
              </div>
              <div className="card-body" style={{ padding: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Country</label>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{viewPharmacy.country || 'N/A'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Currency</label>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{viewPharmacy.currency || 'N/A'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Currency Symbol</label>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{viewPharmacy.currencySymbol || 'N/A'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Timezone</label>
                    <span style={{ fontSize: '14px' }}>{viewPharmacy.timezone || 'N/A'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Date Format</label>
                    <span style={{ fontSize: '14px' }}>{viewPharmacy.dateFormat || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription Card */}
            <div className="card" style={{ marginBottom: '16px', border: '1px solid var(--gray-200)' }}>
              <div className="card-header" style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid var(--gray-200)' }}>
                <h6 style={{ margin: 0, color: 'var(--primary-color)' }}>
                  <i className="fa-solid fa-credit-card"></i> Subscription Details
                </h6>
              </div>
              <div className="card-body" style={{ padding: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Subscription Plan</label>
                    <span className={`badge ${viewPharmacy.subscriptionPlan === 'free' ? 'badge-secondary' : 'badge-info'}`} style={{ textTransform: 'capitalize' }}>
                      {viewPharmacy.subscriptionPlan}
                    </span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Subscription Status</label>
                    <span className={`badge ${getStatusBadge(viewPharmacy.status)}`} style={{ textTransform: 'capitalize' }}>
                      {viewPharmacy.status}
                    </span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Start Date</label>
                    <span style={{ fontSize: '14px' }}>{viewPharmacy.subscriptionStartDate ? new Date(viewPharmacy.subscriptionStartDate).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>End Date</label>
                    <span style={{ fontSize: '14px' }}>{viewPharmacy.subscriptionEndDate ? new Date(viewPharmacy.subscriptionEndDate).toLocaleDateString() : 'No end date'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* System Info Card */}
            <div className="card" style={{ marginBottom: '16px', border: '1px solid var(--gray-200)' }}>
              <div className="card-header" style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid var(--gray-200)' }}>
                <h6 style={{ margin: 0, color: 'var(--primary-color)' }}>
                  <i className="fa-solid fa-circle-info"></i> System Information
                </h6>
              </div>
              <div className="card-body" style={{ padding: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Total Users</label>
                    <span style={{ fontSize: '14px' }}>—</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Created Date</label>
                    <span style={{ fontSize: '14px' }}>{viewPharmacy.createdAt ? new Date(viewPharmacy.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Last Updated</label>
                    <span style={{ fontSize: '14px' }}>{viewPharmacy.updatedAt ? new Date(viewPharmacy.updatedAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '2px' }}>Status</label>
                    <span className={`badge ${getStatusBadge(viewPharmacy.status)}`} style={{ textTransform: 'capitalize' }}>
                      {viewPharmacy.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}