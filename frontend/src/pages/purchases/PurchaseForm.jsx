import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { createPurchase, updatePurchase, fetchPurchase, clearSelectedPurchase, fetchSupplierDueInvoices } from '../../redux/slices/purchaseSlice';
import { fetchSuppliers } from '../../redux/slices/supplierSlice';
import { fetchMedicines } from '../../redux/slices/medicineSlice';
import { supplierService } from '../../services/supplierService';
import { medicineService } from '../../services/medicineService';
import CurrencyDisplay from '../../components/common/CurrencyDisplay';
import { getCurrentSymbol } from '../../utils/currency';
import { showSuccess, showError, confirmAction } from '../../utils/sweetAlert';
import { pharmacyService } from '../../services/pharmacyService';
import { calculateInvoiceGST, getStateCode, resolveGstRate } from '../../utils/gst';
import PortalDropdown from '../../components/common/PortalDropdown';

export default function PurchaseForm() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const { selectedPurchase } = useSelector((state) => state.purchases);
  const { items: suppliers } = useSelector((state) => state.suppliers);
  const { items: medicines } = useSelector((state) => state.medicines);

  const [supplier, setSupplier] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierState, setSupplierState] = useState('');
  const [supplierStateCode, setSupplierStateCode] = useState('');
  const [pharmacyStateCode, setPharmacyStateCode] = useState('');
  const [pharmacyStateName, setPharmacyStateName] = useState('');
  const [defaultGstRate, setDefaultGstRate] = useState(0);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('percentage');
  const [shippingCost, setShippingCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [paidAmount, setPaidAmount] = useState();
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchContainerRef = useRef(null);
  const searchRef = useRef(null);

  // Supplier search state
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [supplierSearchResults, setSupplierSearchResults] = useState([]);
  const [supplierSearchLoading, setSupplierSearchLoading] = useState(false);
  const supplierSearchRef = useRef(null);
  const supplierContainerRef = useRef(null);

  // Search debounce timers
  const medicineSearchTimer = useRef(null);
  const supplierSearchTimer = useRef(null);
  const [selectedSupplierObj, setSelectedSupplierObj] = useState(null);

  // Invoice attachment state
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoiceAttachment, setInvoiceAttachment] = useState('');
  const invoiceFileInputRef = useRef(null);

  // Supplier due invoice state
  const [supplierData, setSupplierData] = useState(null);
  const [dueInvoices, setDueInvoices] = useState([]);
  const [selectedDueInvoices, setSelectedDueInvoices] = useState([]);
  const [loadingDueData, setLoadingDueData] = useState(false);

  const selectedSupplier = selectedSupplierObj || suppliers?.find(s => s._id === supplier);

  // Fetch supplier due data when supplier changes
  const loadSupplierDueData = useCallback(async (supplierId) => {
    if (!supplierId) {
      setSupplierData(null);
      setDueInvoices([]);
      setSelectedDueInvoices([]);
      return;
    }
    setLoadingDueData(true);
    try {
      const result = await dispatch(fetchSupplierDueInvoices(supplierId)).unwrap();
      setSupplierData(result);
      setDueInvoices(result.dueInvoices || []);
      setSelectedDueInvoices([]);
    } catch (err) {
      setSupplierData(null);
      setDueInvoices([]);
      setSelectedDueInvoices([]);
    } finally {
      setLoadingDueData(false);
    }
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchSuppliers({ limit: 200 }));
    dispatch(fetchMedicines({ limit: 200 }));
    if (isEditing && id) dispatch(fetchPurchase(id));

    // Load the pharmacy's Default Business State + Default GST % from Settings
    const loadPharmacyState = async () => {
      try {
        const { data } = await pharmacyService.getMyPharmacyProfile();
        if (data?.data) {
          const stateName = data.data.state || '';
          const stateCode = data.data.stateCode || getStateCode(stateName) || '';
          setPharmacyStateCode(stateCode);
          setPharmacyStateName(stateName);
          setDefaultGstRate(Number(data.data.defaultGstRate) || 0);
        }
      } catch (error) {
        // Silently fail — GST will default to intra-state (CGST+SGST)
      }
    };
    loadPharmacyState();

    return () => { dispatch(clearSelectedPurchase()); };
  }, [dispatch, id, isEditing]);

  useEffect(() => {
    if (isEditing && selectedPurchase) {
      const p = selectedPurchase.purchase || selectedPurchase;
      setSupplier(p.supplier?._id || '');
      setSupplierName(p.supplierName || '');
      setSupplierState(p.supplier?.state || '');
      setSupplierStateCode(p.supplierStateCode || '');
      setSupplierSearchQuery(p.supplierName || '');
      setPurchaseDate(p.purchaseDate?.split('T')[0] || '');
      setItems(p.items.map(i => ({
        medicineId: i.medicine?._id || '',
        medicineName: i.medicineName || '',
        batchNumber: i.batchNumber || '',
        quantity: i.quantity || 1,
        purchasePrice: i.purchasePrice || 0,
        sellingPrice: i.sellingPrice || 0,
        mrp: i.mrp || 0,
        expiryDate: i.expiryDate?.split('T')[0] || '',
        gst: i.gst || 0,
        barcode: '',
      })));
      setDiscount(p.discount || 0);
      setDiscountType(p.discountType || 'fixed');
      setShippingCost(p.shippingCost || 0);
      setOtherCost(p.otherCost || 0);
      setPaidAmount(p.paidAmount || 0);
      setPaymentMethod(p.paymentMethod || 'cash');
      setNotes(p.notes || '');
      setInvoiceAttachment(p.invoiceAttachment || '');
    }
  }, [selectedPurchase, isEditing]);

  // Load due data when supplier changes
  useEffect(() => {
    if (supplier && !isEditing) {
      loadSupplierDueData(supplier);
    } else if (!supplier) {
      setSupplierData(null);
      setDueInvoices([]);
      setSelectedDueInvoices([]);
    }
  }, [supplier, loadSupplierDueData, isEditing]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
      if (supplierContainerRef.current && !supplierContainerRef.current.contains(event.target)) {
        setShowSupplierDropdown(false);
      }
    };
    if (showSearchDropdown || showSupplierDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showSearchDropdown, showSupplierDropdown]);

  // Server-side medicine search with debounce
  const handleMedicineSearch = (value) => {
    setSearchTerm(value);
    setShowSearchDropdown(true);
    if (medicineSearchTimer.current) clearTimeout(medicineSearchTimer.current);
    if (!value.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    medicineSearchTimer.current = setTimeout(async () => {
      try {
        const { data } = await medicineService.getMedicines({ search: value.trim(), limit: 10 });
        setSearchResults(data.data || []);
      } catch (err) {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  // Server-side supplier search with debounce
  const handleSupplierSearch = (value) => {
    setSupplierSearchQuery(value);
    setSupplier('');
    setSupplierName(value);
    setSupplierState('');
    setSupplierStateCode('');
    setSelectedSupplierObj(null);
    setShowSupplierDropdown(true);
    if (supplierSearchTimer.current) clearTimeout(supplierSearchTimer.current);
    if (!value.trim()) {
      setSupplierSearchResults([]);
      setSupplierSearchLoading(false);
      return;
    }
    setSupplierSearchLoading(true);
    supplierSearchTimer.current = setTimeout(async () => {
      try {
        const { data } = await supplierService.getAll({ search: value.trim(), limit: 10 });
        setSupplierSearchResults(data.data || []);
      } catch (err) {
        setSupplierSearchResults([]);
      } finally {
        setSupplierSearchLoading(false);
      }
    }, 300);
  };

  // GST calculation using centralized utility (mirrors backend gstHelper.js)
  // Each item's GST: Product GST > 0 → use product GST; Product GST = 0 → use pharmacy Default GST
  const gstCalc = calculateInvoiceGST({
    items: items.map(item => ({
      ...item,
      gst: resolveGstRate(item.gst, defaultGstRate),
    })),
    discount: Number(discount) || 0,
    discountType,
    pharmacyStateCode,
    otherPartyStateCode: supplierStateCode,
  });

  const calcSubtotal = () => items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.purchasePrice)), 0);
  const calcGrandTotal = () => gstCalc.grandTotal + Number(shippingCost) + Number(otherCost);

  // Calculate selected due total
  const selectedDueTotal = dueInvoices
    .filter(inv => selectedDueInvoices.includes(inv._id))
    .reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
  const previousDue = selectedDueTotal;
  const currentTotal = calcGrandTotal();
  const totalPayable = previousDue + currentTotal;

  const handleItemChange = (index, field, value) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    setItems(prev => [...prev, { medicineId: '', medicineName: '', batchNumber: '', quantity: 1, purchasePrice: 0, sellingPrice: 0, mrp: 0, expiryDate: '', gst: 0, barcode: '' }]);
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const selectMedicine = (index, med) => {
    setItems(prev => prev.map((item, i) => i === index ? {
      ...item,
      medicineId: med._id,
      medicineName: med.medicineName,
      batchNumber: med.batchNumber || '',
      purchasePrice: med.purchasePrice || 0,
      sellingPrice: med.sellingPrice || 0,
      gst: med.gst || 0,
      barcode: med.barcode || '',
      expiryDate: med.expiryDate?.split('T')[0] || '',
    } : item));
    setSearchTerm('');
    setShowSearchDropdown(false);
  };

  const selectSupplier = (sup) => {
    setSupplier(sup._id);
    setSupplierName(sup.supplierName);
    setSupplierState(sup.state || '');
    setSupplierStateCode(sup.stateCode || getStateCode(sup.state) || '');
    setSupplierSearchQuery(sup.supplierName);
    setSelectedSupplierObj(sup);
    setShowSupplierDropdown(false);
  };

  const toggleDueInvoice = (invoiceId) => {
    setSelectedDueInvoices(prev =>
      prev.includes(invoiceId)
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const selectAllDueInvoices = () => {
    if (selectedDueInvoices.length === dueInvoices.length) {
      setSelectedDueInvoices([]);
    } else {
      setSelectedDueInvoices(dueInvoices.map(inv => inv._id));
    }
  };

  // Invoice file handlers
  const handleInvoiceFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      showError('Only PDF, JPG, JPEG, or PNG files are allowed');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError('File too large. Max 5MB');
      e.target.value = '';
      return;
    }
    setInvoiceFile(file);
  };

  const removeInvoiceFile = () => {
    setInvoiceFile(null);
    setInvoiceAttachment('');
    if (invoiceFileInputRef.current) invoiceFileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplier && !supplierName) { showError('Please select a supplier'); return; }
    if (items.length === 0) { showError('Add at least one item'); return; }

    const paid = Number(paidAmount) || calcGrandTotal();
    if (paid > totalPayable) {
      showError(`Payment amount cannot exceed the total payable amount of ${getCurrentSymbol()} ${totalPayable.toFixed(2)}.`);
      return;
    }

    // Show payment confirmation before completing the purchase
    const confirmed = await confirmAction(
      `${isEditing ? 'Update' : 'Complete'} Purchase`,
      `Supplier: ${selectedSupplier?.supplierName || supplierName || 'N/A'}\nItems: ${items.length}\nGrand Total: ${getCurrentSymbol()} ${currentTotal.toFixed(2)}\nPrevious Due: ${getCurrentSymbol()} ${previousDue.toFixed(2)}\nTotal Payable: ${getCurrentSymbol()} ${totalPayable.toFixed(2)}\nPaid: ${getCurrentSymbol()} ${paid.toFixed(2)}\nRemaining Due: ${getCurrentSymbol()} ${Math.max(0, totalPayable - paid).toFixed(2)}\nMethod: ${paymentMethod}`,
      `Yes, ${isEditing ? 'Update' : 'Complete'}`
    );
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        purchaseDate,
        supplier: supplier || null,
        supplierName,
        supplierState: supplierState || '',
        supplierStateCode: supplierStateCode || '',
        items: items.map(item => ({
          ...item,
          quantity: Number(item.quantity),
          purchasePrice: Number(item.purchasePrice),
          sellingPrice: Number(item.sellingPrice),
          gst: Number(item.gst),
        })),
        discount: Number(discount),
        discountType,
        shippingCost: Number(shippingCost),
        otherCost: Number(otherCost),
        paidAmount: paid,
        paymentMethod,
        notes,
        selectedDueInvoices: selectedDueInvoices.length > 0 ? selectedDueInvoices : undefined,
      };

      // If invoice file is selected, send as FormData for multipart upload
      if (invoiceFile) {
        const formData = new FormData();
        formData.append('invoiceAttachment', invoiceFile);
        formData.append('purchaseDate', payload.purchaseDate);
        formData.append('supplier', payload.supplier || '');
        formData.append('supplierName', payload.supplierName || '');
        formData.append('supplierState', payload.supplierState || '');
        formData.append('supplierStateCode', payload.supplierStateCode || '');
        formData.append('items', JSON.stringify(payload.items));
        formData.append('discount', payload.discount);
        formData.append('discountType', payload.discountType);
        formData.append('shippingCost', payload.shippingCost);
        formData.append('otherCost', payload.otherCost);
        formData.append('paidAmount', payload.paidAmount);
        formData.append('paymentMethod', payload.paymentMethod);
        formData.append('notes', payload.notes || '');
        if (payload.selectedDueInvoices) {
          formData.append('selectedDueInvoices', JSON.stringify(payload.selectedDueInvoices));
        }

        if (isEditing) {
          await dispatch(updatePurchase({ id, formData })).unwrap();
        } else {
          await dispatch(createPurchase(formData)).unwrap();
        }
      } else {
        if (isEditing) {
          await dispatch(updatePurchase({ id, formData: payload })).unwrap();
        } else {
          await dispatch(createPurchase(payload)).unwrap();
        }
      }

      showSuccess(isEditing ? 'Purchase updated' : 'Purchase created');
      navigate('/purchases');
    } catch (error) {
      showError(error || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const gt = calcGrandTotal();
  const currentDue = Math.max(0, gt - Number(paidAmount));
  const creditPurchase = currentDue + previousDue;
  const isIntra = gstCalc.isIntraState;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{isEditing ? 'Edit Purchase' : 'New Purchase'}</h2>
          <p>{isEditing ? 'Update purchase order' : 'Create a new purchase order'}</p>
        </div>
      </div>

      <div className="sale-layout">
        {/* Left - Purchase Details */}
        <div>
          {/* Supplier Card */}
          <div className="card search-card-no-clip" style={{ marginBottom: '16px' }}>
            <div className="card-header">
              <h5><i className="fa-solid fa-truck"></i> Supplier</h5>
            </div>
            <div className="card-body" ref={supplierContainerRef}>
              <div className="purchase-form-grid">
                <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
                  <label>Supplier *</label>
                  <input
                    ref={supplierSearchRef}
                    type="text"
                    placeholder="Search supplier by name, company or phone..."
                    value={supplierSearchQuery}
                    onChange={(e) => handleSupplierSearch(e.target.value)}
                    className="form-select"
                    style={{ width: '100%' }}
                    autoComplete="off"
                  />
                  <PortalDropdown
                    triggerRef={supplierSearchRef}
                    show={showSupplierDropdown}
                    onClose={() => setShowSupplierDropdown(false)}
                  >
                    {supplierSearchLoading ? (
                      <div style={{ textAlign: 'center', padding: '14px', color: '#888', fontSize: '13px' }}>
                        <i className="fa-solid fa-spinner fa-spin"></i> Searching...
                      </div>
                    ) : supplierSearchResults.length > 0 ? (
                      supplierSearchResults.map(sup => (
                        <div
                          key={sup._id}
                          onClick={() => selectSupplier(sup)}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--gray-100)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--gray-50)'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = ''}
                        >
                          <div>
                            <div style={{ fontWeight: 500 }}>{sup.supplierName}</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              {sup.companyName} {sup.phone ? `| ${sup.phone}` : ''}
                            </div>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 500 }}>
                            {sup.state || 'No State'}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '14px', color: '#888', fontSize: '13px' }}>
                        {supplierSearchQuery.trim() ? 'No suppliers found. Type a name to create a new supplier.' : 'Type to search suppliers...'}
                      </div>
                    )}
                  </PortalDropdown>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Purchase Date</label>
                  <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="form-select" style={{ width: '100%' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="form-select" style={{ width: '100%' }}>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="credit">Credit</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Supplier State Info - GST Type Indicator */}
              {supplier && (
                <div style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: isIntra ? '#f0fdf4' : '#eff6ff',
                  border: `1px solid ${isIntra ? '#bbf7d0' : '#bfdbfe'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}>
                  <i className={`fa-solid ${isIntra ? 'fa-building' : 'fa-truck-fast'}`} style={{ color: isIntra ? '#16a34a' : '#2563eb', fontSize: '18px' }}></i>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>
                      {selectedSupplier?.supplierName || supplierName}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                      Supplier State: <strong>{supplierState || 'Not set'}</strong>
                      {supplierStateCode && <span> (Code: {supplierStateCode})</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${isIntra ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '11px' }}>
                      {isIntra ? 'CGST + SGST' : 'IGST'}
                    </span>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                      {isIntra ? 'Same State' : 'Different State'}
                    </div>
                  </div>
                </div>
              )}

              {/* Previous Due Invoices */}
              {dueInvoices.length > 0 && !isEditing && (
                <div className="due-invoices-section" style={{ marginTop: '12px' }}>
                  <div className="due-invoices-header">
                    <h6><i className="fa-solid fa-file-invoice"></i> Previous Due Invoices</h6>
                    <label className="due-invoices-select-all">
                      <input
                        type="checkbox"
                        checked={selectedDueInvoices.length === dueInvoices.length}
                        onChange={selectAllDueInvoices}
                      />
                      <span>Select All</span>
                    </label>
                  </div>
                  <div className="due-invoices-list">
                    {dueInvoices.map(inv => (
                      <div
                        key={inv._id}
                        className={`due-invoice-item ${selectedDueInvoices.includes(inv._id) ? 'selected' : ''}`}
                        onClick={() => toggleDueInvoice(inv._id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedDueInvoices.includes(inv._id)}
                          readOnly
                        />
                        <div className="due-invoice-info">
                          <span className="due-invoice-number">{inv.invoiceNumber}</span>
                          <span className="due-invoice-date">{new Date(inv.purchaseDate).toLocaleDateString()}</span>
                          <div className="due-invoice-payment-details">
                            <span>Total: <CurrencyDisplay value={inv.grandTotal || 0} /></span>
                            <span>Paid: <CurrencyDisplay value={inv.paidAmount || 0} /></span>
                            <span className="due-invoice-remaining">Due: <CurrencyDisplay value={inv.dueAmount || 0} /></span>
                          </div>
                        </div>
                        <span className="due-invoice-amount"><CurrencyDisplay value={inv.dueAmount} /></span>
                      </div>
                    ))}
                  </div>
                  {selectedDueInvoices.length > 0 && (
                    <div className="due-invoices-total">
                      <span>Selected Due Total ({selectedDueInvoices.length} invoice{selectedDueInvoices.length > 1 ? 's' : ''}):</span>
                      <span className="due-invoices-total-amount"><CurrencyDisplay value={previousDue} /></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Purchase Invoice Upload Card */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header">
              <h5><i className="fa-solid fa-file-invoice"></i> Purchase Invoice</h5>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '13px', color: 'var(--gray-500)', marginBottom: '10px' }}>
                Upload the supplier's invoice (PDF, JPG, JPEG, PNG — max 5MB). One invoice per purchase.
              </p>
              {!invoiceFile && !invoiceAttachment ? (
                <div
                  onClick={() => invoiceFileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--gray-300)',
                    borderRadius: '8px',
                    padding: '24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--gray-300)'}
                >
                  <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '28px', color: 'var(--gray-400)', marginBottom: '8px' }}></i>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--gray-600)' }}>Upload Invoice</div>
                  <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>Click to browse or drag & drop</div>
                  <div style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '4px' }}>PDF, JPG, JPEG, PNG (Max 5MB)</div>
                </div>
              ) : (
                <>
                  {/* File info + actions */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    marginBottom: '12px',
                  }}>
                    <i className={`fa-solid ${invoiceFile?.type === 'application/pdf' || invoiceAttachment?.endsWith('.pdf') ? 'fa-file-pdf' : 'fa-file-image'}`} style={{ fontSize: '24px', color: '#dc2626' }}></i>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {invoiceFile?.name || invoiceAttachment?.split('/').pop() || 'Invoice'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        {invoiceFile ? `${(invoiceFile.size / 1024).toFixed(1)} KB` : 'Uploaded'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {invoiceAttachment && (
                        <a
                          href={invoiceAttachment}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-info"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                        >
                          <i className="fa-solid fa-eye"></i> View
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => invoiceFileInputRef.current?.click()}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        <i className="fa-solid fa-rotate"></i> Replace
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={removeInvoiceFile}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        <i className="fa-solid fa-trash"></i> Remove
                      </button>
                    </div>
                  </div>

                  {/* Invoice Preview */}
                  <div style={{
                    border: '1px solid var(--gray-200)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: '#f1f5f9',
                  }}>
                    {invoiceFile ? (
                      invoiceFile.type === 'application/pdf' ? (
                        <iframe
                          src={URL.createObjectURL(invoiceFile)}
                          title="Purchase Invoice Preview"
                          style={{ width: '100%', height: '400px', border: 'none', background: '#fff' }}
                        />
                      ) : (
                        <img
                          src={URL.createObjectURL(invoiceFile)}
                          alt="Purchase Invoice Preview"
                          style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', background: '#fff' }}
                        />
                      )
                    ) : invoiceAttachment ? (
                      invoiceAttachment.endsWith('.pdf') ? (
                        <iframe
                          src={invoiceAttachment}
                          title="Purchase Invoice Preview"
                          style={{ width: '100%', height: '400px', border: 'none', background: '#fff' }}
                        />
                      ) : (
                        <img
                          src={invoiceAttachment}
                          alt="Purchase Invoice Preview"
                          style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', background: '#fff' }}
                        />
                      )
                    ) : null}
                  </div>
                </>
              )}
              <input
                ref={invoiceFileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={handleInvoiceFileChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Items Card */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header">
              <h5><i className="fa-solid fa-cart-plus"></i> Items</h5>
            </div>
            <div className="card-body">
              <div className="search-box-wrapper" ref={searchContainerRef}>
                <div className="search-input-wrap">
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="🔍 Search medicine by name or barcode..."
                    value={searchTerm}
                    onChange={(e) => handleMedicineSearch(e.target.value)}
                  />
                  <PortalDropdown
                    triggerRef={searchRef}
                    show={showSearchDropdown}
                    onClose={() => setShowSearchDropdown(false)}
                  >
                    {searchLoading ? (
                      <div style={{ textAlign: 'center', padding: '14px', color: '#888', fontSize: '13px' }}>
                        <i className="fa-solid fa-spinner fa-spin"></i> Searching...
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map(med => (
                        <div key={med._id} onClick={() => { addItem(); selectMedicine(items.length, med); }}
                          className="search-dropdown-item">
                          <div>
                            <div className="item-name">{med.medicineName}</div>
                            <div className="item-details">{med.genericName}</div>
                            <div className="item-batch-info">
                              <span className={`batches-badge ${med.currentStock <= 10 ? 'low' : 'in-stock'}`}>Stock: {med.currentStock}</span>
                              {med.expiryDate && (
                                <span className="item-expiry">Exp: {new Date(med.expiryDate).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="item-price"><CurrencyDisplay value={med.purchasePrice} /></div>
                            <div style={{ fontSize: '11px', color: '#666' }}>GST: {resolveGstRate(med.gst, defaultGstRate)}%</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="search-dropdown-empty">
                        {searchTerm.trim() ? 'No medicines found' : 'Type to search medicines...'}
                      </div>
                    )}
                  </PortalDropdown>
                </div>
                <button type="button" className="btn-add-item" onClick={addItem}>
                  <i className="fa-solid fa-plus"></i> Add Item
                </button>
              </div>

              {/* Desktop Table View */}
              <div className="purchase-items-desktop-table" style={{ marginTop: '12px' }}>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Batch</th>
                        <th style={{ width: '60px' }}>Qty</th>
                        <th style={{ width: '90px' }}>Purchase Price</th>
                        <th style={{ width: '90px' }}>Selling Price</th>
                        <th style={{ width: '70px' }}>MRP</th>
                        <th style={{ width: '105px' }}>Expiry</th>
                        <th style={{ width: '55px' }}>GST %</th>
                        <th style={{ width: '80px' }}>Subtotal</th>
                        <th style={{ width: '36px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={index}>
                          <td style={{ minWidth: '150px' }}>
                            <input type="text" placeholder="Medicine name" value={item.medicineName} onChange={(e) => handleItemChange(index, 'medicineName', e.target.value)} className="input-sm" style={{ width: '100%' }} />
                          </td>
                          <td><input type="text" placeholder="Batch" value={item.batchNumber} onChange={(e) => handleItemChange(index, 'batchNumber', e.target.value)} className="input-sm" style={{ width: '65px' }} /></td>
                          <td><input type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="qty-input-sm" onWheel={(e) => e.target.blur()} /></td>
                          <td><input type="number" min="0" step="0.01" value={item.purchasePrice} onChange={(e) => handleItemChange(index, 'purchasePrice', e.target.value)} className="price-input-sm" onWheel={(e) => e.target.blur()} /></td>
                          <td><input type="number" min="0" step="0.01" value={item.sellingPrice} onChange={(e) => handleItemChange(index, 'sellingPrice', e.target.value)} className="price-input-sm" onWheel={(e) => e.target.blur()} /></td>
                          <td><input type="number" min="0" step="0.01" value={item.mrp} onChange={(e) => handleItemChange(index, 'mrp', e.target.value)} className="input-sm" style={{ width: '60px' }} /></td>
                          <td><input type="date" value={item.expiryDate} onChange={(e) => handleItemChange(index, 'expiryDate', e.target.value)} className="input-sm" style={{ width: '105px' }} /></td>
                          <td>
                            <input type="number" min="0" max="100" value={item.gst} onChange={(e) => handleItemChange(index, 'gst', e.target.value)} className="input-sm" style={{ width: '50px' }} />
                            <div style={{ fontSize: '10px', color: '#888', textAlign: 'center' }}>
                              → {resolveGstRate(item.gst, defaultGstRate)}%
                            </div>
                          </td>
                          <td style={{ fontWeight: 600, whiteSpace: 'nowrap', fontSize: '13px' }}><CurrencyDisplay value={Number(item.quantity) * Number(item.purchasePrice)} /></td>
                          <td>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(index)} style={{ padding: '4px 8px' }}>
                              <i className="fa-solid fa-times"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="purchase-items-mobile-cards" style={{ marginTop: '12px' }}>
                {items.map((item, index) => (
                  <div key={index} className="purchase-item-card">
                    <div className="purchase-item-card-header">
                      <div className="purchase-item-card-title">
                        <input
                          type="text"
                          placeholder="Medicine name"
                          value={item.medicineName}
                          onChange={(e) => handleItemChange(index, 'medicineName', e.target.value)}
                          className="purchase-item-card-name-input"
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm purchase-item-card-remove"
                        onClick={() => removeItem(index)}
                      >
                        <i className="fa-solid fa-times"></i>
                      </button>
                    </div>
                    <div className="purchase-item-card-body">
                      <div className="purchase-item-card-field">
                        <label>Batch</label>
                        <input type="text" placeholder="Batch" value={item.batchNumber} onChange={(e) => handleItemChange(index, 'batchNumber', e.target.value)} />
                      </div>
                      <div className="purchase-item-card-field">
                        <label>Qty</label>
                        <input type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} onWheel={(e) => e.target.blur()} />
                      </div>
                      <div className="purchase-item-card-field">
                        <label>Purchase Price</label>
                        <input type="number" min="0" step="0.01" value={item.purchasePrice} onChange={(e) => handleItemChange(index, 'purchasePrice', e.target.value)} onWheel={(e) => e.target.blur()} />
                      </div>
                      <div className="purchase-item-card-field">
                        <label>Selling Price</label>
                        <input type="number" min="0" step="0.01" value={item.sellingPrice} onChange={(e) => handleItemChange(index, 'sellingPrice', e.target.value)} onWheel={(e) => e.target.blur()} />
                      </div>
                      <div className="purchase-item-card-field">
                        <label>MRP</label>
                        <input type="number" min="0" step="0.01" value={item.mrp} onChange={(e) => handleItemChange(index, 'mrp', e.target.value)} />
                      </div>
                      <div className="purchase-item-card-field">
                        <label>Expiry</label>
                        <input type="date" value={item.expiryDate} onChange={(e) => handleItemChange(index, 'expiryDate', e.target.value)} />
                      </div>
                      <div className="purchase-item-card-field">
                        <label>GST %</label>
                        <input type="number" min="0" max="100" value={item.gst} onChange={(e) => handleItemChange(index, 'gst', e.target.value)} />
                        <div style={{ fontSize: '10px', color: '#888' }}>Applied: {resolveGstRate(item.gst, defaultGstRate)}%</div>
                      </div>
                      <div className="purchase-item-card-field purchase-item-card-subtotal">
                        <label>Subtotal</label>
                        <span><CurrencyDisplay value={Number(item.quantity) * Number(item.purchasePrice)} /></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notes Card */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header">
              <h5><i className="fa-solid fa-sticky-note"></i> Notes</h5>
            </div>
            <div className="card-body">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="form-select" style={{ width: '100%', minHeight: '80px', resize: 'vertical' }} placeholder="Any additional notes or comments..." />
            </div>
          </div>
        </div>

        {/* Right - Invoice Summary */}
        <div>
          <div className="card invoice-summary-sticky">
            <div className="card-header">
              <h5><i className="fa-solid fa-receipt"></i> Invoice Summary</h5>
              <span style={{ fontSize: '13px', color: 'var(--gray-500)' }}>{items.length} item(s)</span>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: '8px' }}>
                {items.map((item, idx) => (
                  <div key={idx} className="cart-item-row">
                    <div>
                      <span className="cart-item-name">{item.medicineName || 'New Item'}</span>
                      <span className="cart-item-quantity"> × {item.quantity}</span>
                    </div>
                    <span className="cart-item-total"><CurrencyDisplay value={Number(item.quantity) * Number(item.purchasePrice)} /></span>
                  </div>
                ))}
              </div>

              <hr style={{ margin: '6px 0', borderColor: 'var(--gray-200)' }} />

              <div className="summary-row">
                <span className="summary-label">Subtotal:</span><span className="summary-value"><CurrencyDisplay value={gstCalc.subtotal} /></span>
              </div>
              <div className="summary-row" style={{ alignItems: 'center' }}>
                <span className="summary-label">Discount:</span>
                <div className="inline-discount">
                  <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} onWheel={(e) => e.target.blur()} />
                  <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                    <option value="percentage">%</option>
                    <option value="fixed">{getCurrentSymbol()}</option>
                  </select>
                </div>
              </div>
              <div className="summary-row">
                <span className="summary-label">Taxable Amount:</span><span className="summary-value"><CurrencyDisplay value={gstCalc.taxableAmount} /></span>
              </div>

              {/* GST Breakdown - Only show applicable type */}
              {isIntra ? (
                <>
                  <div className="summary-row">
                    <span className="summary-label">CGST:</span><span className="summary-value"><CurrencyDisplay value={gstCalc.cgst} /></span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">SGST:</span><span className="summary-value"><CurrencyDisplay value={gstCalc.sgst} /></span>
                  </div>
                </>
              ) : (
                <div className="summary-row">
                  <span className="summary-label">IGST:</span><span className="summary-value"><CurrencyDisplay value={gstCalc.igst} /></span>
                </div>
              )}
              <div className="summary-row">
                <span className="summary-label">Total GST:</span><span className="summary-value"><CurrencyDisplay value={gstCalc.totalGst} /></span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Shipping:</span>
                <input type="number" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} className="inline-input-sm" onWheel={(e) => e.target.blur()} />
              </div>
              <div className="summary-row">
                <span className="summary-label">Other Cost:</span>
                <input type="number" value={otherCost} onChange={(e) => setOtherCost(e.target.value)} className="inline-input-sm" onWheel={(e) => e.target.blur()} />
              </div>

              <hr style={{ margin: '6px 0', borderColor: 'var(--gray-200)' }} />

              <div className="grand-total-row" style={{ marginBottom: '10px' }}>
                <span>Grand Total:</span><span><CurrencyDisplay value={gt} /></span>
              </div>

              {/* Previous Due Display */}
              {previousDue > 0 && !isEditing && (
                <div className="previous-due-row">
                  <span>Previous Due:</span>
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}><CurrencyDisplay value={previousDue} /></span>
                </div>
              )}

              {/* Total Payable */}
              {previousDue > 0 && !isEditing && (
                <div className="total-payable-row">
                  <span>Total Payable:</span>
                  <span><CurrencyDisplay value={totalPayable} /></span>
                </div>
              )}

              <div className="form-group">
                <label>Paid Amount</label>
                <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="form-select" style={{ width: '100%' }} onWheel={(e) => e.target.blur()} />
              </div>

              <div className={`due-row ${Number(paidAmount) >= totalPayable ? 'positive' : 'negative'}`} style={{ padding: '8px 0' }}>
                <span>Remaining Due:</span><span className="due-value"><CurrencyDisplay value={Math.max(0, totalPayable - Number(paidAmount))} /></span>
              </div>

              <button
                type="submit"
                className="btn btn-success btn-block"
                onClick={handleSubmit}
                disabled={submitting || items.length === 0}
                style={{ marginTop: '12px', padding: '10px', fontSize: '15px', fontWeight: 700 }}
              >
                {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
                {submitting ? ' Processing...' : ` ${getCurrentSymbol()} ${(previousDue > 0 && !isEditing ? totalPayable : gt).toFixed(2)} • ${isEditing ? 'Update Purchase' : 'Create Purchase'}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}