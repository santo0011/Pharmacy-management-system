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
import CurrencyDisplay from '../../components/common/CurrencyDisplay';
import BarcodeScanner from '../../components/common/BarcodeScanner';
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

  // Barcode lookup state
  const [barcodeChecking, setBarcodeChecking] = useState(false);
  const [barcodeLookupMessage, setBarcodeLookupMessage] = useState('');

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
      setShowScanner(false);

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
    <div className="medicine-form-page">
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

      <form onSubmit={handleSubmit} className="medicine-form">
        <div className="medicine-form-grid">
              {/* Left Column */}
              <div className="medicine-form-column">
                {/* Basic Information */}
                <div className="mf-section-card">
                  <div className="mf-section-header">
                    <div className="mf-section-icon">
                      <i className="fa-solid fa-pills"></i>
                    </div>
                    <div>
                      <h4>Basic Information</h4>
                      <p>Core identification details</p>
                    </div>
                  </div>
                  <div className="mf-section-body">
                    <div className="form-group">
                      <label>Medicine Name <span className="required-star">*</span></label>
                      <input type="text" name="medicineName" value={formData.medicineName} onChange={handleChange} placeholder="e.g. Paracetamol 500mg" required />
                    </div>
                    <div className="form-group">
                      <label>Generic Name</label>
                      <input type="text" name="genericName" value={formData.genericName} onChange={handleChange} placeholder="e.g. Acetaminophen" />
                    </div>
                    <div className="mf-form-row">
                      <div className="form-group">
                        <label>Category <span className="required-star">*</span></label>
                        <select name="category" value={formData.category} onChange={handleChange} required>
                          <option value="">Select Category</option>
                          {categories?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Brand <span className="required-star">*</span></label>
                        <select name="brand" value={formData.brand} onChange={handleChange} required>
                          <option value="">Select Brand</option>
                          {brands?.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Supplier <span className="required-star">*</span></label>
                      <select name="supplier" value={formData.supplier} onChange={handleChange} required>
                        <option value="">Select Supplier</option>
                        {suppliers?.map((s) => <option key={s._id} value={s._id}>{s.supplierName}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>HSN Code</label>
                      <input type="text" name="hsnCode" value={formData.hsnCode} onChange={handleChange} placeholder="e.g. 30049099" />
                    </div>
                  </div>
                </div>

                {/* Additional Details */}
                <div className="mf-section-card">
                  <div className="mf-section-header">
                    <div className="mf-section-icon">
                      <i className="fa-solid fa-align-left"></i>
                    </div>
                    <div>
                      <h4>Additional Details</h4>
                      <p>Description and dosage form</p>
                    </div>
                  </div>
                  <div className="mf-section-body">
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
                    <div className="form-group">
                      <label>Description</label>
                      <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Enter description, usage notes, or special instructions..." rows={3} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="medicine-form-column">
                {/* Batch & Pricing */}
                <div className="mf-section-card">
                  <div className="mf-section-header">
                    <div className="mf-section-icon">
                      <i className="fa-solid fa-barcode"></i>
                    </div>
                    <div>
                      <h4>Batch & Pricing</h4>
                      <p>Batch details and cost information</p>
                    </div>
                  </div>
                  <div className="mf-section-body">
                    <div className="mf-form-row">
                      <div className="form-group">
                        <label>Batch Number <span className="required-star">*</span></label>
                        <input type="text" name="batchNumber" value={formData.batchNumber} onChange={handleChange} placeholder="e.g. B2024001" required />
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
                            placeholder="Scan or type"
                            className="barcode-input-flex"
                          />
                          <button
                            type="button"
                            className="btn btn-info btn-scan"
                            onClick={() => setShowScanner(true)}
                            title="Scan Barcode/QR"
                          >
                            <i className="fa-solid fa-camera"></i> Scan
                          </button>
                        </div>
                        {barcodeChecking && (
                          <small className="mf-field-hint mf-field-hint-info">
                            <i className="fa-solid fa-spinner fa-spin"></i> Checking barcode...
                          </small>
                        )}
                        {barcodeLookupMessage && (
                          <small className="mf-field-hint mf-field-hint-error">
                            <i className="fa-solid fa-exclamation-circle"></i> {barcodeLookupMessage}
                          </small>
                        )}
                      </div>
                    </div>
                    <div className="mf-form-row">
                      <div className="form-group">
                        <label>Manufacturing Date</label>
                        <input type="date" name="manufacturingDate" value={formData.manufacturingDate} onChange={handleChange} />
                      </div>
                      <div className="form-group">
                        <label>Expiry Date <span className="required-star">*</span></label>
                        <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleChange} required />
                      </div>
                    </div>
                    <div className="mf-form-row">
                      <div className="form-group">
                        <label>Purchase Price <span className="required-star">*</span></label>
                        <div className="mf-input-with-icon">
                          <i className="fa-solid fa-indian-rupee-sign"></i>
                          <input type="number" name="purchasePrice" value={formData.purchasePrice} onChange={handleChange} placeholder="0.00" min="0.01" step="0.01" required />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Selling Price <span className="required-star">*</span></label>
                        <div className="mf-input-with-icon">
                          <i className="fa-solid fa-tag"></i>
                          <input type="number" name="sellingPrice" value={formData.sellingPrice} onChange={handleChange} placeholder="0.00" min="0.01" step="0.01" required />
                        </div>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>GST (%)</label>
                      <input type="number" name="gst" value={formData.gst} onChange={handleChange} placeholder="e.g. 18" min="0" max="100" step="0.01" />
                    </div>
                  </div>
                </div>

                {/* Stock & Storage */}
                <div className="mf-section-card">
                  <div className="mf-section-header">
                    <div className="mf-section-icon">
                      <i className="fa-solid fa-boxes-stacked"></i>
                    </div>
                    <div>
                      <h4>Stock & Storage</h4>
                      <p>Inventory and warehouse details</p>
                    </div>
                  </div>
                  <div className="mf-section-body">
                    <div className="mf-form-row">
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
                      <input type="text" name="rackNumber" value={formData.rackNumber} onChange={handleChange} placeholder="e.g. Rack-03, Shelf-2A" />
                    </div>
                    <div className="form-group">
                      <div className="mf-status-toggle">
                        <div>
                          <span className="mf-status-title">Active Medicine</span>
                          <span className="mf-status-subtitle">Enable to include in sales and stock reports</span>
                        </div>
                        <label className="mf-switch">
                          <input type="checkbox" name="status" checked={formData.status} onChange={handleChange} />
                          <span className="mf-switch-slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Medicine Image */}
                <div className="mf-section-card">
                  <div className="mf-section-header">
                    <div className="mf-section-icon">
                      <i className="fa-solid fa-image"></i>
                    </div>
                    <div>
                      <h4>Medicine Image</h4>
                      <p>Upload a photo for quick identification</p>
                    </div>
                  </div>
                  <div className="mf-section-body">
                    <div className="form-group">
                      <div className="mf-image-upload">
                        <input type="file" id="medicine-image-input" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="file-input mf-file-input-hidden" />
                        <label htmlFor="medicine-image-input" className="mf-file-upload-label">
                          <i className="fa-solid fa-cloud-arrow-up"></i>
                          <span>Click to upload image</span>
                          <small>JPG, PNG or WEBP</small>
                        </label>
                      </div>
                      {imagePreview && (
                        <div className="image-preview-container">
                          <img src={imagePreview} alt="Preview" className="image-preview-img" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Substitute Medicines */}
            {allMedicines.length > 0 && (
              <div className="mf-section-card mf-section-card-full">
                <div className="mf-section-header">
                  <div className="mf-section-icon">
                    <i className="fa-solid fa-exchange-alt"></i>
                  </div>
                  <div>
                    <h4>Substitute Medicines</h4>
                    <p>Search and select alternative medicines that can be suggested when this medicine is out of stock.</p>
                  </div>
                </div>
                <div className="mf-section-body">
                  <div className="substitute-search-wrapper">
                    <div className="mf-substitute-search-icon">
                      <i className="fa-solid fa-magnifying-glass"></i>
                    </div>
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
                    />
                    {showSubstituteDropdown && (
                      <div className="mf-substitute-dropdown">
                        {substituteSearchResults.map(m => (
                          <div key={m._id} className="mf-substitute-option" onClick={() => {
                            if (!substituteIds.includes(m._id)) {
                              setSubstituteIds(prev => [...prev, m._id]);
                            }
                            setSubstituteSearchQuery('');
                            setSubstituteSearchResults([]);
                            setShowSubstituteDropdown(false);
                          }}>
                            <div className="mf-substitute-option-info">
                              <div className="mf-substitute-option-name">{m.medicineName}</div>
                              {m.genericName && <div className="mf-substitute-option-generic">{m.genericName}</div>}
                            </div>
                            <div className="mf-substitute-option-meta">
                              <div className="mf-substitute-option-price"><CurrencyDisplay value={m.sellingPrice} /></div>
                              <div className={`mf-substitute-option-stock ${m.currentStock > 0 ? 'in-stock' : 'out-stock'}`}>
                                Stock: {m.currentStock}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {substituteIds.length > 0 && (
                    <div className="selected-substitutes">
                      <div className="mf-selected-title">
                        Selected Substitutes ({substituteIds.length})
                      </div>
                      <div className="selected-substitutes-list">
                        {substituteIds.map(subId => {
                          const med = allMedicines.find(m => m._id === subId);
                          return (
                            <div key={subId} className="selected-substitute-tag">
                              <span>{med?.medicineName || 'Unknown'}</span>
                              <button type="button" onClick={() => setSubstituteIds(prev => prev.filter(id => id !== subId))}>
                                <i className="fa-solid fa-times"></i>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <button type="button" className="btn btn-sm btn-link mf-clear-substitutes" onClick={() => setSubstituteIds([])}>
                        <i className="fa-solid fa-trash"></i> Clear all
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="medicine-form-actions">
              <button type="button" className="btn btn-secondary mf-btn-cancel" onClick={() => navigate('/medicines')}>
                <i className="fa-solid fa-xmark"></i> Cancel
              </button>
              <button type="submit" className="btn btn-primary mf-btn-submit" disabled={submitting || barcodeChecking}>
                {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                {isEditing ? 'Update Medicine' : 'Create Medicine'}
              </button>
            </div>
          </form>

      <BarcodeScanner
        open={showScanner}
        onScan={handleBarcodeDetected}
        onClose={() => setShowScanner(false)}
        scannerId="barcode-scanner-reader"
        stopAfterScan={true}
      />
    </div>
  );
}
