import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCategories } from '../../redux/slices/categorySlice';
import { fetchBrands } from '../../redux/slices/brandSlice';
import { fetchSuppliers } from '../../redux/slices/supplierSlice';
import { medicineService } from '../../services/medicineService';
import toast from 'react-hot-toast';

const SAMPLE_ROWS = `Medicine Name, Batch No, Purchase Price, Selling Price, Expiry Date, Stock, Generic Name, GST%, Unit, Barcode
Paracetamol 500mg, BATCH001, 15.00, 25.00, 2025-12-31, 100, Paracetamol, 12, Tablet, 8901234567890
Amoxicillin 250mg, BATCH002, 45.00, 75.00, 2025-11-30, 50, Amoxicillin, 12, Capsule, 8901234567891
Vitamin C 500mg, BATCH003, 30.00, 55.00, 2026-01-15, 200, Ascorbic Acid, 5, Tablet, 
`;

const TEMPLATE_COLUMNS = [
  { key: 'medicineName', label: 'Medicine Name*', required: true },
  { key: 'batchNumber', label: 'Batch No*', required: true },
  { key: 'purchasePrice', label: 'Purchase Price*', required: true },
  { key: 'sellingPrice', label: 'Selling Price*', required: true },
  { key: 'expiryDate', label: 'Expiry Date* (YYYY-MM-DD)', required: true },
  { key: 'currentStock', label: 'Stock', required: false },
  { key: 'genericName', label: 'Generic Name', required: false },
  { key: 'gst', label: 'GST %', required: false },
  { key: 'unit', label: 'Unit (Tablet/Capsule/etc)', required: false },
  { key: 'barcode', label: 'Barcode', required: false },
  { key: 'hsnCode', label: 'HSN Code', required: false },
  { key: 'rackNumber', label: 'Rack No', required: false },
  { key: 'manufacturingDate', label: 'Mfg Date (YYYY-MM-DD)', required: false },
  { key: 'minStockAlert', label: 'Min Stock Alert', required: false },
  { key: 'description', label: 'Description', required: false },
];

export default function BulkImport() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { categories } = useSelector((state) => state.categories);
  const { brands } = useSelector((state) => state.brands);
  const { suppliers } = useSelector((state) => state.suppliers);

  const [activeTab, setActiveTab] = useState('paste'); // 'paste' or 'excel'
  const [pasteData, setPasteData] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  // Default selections
  const [defaultCategory, setDefaultCategory] = useState('');
  const [defaultBrand, setDefaultBrand] = useState('');
  const [defaultSupplier, setDefaultSupplier] = useState('');

  // Results
  const [results, setResults] = useState(null);

  useEffect(() => {
    dispatch(fetchCategories({ limit: 200 }));
    dispatch(fetchBrands({ limit: 200 }));
    dispatch(fetchSuppliers({ limit: 200 }));
  }, [dispatch]);

  const parseCSVLine = (line) => {
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

  const handleParsePaste = () => {
    if (!pasteData.trim()) {
      toast.error('Please paste some data first');
      return;
    }

    const lines = pasteData.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      toast.error('Please include a header row and at least one data row');
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
      if (row.medicinename || row.medicinename === '') {
        rows.push(row);
      }
    }

    if (rows.length === 0) {
      toast.error('No valid data rows found. Check your format.');
      return;
    }

    setParsedRows(rows);
    setShowPreview(true);
    toast.success(`Parsed ${rows.length} medicine(s) from pasted data`);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast.error('File must have a header row and at least one data row');
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
        if (row.medicinename || row.medicinename === '') {
          rows.push(row);
        }
      }

      if (rows.length === 0) {
        toast.error('No valid data rows found in the file');
        return;
      }

      setParsedRows(rows);
      setShowPreview(true);
      toast.success(`Loaded ${rows.length} medicine(s) from file`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const headerLine = TEMPLATE_COLUMNS.map(c => c.label).join(',');
    const sampleLine1 = 'Paracetamol 500mg,BATCH001,15.00,25.00,2025-12-31,100,Paracetamol,12,Tablet,8901234567890,, ,,10,';
    const sampleLine2 = 'Amoxicillin 250mg,BATCH002,45.00,75.00,2025-11-30,50,Amoxicillin,12,Capsule,8901234567891,, ,,10,';
    const csv = `${headerLine}\n${sampleLine1}\n${sampleLine2}`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medicine-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) {
      toast.error('No data to import');
      return;
    }

    if (!defaultCategory) {
      toast.error('Please select a default category');
      return;
    }
    if (!defaultBrand) {
      toast.error('Please select a default brand');
      return;
    }
    if (!defaultSupplier) {
      toast.error('Please select a default supplier');
      return;
    }

    try {
      setImporting(true);
      const payload = {
        medicines: parsedRows,
        defaultCategory,
        defaultBrand,
        defaultSupplier,
      };

      const res = await medicineService.bulkImport(payload);
      const data = res.data?.data;
      setResults(data);

      if (data && data.successCount > 0) {
        toast.success(`${data.successCount} medicine(s) imported successfully!`);
      }
      if (data && data.errorCount > 0) {
        toast.error(`${data.errorCount} medicine(s) failed. Check results for details.`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setPasteData('');
    setParsedRows([]);
    setShowPreview(false);
    setResults(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-cloud-arrow-up" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>Bulk Medicine Import</h2>
          <p>Import hundreds of medicines at once using Excel or Copy-Paste</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/medicines')}>
            <i className="fa-solid fa-arrow-left"></i> Back to Medicines
          </button>
          <button className="btn btn-success btn-sm" onClick={() => navigate('/medicines/new')}>
            <i className="fa-solid fa-plus"></i> Add Single
          </button>
        </div>
      </div>

      {/* Default Selections */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h5><i className="fa-solid fa-gear" style={{ marginRight: '8px', color: '#3b82f6' }}></i>Default Values</h5>
          <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Applied to all imported medicines (unless specified per row)</span>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label>Default Category *</label>
              <select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)}>
                <option value="">-- Select Category --</option>
                {categories?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Default Brand *</label>
              <select value={defaultBrand} onChange={(e) => setDefaultBrand(e.target.value)}>
                <option value="">-- Select Brand --</option>
                {brands?.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Default Supplier *</label>
              <select value={defaultSupplier} onChange={(e) => setDefaultSupplier(e.target.value)}>
                <option value="">-- Select Supplier --</option>
                {suppliers?.map((s) => <option key={s._id} value={s._id}>{s.supplierName}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Import Options */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn btn-sm ${activeTab === 'paste' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActiveTab('paste'); setShowPreview(false); setResults(null); }}
            >
              <i className="fa-solid fa-paste"></i> Paste Data
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'excel' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActiveTab('excel'); setShowPreview(false); setResults(null); }}
            >
              <i className="fa-solid fa-file-excel"></i> Excel / CSV Import
            </button>
          </div>
        </div>
        <div className="card-body">
          {activeTab === 'paste' ? (
            <div>
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ fontSize: '14px' }}>Paste your data below</strong>
                <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>
                  Copy rows from Excel and paste them here. The first row should be column headers.
                  Required columns: <strong>Medicine Name</strong>, <strong>Batch No</strong>, <strong>Purchase Price</strong>, <strong>Selling Price</strong>, <strong>Expiry Date</strong>
                </p>
              </div>

              {/* Sample format */}
              <div style={{
                background: '#f8fafc', padding: '12px', borderRadius: '8px',
                fontSize: '12px', fontFamily: 'monospace', marginBottom: '12px',
                border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', overflowX: 'auto',
              }}>
                <div style={{ color: '#3b82f6', fontWeight: 600, marginBottom: '4px' }}>Sample Format:</div>
                {SAMPLE_ROWS}
              </div>

              <textarea
                style={{
                  width: '100%', minHeight: '200px', padding: '12px',
                  border: '1px solid var(--gray-300)', borderRadius: '8px',
                  fontSize: '13px', fontFamily: 'monospace', resize: 'vertical',
                }}
                placeholder="Paste your CSV data here..."
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
              />

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button className="btn btn-primary" onClick={handleParsePaste}>
                  <i className="fa-solid fa-eye"></i> Preview Data
                </button>
                <button className="btn btn-secondary" onClick={() => setPasteData('')}>
                  <i className="fa-solid fa-eraser"></i> Clear
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <i className="fa-solid fa-file-excel" style={{ fontSize: '48px', color: '#22c55e', marginBottom: '12px' }}></i>
              <h4 style={{ marginBottom: '8px' }}>Import from CSV File</h4>
              <p style={{ color: 'var(--gray-500)', fontSize: '14px', marginBottom: '20px', maxWidth: '500px', margin: '0 auto 20px' }}>
                Upload a CSV file with your medicine data. 
                <br />Download the template first to see the required format.
              </p>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-success" onClick={downloadTemplate}>
                  <i className="fa-solid fa-download"></i> Download Template
                </button>
                <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                  <i className="fa-solid fa-upload"></i> Select CSV File
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview & Results */}
      {showPreview && parsedRows.length > 0 && !results && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h5><i className="fa-solid fa-eye" style={{ marginRight: '8px', color: '#3b82f6' }}></i>Preview ({parsedRows.length} rows)</h5>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-success btn-sm" onClick={handleImport} disabled={importing}>
                {importing ? (
                  <><i className="fa-solid fa-spinner fa-spin"></i> Importing...</>
                ) : (
                  <><i className="fa-solid fa-check"></i> Import All</>
                )}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={resetImport}>
                <i className="fa-solid fa-xmark"></i> Cancel
              </button>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Medicine Name</th>
                    <th>Batch No</th>
                    <th>Purchase Price</th>
                    <th>Selling Price</th>
                    <th>Expiry Date</th>
                    <th>Stock</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 500 }}>{row.medicinename || row['medicine name'] || '-'}</td>
                      <td>{row.batchno || row['batch no'] || row.batchnumber || row['batch number'] || '-'}</td>
                      <td>{row.purchaseprice || row['purchase price'] || '-'}</td>
                      <td>{row.sellingprice || row['selling price'] || '-'}</td>
                      <td>{row.expirydate || row['expiry date'] || '-'}</td>
                      <td>{row.stock || row.currentstock || row['current stock'] || '0'}</td>
                      <td>{row.unit || 'Tablet'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Import Results */}
      {results && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h5>
              <i className="fa-solid fa-list-check" style={{ marginRight: '8px', color: results.errorCount > 0 ? '#f59e0b' : '#22c55e' }}></i>
              Import Results
            </h5>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/medicines')}>
              <i className="fa-solid fa-eye"></i> View Medicines
            </button>
          </div>
          <div className="card-body">
            {/* Summary */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{
                padding: '16px 24px', borderRadius: '8px', background: '#f0fdf4',
                border: '1px solid #bbf7d0', textAlign: 'center', minWidth: '140px',
              }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#16a34a' }}>{results.successCount}</div>
                <div style={{ fontSize: '12px', color: '#166534', fontWeight: 500 }}>Success</div>
              </div>
              {results.errorCount > 0 && (
                <div style={{
                  padding: '16px 24px', borderRadius: '8px', background: '#fef2f2',
                  border: '1px solid #fecaca', textAlign: 'center', minWidth: '140px',
                }}>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626' }}>{results.errorCount}</div>
                  <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: 500 }}>Failed</div>
                </div>
              )}
              <div style={{
                padding: '16px 24px', borderRadius: '8px', background: '#f8fafc',
                border: '1px solid #e2e8f0', textAlign: 'center', minWidth: '140px',
              }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--gray-800)' }}>{results.totalProcessed}</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 500 }}>Total</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={resetImport} style={{ alignSelf: 'center' }}>
                <i className="fa-solid fa-rotate"></i> Import More
              </button>
            </div>

            {/* Error Details */}
            {results.errors?.length > 0 && (
              <div>
                <h6 style={{ color: '#dc2626', marginBottom: '8px', fontSize: '14px' }}>
                  <i className="fa-solid fa-circle-exclamation"></i> Failed Rows Details
                </h6>
                <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Medicine</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.errors.map((err, idx) => (
                        <tr key={idx}>
                          <td>{err.row}</td>
                          <td>{err.data?.medicineName || err.data?.medicinename || '-'}</td>
                          <td style={{ color: '#dc2626' }}>{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Success Details */}
            {results.success?.length > 0 && (
              <div style={{ marginTop: results.errors?.length ? '20px' : 0 }}>
                <h6 style={{ color: '#16a34a', marginBottom: '8px', fontSize: '14px' }}>
                  <i className="fa-solid fa-check-circle"></i> Successfully Imported ({results.successCount})
                </h6>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}