import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Drawer from './Drawer';
import { INDIAN_STATES } from '../../utils/indianStates';

export default function BulkImportSimple({ 
  title = 'Bulk Import', 
  icon = 'fa-solid fa-cloud-arrow-up',
  entityName = 'items', 
  endpoint = '',
  fields = [{ key: 'name', label: 'Name', required: true }],
  onComplete,
  headerIncluded = true,
  requiredState = false,
  width = '700px',
}) {
  const [showDrawer, setShowDrawer] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validation, setValidation] = useState({ total: 0, valid: 0, invalid: 0, invalidRows: [] });

  // Required State selection state
  const [selectedState, setSelectedState] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);
  const stateSearchRef = useRef(null);

  // Close state dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (stateSearchRef.current && !stateSearchRef.current.contains(event.target)) {
        setStateDropdownOpen(false);
      }
    };
    if (stateDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [stateDropdownOpen]);

  const filteredStates = INDIAN_STATES.filter(s =>
    s.name.toLowerCase().includes(stateSearch.toLowerCase())
  );

  /**
   * Parse a single CSV line into an array of values.
   */
  const parseCSVLine = (line) => {
    line = line.replace(/\r$/, '');
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  /**
   * Build a sample format string with * markers for required fields.
   * E.g. "Brand Name*,Description"
   */
  const getSampleHeader = () => {
    return fields.map(f => f.required ? f.label + '*' : f.label).join(',');
  };

  /**
   * Build a sample data row from field sample values.
   */
  const getSampleRow = () => {
    return fields.map(f => f.sample || '').join(',');
  };

  /**
   * Validate a single row against required fields.
   */
  const validateRow = (row) => {
    const missing = fields
      .filter(f => f.required && !row[f.key]?.trim())
      .map(f => f.label);
    return { valid: missing.length === 0, missing };
  };

  const handleParse = () => {
    if (requiredState && !selectedState) {
      toast.error('Please select a state before continuing');
      return;
    }
    if (!pasteData.trim()) {
      toast.error('Please paste some data first');
      return;
    }

    const rawText = pasteData.trim().replace(/\r\n/g, '\n');
    const lines = rawText.split('\n').filter(l => l.trim());
    let startIndex = 0;

    if (!lines.length) {
      toast.error('No data found. Please paste your data.');
      return;
    }

    if (headerIncluded) {
      if (lines.length < 2) {
        toast.error('Include a header row and at least one data row');
        return;
      }
      startIndex = 1;
    } else {
      if (lines.length < 1) {
        toast.error('Please paste at least one data row');
        return;
      }
    }

    // Map by position only: column 0 → fields[0].key, col 1 → fields[1].key, etc.
    const rows = [];
    for (let i = startIndex; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row = {};
      let hasValue = false;

      fields.forEach((field, idx) => {
        const value = (values[idx] || '').trim();
        row[field.key] = value;
        if (value) hasValue = true;
      });

      if (hasValue) {
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

  /**
   * Show the confirmation dialog before importing.
   */
  const handleConfirmImport = () => {
    if (requiredState && !selectedState) {
      toast.error('Please select a state before continuing');
      return;
    }
    if (parsedRows.length === 0) {
      toast.error('No data to import');
      return;
    }

    let validCount = 0;
    let invalidCount = 0;
    const invalidRows = [];

    parsedRows.forEach((row, idx) => {
      const { valid, missing } = validateRow(row);
      if (valid) {
        validCount++;
      } else {
        invalidCount++;
        invalidRows.push({ row: idx + 1, name: row[fields[0]?.key] || '-', missing });
      }
    });

    setValidation({
      total: parsedRows.length,
      valid: validCount,
      invalid: invalidCount,
      invalidRows,
    });
    setShowConfirm(true);
  };

  const handleImport = async () => {
    if (requiredState && !selectedState) {
      toast.error('Please select a state before continuing');
      return;
    }
    if (parsedRows.length === 0) {
      toast.error('No data to import');
      return;
    }
    try {
      setImporting(true);
      setShowConfirm(false);
      const payload = { [entityName]: parsedRows };
      if (requiredState) payload.state = selectedState;
      const res = await api.post(endpoint, payload);
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
    setShowConfirm(false);
    setSelectedState('');
    setStateSearch('');
    setStateDropdownOpen(false);
    setShowDrawer(false);
  };

  const downloadTemplate = () => {
    const headerLine = fields.map(f => f.label).join(',');
    const sampleLine = getSampleRow();
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
      <button className="btn btn-success btn-sm" onClick={() => setShowDrawer(true)}>
        <i className="fa-solid fa-cloud-arrow-up"></i> Bulk Import
      </button>

      <Drawer
        isOpen={showDrawer}
        onClose={() => !importing && reset()}
        title={<><i className={icon} style={{ marginRight: '10px', color: 'var(--primary)' }}></i>{title}</>}
        width={width}
      >
        {!results ? (
          <>
            {/* Confirmation Step */}
            {showConfirm ? (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '48px', color: '#f59e0b', marginBottom: '12px' }}></i>
                  <h4 style={{ marginBottom: '8px' }}>Confirm Import</h4>
                  <p style={{ color: 'var(--gray-500)', fontSize: '14px' }}>
                    Please review the data before proceeding with the import.
                  </p>
                </div>

                {requiredState && selectedState && (
                  <div style={{ textAlign: 'center', marginBottom: '16px', padding: '10px 16px', background: '#eff6ff', borderRadius: '8px', display: 'inline-block', width: '100%', boxSizing: 'border-box' }}>
                    <span style={{ fontSize: '13px', color: '#1e40af' }}>
                      <i className="fa-solid fa-location-dot" style={{ marginRight: '6px' }}></i>
                      State: <strong>{selectedState}</strong>
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
                  <div style={{ padding: '16px 24px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center', minWidth: '100px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#64748b' }}>{validation.total}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Rows</div>
                  </div>
                  <div style={{ padding: '16px 24px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center', minWidth: '100px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#16a34a' }}>{validation.valid}</div>
                    <div style={{ fontSize: '12px', color: '#166534' }}>Valid</div>
                  </div>
                  {validation.invalid > 0 && (
                    <div style={{ padding: '16px 24px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', textAlign: 'center', minWidth: '100px' }}>
                      <div style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626' }}>{validation.invalid}</div>
                      <div style={{ fontSize: '12px', color: '#991b1b' }}>Invalid</div>
                    </div>
                  )}
                </div>

                {validation.invalidRows.length > 0 && (
                  <div style={{ marginBottom: '16px', maxHeight: '150px', overflowY: 'auto', border: '1px solid #fecaca', borderRadius: '6px' }}>
                    <table style={{ width: '100%', fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '6px 8px', textAlign: 'left', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>Row</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>Name</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>Missing Fields</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validation.invalidRows.map((err, idx) => (
                          <tr key={idx}>
                            <td style={{ padding: '4px 8px', borderBottom: '1px solid #fee2e2' }}>{err.row}</td>
                            <td style={{ padding: '4px 8px', borderBottom: '1px solid #fee2e2' }}>{err.name}</td>
                            <td style={{ padding: '4px 8px', borderBottom: '1px solid #fee2e2', color: '#dc2626' }}>{err.missing.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--gray-200)', paddingTop: '16px', marginTop: '16px' }}>
                  <button className="btn btn-secondary" onClick={() => setShowConfirm(false)} disabled={importing}>
                    <i className="fa-solid fa-arrow-left"></i> Back
                  </button>
                  <button className="btn btn-success" onClick={handleImport} disabled={importing}>
                    {importing ? (
                      <><i className="fa-solid fa-spinner fa-spin"></i> Importing...</>
                    ) : (
                      <><i className="fa-solid fa-check"></i> Import {validation.valid} Rows</>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Required State Selection Step */}
                {requiredState && (
                  <div style={{ marginBottom: '20px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                      State <span style={{ color: 'var(--danger)' }}>*</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '10px' }}>
                      Select the state that will be applied to every imported {entityName}.
                    </p>
                    <div style={{ position: 'relative' }} ref={stateSearchRef}>
                      <input
                        type="text"
                        className="form-select"
                        value={selectedState || stateSearch}
                        onChange={(e) => {
                          setStateSearch(e.target.value);
                          setSelectedState('');
                          setStateDropdownOpen(true);
                        }}
                        onFocus={(e) => {
                          setStateDropdownOpen(true);
                          e.target.select();
                        }}
                        style={{ width: '100%' }}
                        placeholder="Search state..."
                      />
                      {stateDropdownOpen && (
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
                          maxHeight: '200px',
                          overflowY: 'auto',
                          marginTop: '4px',
                        }}>
                          {filteredStates.length > 0 ? (
                            filteredStates.map(state => (
                              <div
                                key={state.code}
                                onClick={() => {
                                  setSelectedState(state.name);
                                  setStateSearch('');
                                  setStateDropdownOpen(false);
                                }}
                                style={{
                                  padding: '10px 14px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--gray-100)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  background: selectedState === state.name ? 'var(--primary-light)' : '#fff',
                                }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--gray-50)'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = selectedState === state.name ? 'var(--primary-light)' : '#fff'}
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
                    {!selectedState && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-solid fa-circle-exclamation"></i>
                        Please select a state to continue with the import.
                      </div>
                    )}
                  </div>
                )}

                {(!requiredState || selectedState) && (
                  <>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Paste your data below</div>
                  {!headerIncluded && (
                    <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '4px' }}>
                      Paste only data rows. Header row is not required.
                    </p>
                  )}
                  <div style={{ fontSize: '13px', color: 'var(--gray-500)', margin: '2px 0' }}>
                    <strong>Required:</strong> {fields.filter(f => f.required).map(f => f.label).join(', ')}
                  </div>
                  {fields.filter(f => !f.required).length > 0 && (
                    <div style={{ fontSize: '13px', color: 'var(--gray-500)', margin: '2px 0' }}>
                      <strong>Optional:</strong> {fields.filter(f => !f.required).map(f => f.label).join(', ')}
                    </div>
                  )}
                </div>

                {/* Format display */}
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#3b82f6', fontWeight: 600, marginBottom: '6px' }}>Expected Format:</div>
                  <div style={{ lineHeight: '1.6' }}>
                    <span style={{ color: '#475569' }}>{getSampleHeader()}</span>
                    <br />
                    <span style={{ color: '#64748b' }}>{getSampleRow()}</span>
                  </div>
                </div>

                <textarea
                  style={{ width: '100%', minHeight: '180px', padding: '12px', border: '1px solid var(--gray-300)', borderRadius: '6px', fontSize: '13px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
                  placeholder={headerIncluded ? "Paste CSV data (header + data rows)..." : "Paste data rows only (one per line)...\nE.g.\nSun Pharma,Care Plus,9876543215,careplus@example.com,Asansol,19FGHIJ6789L1Z0"}
                  value={pasteData} onChange={e => setPasteData(e.target.value)}
                />

                <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" onClick={handleParse}><i className="fa-solid fa-eye"></i> Preview</button>
                  <button className="btn btn-outline btn-sm" onClick={downloadTemplate}><i className="fa-solid fa-download"></i> Template</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPasteData('')}><i className="fa-solid fa-eraser"></i> Clear</button>
                </div>

                {parsedRows.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Preview ({parsedRows.length} rows)</h5>
                    <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: '6px' }}>
                      <table style={{ width: '100%', fontSize: '12px' }}>
                        <thead>
                          <tr>
                            {fields.map(f => <th key={f.key} style={{ padding: '8px 10px', position: 'sticky', top: 0, background: '#f8fafc', borderBottom: '1px solid var(--gray-200)' }}>{f.label}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {parsedRows.slice(0, 50).map((row, idx) => (
                            <tr key={idx}>
                              {fields.map(f => <td key={f.key} style={{ padding: '6px 10px', borderBottom: '1px solid var(--gray-100)' }}>{row[f.key] || '-'}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {requiredState && selectedState && (
                      <div style={{ marginTop: '10px', padding: '8px 12px', background: '#eff6ff', borderRadius: '6px', display: 'inline-block' }}>
                        <span style={{ fontSize: '12px', color: '#1e40af' }}>
                          <i className="fa-solid fa-location-dot" style={{ marginRight: '4px' }}></i>
                          All {parsedRows.length} rows will be imported with State: <strong>{selectedState}</strong>
                        </span>
                      </div>
                    )}
                    <div style={{ marginTop: '16px' }}>
                      <button className="btn btn-success" onClick={handleConfirmImport} disabled={importing}>
                        <i className="fa-solid fa-arrow-right"></i> Continue to Import
                      </button>
                    </div>
                  </div>
                )}
                  </>
                )}
              </>
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
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--gray-200)', paddingTop: '16px' }}>
              <button className="btn btn-primary" onClick={reset}><i className="fa-solid fa-rotate"></i> Import More</button>
              <button className="btn btn-secondary" onClick={reset}><i className="fa-solid fa-check"></i> Done</button>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}