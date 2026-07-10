import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchCategories } from '../../redux/slices/categorySlice';
import { fetchBrands } from '../../redux/slices/brandSlice';
import { fetchSuppliers } from '../../redux/slices/supplierSlice';
import {
  createMedicine,
  updateMedicine,
  fetchMedicine,
  clearSelectedMedicine,
} from '../../redux/slices/medicineSlice';
import { medicineService } from '../../services/medicineService';
import { showSuccess, showError, showWarning, showInfo } from '../../utils/sweetAlert';
import { useAuth } from '../../hooks/useAuth';

const initialFormState = {
  medicineName: '',
  genericName: '',
  category: '',
  brand: '',
  supplier: '',
  hsnCode: '',
  batchNumber: '',
  barcode: '',
  manufacturingDate: '',
  expiryDate: '',
  purchasePrice: '',
  sellingPrice: '',
  gst: '',
  currentStock: '',
  minStockAlert: '10',
  unit: 'Tablet',
  rackNumber: '',
  description: '',
  status: true,
};

export default function MedicineForm() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const { selectedMedicine } = useSelector((state) => state.medicines);
  const { items: categories } = useSelector((state) => state.categories);
  const { items: brands } = useSelector((state) => state.brands);
  const { items: suppliers } = useSelector((state) => state.suppliers);
  const { isCashier } = useAuth();

  const [formData, setFormData] = useState(initialFormState);
  const [imagePreview, setImagePreview] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Substitute medicines state
  const [substituteIds, setSubstituteIds] = useState([]);
  const [substituteSearchQuery, setSubstituteSearchQuery] = useState('');
  const [substituteSearchResults, setSubstituteSearchResults] = useState([]);
  const [showSubstituteDropdown, setShowSubstituteDropdown] = useState(false);
  const [allMedicines, setAllMedicines] = useState([]);

  // Barcode scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [scannerPermission, setScannerPermission] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');

  // Barcode lookup state
  const [barcodeChecking, setBarcodeChecking] = useState(false);
  const [barcodeLookupMessage, setBarcodeLookupMessage] = useState('');

  const scannerInstanceRef = useRef(null);
  const scannerContainerRef = useRef(null);
  const isProcessingScan = useRef(false);
  const formDataRef = useRef(formData);
  const barcodeCheckInProgress = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    dispatch(fetchCategories({ limit: 100 }));
    dispatch(fetchBrands({ limit: 100 }));
    dispatch(fetchSuppliers({ limit: 100 }));

    // Load all medicines for substitute selection
    medicineService.getMedicines({ limit: 1000 }).then(res => {
      if (res.data?.data) {
        setAllMedicines(res.data.data);
      }
    }).catch(() => {});

    if (isEditing && id) {
      dispatch(fetchMedicine(id));
    }

    return () => {
      cleanupScanner();
      dispatch(clearSelectedMedicine());
    };
  }, [dispatch, id, isEditing]);

  useEffect(() => {
    if (isEditing && selectedMedicine) {
      setFormData({
        medicineName: selectedMedicine.medicineName || '',
        genericName: selectedMedicine.genericName || '',
        category: selectedMedicine.category?._id || '',
        brand: selectedMedicine.brand?._id || '',
        supplier: selectedMedicine.supplier?._id || '',
        hsnCode: selectedMedicine.hsnCode || '',
        batchNumber: selectedMedicine.batchNumber || '',
        barcode: selectedMedicine.barcode || '',
        manufacturingDate: selectedMedicine.manufacturingDate ? selectedMedicine.manufacturingDate.split('T')[0] : '',
        expiryDate: selectedMedicine.expiryDate ? selectedMedicine.expiryDate.split('T')[0] : '',
        purchasePrice: selectedMedicine.purchasePrice || '',
        sellingPrice: selectedMedicine.sellingPrice || '',
        gst: selectedMedicine.gst || '',
        currentStock: selectedMedicine.currentStock ?? '',
        minStockAlert: selectedMedicine.minStockAlert || '10',
        unit: selectedMedicine.unit || 'Tablet',
        rackNumber: selectedMedicine.rackNumber || '',
        description: selectedMedicine.description || '',
        status: selectedMedicine.status ?? true,
      });
      if (selectedMedicine.medicineImage) {
        setImagePreview(selectedMedicine.medicineImage);
      }
      // Load existing substitutes
      if (selectedMedicine.substituteMedicines && selectedMedicine.substituteMedicines.length > 0) {
        const ids = selectedMedicine.substituteMedicines.map(s => s._id || s);
        setSubstituteIds(ids);
      }
    }
  }, [selectedMedicine, isEditing]);

  // --- Scanner Functions ---

  const cleanupScanner = useCallback(async () => {
    if (scannerInstanceRef.current) {
      try {
        await scannerInstanceRef.current.stop();
        scannerInstanceRef.current.clear();
      } catch (err) {
        // Ignore cleanup errors
      }
      scannerInstanceRef.current = null;
    }
    setShowScanner(false);
    setScannerLoading(false);
    setScannerError('');
    setScannerPermission(false);
    setAvailableCameras([]);
    setSelectedCameraId('');
    isProcessingScan.current = false;
  }, []);

  const getAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      if (videoDevices.length > 0) {
        // Prefer environment (rear) camera
        const rearCam = videoDevices.find(
          (d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment')
        );
        setSelectedCameraId(rearCam ? rearCam.deviceId : videoDevices[0].deviceId);
      }
      return videoDevices;
    } catch (err) {
      return [];
    }
  };

  const startScanner = async () => {
    setScannerError('');
    setScannerLoading(true);
    setShowScanner(true);
    setScannerPermission(false);

    try {
      // First request camera permission explicitly
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      // Stop the test stream immediately; we just needed permission
      stream.getTracks().forEach((track) => track.stop());
      setScannerPermission(true);

      // Get available cameras
      await getAvailableCameras();

      // Dynamically import html5-qrcode
      const { Html5Qrcode } = await import('html5-qrcode');

      if (scannerInstanceRef.current) {
        await scannerInstanceRef.current.stop().catch(() => {});
        scannerInstanceRef.current.clear().catch(() => {});
        scannerInstanceRef.current = null;
      }

      // Create scanner with specific element ID
      if (scannerContainerRef.current) {
        scannerContainerRef.current.innerHTML = '';
      }

      scannerInstanceRef.current = new Html5Qrcode('barcode-scanner-reader');

      const cameraConfig = selectedCameraId
        ? { deviceId: { exact: selectedCameraId } }
        : { facingMode: 'environment' };

      isProcessingScan.current = false;

      await scannerInstanceRef.current.start(
        cameraConfig,
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          // Prevent duplicate scans
          if (isProcessingScan.current) return;

          isProcessingScan.current = true;
          handleBarcodeDetected(decodedText);
        },
        () => {}
      );

      setScannerLoading(false);
    } catch (err) {
      setScannerLoading(false);
      console.error('Scanner error:', err);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setScannerError('Camera permission denied. Please allow camera access and try again, or type the barcode manually.');
      } else if (err.name === 'NotFoundError') {
        setScannerError('No camera found on this device. Please type the barcode manually.');
      } else if (err.name === 'NotReadableError') {
        setScannerError('Camera is already in use by another application. Please close other apps and try again.');
      } else {
        setScannerError('Failed to access camera. Please try typing the barcode manually.');
      }
    }
  };

  const switchCamera = async (deviceId) => {
    setSelectedCameraId(deviceId);
    setScannerLoading(true);
    setScannerError('');

    try {
      if (scannerInstanceRef.current) {
        await scannerInstanceRef.current.stop().catch(() => {});
      }

      const { Html5Qrcode } = await import('html5-qrcode');

      if (scannerContainerRef.current) {
        scannerContainerRef.current.innerHTML = '';
      }

      scannerInstanceRef.current = new Html5Qrcode('barcode-scanner-reader');

      isProcessingScan.current = false;

      await scannerInstanceRef.current.start(
        { deviceId: { exact: deviceId } },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          if (isProcessingScan.current) return;

          isProcessingScan.current = true;
          handleBarcodeDetected(decodedText);
        },
        () => {}
      );

      setScannerLoading(false);
    } catch (err) {
      setScannerLoading(false);
      setScannerError('Failed to switch camera. Please try again.');
    }
  };

  const stopScanner = async () => {
    await cleanupScanner();
  };

  // --- Barcode Handling ---

  const handleBarcodeDetected = async (barcode) => {
    // Prevent concurrent barcode lookups
    if (barcodeCheckInProgress.current) return;
    barcodeCheckInProgress.current = true;

    try {
      // Fill barcode field immediately
      setFormData((prev) => ({ ...prev, barcode }));
      setBarcodeLookupMessage('');
      setBarcodeChecking(true);

      // Close scanner overlay immediately after successful scan
      await cleanupScanner();

      // Lookup barcode - this checks our DB first, then external API
      const lookupResponse = await medicineService.lookupBarcode(barcode);
      const lookupData = lookupResponse.data;

      if (lookupData.data?.found) {
        if (lookupData.data.inDatabase) {
          // 🟢 Barcode found in our database - load all medicine details
          const existing = lookupData.data.medicine;
          showInfo('Medicine found in database! Loading details.');

          setFormData((prev) => ({
            ...prev,
            medicineName: existing.medicineName || '',
            genericName: existing.genericName || '',
            category: existing.category?._id || existing.category || '',
            brand: existing.brand?._id || existing.brand || '',
            supplier: existing.supplier?._id || existing.supplier || '',
            barcode: barcode,
            hsnCode: existing.hsnCode || '',
            unit: existing.unit || 'Tablet',
            rackNumber: existing.rackNumber || '',
            description: existing.description || '',
            // The user still needs to enter batch-specific fields
            batchNumber: '',
            manufacturingDate: '',
            expiryDate: '',
            purchasePrice: '',
            sellingPrice: '',
            gst: existing.gst || '',
            currentStock: '',
            minStockAlert: existing.minStockAlert || '10',
            status: true,
          }));

          // Load image preview if exists
          if (existing.medicineImage) {
            setImagePreview(existing.medicineImage);
          }
        } else if (lookupData.data.autoFill) {
          // 🟡 Barcode found in external API - auto-fill what we can
          const auto = lookupData.data.autoFill;
          showInfo('Medicine found! Auto-filling details.');

          let matchedCategory = '';
          let matchedBrand = '';

          if (auto.category && categories?.length > 0) {
            const cat = categories.find(
              (c) => auto.category.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(auto.category.toLowerCase())
            );
            if (cat) matchedCategory = cat._id;
          }

          if (auto.brand && brands?.length > 0) {
            const br = brands.find(
              (b) => auto.brand.toLowerCase().includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(auto.brand.toLowerCase())
            );
            if (br) matchedBrand = br._id;
          }

          setFormData((prev) => ({
            ...prev,
            medicineName: auto.medicineName || prev.medicineName,
            genericName: auto.genericName || prev.genericName,
            barcode: barcode,
            category: matchedCategory || prev.category,
            brand: matchedBrand || prev.brand,
          }));
        }
      } else {
        // 🔴 Barcode not found anywhere
        showInfo('Medicine not found. Please enter the details manually.');
        // Keep the scanned barcode in the barcode field
        setFormData((prev) => ({ ...prev, barcode }));
      }
    } catch (err) {
      showInfo('Medicine not found in database. Please enter the details manually.');
      setFormData((prev) => ({ ...prev, barcode }));
    } finally {
      setBarcodeChecking(false);
      barcodeCheckInProgress.current = false;
    }
  };

  // --- Manual Barcode Validation ---
  // Uses formDataRef to avoid stale closure issues in event handlers

  const validateBarcode = async (barcodeValue) => {
    // Skip validation if barcode is empty or null
    if (!barcodeValue || !barcodeValue.trim()) {
      setBarcodeLookupMessage('');
      return true;
    }

    // Prevent concurrent validations
    if (barcodeCheckInProgress.current) return false;
    barcodeCheckInProgress.current = true;

    setBarcodeChecking(true);
    try {
      const response = await medicineService.checkBarcode(barcodeValue.trim(), isEditing ? id : null);
      const data = response.data;

      if (data.data?.exists) {
        setBarcodeLookupMessage('Barcode already exists in your pharmacy.');
        showWarning('Barcode already exists!');
        return false;
      }

      setBarcodeLookupMessage('');
      return true;
    } catch (err) {
      setBarcodeLookupMessage('');
      return true; // Allow submission if validation fails
    } finally {
      setBarcodeChecking(false);
      barcodeCheckInProgress.current = false;
    }
  };

  // --- Form Handling ---

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    // Immediately update ref for synchronous access
    formDataRef.current = {
      ...formDataRef.current,
      [name]: newValue,
    };

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    // If barcode field changed manually, clear lookup message
    if (name === 'barcode') {
      setBarcodeLookupMessage('');
    }
  };

  const handleBarcodeBlur = (e) => {
    const barcodeValue = e.target.value;
    // Only validate if barcode is non-empty
    if (barcodeValue && barcodeValue.trim()) {
      validateBarcode(barcodeValue);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Use ref to get latest form data values (avoids stale closure issues)
    const currentData = formDataRef.current;

    if (!currentData.medicineName.trim()) { showError('Medicine name is required'); return; }
    if (!currentData.category) { showError('Category is required'); return; }
    if (!currentData.brand) { showError('Brand is required'); return; }
    if (!currentData.supplier) { showError('Supplier is required'); return; }
    if (!currentData.batchNumber.trim()) { showError('Batch number is required'); return; }
    if (!currentData.expiryDate) { showError('Expiry date is required'); return; }
    if (!currentData.purchasePrice || parseFloat(currentData.purchasePrice) <= 0) { showError('Purchase price must be greater than 0'); return; }
    if (!currentData.sellingPrice || parseFloat(currentData.sellingPrice) <= 0) { showError('Selling price must be greater than 0'); return; }
    if (currentData.manufacturingDate && currentData.expiryDate && new Date(currentData.manufacturingDate) >= new Date(currentData.expiryDate)) {
      showError('Manufacturing date must be before expiry date');
      return;
    }

    // Validate barcode if provided before submission
    const barcodeValue = currentData.barcode;
    if (barcodeValue && barcodeValue.trim()) {
      const isValid = await validateBarcode(barcodeValue);
      if (!isValid) return;
    }

    setSubmitting(true);
    try {
      const formDataObj = new FormData();
      Object.keys(currentData).forEach((key) => {
        if (currentData[key] !== '' && currentData[key] !== null) {
          formDataObj.append(key, currentData[key]);
        }
      });
      if (imageFile) formDataObj.append('medicineImage', imageFile);

      let medicineId = id;
      if (isEditing) {
        await dispatch(updateMedicine({ id, formData: formDataObj })).unwrap();
        // Save substitutes for existing medicine
        if (substituteIds.length >= 0) {
          try {
            await medicineService.updateSubstitutes(id, substituteIds);
          } catch (err) {
            console.error('Failed to save substitutes:', err);
          }
        }
        showSuccess('Medicine updated successfully');
      } else {
        const result = await dispatch(createMedicine(formDataObj)).unwrap();
        medicineId = result._id || result.data?._id;
        // Save substitutes for new medicine
        if (medicineId && substituteIds.length > 0) {
          try {
            await medicineService.updateSubstitutes(medicineId, substituteIds);
          } catch (err) {
            console.error('Failed to save substitutes:', err);
          }
        }
        showSuccess('Medicine created successfully');
      }
      navigate('/medicines');
    } catch (error) {
      showError(error || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (isCashier) {
    return (
      <div className="empty-state">
        <i className="fa-solid fa-lock"></i>
        <h4>Access Denied</h4>
        <p>You do not have permission to add or edit medicines.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header page-header-inline-mobile">
        <div>
          <h2>{isEditing ? 'Edit Medicine' : 'Add Medicine'}</h2>
          <p>{isEditing ? 'Update medicine information' : 'Add a new medicine to inventory'}</p>
        </div>
        <div className="btn-group-grid">
          <button className="btn btn-secondary" onClick={() => navigate('/medicines')}>
            <i className="fa-solid fa-arrow-left"></i> Back
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            {/* Responsive form grid */}
            <div className="medicine-form-grid">
              {/* Left Column - Basic Information */}
              <div className="medicine-form-column">
                <h4 className="medicine-form-section-title">
                  <i className="fa-solid fa-info-circle"></i> Basic Information
                </h4>
                <div className="form-group">
                  <label>Medicine Name *</label>
                  <input type="text" name="medicineName" value={formData.medicineName} onChange={handleChange} placeholder="Enter medicine name" required />
                </div>
                <div className="form-group">
                  <label>Generic Name</label>
                  <input type="text" name="genericName" value={formData.genericName} onChange={handleChange} placeholder="Enter generic name" />
                </div>
                <div className="form-group">
                  <label>Category *</label>
                  <select name="category" value={formData.category} onChange={handleChange} required>
                    <option value="">Select Category</option>
                    {categories?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Brand *</label>
                  <select name="brand" value={formData.brand} onChange={handleChange} required>
                    <option value="">Select Brand</option>
                    {brands?.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Supplier *</label>
                  <select name="supplier" value={formData.supplier} onChange={handleChange} required>
                    <option value="">Select Supplier</option>
                    {suppliers?.map((s) => <option key={s._id} value={s._id}>{s.supplierName}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>HSN Code</label>
                  <input type="text" name="hsnCode" value={formData.hsnCode} onChange={handleChange} placeholder="Enter HSN code" />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Enter description" rows={3} />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <select name="unit" value={formData.unit} onChange={handleChange}>
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Bottle">Bottle</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                    <option value="Tube">Tube</option>
                    <option value="Strip">Strip</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Right Column - Batch & Pricing */}
              <div className="medicine-form-column">
                <h4 className="medicine-form-section-title">
                  <i className="fa-solid fa-barcode"></i> Batch & Pricing
                </h4>
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Batch Number *</label>
                    <input type="text" name="batchNumber" value={formData.batchNumber} onChange={handleChange} placeholder="Batch number" required />
                  </div>
                  <div className="form-group">
                    <label>Barcode</label>
                    <div className="barcode-input-group">
                      <input
                        type="text"
                        name="barcode"
                        value={formData.barcode}
                        onChange={handleChange}
                        onBlur={handleBarcodeBlur}
                        placeholder="Barcode"
                        className="barcode-input-flex"
                      />
                      <button
                        type="button"
                        className="btn btn-info btn-scan"
                        onClick={startScanner}
                        title="Scan Barcode/QR"
                        disabled={scannerLoading}
                      >
                        {scannerLoading ? (
                          <i className="fa-solid fa-spinner fa-spin"></i>
                        ) : (
                          <i className="fa-solid fa-camera"></i>
                        )} Scan
                      </button>
                    </div>
                    {barcodeChecking && (
                      <small style={{ color: 'var(--gray-500)' }}>
                        <i className="fa-solid fa-spinner fa-spin"></i> Checking barcode...
                      </small>
                    )}
                    {barcodeLookupMessage && (
                      <small style={{ color: 'var(--danger-color)' }}>
                        <i className="fa-solid fa-exclamation-circle"></i> {barcodeLookupMessage}
                      </small>
                    )}
                  </div>
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Manufacturing Date</label>
                    <input type="date" name="manufacturingDate" value={formData.manufacturingDate} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Expiry Date *</label>
                    <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleChange} required />
                  </div>
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Purchase Price * (₹)</label>
                    <input type="number" name="purchasePrice" value={formData.purchasePrice} onChange={handleChange} placeholder="0.00" min="0.01" step="0.01" required />
                  </div>
                  <div className="form-group">
                    <label>Selling Price * (₹)</label>
                    <input type="number" name="sellingPrice" value={formData.sellingPrice} onChange={handleChange} placeholder="0.00" min="0.01" step="0.01" required />
                  </div>
                </div>
                <div className="form-group">
                  <label>GST (%)</label>
                  <input type="number" name="gst" value={formData.gst} onChange={handleChange} placeholder="0" min="0" max="100" step="0.01" />
                </div>

                <hr className="medicine-form-divider" />
                <h4 className="medicine-form-section-title">
                  <i className="fa-solid fa-boxes-stacked"></i> Stock & Storage
                </h4>
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Current Stock</label>
                    <input type="number" name="currentStock" value={formData.currentStock} onChange={handleChange} placeholder="0" min="0" />
                  </div>
                  <div className="form-group">
                    <label>Min Stock Alert</label>
                    <input type="number" name="minStockAlert" value={formData.minStockAlert} onChange={handleChange} placeholder="10" min="0" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Rack Number</label>
                  <input type="text" name="rackNumber" value={formData.rackNumber} onChange={handleChange} placeholder="Enter rack number" />
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input type="checkbox" name="status" checked={formData.status} onChange={handleChange} />
                    Active
                  </label>
                </div>

                <div className="form-group">
                  <label>Medicine Image</label>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="file-input" />
                  {imagePreview && (
                    <div className="image-preview-container">
                      <img src={imagePreview} alt="Preview" className="image-preview-img" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Substitute Medicines Section */}
            {allMedicines.length > 0 && (
              <div className="substitute-medicines-section" style={{ marginTop: '24px' }}>
                <hr className="medicine-form-divider" />
                <h4 className="medicine-form-section-title">
                  <i className="fa-solid fa-exchange-alt"></i> Substitute Medicines
                </h4>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                  Search and select alternative medicines that can be suggested when this medicine is out of stock.
                </p>
                <div className="substitute-search-wrapper" style={{ position: 'relative', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Search medicines to add as substitutes..."
                    value={substituteSearchQuery}
                    onChange={(e) => {
                      const q = e.target.value;
                      setSubstituteSearchQuery(q);
                      if (q.trim()) {
                        const filtered = allMedicines.filter(m =>
                          m._id !== id &&
                          !substituteIds.includes(m._id) &&
                          (m.medicineName?.toLowerCase().includes(q.toLowerCase()) ||
                           m.genericName?.toLowerCase().includes(q.toLowerCase()) ||
                           m.barcode?.includes(q))
                        ).slice(0, 8);
                        setSubstituteSearchResults(filtered);
                        setShowSubstituteDropdown(filtered.length > 0);
                      } else {
                        setSubstituteSearchResults([]);
                        setShowSubstituteDropdown(false);
                      }
                    }}
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--gray-300)', width: '100%' }}
                  />
                  {showSubstituteDropdown && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0,
                      background: '#fff', border: '1px solid var(--gray-200)',
                      borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 100, maxHeight: '250px', overflowY: 'auto',
                    }}>
                      {substituteSearchResults.map(m => (
                        <div key={m._id} onClick={() => {
                          if (!substituteIds.includes(m._id)) {
                            setSubstituteIds(prev => [...prev, m._id]);
                          }
                          setSubstituteSearchQuery('');
                          setSubstituteSearchResults([]);
                          setShowSubstituteDropdown(false);
                        }} style={{
                          padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--gray-50)'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = ''}
                        >
                          <div>
                            <div style={{ fontWeight: 500, fontSize: '13px' }}>{m.medicineName}</div>
                            {m.genericName && <div style={{ fontSize: '11px', color: '#888' }}>{m.genericName}</div>}
                          </div>
                          <div style={{ fontSize: '12px', textAlign: 'right' }}>
                            <div>₹{m.sellingPrice?.toFixed(2)}</div>
                            <div style={{ color: m.currentStock > 0 ? 'var(--success)' : 'var(--danger)' }}>
                              Stock: {m.currentStock}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Selected substitutes */}
                {substituteIds.length > 0 && (
                  <div className="selected-substitutes" style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 500 }}>
                      Selected Substitutes ({substituteIds.length})
                    </div>
                    <div className="selected-substitutes-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {substituteIds.map(subId => {
                        const med = allMedicines.find(m => m._id === subId);
                        return (
                          <div key={subId} className="selected-substitute-tag" style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '4px 10px', borderRadius: '16px',
                            background: 'var(--primary-light, #e8f5e9)',
                            border: '1px solid var(--primary, #4caf50)',
                            fontSize: '12px', fontWeight: 500,
                          }}>
                            <span>{med?.medicineName || 'Unknown'}</span>
                            <button type="button" onClick={() => setSubstituteIds(prev => prev.filter(id => id !== subId))} style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--danger, #dc3545)', fontSize: '14px', padding: '0 2px',
                            }}>
                              <i className="fa-solid fa-times"></i>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <button type="button" className="btn btn-sm btn-link" onClick={() => setSubstituteIds([])} style={{
                      marginTop: '4px', color: 'var(--danger)', fontSize: '12px', padding: 0, border: 'none', background: 'none', cursor: 'pointer',
                    }}>
                      <i className="fa-solid fa-trash"></i> Clear all
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Form Actions */}
            <div className="medicine-form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/medicines')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting || barcodeChecking}>
                {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
                {isEditing ? 'Update Medicine' : 'Create Medicine'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Barcode Scanner Overlay */}
      {showScanner && (
        <div className="scanner-overlay">
          {scannerLoading ? (
            <div className="scanner-loading">
              <i className="fa-solid fa-spinner fa-spin"></i>
              <div>Accessing camera...</div>
              <p>Please allow camera permission when prompted</p>
            </div>
          ) : scannerError ? (
            <div className="scanner-error">
              <i className="fa-solid fa-exclamation-triangle"></i>
              <div>Camera Error</div>
              <p>{scannerError}</p>
              <div className="scanner-error-actions">
                <button type="button" className="btn btn-info" onClick={startScanner}>
                  <i className="fa-solid fa-redo"></i> Try Again
                </button>
                <button type="button" className="btn btn-secondary" onClick={stopScanner}>
                  Close
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="scanner-header">
                <i className="fa-solid fa-camera"></i> Point camera at barcode
              </div>

              {availableCameras.length > 1 && (
                <div className="scanner-cameras">
                  {availableCameras.map((cam) => (
                    <button
                      key={cam.deviceId}
                      type="button"
                      className={`btn btn-sm ${cam.deviceId === selectedCameraId ? 'btn-primary' : 'btn-outline-light'}`}
                      onClick={() => switchCamera(cam.deviceId)}
                    >
                      <i className="fa-solid fa-camera"></i>{' '}
                      {cam.label || `Camera ${availableCameras.indexOf(cam) + 1}`}
                    </button>
                  ))}
                </div>
              )}

              <div
                id="barcode-scanner-reader"
                ref={scannerContainerRef}
                className="scanner-reader"
              />
              <button type="button" className="btn btn-danger scanner-cancel" onClick={stopScanner}>
                <i className="fa-solid fa-times"></i> Cancel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}