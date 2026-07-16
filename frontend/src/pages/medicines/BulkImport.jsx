import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCategories } from '../../redux/slices/categorySlice';
import { fetchBrands } from '../../redux/slices/brandSlice';
import { fetchSuppliers } from '../../redux/slices/supplierSlice';
import { medicineService } from '../../services/medicineService';
import { confirmAction } from '../../utils/sweetAlert';
import toast from 'react-hot-toast';

// All fields mapped from the Medicine model for the import template
const TEMPLATE_COLUMNS = [
  { key: 'medicineName', label: 'Medicine Name*', required: true, desc: 'Full name of the medicine' },
  { key: 'batchNumber', label: 'Batch No*', required: true, desc: 'Unique batch/lot number' },
  { key: 'purchasePrice', label: 'Purchase Price*', required: true, desc: 'Cost price per unit' },
  { key: 'sellingPrice', label: 'Selling Price*', required: true, desc: 'Retail price per unit' },
  { key: 'expiryDate', label: 'Expiry Date*', required: true, desc: 'YYYY-MM-DD format' },
  { key: 'currentStock', label: 'Stock Qty', required: false, desc: 'Initial stock quantity' },
  { key: 'genericName', label: 'Generic Name', required: false, desc: 'Generic/chemical name' },
  { key: 'gst', label: 'GST %', required: false, desc: 'GST percentage (0-100)' },
  { key: 'unit', label: 'Unit', required: false, desc: 'Tablet/Capsule/Syrup/Bottle/Strip' },
  { key: 'barcode', label: 'Barcode', required: false, desc: 'Unique barcode number' },
  { key: 'hsnCode', label: 'HSN Code', required: false, desc: 'HSN/SAC code' },
  { key: 'rackNumber', label: 'Rack No', required: false, desc: 'Storage rack/shelf number' },
  { key: 'manufacturingDate', label: 'Mfg Date', required: false, desc: 'YYYY-MM-DD' },
  { key: 'minStockAlert', label: 'Min Stock Alert', required: false, desc: 'Low stock threshold' },
  { key: 'description', label: 'Description', required: false, desc: 'Additional notes' },
];

const REQUIRED_COLS = TEMPLATE_COLUMNS.filter(c => c.required).map(c => c.label).join(', ');

export default function BulkImport() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { items: categories } = useSelector((state) => state.categories);
  const { items: brands } = useSelector((state) => state.brands);
  const { items: suppliers } = useSelector((state) => state.suppliers);

  const [activeTab, setActiveTab] = useState('paste');
  const [pasteData, setPasteData] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);

  // Required default selections
  const [defaultCategory, setDefaultCategory] = useState('');
  const [defaultBrand, setDefaultBrand] = useState('');
  const [defaultSupplier, setDefaultSupplier] = useState('');

  const [results, setResults] = useState(null);

  const allSelectionsMade = defaultCategory && defaultBrand && defaultSupplier;

  // Load active categories, brands, suppliers from DB
  useEffect(() => {
    dispatch(fetchCategories({ limit: 200 }));
    dispatch(fetchBrands({ limit: 200 }));
    dispatch(fetchSuppliers({ limit: 200 }));
  }, [dispatch]);

  // Get selected names for template
  const selectedCategoryName = categories?.find(c => c._id === defaultCategory)?.name || '';
  const selectedBrandName = brands?.find(b => b._id === defaultBrand)?.name || '';
  const selectedSupplierName = suppliers?.find(s => s._id === defaultSupplier)?.supplierName || '';

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

  const parseData = (text) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 1) {
      toast.error('No data found to parse');
      return null;
    }

    // Known header labels (exact match against comma-separated values)
    const knownHeaders = [
      'medicine name', 'batch no', 'batch number', 'purchase price', 'selling price',
      'expiry date', 'expiry', 'stock qty', 'current stock', 'stock',
      'generic name', 'gst', 'gst %', 'unit', 'barcode',
      'hsn code', 'hsn', 'rack no', 'rack number', 'rack',
      'mfg date', 'manufacturing date', 'min stock alert', 'min stock', 'description'
    ];

    const firstLineValues = parseCSVLine(lines[0]);
    const trimmedLower = firstLineValues.map(v => v.trim().toLowerCase().replace(/[*]/g, ''));

    // Detect header: check if any complete value matches a known header label
    const hasHeader = trimmedLower.some(val => knownHeaders.includes(val));

    let headers;
    let dataStartIndex;

    if (hasHeader) {
      // First line is a header row — derive keys from header labels
      headers = firstLineValues.map(h =>
        h.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      dataStartIndex = 1;
      if (lines.length < 2) {
        toast.error('Header row found but no data rows detected');
        return null;
      }
    } else {
      // No header — assume standard column order
      headers = ['medicinename', 'batchno', 'purchaseprice', 'sellingprice', 'expirydate', 'currentstock', 'genericname', 'gst', 'unit', 'barcode', 'hsncode', 'racknumber', 'manufacturingdate', 'minstockalert', 'description'];
      dataStartIndex = 0;
    }

    const rows = [];
    for (let i = dataStartIndex; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row = {};
      let valid = true;
      headers.forEach((header, idx) => {
        row[header] = (idx < values.length) ? values[idx].trim() : '';
      });
      // Validate: medicine name (first column) must be non-empty
      const firstName = row[headers[0]];
      if (!firstName) {
        valid = false;
      }
      if (valid) {
        rows.push(row);
      }
    }
    return rows;
  };

  const handleParsePaste = () => {
    if (!pasteData.trim()) { toast.error('Please paste some data first'); return; }
    if (!allSelectionsMade) { toast.error('Please select Category, Brand, and Supplier first'); return; }
    const rows = parseData(pasteData);
    if (!rows || rows.length === 0) { toast.error('No valid data rows found'); return; }
    setParsedRows(rows);
    setShowPreview(true);
    toast.success(`Parsed ${rows.length} medicine(s)`);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!allSelectionsMade) { toast.error('Please select Category, Brand, and Supplier first'); return; }
    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = parseData(event.target.result);
      if (!rows || rows.length === 0) { toast.error('No valid data rows found'); return; }
      setParsedRows(rows);
      setShowPreview(true);
      toast.success(`Loaded ${rows.length} medicine(s)`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const downloadTemplate = () => {
    if (!allSelectionsMade) {
      toast.error('Please select Category, Brand, and Supplier before downloading template');
      return;
    }
    const headerLine = TEMPLATE_COLUMNS.map(c => c.label).join(',');
    const sampleValues = TEMPLATE_COLUMNS.map(c => {
      const samples = {
        medicineName: 'Paracetamol 500mg',
        batchNumber: 'BATCH001',
        purchasePrice: '15.00',
        sellingPrice: '25.00',
        expiryDate: '2025-12-31',
        currentStock: '100',
        genericName: 'Paracetamol',
        gst: '12',
        unit: 'Tablet',
        barcode: '8901234567890',
        hsnCode: '300490',
        rackNumber: 'A-12',
        manufacturingDate: '2024-01-15',
        minStockAlert: '10',
        description: 'For fever & pain relief',
      };
      return samples[c.key] || '';
    }).join(',');

    const csv = `${headerLine}\n${sampleValues}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medicine-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Template downloaded with your selected defaults');
  };

  // Map parsed row keys to backend camelCase field names
  const mapRowToBackend = (row) => {
    const fieldMap = {
      medicinename: 'medicineName',
      'medicine name': 'medicineName',
      'medicine name*': 'medicineName',
      batchno: 'batchNumber',
      'batch no': 'batchNumber',
      'batch no*': 'batchNumber',
      batchnumber: 'batchNumber',
      'batch number': 'batchNumber',
      'batch number*': 'batchNumber',
      purchaseprice: 'purchasePrice',
      'purchase price': 'purchasePrice',
      'purchase price*': 'purchasePrice',
      sellingprice: 'sellingPrice',
      'selling price': 'sellingPrice',
      'selling price*': 'sellingPrice',
      expirydate: 'expiryDate',
      'expiry date': 'expiryDate',
      'expiry date*': 'expiryDate',
      expiry: 'expiryDate',
      currentstock: 'currentStock',
      'current stock': 'currentStock',
      'stock qty': 'currentStock',
      stock: 'currentStock',
      genericname: 'genericName',
      'generic name': 'genericName',
      gst: 'gst',
      'gst %': 'gst',
      'gst%': 'gst',
      unit: 'unit',
      barcode: 'barcode',
      hsncode: 'hsnCode',
      'hsn code': 'hsnCode',
      hsn: 'hsnCode',
      racknumber: 'rackNumber',
      'rack number': 'rackNumber',
      'rack no': 'rackNumber',
      rack: 'rackNumber',
      manufacturingdate: 'manufacturingDate',
      'manufacturing date': 'manufacturingDate',
      'mfg date': 'manufacturingDate',
      minstockalert: 'minStockAlert',
      'min stock alert': 'minStockAlert',
      'min stock': 'minStockAlert',
      description: 'description',
    };
    const mapped = {};
    for (const [key, value] of Object.entries(row)) {
      const backendKey = fieldMap[key.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()] || key;
      mapped[backendKey] = value;
    }
    return mapped;
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) { toast.error('No data to import'); return; }
    if (!allSelectionsMade) { toast.error('Please complete all default selections'); return; }

    // Show confirmation dialog with row count
    const confirmed = await confirmAction(
      'Confirm Bulk Import',
      `You are about to import ${parsedRows.length} medicine(s) with defaults:\n\nCategory: ${selectedCategoryName}\nBrand: ${selectedBrandName}\nSupplier: ${selectedSupplierName}`,
      `Import ${parsedRows.length} Medicine(s)`
    );
    if (!confirmed) return;

    try {
      setImporting(true);
      const payload = {
        medicines: parsedRows.map(mapRowToBackend),
        defaultCategory,
        defaultBrand,
        defaultSupplier,
      };
      const res = await medicineService.bulkImport(payload);
      const data = res.data?.data;
      setResults(data);
      if (data?.successCount > 0) toast.success(`${data.successCount} medicine(s) imported!`);
      if (data?.errorCount > 0) toast.error(`${data.errorCount} failed. Check details.`);
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

      {/* Step 1: Default Selections — must be completed first */}
      <div className="card" style={{ marginBottom: '20px', borderLeft: allSelectionsMade ? '4px solid #22c55e' : '4px solid #f59e0b' }}>
        <div className="card-header">
          <h5>
            <i className="fa-solid fa-gear" style={{ marginRight: '8px', color: '#3b82f6' }}></i>
            Step 1: Set Default Values
            {allSelectionsMade && <span style={{ marginLeft: '10px', fontSize: '12px', color: '#16a34a', fontWeight: 500 }}><i className="fa-solid fa-check-circle"></i> Ready</span>}
          </h5>
          <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
            These values will be automatically applied to every imported medicine
          </span>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label>Default Category *</label>
              <select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)}>
                <option value="">-- Select Category --</option>
                {categories?.filter(c => c.status !== false).map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
              {!defaultCategory && <small style={{ color: '#f59e0b' }}>Required</small>}
            </div>
            <div className="form-group">
              <label>Default Brand *</label>
              <select value={defaultBrand} onChange={(e) => setDefaultBrand(e.target.value)}>
                <option value="">-- Select Brand --</option>
                {brands?.filter(b => b.status !== false).map((b) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
              {!defaultBrand && <small style={{ color: '#f59e0b' }}>Required</small>}
            </div>
            <div className="form-group">
              <label>Default Supplier *</label>
              <select value={defaultSupplier} onChange={(e) => setDefaultSupplier(e.target.value)}>
                <option value="">-- Select Supplier --</option>
                {suppliers?.filter(s => s.status !== false).map((s) => (
                  <option key={s._id} value={s._id}>{s.supplierName}</option>
                ))}
              </select>
              {!defaultSupplier && <small style={{ color: '#f59e0b' }}>Required</small>}
            </div>
          </div>

          {/* Show summary when selected */}
          {allSelectionsMade && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '13px' }}>
              <i className="fa-solid fa-check-circle" style={{ color: '#16a34a', marginRight: '6px' }}></i>
              <strong>Defaults configured:</strong> Category: <strong>{selectedCategoryName}</strong> | Brand: <strong>{selectedBrandName}</strong> | Supplier: <strong>{selectedSupplierName}</strong>
              <span style={{ display: 'block', marginTop: '4px', color: 'var(--gray-600)', fontSize: '12px' }}>
                These values are now set. The CSV template will only include medicine-specific fields.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Import Options — only active when defaults are set */}
      <div className="card" style={{ marginBottom: '20px', opacity: allSelectionsMade ? 1 : 0.6 }}>
        <div className="card-header">
          <h5>
            <i className="fa-solid fa-file-import" style={{ marginRight: '8px', color: '#22c55e' }}></i>
            Step 2: Choose Import Method
            {!allSelectionsMade && <span style={{ marginLeft: '10px', fontSize: '12px', color: '#f59e0b' }}>Complete Step 1 first</span>}
          </h5>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn btn-sm ${activeTab === 'paste' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { if (allSelectionsMade) { setActiveTab('paste'); setShowPreview(false); setResults(null); } else { toast.error('Complete Step 1 first'); } }}
            >
              <i className="fa-solid fa-paste"></i> Paste Data
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'excel' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { if (allSelectionsMade) { setActiveTab('excel'); setShowPreview(false); setResults(null); } else { toast.error('Complete Step 1 first'); } }}
            >
              <i className="fa-solid fa-file-excel"></i> Excel / CSV Import
            </button>
          </div>
        </div>
        <div className="card-body">
          {!allSelectionsMade ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--gray-500)' }}>
              <i className="fa-solid fa-lock" style={{ fontSize: '32px', marginBottom: '10px' }}></i>
              <p>Please select Category, Brand, and Supplier above to enable import options</p>
            </div>
          ) : activeTab === 'paste' ? (
            <div>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <strong style={{ fontSize: '14px' }}>Paste your data below</strong>
                  <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>
                    First row = column headers. Required: <strong>{REQUIRED_COLS}</strong>
                  </p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={downloadTemplate}>
                  <i className="fa-solid fa-download"></i> Download Template
                </button>
              </div>

              {/* Example Format Display */}
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
                padding: '14px 16px', marginBottom: '12px', fontSize: '13px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <i className="fa-solid fa-lightbulb" style={{ color: '#f59e0b', fontSize: '15px' }}></i>
                  <strong style={{ color: 'var(--gray-700)', fontSize: '14px' }}>Example Format</strong>
                  <span style={{ color: 'var(--gray-500)', fontSize: '12px' }}>
                    — Copy the format below and replace with your data
                  </span>
                </div>
                <div style={{
                  background: '#1e293b', color: '#e2e8f0', borderRadius: '6px',
                  padding: '12px 14px', fontFamily: 'monospace', fontSize: '12px',
                  lineHeight: '1.7', overflowX: 'auto', whiteSpace: 'nowrap',
                }}>
                  <div style={{ color: '#94a3b8', marginBottom: '4px', fontSize: '11px' }}>
                    {`// Header row (column names) — keep exactly as shown below`}
                  </div>
                  <div>Medicine Name,Batch No,Purchase Price,Selling Price,Expiry Date,Stock,Generic Name,GST%,Unit,Barcode</div>
                  <div style={{ color: '#94a3b8', margin: '4px 0', fontSize: '11px' }}>
                    {`// Data row (replace values with your own medicine data)`}
                  </div>
                  <div style={{ color: '#22c55e' }}>Amoxicillin 250mg Capsule,BATCH-AX-101,28.50,45.00,2026-08-15,200,Amoxicillin,12,Strip,8901234567123</div>
                  <div style={{ color: '#94a3b8', marginTop: '4px', fontSize: '11px' }}>
                    {`// Tip: Include one medicine per row. Required fields: Medicine Name, Batch No, Purchase Price, Selling Price, Expiry Date`}
                  </div>
                </div>
              </div>

              <textarea
                style={{
                  width: '100%', minHeight: '180px', padding: '12px',
                  border: '1px solid var(--gray-300)', borderRadius: '8px',
                  fontSize: '13px', fontFamily: 'monospace', resize: 'vertical',
                }}
                placeholder="Paste your CSV data here...&#10;&#10;Medicine Name,Batch No,Purchase Price,Selling Price,Expiry Date,Stock,Generic Name,GST%,Unit,Barcode&#10;Paracetamol 500mg,BATCH001,15.00,25.00,2025-12-31,100,Paracetamol,12,Tablet,8901234567890"
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
              />

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button className="btn btn-primary" onClick={handleParsePaste} disabled={!pasteData.trim()}>
                  <i className="fa-solid fa-eye"></i> Preview Data
                </button>
                <button className="btn btn-secondary" onClick={() => setPasteData('')}>
                  <i className="fa-solid fa-eraser"></i> Clear
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px' }}>
              <i className="fa-solid fa-file-excel" style={{ fontSize: '48px', color: '#22c55e', marginBottom: '12px' }}></i>
              <h4 style={{ marginBottom: '8px' }}>Import from CSV File</h4>
              <p style={{ color: 'var(--gray-500)', fontSize: '14px', marginBottom: '20px', maxWidth: '500px', margin: '0 auto' }}>
                Download the template first to see the required format. Fill in your medicine data and upload the file.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-success" onClick={downloadTemplate}>
                  <i className="fa-solid fa-download"></i> Download Template
                </button>
                <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                  <i className="fa-solid fa-upload"></i> Select CSV File
                  <input type="file" accept=".csv,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      {showPreview && parsedRows.length > 0 && !results && (
        <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid #3b82f6' }}>
          <div className="card-header">
            <h5><i className="fa-solid fa-eye" style={{ marginRight: '8px', color: '#3b82f6' }}></i>Preview ({parsedRows.length} rows)</h5>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-success btn-sm" onClick={handleImport} disabled={importing}>
                {importing ? <><i className="fa-solid fa-spinner fa-spin"></i> Importing...</> : <><i className="fa-solid fa-check"></i> Import All ({parsedRows.length})</>}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={resetImport}><i className="fa-solid fa-xmark"></i> Cancel</button>
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

      {/* Results */}
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
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ padding: '16px 24px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', textAlign: 'center', minWidth: '140px' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#16a34a' }}>{results.successCount}</div>
                <div style={{ fontSize: '12px', color: '#166534', fontWeight: 500 }}>Success</div>
              </div>
              {results.errorCount > 0 && (
                <div style={{ padding: '16px 24px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', textAlign: 'center', minWidth: '140px' }}>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626' }}>{results.errorCount}</div>
                  <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: 500 }}>Failed</div>
                </div>
              )}
              <div style={{ padding: '16px 24px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center', minWidth: '140px' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--gray-800)' }}>{results.totalProcessed}</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 500 }}>Total</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={resetImport} style={{ alignSelf: 'center' }}>
                <i className="fa-solid fa-rotate"></i> Import More
              </button>
            </div>
            {results.errors?.length > 0 && (
              <div>
                <h6 style={{ color: '#dc2626', marginBottom: '8px', fontSize: '14px' }}>
                  <i className="fa-solid fa-circle-exclamation"></i> Failed Rows Details
                </h6>
                <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table>
                    <thead><tr><th>Row</th><th>Medicine</th><th>Reason</th></tr></thead>
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