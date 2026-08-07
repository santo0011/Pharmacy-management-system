import { useState, useEffect, useRef } from 'react';
import { showSuccess, showError } from '../../utils/sweetAlert';
import { settingService } from '../../services/settingService';
import { invoiceSettingService } from '../../services/invoiceSettingService';
import { INVOICE_TEMPLATES, PRINT_FORMATS } from '../../utils/invoiceTemplates';
import { useAuth } from '../../hooks/useAuth';
import { INDIAN_STATES, getStateCodeByName } from '../../utils/indianStates';
import { pharmacyService } from '../../services/pharmacyService';

/**
 * Settings groups configuration for Super Admin.
 * Only functional, meaningful settings are included:
 * - General: Platform name, support email
 * - Localization: Timezone, date format, currency
 * - Invoice: Prefix, GST toggle, GST rate
 */
const SETTINGS_GROUPS = [
  {
    id: 'general',
    label: 'General',
    icon: 'fa-cog',
    description: 'Platform branding and support contact information.',
    settings: ['platformName', 'supportEmail'],
  },
  {
    id: 'localization',
    label: 'Localization',
    icon: 'fa-globe',
    description: 'Timezone, date format, and currency settings for the platform.',
    settings: ['currency', 'timezone', 'dateFormat'],
  },
  {
    id: 'invoice',
    label: 'Invoice',
    icon: 'fa-file-invoice',
    description: 'Invoice prefix, GST calculation, and default tax rates.',
    settings: ['invoicePrefix', 'enableGst', 'gstRate'],
  },
];

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR (₹) - Indian Rupee', symbol: '₹' },
  { value: 'USD', label: 'USD ($) - US Dollar', symbol: '$' },
  { value: 'EUR', label: 'EUR (€) - Euro', symbol: '€' },
  { value: 'GBP', label: 'GBP (£) - British Pound', symbol: '£' },
  { value: 'AED', label: 'AED (د.إ) - UAE Dirham', symbol: 'د.إ' },
  { value: 'SAR', label: 'SAR (﷼) - Saudi Riyal', symbol: '﷼' },
  { value: 'PKR', label: 'PKR (₨) - Pakistani Rupee', symbol: '₨' },
  { value: 'BDT', label: 'BDT (৳) - Bangladeshi Taka', symbol: '৳' },
  { value: 'LKR', label: 'LKR (₨) - Sri Lankan Rupee', symbol: '₨' },
  { value: 'NPR', label: 'NPR (₨) - Nepalese Rupee', symbol: '₨' },
  { value: 'PHP', label: 'PHP (₱) - Philippine Peso', symbol: '₱' },
  { value: 'MYR', label: 'MYR (RM) - Malaysian Ringgit', symbol: 'RM' },
  { value: 'SGD', label: 'SGD (S$) - Singapore Dollar', symbol: 'S$' },
  { value: 'AUD', label: 'AUD (A$) - Australian Dollar', symbol: 'A$' },
  { value: 'CAD', label: 'CAD (C$) - Canadian Dollar', symbol: 'C$' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4:00)' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (AST, UTC+3:00)' },
  { value: 'Asia/Karachi', label: 'Asia/Karachi (PKT, UTC+5:00)' },
  { value: 'Asia/Dhaka', label: 'Asia/Dhaka (BST, UTC+6:00)' },
  { value: 'Asia/Colombo', label: 'Asia/Colombo (IST, UTC+5:30)' },
  { value: 'Asia/Kathmandu', label: 'Asia/Kathmandu (NPT, UTC+5:45)' },
  { value: 'Asia/Manila', label: 'Asia/Manila (PST, UTC+8:00)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala_Lumpur (MYT, UTC+8:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+8:00)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST, UTC+10:00)' },
  { value: 'America/New_York', label: 'America/New_York (EST, UTC-5:00)' },
  { value: 'America/Toronto', label: 'America/Toronto (EST, UTC-5:00)' },
  { value: 'Europe/London', label: 'Europe/London (GMT, UTC+0:00)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET, UTC+1:00)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
];

const DATE_FORMAT_OPTIONS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' },
];

export default function Settings() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [formData, setFormData] = useState({});
  const [metaData, setMetaData] = useState({});
  const [invoiceSettings, setInvoiceSettings] = useState({
    invoiceTemplate: 'classic',
    printFormat: 'a4',
  });
  const [saving, setSaving] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [gstSaving, setGstSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [gstSettings, setGstSettings] = useState({ state: '', stateCode: '', defaultGstRate: 18 });
  const [gstStateSearch, setGstStateSearch] = useState('');
  const [gstStateDropdownOpen, setGstStateDropdownOpen] = useState(false);
  const gstStateSearchRef = useRef(null);
  const GST_RATE_OPTIONS = [0, 5, 12, 18, 28];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Try to initialize defaults first (only Super Admin can do this)
        if (isSuperAdmin) {
          try {
            await settingService.initDefaults();
          } catch (e) {
            // Settings already initialized, ignore
          }
        }

        const { data } = await settingService.getSettings();
        if (data.data) {
          const values = data.data.values || {};
          const metadata = data.data.metadata || {};
          setFormData(values);
          setMetaData(metadata);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchInvoiceSettings = async () => {
      if (isSuperAdmin) return;
      try {
        const { data } = await invoiceSettingService.getMySettings();
        if (data.data) {
          setInvoiceSettings({
            invoiceTemplate: data.data.invoiceTemplate || 'classic',
            printFormat: data.data.printFormat || 'a4',
          });
        }
      } catch (error) {
        // Use defaults
      }
    };

    const fetchGstSettings = async () => {
      if (isSuperAdmin) return;
      try {
        const { data } = await pharmacyService.getMyPharmacyProfile();
        if (data.data) {
          const state = data.data.state || '';
          setGstSettings({
            state,
            stateCode: data.data.stateCode || getStateCodeByName(state),
            defaultGstRate: data.data.defaultGstRate || 18,
          });
          setGstStateSearch(state);
        }
      } catch (error) {
        // Use defaults
      }
    };

    fetchData();
    fetchInvoiceSettings();
    fetchGstSettings();
  }, [isSuperAdmin]);

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await settingService.updateSettings(formData);
      if (data.data) {
        const newValues = data.data.values || {};
        const newMetadata = data.data.metadata || {};
        setFormData(prev => ({ ...prev, ...newValues }));
        if (Object.keys(newMetadata).length > 0) {
          setMetaData(prev => ({ ...prev, ...newMetadata }));
        }
      }
      showSuccess('Settings saved successfully');
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInvoiceSettings = async (e) => {
    e.preventDefault();
    setInvoiceSaving(true);
    try {
      const { data } = await invoiceSettingService.updateMySettings(invoiceSettings);
      if (data.data) {
        setInvoiceSettings({
          invoiceTemplate: data.data.invoiceTemplate || 'classic',
          printFormat: data.data.printFormat || 'a4',
        });
      }
      showSuccess('Invoice settings saved successfully');
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to save invoice settings');
    } finally {
      setInvoiceSaving(false);
    }
  };

  const handleSaveGstSettings = async (e) => {
    e.preventDefault();
    setGstSaving(true);
    try {
      const { data } = await pharmacyService.updateMyPharmacyProfile({
        state: gstSettings.state,
        stateCode: gstSettings.stateCode || getStateCodeByName(gstSettings.state),
        defaultGstRate: gstSettings.defaultGstRate,
      });
      if (data.data) {
        setGstSettings({
          state: data.data.state || gstSettings.state,
          stateCode: data.data.stateCode || gstSettings.stateCode,
          defaultGstRate: data.data.defaultGstRate || gstSettings.defaultGstRate,
        });
      }
      showSuccess('GST settings saved successfully');
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to save GST settings');
    } finally {
      setGstSaving(false);
    }
  };

  // Close GST state dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (gstStateSearchRef.current && !gstStateSearchRef.current.contains(event.target)) {
        setGstStateDropdownOpen(false);
      }
    };
    if (gstStateDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [gstStateDropdownOpen]);

  const filteredGstStates = INDIAN_STATES.filter(s =>
    s.name.toLowerCase().includes(gstStateSearch.toLowerCase())
  );

  const getField = (key) => {
    const meta = metaData[key] || {};
    const value = formData[key];
    return { meta, value };
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <i className="fa-solid fa-spinner fa-spin"></i>
      </div>
    );
  }

  const renderSettingField = (key) => {
    const { meta, value } = getField(key);

    const commonProps = {
      id: `setting-${key}`,
      className: 'form-control',
      value: value !== undefined && value !== null ? value : '',
      onChange: (e) => {
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        handleChange(key, val);
      },
    };

    const renderInput = () => {
      switch (key) {
        case 'currency':
          return (
            <select {...commonProps}>
              {CURRENCY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          );
        case 'timezone':
          return (
            <select {...commonProps}>
              {TIMEZONE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          );
        case 'dateFormat':
          return (
            <select {...commonProps}>
              {DATE_FORMAT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          );
        case 'enableGst':
          return (
            <label className="toggle-switch" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => handleChange(key, e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                {value ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          );
        case 'gstRate':
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                {...commonProps}
                min="0"
                max="100"
                step="0.1"
                style={{ width: '120px' }}
              />
              <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>%</span>
            </div>
          );
        default:
          return <input type={key === 'supportEmail' ? 'email' : 'text'} {...commonProps} />;
      }
    };

    return (
      <div className="form-group" key={key} style={{ marginBottom: '20px' }}>
        <label htmlFor={`setting-${key}`} style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'block' }}>
          {meta.label || key}
        </label>
        {meta.description && (
          <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '8px', lineHeight: 1.5 }}>
            {meta.description}
          </p>
        )}
        {renderInput()}
      </div>
    );
  };

  // Currency info banner displayed in localization tab
  const renderCurrencyInfo = () => {
    const { value: currency } = getField('currency');
    const currencyMeta = CURRENCY_OPTIONS.find(c => c.value === currency);

    return (
      <div style={{
        padding: '16px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
        border: '1px solid #bae6fd',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: '#3b82f6', display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}>
            <i className="fa-solid fa-coins" style={{ color: '#fff', fontSize: '18px' }}></i>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e40af', marginBottom: '4px' }}>
              Base Currency: INR (₹)
            </div>
            <div style={{ fontSize: '13px', color: '#3b82f6', lineHeight: 1.5 }}>
              All financial calculations — total revenue, profit, dashboard cards, reports, and analytics — are stored and calculated in <strong>Indian Rupees (INR)</strong> regardless of the display currency selected below.
              {currency !== 'INR' && currencyMeta && (
                <span> The <strong>{currencyMeta.label.split(' - ')[0]}</strong> is used for <strong>display purposes only</strong> when showing prices on the user-facing interface.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ===== ADMIN VIEW: Simple invoice print settings only =====
  if (!isSuperAdmin) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h2><i className="fa-solid fa-sliders" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>Settings</h2>
            <p>Manage your pharmacy invoice preferences</p>
          </div>
        </div>

        {/* GST Configuration */}
        <div className="card" style={{ maxWidth: '900px', marginBottom: '20px' }}>
          <div className="card-header">
            <h5><i className="fa-solid fa-percent" style={{ marginRight: '8px', color: 'var(--primary)' }}></i>GST Configuration</h5>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Configure default business state and GST rate</span>
          </div>
          <div className="card-body">
            <form onSubmit={handleSaveGstSettings}>
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'block' }}>
                  Default Business State <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '12px' }}>
                  Used to determine CGST+SGST (same state) vs IGST (different state) on sales.
                </p>
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
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#fff',
                      border: '1px solid var(--gray-200)',
                      borderRadius: '8px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      zIndex: 100,
                      maxHeight: '220px',
                      overflowY: 'auto',
                      marginTop: '4px',
                    }}>
                      {filteredGstStates.length > 0 ? (
                        filteredGstStates.map(state => (
                          <div
                            key={state.code}
                            onClick={() => {
                              setGstSettings(prev => ({ ...prev, state: state.name, stateCode: state.code }));
                              setGstStateSearch(state.name);
                              setGstStateDropdownOpen(false);
                            }}
                            style={{
                              padding: '10px 14px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--gray-100)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: gstSettings.state === state.name ? 'var(--primary-light)' : '#fff',
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--gray-50)'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = gstSettings.state === state.name ? 'var(--primary-light)' : '#fff'}
                          >
                            <span style={{ fontWeight: 500, fontSize: '13px' }}>{state.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Code: {state.code}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '12px 14px', color: '#888', fontSize: '13px', textAlign: 'center' }}>
                          No states found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '20px' }}>
                <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'block' }}>
                  Default GST %
                </label>
                <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '12px' }}>
                  Default GST rate applied to new products when no specific rate is set.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {GST_RATE_OPTIONS.map(rate => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setGstSettings(prev => ({ ...prev, defaultGstRate: rate }))}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: `2px solid ${gstSettings.defaultGstRate === rate ? 'var(--primary)' : 'var(--gray-200)'}`,
                        background: gstSettings.defaultGstRate === rate ? 'var(--primary-light, #f0f5ff)' : '#fff',
                        color: gstSettings.defaultGstRate === rate ? 'var(--primary)' : 'var(--gray-700)',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '20px' }} disabled={gstSaving}>
                {gstSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-save"></i>}
                {' '}{gstSaving ? 'Saving...' : 'Save GST Settings'}
              </button>
            </form>
          </div>
        </div>

        {/* Invoice Print Settings */}
        <div className="card" style={{ maxWidth: '900px' }}>
          <div className="card-header">
            <h5><i className="fa-solid fa-print" style={{ marginRight: '8px', color: 'var(--primary)' }}></i>Invoice Print Settings</h5>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Configure your invoice template and paper size</span>
          </div>
          <div className="card-body">
            <form onSubmit={handleSaveInvoiceSettings}>
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'block' }}>
                  Invoice Template / Theme
                </label>
                <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '12px' }}>
                  Select the visual style used when printing invoices from the Sales page.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {INVOICE_TEMPLATES.map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => setInvoiceSettings({ ...invoiceSettings, invoiceTemplate: tpl.id })}
                      style={{
                        border: `2px solid ${invoiceSettings.invoiceTemplate === tpl.id ? 'var(--primary)' : 'var(--gray-200)'}`,
                        borderRadius: '10px',
                        padding: '16px',
                        cursor: 'pointer',
                        background: invoiceSettings.invoiceTemplate === tpl.id ? 'var(--primary-light, #f0f5ff)' : '#fff',
                        transition: 'all 0.2s',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '36px', marginBottom: '8px' }}>{tpl.preview}</div>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{tpl.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{tpl.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '24px' }}>
                <label style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px', display: 'block' }}>
                  Print Format / Paper Size
                </label>
                <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginBottom: '12px' }}>
                  Choose the paper format for printing invoices. Supports A4 printers and 58mm/80mm thermal printers.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                  {PRINT_FORMATS.map((fmt) => (
                    <div
                      key={fmt.id}
                      onClick={() => setInvoiceSettings({ ...invoiceSettings, printFormat: fmt.id })}
                      style={{
                        border: `2px solid ${invoiceSettings.printFormat === fmt.id ? 'var(--primary)' : 'var(--gray-200)'}`,
                        borderRadius: '10px',
                        padding: '14px',
                        cursor: 'pointer',
                        background: invoiceSettings.printFormat === fmt.id ? 'var(--primary-light, #f0f5ff)' : '#fff',
                        transition: 'all 0.2s',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '28px', marginBottom: '6px' }}>{fmt.preview}</div>
                      <div style={{ fontWeight: 600, marginBottom: '2px' }}>{fmt.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{fmt.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                marginTop: '20px', padding: '14px', background: '#f8fafc',
                borderRadius: '8px', border: '1px solid var(--gray-200)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gray-600)', fontSize: '13px' }}>
                  <i className="fa-solid fa-info-circle" style={{ color: 'var(--primary)' }}></i>
                  <span>
                    The selected template and format will be applied automatically when printing invoices
                    from the <strong>Sales</strong> page. Click <strong>Invoice</strong> on any sale to see the result.
                  </span>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '20px' }} disabled={invoiceSaving}>
                {invoiceSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-save"></i>}
                {' '}{invoiceSaving ? 'Saving...' : 'Save Invoice Settings'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ===== SUPER ADMIN VIEW: Full settings management =====
  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-sliders" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>Platform Settings</h2>
          <p>Configure platform-wide settings, localization, and invoice preferences</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '0', marginBottom: '24px',
        borderBottom: '2px solid var(--gray-200)', overflowX: 'auto',
      }}>
        {SETTINGS_GROUPS.map((group) => (
          <button
            key={group.id}
            className={`tab-btn ${activeTab === group.id ? 'active' : ''}`}
            onClick={() => setActiveTab(group.id)}
            style={{
              padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === group.id ? '600' : '400',
              color: activeTab === group.id ? 'var(--primary)' : 'var(--gray-500)',
              borderBottom: activeTab === group.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-2px', fontSize: '14px', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s',
            }}
            title={group.description}
          >
            <i className={`fa-solid ${group.icon}`}></i>
            {group.label}
          </button>
        ))}
      </div>

      {/* Settings Content */}
      <div className="card" style={{ maxWidth: '900px' }}>
        <div className="card-header">
          <h5>
            <i className={`fa-solid ${SETTINGS_GROUPS.find(g => g.id === activeTab)?.icon || 'fa-cog'}`}
              style={{ marginRight: '8px', color: 'var(--primary)' }}>
            </i>
            {SETTINGS_GROUPS.find(g => g.id === activeTab)?.label || 'Settings'}
          </h5>
          <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
            {SETTINGS_GROUPS.find(g => g.id === activeTab)?.description || ''}
          </span>
        </div>
        <div className="card-body">
          {/* Currency info banner only in localization tab */}
          {activeTab === 'localization' && renderCurrencyInfo()}

          <form onSubmit={handleSave}>
            {SETTINGS_GROUPS.find(g => g.id === activeTab)?.settings.map(key => renderSettingField(key))}

            <div style={{
              marginTop: '24px', padding: '16px 20px',
              background: '#f8fafc', borderRadius: '10px',
              border: '1px solid var(--gray-200)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
                <i className="fa-solid fa-info-circle" style={{ marginRight: '6px', color: 'var(--primary)' }}></i>
                Changes are saved immediately for all platform users.
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-save"></i>}
                {' '}{saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}