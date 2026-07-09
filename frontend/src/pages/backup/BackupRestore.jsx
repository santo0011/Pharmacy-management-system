import { useState, useEffect } from 'react';
import { backupService } from '../../services/backupService';
import toast from 'react-hot-toast';

export default function BackupRestore() {
  const [backupInfo, setBackupInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchBackupInfo();
  }, []);

  const fetchBackupInfo = async () => {
    try {
      setLoading(true);
      const res = await backupService.getInfo();
      setBackupInfo(res.data?.data);
    } catch (err) {
      console.error('Failed to fetch backup info:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await backupService.exportData();
      const backup = res.data?.data;

      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pharmacy-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Backup exported successfully! ${backup.stats?.totalRecords || 0} records included.`);
    } catch (err) {
      toast.error('Failed to export backup');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        setImporting(true);
        const text = await file.text();
        const backup = JSON.parse(text);

        if (!backup.data) {
          toast.error('Invalid backup file format');
          return;
        }

        const res = await backupService.importData(backup);
        toast.success(`Backup restored! ${JSON.stringify(res.data?.data)}`);
        fetchBackupInfo();
      } catch (err) {
        toast.error('Failed to import backup. Ensure the file is valid.');
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  if (loading) {
    return <div className="loading-spinner"><i className="fa-solid fa-spinner"></i></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-database" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>Backup & Restore</h2>
          <p>Export your pharmacy data as a backup or restore from a previous backup</p>
        </div>
      </div>

      {/* Backup Info */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h5><i className="fa-solid fa-circle-info" style={{ marginRight: '8px', color: '#3b82f6' }}></i>Data Overview</h5>
        </div>
        <div className="card-body">
          {backupInfo ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
              {Object.entries(backupInfo).filter(([key]) => key !== 'totalRecords').map(([key, value]) => (
                <div key={key} style={{
                  padding: '16px', borderRadius: '8px', background: '#f8fafc',
                  textAlign: 'center', border: '1px solid #e2e8f0',
                }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)' }}>{value}</div>
                  <div style={{ fontSize: '12px', color: 'var(--gray-500)', textTransform: 'capitalize', marginTop: '4px' }}>{key}</div>
                </div>
              ))}
              <div style={{
                padding: '16px', borderRadius: '8px', background: '#f0fdf4',
                textAlign: 'center', border: '1px solid #bbf7d0',
              }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>{backupInfo.totalRecords}</div>
                <div style={{ fontSize: '12px', color: '#166534', marginTop: '4px' }}>Total Records</div>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--gray-500)' }}>Unable to load data overview</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-download" style={{ marginRight: '8px', color: '#22c55e' }}></i>Export Backup</h5>
          </div>
          <div className="card-body" style={{ textAlign: 'center', padding: '40px' }}>
            <i className="fa-solid fa-cloud-arrow-down" style={{ fontSize: '48px', color: '#22c55e', marginBottom: '16px' }}></i>
            <h4 style={{ marginBottom: '8px' }}>Download Data Backup</h4>
            <p style={{ color: 'var(--gray-500)', fontSize: '14px', marginBottom: '20px' }}>
              Export all your pharmacy data including medicines, sales, purchases, customers, and more as a JSON file.
            </p>
            <button
              className="btn btn-success"
              onClick={handleExport}
              disabled={exporting}
              style={{ padding: '12px 32px', fontSize: '15px' }}
            >
              {exporting ? (
                <><i className="fa-solid fa-spinner fa-spin"></i> Exporting...</>
              ) : (
                <><i className="fa-solid fa-download"></i> Export Backup</>
              )}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h5><i className="fa-solid fa-upload" style={{ marginRight: '8px', color: '#f59e0b' }}></i>Restore Backup</h5>
          </div>
          <div className="card-body" style={{ textAlign: 'center', padding: '40px' }}>
            <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '48px', color: '#f59e0b', marginBottom: '16px' }}></i>
            <h4 style={{ marginBottom: '8px' }}>Restore from Backup</h4>
            <p style={{ color: 'var(--gray-500)', fontSize: '14px', marginBottom: '20px' }}>
              Upload a previously exported backup JSON file to restore your pharmacy data. This will add the data to existing records.
            </p>
            <button
              className="btn btn-warning"
              onClick={handleImport}
              disabled={importing}
              style={{ padding: '12px 32px', fontSize: '15px' }}
            >
              {importing ? (
                <><i className="fa-solid fa-spinner fa-spin"></i> Restoring...</>
              ) : (
                <><i className="fa-solid fa-upload"></i> Restore Backup</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Info Note */}
      <div className="card" style={{ marginTop: '20px', background: '#fffbeb', border: '1px solid #fde68a' }}>
        <div className="card-body" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <i className="fa-solid fa-circle-info" style={{ color: '#d97706', fontSize: '20px', marginTop: '2px' }}></i>
          <div>
            <strong style={{ color: '#92400e' }}>Important Notes:</strong>
            <ul style={{ margin: '8px 0 0 20px', color: '#92400e', fontSize: '13px', lineHeight: '1.8' }}>
              <li>Backup exports all your data as a JSON file that can be stored securely</li>
              <li>Restore will add data to existing records - it does not replace current data</li>
              <li>Keep backups in a safe location for disaster recovery</li>
              <li>Regular backups are recommended (weekly or monthly)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}