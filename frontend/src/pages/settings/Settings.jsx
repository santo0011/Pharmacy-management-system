import { useState, useEffect } from 'react';
import { showSuccess, showError } from '../../utils/sweetAlert';
import { settingService } from '../../services/settingService';
import { invoiceSettingService } from '../../services/invoiceSettingService';
import { INVOICE_TEMPLATES, PRINT_FORMATS } from '../../utils/invoiceTemplates';
import { useAuth } from '../../hooks/useAuth';

export default function Settings() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [formData, setFormData] = useState({
    platformName: 'Pharmacy Management System',
    supportEmail: 'support@pharmacy.com',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
  });
  const [invoiceSettings, setInvoiceSettings] = useState({
    invoiceTemplate: 'classic',
    printFormat: 'a4',
  });
  const [saving, setSaving] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await settingService.getSettings();
        if (data.data) {
          setFormData({
            platformName: data.data.platformName || 'Pharmacy Management System',
            supportEmail: data.data.supportEmail || 'support@pharmacy.com',
            currency: data.data.currency || 'INR',
            timezone: data.data.timezone || 'Asia/Kolkata',
            dateFormat: data.data.dateFormat || 'DD/MM/YYYY',
          });
        }
      } catch (error) {
        // Settings not saved yet, use defaults
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

    fetchSettings();
    fetchInvoiceSettings();
  }, [isSuperAdmin]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await settingService.updateSettings(formData);
      if (data.data) {
        setFormData({
          platformName: data.data.platformName || 'Pharmacy Management System',
          supportEmail: data.data.supportEmail || 'support@pharmacy.com',
          currency: data.data.currency || 'INR',
          timezone: data.data.timezone || 'Asia/Kolkata',
          dateFormat: data.data.dateFormat || 'DD/MM/YYYY',
        });
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

  if (loading) {
    return (
      <div className="loading-spinner">
        <i className="fa-solid fa-spinner fa-spin"></i>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Platform Settings</h2>
          <p>Configure platform-wide settings</p>
        </div>
      </div>

      {/* Tabs - only show Invoice tab for non-super-admin users */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid var(--gray-200)', paddingBottom: '8px' }}>
        <button
          className={`btn ${activeTab === 'general' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ border: 'none', borderRadius: '8px 8px 0 0' }}
          onClick={() => setActiveTab('general')}
        >
          <i className="fa-solid fa-cog"></i> General
        </button>
        {!isSuperAdmin && (
          <button
            className={`btn ${activeTab === 'invoice' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ border: 'none', borderRadius: '8px 8px 0 0' }}
            onClick={() => setActiveTab('invoice')}
          >
            <i className="fa-solid fa-print"></i> Invoice Print
          </button>
        )}
      </div>

      {/* General Settings Tab */}
      {activeTab === 'general' && (
        <div className="card">
          <div className="card-header"><h5>General Settings</h5></div>
          <div className="card-body">
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Platform Name</label>
                <input type="text" value={formData.platformName} onChange={(e) => setFormData({ ...formData, platformName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Support Email</label>
                <input type="email" value={formData.supportEmail} onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Currency</label>
                  <select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Timezone</label>
                  <select value={formData.timezone} onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Date Format</label>
                  <select value={formData.dateFormat} onChange={(e) => setFormData({ ...formData, dateFormat: e.target.value })}>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '16px' }} disabled={saving}>
                {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-save"></i>} Save Settings
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Print Settings Tab - Admin only */}
      {activeTab === 'invoice' && !isSuperAdmin && (
        <div className="card">
          <div className="card-header"><h5>Invoice Print Settings</h5></div>
          <div className="card-body">
            <form onSubmit={handleSaveInvoiceSettings}>
              {/* Template Selection */}
              <div className="form-group">
                <label>Invoice Template / Theme</label>
                <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '12px' }}>
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

              {/* Print Format Selection */}
              <div className="form-group" style={{ marginTop: '24px' }}>
                <label>Print Format / Paper Size</label>
                <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '12px' }}>
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

              {/* Preview hint */}
              <div style={{ marginTop: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gray-600)', fontSize: '13px' }}>
                  <i className="fa-solid fa-info-circle" style={{ color: 'var(--primary)' }}></i>
                  <span>
                    The selected template and format will be applied automatically when printing invoices
                    from the <strong>Sales</strong> page. Click <strong>Invoice</strong> on any sale to see the result.
                  </span>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '16px' }} disabled={invoiceSaving}>
                {invoiceSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-save"></i>} Save Settings
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}