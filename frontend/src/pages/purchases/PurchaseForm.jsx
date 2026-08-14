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
import { getStateCode, isIntraState, resolveGstRate } from '../../utils/gst';
import PortalDropdown from '../../components/common/PortalDropdown';

/**
 * Sanitize a numeric input value:
 * - Empty string → '0'
 * - Strips leading zeros (e.g. '012' → '12', '0.5' stays '0.5')
 * - Allows only digits and a single decimal point
 */
const sanitizeNumericInput = (value) => {
  if (value === '' || value === null || value === undefined) return '0';
  let str = String(value).trim();
  if (str === '') return '0';
  // Allow only digits and one decimal point
  str = str.replace(/[^\d.]/g, '');
  const parts = str.split('.');
  if (parts.length > 2) str = parts[0] + '.' + parts.slice(1).join('');
  // Strip leading zeros (but keep '0.' for decimals like 0.5)
  str = str.replace(/^0+(?=\d)/, '');
  if (str === '' || str === '.') return '0';
  return str;
};

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
  const [roundOff, setRoundOff] = useState(0);
  const [roundOffOptions, setRoundOffOptions] = useState([]); // Generated round-off option cards
  const [selectedRoundOffIndex, setSelectedRoundOffIndex] = useState(-1); // -1 = no round-off selected
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
      setRoundOff(p.roundOffAmount || 0);
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

  // Close dropdowns on click outside (but NOT when clicking inside portal dropdowns,
  // which are rendered at document.body level and handle their own outside clicks)
  useEffect(() => {
    const handleClickOutside = (event) => {
      let inPortalDropdown = false;
      document.querySelectorAll('.portal-dropdown').forEach(dd => {
        if (dd.contains(event.target)) inPortalDropdown = true;
      });
      if (inPortalDropdown) return;
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

  // Populate the dropdown with all available suppliers (no search required)
  const showAllSuppliers = useCallback(() => {
    setShowSupplierDropdown(true);
    setSupplierSearchLoading(false);
    setSupplierSearchResults(suppliers || []);
  }, [suppliers]);

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
      setSupplierSearchResults(suppliers || []);
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

  // ===== Custom GST-first calculation: Product → GST → Discount → Round Off → Final =====
  // Each item's GST: Product GST > 0 → use product GST; Product GST = 0 → use pharmacy Default GST
  const resolvedItems = items.map(item => ({
    ...item,
    gst: resolveGstRate(item.gst, defaultGstRate),
  }));

  // Step 1: Product Subtotal (before GST)
  const productSubtotal = resolvedItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.purchasePrice)), 0);

  // Step 2: Add GST on the product subtotal (GST is calculated FIRST, before discount)
  const intraState = isIntraState(pharmacyStateCode, supplierStateCode);
  const totalGst = resolvedItems.reduce((sum, item) => {
    const sub = Number(item.quantity) * Number(item.purchasePrice);
    return sum + (sub * (Number(item.gst) / 100));
  }, 0);
  const gstInclusiveTotal = Number((productSubtotal + totalGst).toFixed(2));

  // Step 3: Apply Discount AFTER GST (on the GST-inclusive total)
  const discountAmt = discountType === 'percentage'
    ? gstInclusiveTotal * (Number(discount) / 100)
    : Math.min(Number(discount) || 0, gstInclusiveTotal);
  const discountedTotal = Number((gstInclusiveTotal - discountAmt).toFixed(2));

  // Step 4: Apply Round Off LAST (deduction only, never increases the bill)
  const roundOffAmt = Math.min(Number(roundOff) || 0, discountedTotal);
  const afterRoundOff = Number((discountedTotal - roundOffAmt).toFixed(2));

  // Step 5: Final Grand Total (includes shipping + other cost)
  const calcGrandTotal = () => afterRoundOff + Number(shippingCost) + Number(otherCost);

  // GST breakdown for display (split CGST/SGST or IGST)
  const cgst = intraState ? Number((totalGst / 2).toFixed(2)) : 0;
  const sgst = intraState ? Number((totalGst - cgst).toFixed(2)) : 0;
  const igst = intraState ? 0 : Number(totalGst.toFixed(2));

  // Effective GST rate for display labels
  const effectiveGstRate = productSubtotal > 0 ? (totalGst / productSubtotal) * 100 : 0;
  const cgstRate = Number((effectiveGstRate / 2).toFixed(2));
  const sgstRate = Number((effectiveGstRate / 2).toFixed(2));
  const igstRate = Number(effectiveGstRate.toFixed(2));

  // Round-off option generation based on the total AFTER GST and discount (before round-off)
  // Generates exactly 4 round-DOWN (deduction) options — ALWAYS decreases the bill.
  // e.g. ₹102.00 → −₹2.00 → ₹100.00 | −₹7.00 → ₹95.00 | −₹12.00 → ₹90.00 | −₹17.00 → ₹85.00
  const generateRoundOffOptions = (total) => {
    if (!total || isNaN(total) || total <= 0) return [];
    const exact = Number(total.toFixed(2));
    const step = 5;
    // Largest multiple of 5 strictly BELOW the bill so every deduction > 0
    let base = Math.floor(exact / step) * step;
    if (base >= exact) base -= step;
    return [0, 1, 2, 3].map((i) => {
      const target = Number((base - i * step).toFixed(2));
      return {
        value: Number((exact - target).toFixed(2)), // positive deduction amount
        target,
        label: `Round down to ₹${target}`,
      };
    });
  };

  // Regenerate round-off options whenever the total after GST + discount changes.
  // Uses discountedTotal (before round-off) so the options stay stable when a round-off
  // is applied — the effect does NOT re-run on card click, so the selection is never reset.
  useEffect(() => {
    const baseTotal = discountedTotal + Number(shippingCost) + Number(otherCost);
    const opts = generateRoundOffOptions(baseTotal);
    setRoundOffOptions(opts);
    // Keep selection in sync with the current round-off value
    const current = Number(roundOff) || 0;
    if (current > 0) {
      const matchIdx = opts.findIndex(o => Math.abs(o.value - current) < 0.005);
      if (matchIdx !== -1) {
        setSelectedRoundOffIndex(matchIdx);
      } else {
        setSelectedRoundOffIndex(-1);
        setRoundOff(0);
      }
    } else {
      setSelectedRoundOffIndex(-1);
    }
  }, [discountedTotal, shippingCost, otherCost]);

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
        roundOffAmount: Number(roundOff) || 0,
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
        formData.append('roundOffAmount', payload.roundOffAmount);
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
  const isIntra = intraState;

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
            <div className="card-body" ref={supplierContainerRef} style={{ padding: '14px 16px' }}>
              <div className="purchase-form-grid" style={{ gap: '10px' }}>
                <div className="form-group" style={{ marginBottom: 0, position: 'relative', gridColumn: 'span 2' }}>
                  <label>Supplier *</label>
                  <div style={{ position: 'relative' }}>
                    <i className="fa-solid fa-building" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: '13px', pointerEvents: 'none' }}></i>
                    <input
                      ref={supplierSearchRef}
                      type="text"
                      placeholder="Search supplier by name, company or phone..."
                      value={supplierSearchQuery}
                      onChange={(e) => handleSupplierSearch(e.target.value)}
                      onFocus={showAllSuppliers}
                      className="form-select"
                      style={{ width: '100%', paddingLeft: '30px' }}
                      autoComplete="off"
                    />
                  </div>
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
                        {supplierSearchQuery.trim() ? 'No suppliers found. Type a name to create a new supplier.' : 'No suppliers found'}
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
                  marginTop: '10px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: isIntra ? '#f0fdf4' : '#eff6ff',
                  border: `1px solid ${isIntra ? '#bbf7d0' : '#bfdbfe'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: isIntra ? 'rgba(22, 163, 74, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                    color: isIntra ? '#16a34a' : '#2563eb',
                    flexShrink: 0,
                  }}>
                    <i className={`fa-solid ${isIntra ? 'fa-building' : 'fa-truck-fast'}`} style={{ fontSize: '14px' }}></i>
                  </div>
                  <div style={{ flex: 1, minWidth: '160px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                      {selectedSupplier?.supplierName || supplierName}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                      {supplierState || 'Not set'}{supplierStateCode ? ` • Code: ${supplierStateCode}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.3 }}>
                        {isIntra ? 'Same State' : 'Different State'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1.3 }}>
                        {isIntra ? 'CGST + SGST' : 'IGST applied'}
                      </div>
                    </div>
                    <span className={`badge ${isIntra ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
                      {isIntra ? 'CGST + SGST' : 'IGST'}
                    </span>
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
            <div className="card-body" style={{ padding: '14px 16px' }}>
              {!invoiceFile && !invoiceAttachment ? (
                <div
                  onClick={() => invoiceFileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--gray-300)',
                    borderRadius: '10px',
                    padding: '16px 14px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background-color 0.2s',
                    background: 'var(--gray-50)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-light)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--gray-300)'; e.currentTarget.style.background = 'var(--gray-50)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      flexShrink: 0,
                    }}>
                      <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '18px' }}></i>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--gray-700)' }}>
                        Upload Invoice
                        <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}> — or drag & drop</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--gray-400)', marginTop: '2px' }}>
                        PDF, JPG, JPEG, PNG • Max 5MB
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* File info + actions */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    marginBottom: '10px',
                  }}>
                    <i className={`fa-solid ${invoiceFile?.type === 'application/pdf' || invoiceAttachment?.endsWith('.pdf') ? 'fa-file-pdf' : 'fa-file-image'}`} style={{ fontSize: '20px', color: '#dc2626' }}></i>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {invoiceFile?.name || invoiceAttachment?.split('/').pop() || 'Invoice'}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#666' }}>
                        {invoiceFile ? `${(invoiceFile.size / 1024).toFixed(1)} KB` : 'Uploaded'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {invoiceAttachment && (
                        <a
                          href={invoiceAttachment}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-outline-info"
                          style={{ padding: '3px 8px', fontSize: '11px' }}
                        >
                          <i className="fa-solid fa-eye"></i> View
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => invoiceFileInputRef.current?.click()}
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        <i className="fa-solid fa-rotate"></i> Replace
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={removeInvoiceFile}
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        <i className="fa-solid fa-trash"></i> Remove
                      </button>
                    </div>
                  </div>

                  {/* Invoice Preview - compact collapsible */}
                  <details style={{ border: '1px solid var(--gray-200)', borderRadius: '8px', overflow: 'hidden', background: '#f1f5f9' }}>
                    <summary style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--gray-600)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      listStyle: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <span><i className="fa-solid fa-eye" style={{ fontSize: '11px', marginRight: '6px', color: 'var(--primary)' }}></i> Preview Invoice</span>
                      <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px', color: 'var(--gray-400)' }}></i>
                    </summary>
                    {invoiceFile ? (
                      invoiceFile.type === 'application/pdf' ? (
                        <iframe
                          src={URL.createObjectURL(invoiceFile)}
                          title="Purchase Invoice Preview"
                          style={{ width: '100%', height: '260px', border: 'none', background: '#fff' }}
                        />
                      ) : (
                        <img
                          src={URL.createObjectURL(invoiceFile)}
                          alt="Purchase Invoice Preview"
                          style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', background: '#fff' }}
                        />
                      )
                    ) : invoiceAttachment ? (
                      invoiceAttachment.endsWith('.pdf') ? (
                        <iframe
                          src={invoiceAttachment}
                          title="Purchase Invoice Preview"
                          style={{ width: '100%', height: '260px', border: 'none', background: '#fff' }}
                        />
                      ) : (
                        <img
                          src={invoiceAttachment}
                          alt="Purchase Invoice Preview"
                          style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', background: '#fff' }}
                        />
                      )
                    ) : null}
                  </details>
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
          <div className="card items-card-modern" style={{ marginBottom: '16px' }}>
            <div className="card-header items-card-header">
              <h5><i className="fa-solid fa-cart-plus"></i> Items</h5>
              <button type="button" className="btn-add-item" onClick={addItem}>
                <i className="fa-solid fa-plus"></i> Add Item
              </button>
            </div>
            <div className="card-body">
              <div className="search-box-wrapper" ref={searchContainerRef}>
                <div className="search-input-wrap">
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="🔍 Search medicine by name, SKU or barcode..."
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
              </div>

              {/* Desktop Table View */}
              <div className="purchase-items-desktop-table items-table-wrap" style={{ marginTop: '12px' }}>
                <div className="table-container">
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th style={{ width: '70px' }}>Qty</th>
                        <th style={{ width: '110px' }}>Purchase Price</th>
                        <th style={{ width: '120px' }}>Expiry</th>
                        <th style={{ width: '75px' }}>GST %</th>
                        <th className="th-subtotal" style={{ width: '110px' }}>Subtotal</th>
                        <th style={{ width: '44px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={index}>
                          <td className="td-medicine">
                            <input type="text" placeholder="Medicine name" value={item.medicineName} onChange={(e) => handleItemChange(index, 'medicineName', e.target.value)} className="input-sm" style={{ width: '100%' }} />
                          </td>
                          <td><input type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} className="qty-input-sm" onWheel={(e) => e.target.blur()} /></td>
                          <td className="td-price"><input type="number" min="0" step="0.01" value={item.purchasePrice} onChange={(e) => handleItemChange(index, 'purchasePrice', e.target.value)} className="price-input-sm" onWheel={(e) => e.target.blur()} /></td>
                          <td className="td-expiry"><input type="date" value={item.expiryDate} onChange={(e) => handleItemChange(index, 'expiryDate', e.target.value)} className="input-sm" style={{ width: '100%' }} /></td>
                          <td className="td-gst">
                            <input type="number" min="0" max="100" value={item.gst} onChange={(e) => handleItemChange(index, 'gst', e.target.value)} className="gst-input-sm" onWheel={(e) => e.target.blur()} />
                            <div className="gst-applied-hint">
                              → {resolveGstRate(item.gst, defaultGstRate)}%
                            </div>
                          </td>
                          <td className="td-subtotal"><CurrencyDisplay value={Number(item.quantity) * Number(item.purchasePrice)} cardMode={false} forceDecimals /></td>
                          <td className="td-remove">
                            <button type="button" className="btn btn-danger btn-sm item-remove-btn" onClick={() => removeItem(index)}>
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
                        <label>Qty</label>
                        <input type="number" min="1" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} onWheel={(e) => e.target.blur()} />
                      </div>
                      <div className="purchase-item-card-field">
                        <label>Purchase Price</label>
                        <input type="number" min="0" step="0.01" value={item.purchasePrice} onChange={(e) => handleItemChange(index, 'purchasePrice', e.target.value)} onWheel={(e) => e.target.blur()} />
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
                <span className="summary-label">Product Subtotal:</span><span className="summary-value"><CurrencyDisplay value={productSubtotal} cardMode={false} forceDecimals /></span>
              </div>

              {/* GST Breakdown - calculated FIRST, before discount */}
              {isIntra ? (
                <>
                  <div className="summary-row">
                    <span className="summary-label">CGST ({cgstRate}%):</span><span className="summary-value"><CurrencyDisplay value={cgst} cardMode={false} forceDecimals /></span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">SGST ({sgstRate}%):</span><span className="summary-value"><CurrencyDisplay value={sgst} cardMode={false} forceDecimals /></span>
                  </div>
                </>
              ) : (
                <div className="summary-row">
                  <span className="summary-label">IGST ({igstRate}%):</span><span className="summary-value"><CurrencyDisplay value={igst} cardMode={false} forceDecimals /></span>
                </div>
              )}
              <div className="summary-row">
                <span className="summary-label">Total GST:</span><span className="summary-value"><CurrencyDisplay value={totalGst} cardMode={false} forceDecimals /></span>
              </div>
              <div className="summary-row" style={{ fontWeight: 600 }}>
                <span className="summary-label">GST Inclusive Total:</span><span className="summary-value"><CurrencyDisplay value={gstInclusiveTotal} cardMode={false} forceDecimals /></span>
              </div>

              {/* Discount - applied AFTER GST */}
              <div className="summary-row" style={{ alignItems: 'center' }}>
                <span className="summary-label">Discount:</span>
                <div className="inline-discount">
                  <input type="number" value={discount} onChange={(e) => setDiscount(sanitizeNumericInput(e.target.value))} onWheel={(e) => e.target.blur()} />
                  <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                    <option value="percentage">%</option>
                    <option value="fixed">{getCurrentSymbol()}</option>
                  </select>
                </div>
              </div>


              {/* <div className="summary-row" style={{ fontWeight: 600 }}>
                <span className="summary-label">After Round Off:</span><span className="summary-value"><CurrencyDisplay value={afterRoundOff} cardMode={false} forceDecimals /></span>
              </div> */}
              <div className="summary-row">
                <span className="summary-label">Shipping:</span>
                <input type="number" value={shippingCost} onChange={(e) => setShippingCost(sanitizeNumericInput(e.target.value))} className="inline-input-sm" onWheel={(e) => e.target.blur()} />
              </div>
              <div className="summary-row">
                <span className="summary-label">Other Cost:</span>
                <input type="number" value={otherCost} onChange={(e) => setOtherCost(sanitizeNumericInput(e.target.value))} className="inline-input-sm" onWheel={(e) => e.target.blur()} />
              </div>



              {/* Round Off Options - Selectable Cards (round down only) - placed AFTER GST & discount */}
              {items.length > 0 && roundOffOptions.length > 0 && (
                <div className="round-off-section">
                  <div className="round-off-header">
                    <span><i className="fa-solid fa-circle-dollar"></i> Round Off</span>
                    {Number(roundOff) > 0 && (
                      <span className="round-off-badge down">
                        − {getCurrentSymbol()}{Number(roundOff).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="round-off-cards">
                    {roundOffOptions.map((opt, idx) => {
                      const isSelected = selectedRoundOffIndex === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={`round-off-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedRoundOffIndex(idx);
                            setRoundOff(opt.value);
                          }}
                          title={opt.label}
                        >
                          <span className="round-off-card-add">− {getCurrentSymbol()}{opt.value.toFixed(2)}</span>
                          <span className="round-off-diff down">
                            → {getCurrentSymbol()}{Number.isInteger(opt.target) ? opt.target : opt.target.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {Number(roundOff) > 0 && (
                    <button
                      type="button"
                      className="round-off-clear"
                      onClick={() => {
                        setSelectedRoundOffIndex(-1);
                        setRoundOff(0);
                      }}
                    >
                      <i className="fa-solid fa-rotate-left"></i> Reset to ₹0.00
                    </button>
                  )}
                </div>
              )}

              {Number(discountAmt) > 0 && (
                <div className="summary-row discount-amount-row">
                  <span className="summary-label">Total Discount:</span>
                  <span className="summary-value discount-amount-value">
                    − <CurrencyDisplay value={discountAmt + roundOff} cardMode={false} forceDecimals />
                  </span>
                </div>
              )}

              <hr style={{ margin: '6px 0', borderColor: 'var(--gray-200)' }} />

              <div className="grand-total-row" style={{ marginBottom: '10px' }}>
                <span>Grand Total:</span><span><CurrencyDisplay value={gt} cardMode={false} forceDecimals /></span>
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
                <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(sanitizeNumericInput(e.target.value))} className="form-select" style={{ width: '100%' }} onWheel={(e) => e.target.blur()} />
              </div>

              <div className={`due-row ${Number(paidAmount) >= totalPayable ? 'positive' : 'negative'}`} style={{ padding: '8px 0' }}>
                <span>Remaining Due:</span><span className="due-value"><CurrencyDisplay value={Math.max(0, totalPayable - Number(paidAmount))} cardMode={false} forceDecimals /></span>
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