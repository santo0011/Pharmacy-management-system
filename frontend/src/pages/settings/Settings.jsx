import { useState, useEffect } from 'react';
import { showSuccess, showError } from '../../utils/sweetAlert';
import { settingService } from '../../services/settingService';

export default function Settings() {
  const [formData, setFormData] = useState({
    platformName: 'Pharmacy Management System',
    supportEmail: 'support@pharmacy.com',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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
    fetchSettings();
  }, []);

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

    </div>
  );
}