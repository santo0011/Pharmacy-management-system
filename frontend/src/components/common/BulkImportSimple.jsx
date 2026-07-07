import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function BulkImportSimple({ 
  title = 'Bulk Import', 
  icon = 'fa-solid fa-cloud-arrow-up',
  entityName = 'items', 
  endpoint = '',
  sampleFormat = '',
  fields = [{ key: 'name', label: 'Name', required: true }],
  onComplete 
}) {
  const [showModal, setShowModal] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += char; }
    }
    result.push(current.trim());
    return result;
  };

  const handleParse = () => {
    if (!pasteData.trim()) {
      toast.error('Please paste some data first');
      return;
    }
    const lines = pasteData.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      toast.error('Include a header row and at least one data row');
      return;
    }
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      if (row.name || row[entityName === 'brands' ? 'brandname' : entityName === 'suppliers' ? 'suppliername' : 'categoryname'] || row.name === '') {
        rows.push(row);
      }
    }
    if (rows.length === 0) {
      toast.error('No valid rows found. Check your format.');
      return;
    }
    setParsedRows(rows);
    toast.success(`Parsed ${rows.length} ${entityName} from pasted data`);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) {
      toast.error('No data to import');
      return;
    }
    try {
      setImporting(true);
      const res = await api.post(endpoint, { [entityName]: parsedRows });
      const data = res.data?.data;
      setResults(data);
      if (data?.successCount > 0) {
        toast.success(`${data.successCount} ${entityName} imported!`);
        if (onComplete) onComplete();
      }
      if (data?.errorCount > 0) {
        toast.error(`${data.errorCount} failed. Check details.`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setPasteData('');
    setParsedRows([]);
    setResults(null);
    setShowModal(false);
  };

  const downloadTemplate = () => {
    const headerLine = fields.map(f => f.label).join(',');
    const sampleLine = fields.map(f => f.sample || '').join(',');
    const csv = `${headerLine}\n${sampleLine}\n${sampleLine}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityName}-import-template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  return (
    <>
      <button className="btn btn-success btn-sm" onClick={() => setShowModal(true)}>
        <i className="fa-solid fa-cloud-arrow-up"></i> Bulk Import
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={() => !importing && reset()} style={{ opacity: 1, visibility: 'visible' }}>
          <div className="modal" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className={icon} style={{ marginRight: '10px', color: 'var(--primary)' }}></i>{title}</h3>
              <button className="close-btn" onClick={reset}><i className="fa-solid fa-xmark"></i></button>
            </div>
            <div className="modal-body">
              {!results ? (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <strong>Paste your data below</strong>
                    <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>
                      First row should be headers. Required: <strong>{fields.filter(f => f.required).map(f => f.label).join(', ')}</strong>
                    </p>
                  </div>

                  {sampleFormat && (
                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', marginBottom: '10px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
                      <div style={{ color: '#3b82f6', fontWeight: 600, marginBottom: '2px' }}>Sample:</div>
                      {sampleFormat}
                    </div>
                  )}

                  <textarea style={{ width: '100%', minHeight: '150px', padding: '10px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace', resize: 'vertical' }}
                    placeholder="Paste CSV data here..."
                    value={pasteData} onChange={e => setPasteData(e.target.value)}
                  />

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleParse}><i className="fa-solid fa-eye"></i> Preview</button>
                    <button className="btn btn-outline btn-sm" onClick={downloadTemplate}><i className="fa-solid fa-download"></i> Template</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPasteData('')}><i className="fa-solid fa-eraser"></i> Clear</button>
                  </div>

                  {parsedRows.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <h5 style={{ fontSize: '14px', marginBottom: '8px' }}>Preview ({parsedRows.length} rows)</h5>
                      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: '6px' }}>
                        <table style={{ width: '100%', fontSize: '12px' }}>
                          <thead>
                            <tr>
                              {fields.map(f => <th key={f.key} style={{ padding: '6px 8px', position: 'sticky', top: 0, background: 'var(--gray-50)' }}>{f.label}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {parsedRows.slice(0, 50).map((row, idx) => (
                              <tr key={idx}>
                                {fields.map(f => <td key={f.key} style={{ padding: '4px 8px', borderBottom: '1px solid var(--gray-100)' }}>{row[f.key] || '-'}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                        <button className="btn btn-success" onClick={handleImport} disabled={importing}>
                          {importing ? <><i className="fa-solid fa-spinner fa-spin"></i> Importing...</> : <><i className="fa-solid fa-check"></i> Import All ({parsedRows.length})</>}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <div style={{ padding: '12px 20px', borderRadius: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center', minWidth: '100px' }}>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>{results.successCount}</div>
                      <div style={{ fontSize: '11px', color: '#166534' }}>Success</div>
                    </div>
                    {results.errorCount > 0 && (
                      <div style={{ padding: '12px 20px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', textAlign: 'center', minWidth: '100px' }}>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>{results.errorCount}</div>
                        <div style={{ fontSize: '11px', color: '#991b1b' }}>Failed</div>
                      </div>
                    )}
                  </div>
                  {results.errors?.length > 0 && (
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <h6 style={{ color: '#dc2626', fontSize: '13px', marginBottom: '6px' }}>Failed Rows:</h6>
                      <table style={{ width: '100%', fontSize: '12px' }}>
                        <thead><tr><th style={{ padding: '4px 8px', textAlign: 'left' }}>Row</th><th style={{ padding: '4px 8px', textAlign: 'left' }}>Name</th><th style={{ padding: '4px 8px', textAlign: 'left' }}>Reason</th></tr></thead>
                        <tbody>
                          {results.errors.map((err, idx) => (
                            <tr key={idx}><td style={{ padding: '4px 8px' }}>{err.row}</td><td style={{ padding: '4px 8px' }}>{err.data?.name || err.data?.supplierName || '-'}</td><td style={{ padding: '4px 8px', color: '#dc2626' }}>{err.reason}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              {results && (
                <>
                  <button className="btn btn-primary" onClick={reset}><i className="fa-solid fa-rotate"></i> Import More</button>
                  <button className="btn btn-secondary" onClick={reset}><i className="fa-solid fa-check"></i> Done</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}