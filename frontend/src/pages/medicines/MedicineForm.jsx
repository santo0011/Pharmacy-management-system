import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createMedicine,
  updateMedicine,
  fetchMedicine,
  clearSelectedMedicine,
} from '../../redux/slices/medicineSlice';
import { fetchCategories } from '../../redux/slices/categorySlice';
import { fetchBrands } from '../../redux/slices/brandSlice';
import { fetchSuppliers } from '../../redux/slices/supplierSlice';
import { showSuccess, showError } from '../../utils/sweetAlert';
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

  useEffect(() => {
    dispatch(fetchCategories({ limit: 100 }));
    dispatch(fetchBrands({ limit: 100 }));
    dispatch(fetchSuppliers({ limit: 100 }));

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
    }
  }, [selectedMedicine, isEditing]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
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

    if (!formData.medicineName.trim()) { showError('Medicine name is required'); return; }
    if (!formData.category) { showError('Category is required'); return; }
    if (!formData.brand) { showError('Brand is required'); return; }
    if (!formData.supplier) { showError('Supplier is required'); return; }
    if (!formData.batchNumber.trim()) { showError('Batch number is required'); return; }
    if (!formData.expiryDate) { showError('Expiry date is required'); return; }
    if (!formData.purchasePrice || parseFloat(formData.purchasePrice) <= 0) { showError('Purchase price must be greater than 0'); return; }
    if (!formData.sellingPrice || parseFloat(formData.sellingPrice) <= 0) { showError('Selling price must be greater than 0'); return; }
    if (formData.manufacturingDate && formData.expiryDate && new Date(formData.manufacturingDate) >= new Date(formData.expiryDate)) {
      showError('Manufacturing date must be before expiry date');
      return;
    }

    setSubmitting(true);
    try {
      const formDataObj = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== '' && formData[key] !== null) {
          formDataObj.append(key, formData[key]);
        }
      });
      if (imageFile) formDataObj.append('medicineImage', imageFile);

      if (isEditing) {
        await dispatch(updateMedicine({ id, formData: formDataObj })).unwrap();
        showSuccess('Medicine updated successfully');
      } else {
        await dispatch(createMedicine(formDataObj)).unwrap();
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
      <div className="page-header">
        <div>
          <h2>{isEditing ? 'Edit Medicine' : 'Add Medicine'}</h2>
          <p>{isEditing ? 'Update medicine information' : 'Add a new medicine to inventory'}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Left Column */}
              <div>
                <h4 style={{ color: 'var(--primary-color)', marginBottom: '16px' }}>
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

              {/* Right Column */}
              <div>
                <h4 style={{ color: 'var(--primary-color)', marginBottom: '16px' }}>
                  <i className="fa-solid fa-barcode"></i> Batch & Pricing
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Batch Number *</label>
                    <input type="text" name="batchNumber" value={formData.batchNumber} onChange={handleChange} placeholder="Batch number" required />
                  </div>
                  <div className="form-group">
                    <label>Barcode</label>
                    <input type="text" name="barcode" value={formData.barcode} onChange={handleChange} placeholder="Barcode" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Manufacturing Date</label>
                    <input type="date" name="manufacturingDate" value={formData.manufacturingDate} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Expiry Date *</label>
                    <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleChange} required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

                <hr style={{ margin: '16px 0', borderColor: 'var(--gray-200)' }} />
                <h4 style={{ color: 'var(--primary-color)', marginBottom: '16px' }}>
                  <i className="fa-solid fa-boxes-stacked"></i> Stock & Storage
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                  <label>
                    <input type="checkbox" name="status" checked={formData.status} onChange={handleChange} style={{ width: 'auto', marginRight: '8px' }} />
                    Active
                  </label>
                </div>

                <div className="form-group">
                  <label>Medicine Image</label>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} style={{ padding: '8px' }} />
                  {imagePreview && (
                    <div style={{ marginTop: '8px' }}>
                      <img src={imagePreview} alt="Preview" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px' }} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/medicines')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
                {isEditing ? 'Update Medicine' : 'Create Medicine'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}