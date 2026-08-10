import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CurrencyDisplay from '../../components/common/CurrencyDisplay';
import { showSuccess, showError } from '../../utils/sweetAlert';
import { settingService } from '../../services/settingService';
import { invoiceSettingService } from '../../services/invoiceSettingService';
import { INVOICE_TEMPLATES, PRINT_FORMATS } from '../../utils/invoiceTemplates';
import { useAuth } from '../../hooks/useAuth';
import { INDIAN_STATES, getStateCodeByName } from '../../utils/indianStates';
import { pharmacyService } from '../../services/pharmacyService';
import { dashboardService } from '../../services/dashboardService';
import { subscriptionHistoryService } from '../../services/subscriptionHistoryService';
import SettingsSkeleton from '../../components/common/SettingsSkeleton';

/* ============================================================
   Module-level caches — each Settings section loads its data
   ONCE and reuses it on subsequent mounts. This prevents the
   full-page reload / data re-fetch issue entirely.
   ============================================================ */
const shopCache = { loaded: false, data: null };
const gstCache = { loaded: false, data: null };
const invoiceCache = { loaded: false, data: null };
const subCache = { loaded: false, data: null };

const GST_RATE_OPTIONS = [0, 5, 12, 18, 28];

/* ============================================================
   NAV ITEMS
   ============================================================ */
const NAV_ITEMS = [
  { id: 'shop', label: 'Shop Settings', icon: 'fa-solid fa-store' },
  { id: 'gst', label: 'GST Settings', icon: 'fa-solid fa-percent' },
  { id: 'invoice', label: 'Invoice Settings', icon: 'fa-solid fa-file-invoice' },
];

/* ============================================================
   SHOP SETTINGS SECTION
   ============================================================ */
function ShopSettings() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!shopCache.loaded);

  useEffect(() => {
    if (shopCache.loaded && shopCache.data) {
      setForm(shopCache.data);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await pharmacyService.getMyPharmacyProfile();
        if (data.data && !cancelled) {
          const p = data.data;
          const shop = {
            pharmacyName: p.pharmacyName || '',
            phone: p.phone || '',
            email: p.email || '',
            address: p.address || '',
            state: p.state || '',
            gstin: p.gstin || p.gstNumber || '',
          };
          shopCache.data = shop;
          shopCache.loaded = true;
          setForm(shop);
        }
      } catch (err) {
        // Ignore — empty form will be shown
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await pharmacyService.updateMyPharmacyProfile({
        pharmacyName: form.pharmacyName,
        phone: form.phone,
        email: form.email,
        address: form.address,
        state: form.state,
        gstin: form.gstin,
        stateCode: getStateCodeByName(form.state) || '',
      });
      shopCache.data = { ...form };
      showSuccess('Shop settings saved successfully');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to save shop settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <SettingsSkeleton section="shop" />;
  }

  return (
    <div className="settings-section-content">
      <div className="settings-section-header">
        <h4><i className="fa-solid fa-store" style={{ color: 'var(--primary)' }}></i> Shop Settings</h4>
        <p>Manage your pharmacy business information</p>
      </div>
      <form onSubmit={handleSave}>
        <div className="settings-form-grid">
          <div className="form-group">
            <label>Shop Name</label>
            <input type="text" name="pharmacyName" value={form?.pharmacyName || ''} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input type="text" name="phone" value={form?.phone || ''} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" name="email" value={form?.email || ''} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>GSTIN</label>
            <input type="text" name="gstin" value={form?.gstin || ''} onChange={handleChange} placeholder="e.g. 27ABCDE1234F1Z5" />
          </div>
          <div className="form-group settings-form-full">
            <label>Address</label>
            <textarea name="address" value={form?.address || ''} onChange={handleChange} rows="2" />
          </div>
          <div className="form-group">
            <label>State</label>
            <select name="state" value={form?.state || ''} onChange={handleChange}>
              <option value="">Select state...</option>
              {INDIAN_STATES.map(s => (
                <option key={s.code} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="settings-save-bar">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-save"></i>}
            {saving ? ' Saving...' : ' Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   GST SETTINGS SECTION
   ============================================================ */
function GstSettings() {
  const [gstSettings, setGstSettings] = useState(gstCache.data || { state: '', stateCode: '', defaultGstRate: 18 });
  const [gstStateSearch, setGstStateSearch] = useState(gstCache.data?.state || '');
  const [gstStateDropdownOpen, setGstStateDropdownOpen] = useState(false);
  const gstStateSearchRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!gstCache.loaded);

  useEffect(() => {
    if (gstCache.loaded && gstCache.data) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await pharmacyService.getMyPharmacyProfile();
        if (data.data && !cancelled) {
          const state = data.data.state || '';
          const gst = {
            state,
            stateCode: data.data.stateCode || getStateCodeByName(state),
            defaultGstRate: data.data.defaultGstRate || 18,
          };
          gstCache.data = gst;
          gstCache.loaded = true;
          setGstSettings(gst);
          setGstStateSearch(state);
        }
      } catch (err) {
        // Use defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (gstStateSearchRef.current && !gstStateSearchRef.current.contains(event.target)) {
        setGstStateDropdownOpen(false);
      }
    };
    if (gstStateDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [gstStateDropdownOpen]);

  const filteredGstStates = INDIAN_STATES.filter(s =>
    s.name.toLowerCase().includes(gstStateSearch.toLowerCase())
  );

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await pharmacyService.updateMyPharmacyProfile({
        state: gstSettings.state,
        stateCode: gstSettings.stateCode || getStateCodeByName(gstSettings.state),
        defaultGstRate: gstSettings.defaultGstRate,
      });
      const gst = {
        state: data.data?.state || gstSettings.state,
        stateCode: data.data?.stateCode || gstSettings.stateCode,
        defaultGstRate: data.data?.defaultGstRate || gstSettings.defaultGstRate,
      };
      gstCache.data = gst;
      setGstSettings(gst);
      setGstStateSearch(gst.state);
      showSuccess('GST settings saved successfully');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to save GST settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <SettingsSkeleton section="gst" />;
  }

  return (
    <div className="settings-section-content">
      <div className="settings-section-header">
        <h4><i className="fa-solid fa-percent" style={{ color: 'var(--primary)' }}></i> GST Settings</h4>
        <p>Configure default GST rate and business state</p>
      </div>

      {/* GST Explanation Cards */}
      <div className="gst-explainer-grid">
        <div className="gst-explainer-card gst-intra-card">
          <i className="fa-solid fa-location-dot"></i>
          <div>
            <strong>Same State → CGST + SGST</strong>
            <p>When customer is in the same state, GST is split into Central GST (CGST) and State GST (SGST).</p>
          </div>
        </div>
        <div className="gst-explainer-card gst-inter-card">
          <i className="fa-solid fa-truck-fast"></i>
          <div>
            <strong>Different State → IGST</strong>
            <p>When customer is in a different state, Integrated GST (IGST) is applied.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="form-group">
          <label>Default Business State <span style={{ color: 'var(--danger)' }}>*</span></label>
          <div style={{ position: 'relative' }} ref={gstStateSearchRef}>
            <input
              type="text"
              className="form-select"
              value={gstStateSearch}
              onChange={(e) => {
                setGstStateSearch(e.target.value);
                setGstSettings(prev => ({ ...prev, state: '', stateCode: '' }));
                setGstStateDropdownOpen(true);
              }}
              onFocus={() => setGstStateDropdownOpen(true)}
              style={{ width: '100%' }}
              placeholder="Search Indian state..."
            />
            {gstStateDropdownOpen && (
              <div className="settings-state-dropdown">
                {filteredGstStates.length > 0 ? (
                  filteredGstStates.map(state => (
                    <div
                      key={state.code}
                      className={`settings-state-option ${gstSettings.state === state.name ? 'active' : ''}`}
                      onClick={() => {
                        setGstSettings(prev => ({ ...prev, state: state.name, stateCode: state.code }));
                        setGstStateSearch(state.name);
                        setGstStateDropdownOpen(false);
                      }}
                    >
                      <span>{state.name}</span>
                      <span className="settings-state-code">Code: {state.code}</span>
                    </div>
                  ))
                ) : (
                  <div className="settings-state-empty">No states found</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Default GST %</label>
          <div className="gst-rate-options">
            {GST_RATE_OPTIONS.map(rate => (
              <button
                key={rate}
                type="button"
                className={`gst-rate-btn ${gstSettings.defaultGstRate === rate ? 'active' : ''}`}
                onClick={() => setGstSettings(prev => ({ ...prev, defaultGstRate: rate }))}
              >
                {rate}%
              </button>
            ))}
          </div>
        </div>

        <div className="settings-save-bar">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-save"></i>}
            {saving ? ' Saving...' : ' Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   INVOICE SETTINGS SECTION
   ============================================================ */
function InvoiceSettings() {
  const [invoiceSettings, setInvoiceSettings] = useState(
    invoiceCache.data || { invoiceTemplate: 'classic', printFormat: 'a4' }
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!invoiceCache.loaded);

  useEffect(() => {
    if (invoiceCache.loaded && invoiceCache.data) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await invoiceSettingService.getMySettings();
        if (data.data && !cancelled) {
          const inv = {
            invoiceTemplate: data.data.invoiceTemplate || 'classic',
            printFormat: data.data.printFormat || 'a4',
          };
          invoiceCache.data = inv;
          invoiceCache.loaded = true;
          setInvoiceSettings(inv);
        }
      } catch (err) {
        // Use defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await invoiceSettingService.updateMySettings(invoiceSettings);
      const inv = {
        invoiceTemplate: data.data?.invoiceTemplate || invoiceSettings.invoiceTemplate,
        printFormat: data.data?.printFormat || invoiceSettings.printFormat,
      };
      invoiceCache.data = inv;
      setInvoiceSettings(inv);
      showSuccess('Invoice settings saved successfully');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to save invoice settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <SettingsSkeleton section="invoice" />;
  }

  return (
    <div className="settings-section-content">
      <div className="settings-section-header">
        <h4><i className="fa-solid fa-file-invoice" style={{ color: 'var(--primary)' }}></i> Invoice Settings</h4>
        <p>Configure invoice template and paper size</p>
      </div>

      <form onSubmit={handleSave}>
        <div className="form-group">
          <label>Invoice Template / Theme</label>
          <p className="settings-field-hint">Select the visual style used when printing invoices from the Sales page.</p>
          <div className="invoice-template-grid">
            {INVOICE_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className={`invoice-template-card ${invoiceSettings.invoiceTemplate === tpl.id ? 'active' : ''}`}
                onClick={() => setInvoiceSettings({ ...invoiceSettings, invoiceTemplate: tpl.id })}
              >
                <div className="invoice-template-preview">{tpl.preview}</div>
                <div className="invoice-template-name">{tpl.name}</div>
                <div className="invoice-template-desc">{tpl.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Print Format / Paper Size</label>
          <p className="settings-field-hint">Choose the paper format for printing invoices. Supports A4 printers and 58mm/80mm thermal printers.</p>
          <div className="invoice-format-grid">
            {PRINT_FORMATS.map((fmt) => (
              <div
                key={fmt.id}
                className={`invoice-format-card ${invoiceSettings.printFormat === fmt.id ? 'active' : ''}`}
                onClick={() => setInvoiceSettings({ ...invoiceSettings, printFormat: fmt.id })}
              >
                <div className="invoice-format-preview">{fmt.preview}</div>
                <div className="invoice-format-name">{fmt.name}</div>
                <div className="invoice-format-desc">{fmt.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-info-box">
          <i className="fa-solid fa-info-circle"></i>
          <span>
            The selected template and format will be applied automatically when printing invoices
            from the <strong>Sales</strong> page. Click <strong>Invoice</strong> on any sale to see the result.
          </span>
        </div>

        <div className="settings-save-bar">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-save"></i>}
            {saving ? ' Saving...' : ' Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   PROFILE SECTION — shows profile content directly in the
   Settings content area (same behavior as Shop/GST/Invoice)
   ============================================================ */
function ProfileSection() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await pharmacyService.getMyPharmacyProfile();
        if (data.data && !cancelled) {
          setProfile(data.data);
        }
      } catch (err) {
        // Use defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <SettingsSkeleton section="profile" />;
  }

  const infoItems = [
    { label: 'Pharmacy Name', value: profile?.pharmacyName || '-' },
    { label: 'Owner Name', value: profile?.ownerName || '-' },
    { label: 'Phone', value: profile?.phone || '-' },
    { label: 'Email', value: profile?.email || '-' },
    { label: 'Address', value: profile?.address || '-' },
    { label: 'City', value: profile?.city || '-' },
    { label: 'State', value: profile?.state || '-' },
    { label: 'GSTIN', value: profile?.gstin || profile?.gstNumber || '-' },
    { label: 'License Number', value: profile?.licenseNumber || '-' },
    { label: 'User Name', value: user?.name || '-' },
    { label: 'User Role', value: user?.role?.replace('_', ' ') || '-' },
    { label: 'User Phone', value: user?.phone || '-' },
  ];

  return (
    <div className="settings-section-content">
      <div className="settings-section-header">
        <h4><i className="fa-solid fa-user" style={{ color: 'var(--primary)' }}></i> Profile</h4>
        <p>Your pharmacy and account profile information</p>
      </div>
      <div className="subscription-info-grid">
        {infoItems.map((item) => (
          <div className="subscription-info-item" key={item.label}>
            <span className="subscription-info-label">{item.label}</span>
            <span className="subscription-info-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   SUBSCRIPTION SECTION
   ============================================================ */
function SubscriptionSection() {
  const { user } = useAuth();
  const [sub, setSub] = useState(subCache.data);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loading, setLoading] = useState(!subCache.loaded);
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    if (isSuperAdmin) {
      setLoading(false);
      setHistoryLoading(false);
      return;
    }
    if (subCache.loaded && subCache.data) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await dashboardService.getSubscriptionStatus();
        if (data.data && !cancelled) {
          subCache.data = data.data;
          subCache.loaded = true;
          setSub(data.data);
        }
      } catch (err) {
        // Use defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isSuperAdmin]);

  // Fetch subscription history
  useEffect(() => {
    if (isSuperAdmin) return;
    let cancelled = false;
    const loadHistory = async () => {
      try {
        const { data } = await subscriptionHistoryService.getMyHistory({ limit: 50 });
        if (data.data && !cancelled) {
          setHistory(data.data);
        }
      } catch (err) {
        // Use defaults
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };
    loadHistory();
    return () => { cancelled = true; };
  }, [isSuperAdmin]);

  if (loading) {
    return <SettingsSkeleton section="subscription" />;
  }

  const hasActiveSub = sub && sub.status === 'active' && sub.hasSubscription;

  const statusBadgeClass = (status) => {
    const map = {
      active: 'badge-success',
      upcoming: 'badge-info',
      expired: 'badge-danger',
      cancelled: 'badge-warning',
    };
    return map[status] || 'badge-info';
  };

  const formatDuration = (item) => {
    const unit = item.durationUnit || 'months';
    const label = unit === 'days' ? 'day' : unit === 'years' ? 'year' : 'month';
    return `${item.duration} ${label}${item.duration > 1 ? 's' : ''}`;
  };

  return (
    <div className="settings-section-content">
      <div className="settings-section-header">
        <h4><i className="fa-solid fa-credit-card" style={{ color: 'var(--primary)' }}></i> Subscription</h4>
        <p>View your current subscription status</p>
      </div>

      {hasActiveSub ? (
        <div className="subscription-status-card">
          <div className="subscription-status-badge active">
            <i className="fa-solid fa-check-circle"></i> Active
          </div>
          <div className="subscription-info-grid">
            <div className="subscription-info-item">
              <span className="subscription-info-label">Subscription</span>
              <span className="subscription-info-value">{sub.plan || 'Free Plan'}</span>
            </div>
            <div className="subscription-info-item">
              <span className="subscription-info-label">Plan</span>
              <span className="subscription-info-value">{sub.plan || 'Free Plan'}</span>
            </div>
            <div className="subscription-info-item">
              <span className="subscription-info-label">Status</span>
              <span className="subscription-info-value" style={{ color: '#16a34a' }}>{sub.status}</span>
            </div>
            <div className="subscription-info-item">
              <span className="subscription-info-label">Days Remaining</span>
              <span className="subscription-info-value">{sub.daysRemaining} day(s)</span>
            </div>
            <div className="subscription-info-item">
              <span className="subscription-info-label">Start Date</span>
              <span className="subscription-info-value">
                {sub.startDate ? new Date(sub.startDate).toLocaleDateString() : '-'}
              </span>
            </div>
            <div className="subscription-info-item">
              <span className="subscription-info-label">Expiry Date</span>
              <span className="subscription-info-value">
                {sub.endDate ? new Date(sub.endDate).toLocaleDateString() : '-'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="subscription-empty-card">
          <i className="fa-solid fa-circle-info"></i>
          <h5>No active subscription</h5>
          <p>Please contact the Super Admin to activate a subscription.</p>
        </div>
      )}

      {/* Subscription History */}
      <div style={{ marginTop: '24px' }}>
        <div className="settings-section-header" style={{ marginBottom: '16px' }}>
          <h4><i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--primary)' }}></i> Subscription History</h4>
          <p>Your previous subscription records</p>
        </div>

        {historyLoading ? (
          <SettingsSkeleton section="subscription" historyOnly />
        ) : history.length > 0 ? (
          <div className="table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Plan Name</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Duration</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item._id}>
                    <td style={{ fontWeight: 500 }}>{item.planName}</td>
                    <td>{new Date(item.startDate).toLocaleDateString()}</td>
                    <td>{new Date(item.endDate).toLocaleDateString()}</td>
                    <td>{formatDuration(item)}</td>
                    <td style={{ fontWeight: 600 }}>
                      <CurrencyDisplay value={item.amount || 0} />
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(item.status)}`} style={{ textTransform: 'capitalize' }}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {item.renewalDate ? new Date(item.renewalDate).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="subscription-empty-card" style={{ padding: '30px 20px' }}>
            <i className="fa-solid fa-clock-rotate-left"></i>
            <h5>No subscription history</h5>
            <p>Your subscription records will appear here.</p>
          </div>
        )}
      </div>

    </div>
  );
}

/* ============================================================
   MAIN SETTINGS PAGE
   ============================================================ */
export default function Settings() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = searchParams.get('section') || 'shop';

  const setSection = useCallback((section) => {
    if (section === 'shop') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ section }, { replace: true });
    }
  }, [setSearchParams]);

  // Super Admin sees full platform settings (existing tabbed UI)
  if (isSuperAdmin) {
    return <SuperAdminSettings />;
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-sliders" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>Settings</h2>
          <p>Manage your pharmacy settings</p>
        </div>
      </div>

      <div className="settings-layout">
        {/* Left Navigation — only in-page settings sections.
            Profile and Subscription link directly to their own pages. */}
        <aside className="settings-nav">
          <div className="settings-nav-label">Settings</div>
          <button
            className={`settings-nav-item ${activeSection === 'shop' ? 'active' : ''}`}
            onClick={() => setSection('shop')}
          >
            <i className="fa-solid fa-store"></i>
            <span>Shop Settings</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'gst' ? 'active' : ''}`}
            onClick={() => setSection('gst')}
          >
            <i className="fa-solid fa-percent"></i>
            <span>GST Settings</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'invoice' ? 'active' : ''}`}
            onClick={() => setSection('invoice')}
          >
            <i className="fa-solid fa-file-invoice"></i>
            <span>Invoice Settings</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'profile' ? 'active' : ''}`}
            onClick={() => setSection('profile')}
          >
            <i className="fa-solid fa-user"></i>
            <span>Profile</span>
          </button>
          <button
            className={`settings-nav-item ${activeSection === 'subscription' ? 'active' : ''}`}
            onClick={() => setSection('subscription')}
          >
            <i className="fa-solid fa-credit-card"></i>
            <span>Subscription</span>
          </button>
        </aside>

        {/* Right Content — only the selected section renders */}
        <div className="settings-content">
          <div className="card">
            <div className="card-body">
              {activeSection === 'shop' && <ShopSettings />}
              {activeSection === 'gst' && <GstSettings />}
              {activeSection === 'invoice' && <InvoiceSettings />}
              {activeSection === 'profile' && <ProfileSection />}
              {activeSection === 'subscription' && <SubscriptionSection />}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

/* ============================================================
   SUPER ADMIN SETTINGS — full platform settings (tabbed)
   Reuses the existing PlatformSetting API.
   ============================================================ */
function SuperAdminSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const [formData, setFormData] = useState({});
  const [metaData, setMetaData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        await settingService.initDefaults().catch(() => {});
        const { data } = await settingService.getSettings();
        if (data.data && !cancelled) {
          setFormData(data.data.values || {});
          setMetaData(data.data.metadata || {});
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await settingService.updateSettings(formData);
      if (data.data) {
        setFormData(prev => ({ ...prev, ...(data.data.values || {}) }));
        if (Object.keys(data.data.metadata || {}).length) {
          setMetaData(prev => ({ ...prev, ...data.data.metadata }));
        }
      }
      showSuccess('Settings saved successfully');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="settings-section-loading"><i className="fa-solid fa-spinner fa-spin"></i> Loading settings...</div>;
  }

  const renderField = (key) => {
    const meta = metaData[key] || {};
    const value = formData[key];
    const commonProps = {
      id: `setting-${key}`,
      className: 'form-control',
      value: value !== undefined && value !== null ? value : '',
      onChange: (e) => {
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        handleChange(key, val);
      },
    };
    let input;
    if (key === 'currency') {
      input = (
        <select {...commonProps}>
          {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'PKR', 'BDT', 'LKR', 'NPR', 'PHP', 'MYR', 'SGD', 'AUD', 'CAD'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      );
    } else if (key === 'timezone') {
      input = (
        <select {...commonProps}>
          {['Asia/Kolkata', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Colombo', 'UTC', 'America/New_York', 'Europe/London'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      );
    } else if (key === 'dateFormat') {
      input = (
        <select {...commonProps}>
          {['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      );
    } else if (key === 'enableGst') {
      input = (
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!value} onChange={(e) => handleChange(key, e.target.checked)} />
          <span>{value ? 'Enabled' : 'Disabled'}</span>
        </label>
      );
    } else if (key === 'gstRate') {
      input = (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="number" {...commonProps} min="0" max="100" step="0.1" style={{ width: '120px' }} />
          <span>%</span>
        </div>
      );
    } else {
      input = <input type={key === 'supportEmail' ? 'email' : 'text'} {...commonProps} />;
    }
    return (
      <div className="form-group" key={key}>
        <label htmlFor={`setting-${key}`}>{meta.label || key}</label>
        {meta.description && <p className="settings-field-hint">{meta.description}</p>}
        {input}
      </div>
    );
  };

  const groups = [
    { id: 'general', label: 'General', icon: 'fa-cog', keys: ['platformName', 'supportEmail'] },
    { id: 'localization', label: 'Localization', icon: 'fa-globe', keys: ['currency', 'timezone', 'dateFormat'] },
    { id: 'invoice', label: 'Invoice', icon: 'fa-file-invoice', keys: ['invoicePrefix', 'enableGst', 'gstRate'] },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-sliders" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>Platform Settings</h2>
          <p>Configure platform-wide settings, localization, and invoice preferences</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid var(--gray-200)', overflowX: 'auto' }}>
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => setActiveTab(g.id)}
            style={{
              padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === g.id ? '600' : '400',
              color: activeTab === g.id ? 'var(--primary)' : 'var(--gray-500)',
              borderBottom: activeTab === g.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px', fontSize: '14px', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <i className={`fa-solid ${g.icon}`}></i>
            {g.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ maxWidth: '900px' }}>
        <div className="card-header">
          <h5><i className={`fa-solid ${groups.find(g => g.id === activeTab)?.icon}`} style={{ marginRight: '8px', color: 'var(--primary)' }}></i>{groups.find(g => g.id === activeTab)?.label}</h5>
        </div>
        <div className="card-body">
          <form onSubmit={handleSave}>
            {groups.find(g => g.id === activeTab)?.keys.map(k => renderField(k))}
            <div className="settings-save-bar">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-save"></i>}
                {saving ? ' Saving...' : ' Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}