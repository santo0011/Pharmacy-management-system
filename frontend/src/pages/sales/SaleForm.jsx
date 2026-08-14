import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { createSale, updateSale, fetchSale, clearSelectedSale } from '../../redux/slices/saleSlice';
import { fetchMedicines } from '../../redux/slices/medicineSlice';
import { medicineService } from '../../services/medicineService';
import CurrencyDisplay from '../../components/common/CurrencyDisplay';
import { getCurrentSymbol } from '../../utils/currency';
import { showSuccess, showError, confirmAction } from '../../utils/sweetAlert';
import { customerService } from '../../services/customerService';
import { pharmacyService } from '../../services/pharmacyService';
import PortalDropdown from '../../components/common/PortalDropdown';
import BarcodeScanner from '../../components/common/BarcodeScanner';
import { calculateInvoiceGST, getStateCode, resolveGstRate } from '../../utils/gst';

export default function SaleForm() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const { items: medicines } = useSelector((state) => state.medicines);
  const { selectedSale } = useSelector((state) => state.sales);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerRef, setCustomerRef] = useState(null);
  const [customerStateCode, setCustomerStateCode] = useState('');
  const [pharmacyStateCode, setPharmacyStateCode] = useState('');
  const [defaultGstRate, setDefaultGstRate] = useState(0);
  const [customerDueInfo, setCustomerDueInfo] = useState(null);
  const [includePreviousDue, setIncludePreviousDue] = useState(false);
  const [selectedDueInvoices, setSelectedDueInvoices] = useState([]);
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState('percentage');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const PAYMENT_METHODS = [
    { value: 'cash', label: 'Cash', icon: 'fa-solid fa-money-bill-wave', iconColor: '#22c55e' },
    { value: 'card', label: 'Card', icon: 'fa-solid fa-credit-card', iconColor: '#6366f1' },
    { value: 'upi', label: 'UPI', icon: 'fa-solid fa-mobile-screen-button', iconColor: '#0ea5e9' },
    { value: 'mobile_banking', label: 'M. Banking', icon: 'fa-solid fa-mobile-screen', iconColor: '#8b5cf6' },
    { value: 'other', label: 'Other', icon: 'fa-solid fa-receipt', iconColor: '#f59e0b' },
  ];
  const [submitting, setSubmitting] = useState(false);
  const [roundOffDiff, setRoundOffDiff] = useState(0); // Round-off adjustment (always negative or 0)
  const [roundOffOptions, setRoundOffOptions] = useState([]); // Generated round-off option cards
  const [selectedRoundOffIndex, setSelectedRoundOffIndex] = useState(-1); // -1 = no round-off selected
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Substitute suggestion states
  const [substituteModal, setSubstituteModal] = useState(null); // { originalItem, suggestions, index }
  const [loadingSubstitutes, setLoadingSubstitutes] = useState(false);

  // Customer search states
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerVerified, setCustomerVerified] = useState(false);
  const [phoneVerifiedMatch, setPhoneVerifiedMatch] = useState(null); // {name, phone} when phone matches existing customer

  const searchRef = useRef(null);
  const searchContainerRef = useRef(null);
  const customerSearchRef = useRef(null);
  const customerContainerRef = useRef(null);

  const fetchCustomers = useCallback(async (q) => {
    if (!q || q.trim().length < 1) {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      return;
    }
    setCustomerSearchLoading(true);
    try {
      const { data } = await customerService.searchCustomers(q);
      if (data.data) {
        setCustomerSearchResults(data.data);
        setShowCustomerDropdown(data.data.length > 0);

        // Phone-based auto-verification: if the search is exactly a phone number
        // and there's an exact phone match, show "Verified Existing Customer"
        const cleanQ = q.trim();
        if (cleanQ.length >= 10 && /^[\d\s\-+()]+$/.test(cleanQ)) {
          const exactPhoneMatch = data.data.find(c => c.phone === cleanQ);
          if (exactPhoneMatch && !customerRef) {
            // Show verification banner but DON'T auto-link — admin must click to confirm
            setPhoneVerifiedMatch({ name: exactPhoneMatch.name, phone: exactPhoneMatch.phone, _id: exactPhoneMatch._id });
          } else {
            setPhoneVerifiedMatch(null);
          }
        } else {
          setPhoneVerifiedMatch(null);
        }
      } else {
        setPhoneVerifiedMatch(null);
      }
    } catch (error) {
      console.error('Customer search error:', error);
    } finally {
      setCustomerSearchLoading(false);
    }
  }, [customerRef]);

  const debounceTimer = useRef(null);

  const handleCustomerSearch = (value) => {
    setCustomerSearchQuery(value);

    // Clear customer selection when manually typing
    setCustomerRef(null);
    setCustomerDueInfo(null);
    setIncludePreviousDue(false);
    setSelectedDueInvoices([]);
    setCustomerVerified(false);
    setPhoneVerifiedMatch(null);

    // Combined input: the typed value IS the customer name (unless overridden by dropdown selection)
    // Clear phone only if entered text contains no digits (not a phone search)
    setCustomerName(value || '');

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      fetchCustomers(value);
    }, 300);
  };

  const selectCustomer = (customer) => {
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerRef(customer);
    setCustomerSearchQuery(customer.name);
    setShowCustomerDropdown(false);
    setIncludePreviousDue(false);
    setSelectedDueInvoices([]);
    setCustomerVerified(true);
    setPhoneVerifiedMatch(null);
    // Set the customer's state code for GST determination
    setCustomerStateCode(customer.stateCode || getStateCode(customer.state) || '');

    // Fetch due information for this customer
    fetchCustomerDue(customer);
  };

  const fetchCustomerDue = async (customer) => {
    try {
      // Always use the MongoDB _id for identification - never fallback to name
      // This ensures only this specific customer's due is loaded
      const identifier = customer._id;
      if (!identifier) return;
      const { data } = await customerService.getCustomerDueInvoices(identifier);
      if (data.data && data.data.invoices && data.data.invoices.length > 0) {
        const totalDue = data.data.invoices.reduce((sum, inv) => sum + inv.dueAmount, 0);
        setCustomerDueInfo({
          totalDue,
          invoiceCount: data.data.invoices.length,
          invoices: data.data.invoices,
        });
      } else {
        setCustomerDueInfo(null);
      }
    } catch (error) {
      // Silently fail - due info is optional
      setCustomerDueInfo(null);
    }
  };

  useEffect(() => {
    dispatch(fetchMedicines({ limit: 200 }));
    searchRef.current?.focus();
    if (isEditing && id) {
      dispatch(fetchSale(id));
    }
    // Load the pharmacy's Default Business State code for GST determination
    const loadPharmacyState = async () => {
      try {
        const { data } = await pharmacyService.getMyPharmacyProfile();
        if (data?.data) {
          const stateName = data.data.state || '';
          const stateCode = data.data.stateCode || getStateCode(stateName) || '';
          setPharmacyStateCode(stateCode);
          // Load the Default GST % from Settings (used when product GST is 0)
          setDefaultGstRate(Number(data.data.defaultGstRate) || 0);
        }
      } catch (error) {
        // Silently fail — GST will default to intra-state (CGST+SGST)
      }
    };
    loadPharmacyState();
    return () => {
      dispatch(clearSelectedSale());
    };
  }, [dispatch, id, isEditing]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const now = new Date();
      const results = medicines?.filter(m =>
        (m.medicineName?.toLowerCase().includes(q) || m.barcode?.includes(q) || m.genericName?.toLowerCase().includes(q)) &&
        m.currentStock > 0 &&
        // Exclude expired medicines
        m.expiryDate && new Date(m.expiryDate) > now
      ) || [];
      setSearchResults(results.slice(0, 10));
      setShowDropdown(true);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [searchQuery, medicines]);

  // Close dropdown on click outside (but NOT when clicking inside portal dropdown items)
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click target is inside any portal dropdown - if so, don't close
      // Portal dropdowns are rendered at document.body level and handle their own outside clicks
      let inPortalDropdown = false;
      const portalDropdowns = document.querySelectorAll('.portal-dropdown');
      portalDropdowns.forEach(dd => {
        if (dd.contains(event.target)) {
          inPortalDropdown = true;
        }
      });

      if (!inPortalDropdown) {
        if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
          setShowDropdown(false);
        }
        if (customerContainerRef.current && !customerContainerRef.current.contains(event.target)) {
          setShowCustomerDropdown(false);
        }
      }
    };

    if (showDropdown || showCustomerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showDropdown, showCustomerDropdown]);

  const addItem = (medicine) => {
    const existing = items.find(i => i.medicineId === medicine._id);
    if (existing) {
      setItems(prev => prev.map(i => i.medicineId === medicine._id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems(prev => [...prev, {
        medicineId: medicine._id,
        medicineName: medicine.medicineName,
        batchNumber: medicine.batchNumber || '',
        quantity: 1,
        sellingPrice: medicine.sellingPrice || 0,
        purchasePrice: medicine.purchasePrice || 0,
        gst: medicine.gst || 0,
        discount: 0,
        discountType: 'fixed',
        currentStock: medicine.currentStock || 0,
      }]);
    }
    setSearchQuery('');
    setShowDropdown(false);
    searchRef.current?.focus();
  };

  const handleScanResult = useCallback((decodedText) => {
    const med = medicines?.find(m => m.barcode === decodedText && m.currentStock > 0);
    if (med) {
      addItem(med);
    } else {
      showError('Medicine not found for this barcode');
    }
  }, [medicines]);

  const updateItem = (index, field, value) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const calcItemSubtotal = (item) => Number(item.quantity) * Number(item.sellingPrice);
  const calcItemDiscount = (item) => item.discountType === 'percentage' ? calcItemSubtotal(item) * (Number(item.discount) / 100) : Number(item.discount);
  const calcItemTotal = (item) => {
    const sub = calcItemSubtotal(item);
    const disc = calcItemDiscount(item);
    const gstAmt = (sub - disc) * (resolveGstRate(item.gst, defaultGstRate) / 100);
    return sub - disc + gstAmt;
  };
  const calcSubtotal = () => items.reduce((sum, i) => sum + calcItemSubtotal(i), 0);
  const calcDiscount = () => discountType === 'percentage' ? calcSubtotal() * (Number(discount) / 100) : Number(discount);

  // Centralized GST calculation using the shared utility (mirrors backend gstHelper.js)
  // Resolve each item's applicable GST: product GST > 0 → use it; product GST = 0 → use pharmacy Default GST
  const gstCalc = calculateInvoiceGST({
    items: items.map(item => ({
      ...item,
      gst: resolveGstRate(item.gst, defaultGstRate),
    })),
    discount: Number(discount) || 0,
    discountType,
    pharmacyStateCode,
    otherPartyStateCode: customerStateCode,
  });

  // Current bill total (without previous due) - this is what gets sent to backend
  const calcCurrentBillTotal = () => gstCalc.grandTotal;

  // Previous due amount (from individually selected invoices)
  const calcPreviousDue = () => {
    if (!customerDueInfo || !customerDueInfo.invoices) return 0;
    return customerDueInfo.invoices
      .filter(inv => selectedDueInvoices.includes(inv._id))
      .reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
  };

  // Round-off option generation based on current bill total
  // Generates round-down + round-up options (NO Exact Amount card)
  const generateRoundOffOptions = (total) => {
    if (!total || isNaN(total) || total <= 0) return [];
    const exact = Number(total.toFixed(2));
    const options = [];
    const sym = getCurrentSymbol();

    // Round down to nearest whole rupee (if different from exact)
    const floorVal = Math.floor(exact);
    if (floorVal !== exact && floorVal > 0) {
      options.push({
        value: floorVal,
        diff: Number((floorVal - exact).toFixed(2)),
        isExact: false,
        label: 'Round Down',
      });
    }

    // Determine the step unit based on bill size
    const step = exact >= 1000 ? 50 : 5;

    // Generate round-up options at increasing multiples of step
    // e.g. 102.86 → 105, 110, 115 (step 5); 319.55 → 325, 330, 335
    let baseVal = Math.ceil((exact + 0.01) / step) * step;
    let guard = 0;
    while (options.length < 6 && guard < 20) {
      guard++;
      if (baseVal > exact && !options.some(o => o.value === baseVal)) {
        options.push({
          value: baseVal,
          diff: Number((baseVal - exact).toFixed(2)),
          isExact: false,
          label: `Round ${sym}${step}`,
        });
      }
      baseVal += step;
    }

    return options;
  };

  // Regenerate round-off options whenever the current bill total changes
  useEffect(() => {
    const total = calcCurrentBillTotal();
    const opts = generateRoundOffOptions(total);
    setRoundOffOptions(opts);
    // No card selected by default — bill stays exact, no auto-round
    setSelectedRoundOffIndex(-1);
    setRoundOffDiff(0);
  }, [gstCalc.grandTotal]);

  // Calculate the rounded bill total (current bill + round-off adjustment, before previous due)
  const calcRoundedBillTotal = () => {
    const raw = calcCurrentBillTotal();
    return Number((raw + Number(roundOffDiff || 0)).toFixed(2));
  };

  // Final Grand Total displayed in UI (includes round-off + previous due if toggled)
  const calcGrandTotal = () => calcRoundedBillTotal() + calcPreviousDue();

  const calcNetDue = () => Math.max(0, calcGrandTotal() - Number(paidAmount || 0));

  // Load sale data when editing - do NOT load previous due info during edit
  useEffect(() => {
    if (isEditing && selectedSale) {
      setCustomerName(selectedSale.customerName || '');
      setCustomerPhone(selectedSale.customerPhone || '');
      setCustomerSearchQuery(selectedSale.customerName || '');
      setItems(selectedSale.items?.map(i => ({
        medicineId: i.medicine?._id || i.medicineId || '',
        medicineName: i.medicineName,
        batchNumber: i.batchNumber || '',
        quantity: i.quantity,
        sellingPrice: i.sellingPrice,
        purchasePrice: i.purchasePrice || 0,
        gst: i.gst || 0,
        discount: i.discount || 0,
        discountType: i.discountType || 'fixed',
        currentStock: 9999,
      })) || []);
      setDiscount(selectedSale.discount || '');
      setDiscountType(selectedSale.discountType || 'percentage');
      setPaidAmount(selectedSale.paidAmount || '');
      setPaymentMethod('card');
      // Preserve the existing round-off amount when editing
      const existingRoundOff = Number(selectedSale.roundOffAmount) || 0;
      setRoundOffDiff(existingRoundOff);
      // Previous due is not editable on existing sales — skip loading
    }
  }, [selectedSale, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) { showError('Add at least one item'); return; }
    if (!customerName || customerName.trim() === '' || customerName.trim() === 'Walk-in Customer') {
      showError('Customer name is required. Please enter the customer name before billing.');
      return;
    }

    // Compute the current bill total (without previous due) for backend submission
    const currentBillGrandTotal = calcRoundedBillTotal();
    const finalGrandTotal = calcGrandTotal();
    const paid = Number(paidAmount) || 0;

    // Show confirmation before completing the sale
    const dueAfterPayment = Math.max(0, finalGrandTotal - paid);
    const confirmed = await confirmAction(
      `${isEditing ? 'Update' : 'Complete'} Sale`,
      `Customer: ${customerName}\nItems: ${items.length}\nTotal: ${getCurrentSymbol()} ${currentBillGrandTotal.toFixed(2)}\nPrevious Due: ${getCurrentSymbol()} ${calcPreviousDue().toFixed(2)}\nFinal Grand Total: ${getCurrentSymbol()} ${finalGrandTotal.toFixed(2)}\nPaid: ${getCurrentSymbol()} ${paid.toFixed(2)}\nDue: ${getCurrentSymbol()} ${dueAfterPayment.toFixed(2)}\nMethod: ${paymentMethod}`,
      `Yes, ${isEditing ? 'Update' : 'Complete'}`
    );
    if (!confirmed) {
      return;
    }

    // Case 1: Name + Phone both match the same existing customer but user didn't select from dropdown
    if (!customerRef && customerName && customerPhone && customerSearchResults.length > 0) {
      const cleanName = customerName.trim().toLowerCase();
      const cleanPhone = customerPhone.trim();
      const bothMatch = customerSearchResults.find(c =>
        c.name.toLowerCase() === cleanName && c.phone === cleanPhone
      );
      if (bothMatch) {
        showError(
          `This customer already exists (${bothMatch.name}). Please select the existing customer from the search dropdown or use a different name/phone.`
        );
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(true);
    try {
      // If customerRef exists, use the customer with customerId
      let finalCustomerId = '';
      let finalCustomerName = customerName;
      let finalCustomerPhone = customerPhone;

      if (customerRef && customerRef._id) {
        // Case 2: Admin explicitly selected from dropdown — link to that customer
        finalCustomerId = customerRef._id;
        if (customerRef.phone) {
          finalCustomerPhone = customerRef.phone;
        }
      } else if (customerName) {
        // Cases 1, 3, 4: Admin did NOT select from dropdown.
        // Try to create a new customer record. If phone is empty, the backend
        // will auto-generate a CUST-NP-xxx placeholder, guaranteeing a NEW record.
        // If phone is provided and matches existing, the backend returns
        // "Customer already exists" — we must NOT link the sale in that case.
        try {
          const { data } = await customerService.createCustomer({
            name: customerName,
            phone: customerPhone || '',
          });
          // Only link for genuinely NEW customers, never for existing ones.
          // When phone is empty, the backend always creates a new record with
          // a CUST-NP-xxx placeholder phone, so this WILL be a new customer.
          if (data.data && data.data._id && data.message !== 'Customer already exists') {
            finalCustomerId = data.data._id;
          }
          // If customer already existed, finalCustomerId stays ''.
          // The sale stores the name as text but is NOT linked to any customer.
        } catch (err) {
          console.error('Could not create customer record:', err);
        }
      }

      // Compute FIFO payment allocation if previous due is included
      // FIFO: Always pay the oldest unpaid invoice first before paying the new invoice
      let previousDuePayments = [];
      let paidForNewInvoice = paid;

      if (selectedDueInvoices.length > 0 && customerDueInfo && customerDueInfo.invoices && customerDueInfo.invoices.length > 0) {
        // Only process invoices that were actually selected
        const selectedInvoices = customerDueInfo.invoices.filter(inv => selectedDueInvoices.includes(inv._id));

        // Sort old invoices by oldest saleDate first (FIFO)
        const sortedInvoices = [...selectedInvoices].sort(
          (a, b) => new Date(a.saleDate) - new Date(b.saleDate)
        );

        let remainingForOld = paid;
        for (const inv of sortedInvoices) {
          if (remainingForOld <= 0) break;
          const payForThisInvoice = Math.min(remainingForOld, inv.dueAmount);
          if (payForThisInvoice > 0) {
            previousDuePayments.push({
              saleId: inv._id,
              amount: payForThisInvoice,
            });
            remainingForOld -= payForThisInvoice;
          }
        }

        // Whatever remains after paying old invoices goes to the new invoice
        paidForNewInvoice = Math.max(0, remainingForOld);
      }

      // Validate paidForNewInvoice doesn't exceed the new invoice grand total
      if (paidForNewInvoice > currentBillGrandTotal) {
        showError(`Total paid (${getCurrentSymbol()} ${paid.toFixed(2)}) minus previous due allocation (${getCurrentSymbol()} ${previousDuePayments.reduce((s, p) => s + p.amount, 0).toFixed(2)}) = ${getCurrentSymbol()} ${paidForNewInvoice.toFixed(2)} exceeds the current bill total (${getCurrentSymbol()} ${currentBillGrandTotal.toFixed(2)})`);
        setSubmitting(false);
        return;
      }

      const formData = {
        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone,
        items: items.map(i => ({
          medicineId: i.medicineId,
          medicineName: i.medicineName,
          quantity: Number(i.quantity),
          sellingPrice: Number(i.sellingPrice),
          gst: Number(i.gst),
          discount: Number(i.discount),
          discountType: i.discountType,
        })),
        discount: Number(discount),
        discountType,
        // Round-off adjustment (0 for exact, positive/negative otherwise)
        roundOffAmount: Number(roundOffDiff) || 0,
        // Customer GST details for inter-state/intra-state determination
        customerStateCode: customerStateCode || '',
        customerState: customerRef?.state || '',
        customerGstin: customerRef?.gstin || '',
        customerType: customerRef?.customerType || 'retail',
        // Send the total amount paid by the customer
        paidAmount: paid,
        paymentMethod,
        notes: selectedDueInvoices.length > 0 && customerDueInfo ? `Previous due of ${getCurrentSymbol()} ${calcPreviousDue().toFixed(2)} included` : '',
      };

      // Add previous due payments array with FIFO allocation
      if (previousDuePayments.length > 0) {
        formData.previousDuePayments = previousDuePayments;
      }

      // Add customer ref if available
      if (finalCustomerId) {
        formData.customer = finalCustomerId;
      }

      if (isEditing) {
        await dispatch(updateSale({ id, formData })).unwrap();
        showSuccess('Sale updated successfully');
        navigate(`/sales/${id}`);
      } else {
        const result = await dispatch(createSale(formData)).unwrap();
        showSuccess('Sale created successfully');
        navigate(`/sales/${result._id}`);
      }
    } catch (error) {
      showError(error || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const gt = calcGrandTotal();
  const currentBillTotal = calcCurrentBillTotal();

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-cash-register"></i> {isEditing ? 'Edit Sale' : 'POS / Billing'}</h2>
          <p>{isEditing ? 'Update sale order' : 'Create a new sale'}</p>
        </div>
      </div>

      <div className="sale-layout">
        {/* Left - Product Selection */}
        <div>
          <div className="card search-card-no-clip" style={{ marginBottom: '16px' }}>
            <div className="card-body">
              <div className="search-box-wrapper" ref={searchContainerRef}>
                <div className="search-input-wrap">
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="🔍 Search medicine by name or barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <PortalDropdown
                    triggerRef={searchRef}
                    show={showDropdown}
                    onClose={() => setShowDropdown(false)}
                  >
                    {searchResults.length > 0 ? (
                      searchResults.map(med => (
                        <div key={med._id} onClick={() => addItem(med)}
                          className="search-dropdown-item">
                          <div>
                            <div className="item-name">{med.medicineName}</div>
                            <div className="item-details">{med.genericName} | {med.barcode}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="item-price"><CurrencyDisplay value={med.sellingPrice} /></div>
                            <div className={`item-stock ${med.currentStock <= 10 ? 'low' : ''}`}>Stock: {med.currentStock}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="search-dropdown-empty" style={{ padding: '12px 14px', color: '#888', fontSize: '13px' }}>No medicines found</div>
                    )}
                  </PortalDropdown>
                </div>
                <button type="button" className="btn btn-info" onClick={() => setScanning(true)} style={{ height: '46px', whiteSpace: 'nowrap' }}>
                  <i className="fa-solid fa-camera"></i> Scan
                </button>
              </div>
              <BarcodeScanner
                open={scanning}
                onScan={handleScanResult}
                onClose={() => setScanning(false)}
                scannerId="pos-scanner"
                stopAfterScan={true}
              />
            </div>
          </div>

          <div className="card customer-card-no-clip">
            <div className="card-header">
              <h5>Customer</h5>
            </div>
            <div className="card-body" ref={customerContainerRef}>
              {/* Single autocomplete search input — merges search + name */}
              <div className="customer-grid">
                <div className="form-group customer-search-wrapper" style={{ flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Search customer by name or phone... (new name if not found)"
                    value={customerSearchQuery}
                    onChange={(e) => handleCustomerSearch(e.target.value)}
                    className="form-select"
                    style={{ width: '100%' }}
                    ref={customerSearchRef}
                    autoComplete="off"
                  />
                  <PortalDropdown
                    triggerRef={customerSearchRef}
                    show={showCustomerDropdown}
                    onClose={() => setShowCustomerDropdown(false)}
                  >
                    {customerSearchLoading ? (
                      <div style={{ textAlign: 'center', padding: '14px', color: '#888', fontSize: '13px' }}>
                        <i className="fa-solid fa-spinner fa-spin"></i> Searching...
                      </div>
                    ) : customerSearchResults.length > 0 ? (
                      customerSearchResults.map(c => (
                        <div
                          key={c._id}
                          onClick={() => selectCustomer(c)}
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
                            <div style={{ fontWeight: 500 }}>{c.name}</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>{c.phone}</div>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 500 }}>
                            {c.totalPurchases > 0 ? `${c.totalPurchases} purchase(s)` : 'New'}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: '14px', color: '#888', fontSize: '13px' }}>
                        No customer found. Will use typed name as new customer.
                      </div>
                    )}
                  </PortalDropdown>
                  {customerVerified && customerRef && (
                    <div style={{
                      marginTop: '4px',
                      fontSize: '11px',
                      color: 'var(--primary)',
                      fontWeight: 500,
                    }}>
                      <i className="fa-solid fa-check-circle"></i> Verified Existing Customer
                    </div>
                  )}
                  {!customerVerified && phoneVerifiedMatch && (
                    <div style={{
                      marginTop: '4px',
                      fontSize: '11px',
                      color: '#9a3412',
                      fontWeight: 500,
                      padding: '4px 8px',
                      background: '#fff7ed',
                      borderRadius: '4px',
                    }}>
                      <i className="fa-solid fa-exclamation-triangle"></i> Phone {phoneVerifiedMatch.phone} belongs to <strong>{phoneVerifiedMatch.name}</strong> —
                      <button
                        className="btn btn-sm btn-link"
                        style={{ fontSize: '11px', padding: '0 4px', margin: 0, color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none' }}
                        onClick={() => selectCustomer(phoneVerifiedMatch)}
                      >Select this customer</button>
                      to link or change the phone number.
                    </div>
                  )}
                </div>
              </div>
              {/* Separate Phone field — always visible */}
              <div className="form-group" style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  placeholder="Phone (optional)"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    // When phone is manually typed, sync to search so auto-verification triggers
                    if (!customerRef && customerSearchQuery) {
                      // Phone change keeps the search but verification will re-run on next search
                    }
                  }}
                  className="form-select"
                  style={{ width: '100%' }}
                />
              </div>
              {/* Show selected customer name inline */}
              {customerRef && (
                <div style={{ marginTop: '4px', fontSize: '13px', color: '#666' }}>
                  {customerName}
                </div>
              )}
            </div>
          </div>

          {/* Due Details - Shown when customer is verified */}
          {customerVerified && customerDueInfo && !isEditing && (
            <div className="due-invoices-section" style={{ marginTop: '16px' }}>
              <div className="due-invoices-header">
                <h6><i className="fa-solid fa-file-invoice"></i> Previous Due Invoices</h6>
                <label className="due-invoices-select-all">
                  <input
                    type="checkbox"
                    checked={selectedDueInvoices.length > 0 && selectedDueInvoices.length === customerDueInfo.invoices.length}
                    onChange={() => {
                      if (selectedDueInvoices.length === customerDueInfo.invoices.length) {
                        setSelectedDueInvoices([]);
                      } else {
                        setSelectedDueInvoices(customerDueInfo.invoices.map(inv => inv._id));
                      }
                    }}
                  />
                  <span>{selectedDueInvoices.length > 0 ? `${selectedDueInvoices.length} Due Included` : 'Select All'}</span>
                </label>
              </div>
              <div className="due-invoices-list">
                {customerDueInfo.invoices.map(inv => (
                  <div
                    key={inv._id}
                    className={`due-invoice-item ${selectedDueInvoices.includes(inv._id) ? 'selected' : ''}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDueInvoices.includes(inv._id)}
                      onChange={() => {
                        setSelectedDueInvoices(prev =>
                          prev.includes(inv._id)
                            ? prev.filter(id => id !== inv._id)
                            : [...prev, inv._id]
                        );
                      }}
                    />
                    <div className="due-invoice-info">
                      <span className="due-invoice-number">{inv.invoiceNumber}</span>
                      <span className="due-invoice-date">{new Date(inv.saleDate).toLocaleDateString()}</span>
                      <div className="due-invoice-payment-details">
                        <span>Total: <CurrencyDisplay value={inv.grandTotal || 0} /></span>
                        <span>Paid: <CurrencyDisplay value={inv.paidAmount || 0} /></span>
                        <span className="due-invoice-remaining">Due: <CurrencyDisplay value={inv.dueAmount || 0} /></span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <span className="due-invoice-amount"><CurrencyDisplay value={inv.dueAmount} /></span>
                      <span className={`badge ${inv.paymentStatus === 'paid' ? 'badge-success' : inv.paymentStatus === 'partial' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '10px' }}>
                        {inv.paymentStatus || 'due'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{
                padding: '10px 14px',
                background: '#fef2f2',
                borderTop: '1px solid #fecaca',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '14px',
                fontWeight: 700,
                color: '#991b1b',
              }}>
                <span>Total Due</span>
                <span><CurrencyDisplay value={customerDueInfo.totalDue} /></span>
              </div>
            </div>
          )}

          <div className="card" style={{ marginTop: '16px' }}>
            <div className="card-body" style={{ padding: 0 }}>
              {items.length === 0 ? (
                <div className="cart-empty-state">
                  <i className="fa-solid fa-cart-shopping"></i>
                  <p>Search and add medicines to start billing</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th style={{ width: '60px' }}>Qty</th>
                        <th style={{ width: '90px' }}>Price</th>
                        <th style={{ width: '60px' }}>GST</th>
                        {/* <th style={{ width: '90px' }}>Total</th> */}
                        <th style={{ width: '30px' }}></th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} className={item.quantity > item.currentStock ? 'stock-warning-row' : ''}>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: '13px' }}>{item.medicineName}</div>
                            <div className={`gst-label ${item.quantity > item.currentStock ? 'text-danger' : ''}`}>
                              Stock: {item.currentStock}
                              {item.quantity > item.currentStock && (
                                <span style={{ color: 'var(--danger)', fontWeight: 600, marginLeft: '4px' }}>
                                  <i className="fa-solid fa-exclamation-triangle"></i> Insufficient
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <input type="number" min="1" max={item.currentStock} value={item.quantity}
                              onChange={(e) => updateItem(idx, 'quantity', Math.min(Number(e.target.value), item.currentStock))}
                              className="qty-input-sm"
                              onWheel={(e) => e.target.blur()} />
                          </td>
                          <td>
                            <input type="number" min="0" step="0.01" value={item.sellingPrice}
                              onChange={(e) => updateItem(idx, 'sellingPrice', e.target.value)}
                              className="price-input-sm"
                              onWheel={(e) => e.target.blur()} />
                          </td>
                          <td className="gst-label">
                            <div>{resolveGstRate(item.gst, defaultGstRate)}%</div>
                          </td>
                          {/* <td style={{ fontWeight: 600, fontSize: '13px' }}><CurrencyDisplay value={calcItemTotal(item)} /></td> */}
                          <td>
                            <button className="btn btn-sm btn-outline-info"
                              onClick={async () => {
                                setLoadingSubstitutes(true);
                                try {
                                  const qty = Number(item.quantity) || 1;
                                  const { data } = await medicineService.getSubstituteSuggestions(item.medicineId, qty);
                                  if (data.data && data.data.suggestions && data.data.suggestions.length > 0) {
                                    setSubstituteModal({ originalItem: item, suggestions: data.data.suggestions, index: idx });
                                  } else {
                                    showError('No substitute suggestions found for this medicine');
                                  }
                                } catch (err) {
                                  showError('Failed to fetch substitute suggestions');
                                } finally {
                                  setLoadingSubstitutes(false);
                                }
                              }}
                              disabled={loadingSubstitutes}
                              title="Find substitutes"
                              style={{ padding: '4px 6px', fontSize: '11px' }}>
                              <i className="fa-solid fa-exchange-alt"></i>
                            </button>
                          </td>
                          <td>
                            <button className="btn btn-danger btn-sm" onClick={() => removeItem(idx)} style={{ padding: '4px 8px' }}>
                              <i className="fa-solid fa-times"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right - Cart Summary */}
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
                      <span className="cart-item-name">{item.medicineName}</span>
                      <span className="cart-item-quantity"> × {item.quantity}</span>
                    </div>
                    <span className="cart-item-total"><CurrencyDisplay value={calcItemTotal(item)} /></span>
                  </div>
                ))}
              </div>

              <hr style={{ margin: '6px 0', borderColor: 'var(--gray-200)' }} />

              <div className="invoice-amount-compact">
                <div className="summary-row">
                  <span className="summary-label">Subtotal:</span><span className="summary-value"><CurrencyDisplay value={calcSubtotal()} cardMode={false} forceDecimals /></span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Discount:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div className="inline-discount">
                      <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} onWheel={(e) => e.target.blur()} />
                      <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                        <option value="fixed">{getCurrentSymbol()}</option>
                        <option value="percentage">%</option>
                      </select>
                    </div>
                    <span className="summary-value" style={{ color: '#dc2626', fontWeight: 600, fontSize: '12px' }}>
                      -<CurrencyDisplay value={Number(calcDiscount()) || 0} cardMode={false} forceDecimals />
                    </span>
                  </div>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Taxable Amount:</span><span className="summary-value"><CurrencyDisplay value={gstCalc.taxableAmount} cardMode={false} forceDecimals /></span>
                </div>
                {gstCalc.isIntraState ? (
                  <>
                    <div className="summary-row">
                      <span className="summary-label">CGST ({gstCalc.totalGst > 0 ? (gstCalc.cgst > 0 ? (gstCalc.totalGst / (gstCalc.taxableAmount || 1) * 100 / 2).toFixed(1) : '0') : '0'}%):</span>
                      <span className="summary-value"><CurrencyDisplay value={gstCalc.cgst} cardMode={false} forceDecimals /></span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-label">SGST ({gstCalc.totalGst > 0 ? (gstCalc.sgst > 0 ? (gstCalc.totalGst / (gstCalc.taxableAmount || 1) * 100 / 2).toFixed(1) : '0') : '0'}%):</span>
                      <span className="summary-value"><CurrencyDisplay value={gstCalc.sgst} cardMode={false} forceDecimals /></span>
                    </div>
                  </>
                ) : (
                  <div className="summary-row">
                    <span className="summary-label">IGST ({gstCalc.totalGst > 0 ? (gstCalc.igst > 0 ? (gstCalc.totalGst / (gstCalc.taxableAmount || 1) * 100).toFixed(1) : '0') : '0'}%):</span>
                    <span className="summary-value"><CurrencyDisplay value={gstCalc.igst} cardMode={false} forceDecimals /></span>
                  </div>
                )}

                {/* Current Bill Total - RED (before round off) */}
                <div className="summary-row" style={{ fontWeight: 700, color: '#dc2626' }}>
                  <span className="summary-label">Current Bill:</span>
                  <span className="summary-value" style={{ color: '#dc2626' }}><CurrencyDisplay value={currentBillTotal} cardMode={false} forceDecimals /></span>
                </div>
              </div>

              {/* Round Off Options - Selectable Cards */}
              {items.length > 0 && roundOffOptions.length > 0 && (
                <div className="round-off-section">
                  <div className="round-off-header">
                    <span><i className="fa-solid fa-circle-dollar"></i> Round Off</span>
                    {roundOffDiff !== 0 && (
                      <span className={`round-off-badge ${roundOffDiff < 0 ? 'down' : 'up'}`}>
                        {roundOffDiff > 0 ? '+' : ''}{roundOffDiff.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="round-off-cards" style={{
                    display: 'flex',
                    flexWrap: 'nowrap',
                    gap: '4px',
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                  }}>
                    <style>{`.round-off-cards::-webkit-scrollbar { display: none; }`}</style>
                    {roundOffOptions.map((opt, idx) => {
                      const isSelected = selectedRoundOffIndex === idx;
                      const diff = opt.diff;
                      const diffClass = diff === 0 ? 'exact' : (diff > 0 ? 'up' : 'down');
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={`round-off-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedRoundOffIndex(idx);
                            setRoundOffDiff(diff);
                          }}
                          title={opt.label}
                          style={{
                            flex: '0 0 auto',
                            minWidth: '64px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '1px',
                            padding: '6px 5px',
                            border: `1.5px solid ${isSelected ? (diff > 0 ? 'var(--success)' : 'var(--danger)') : 'var(--gray-200)'}`,
                            borderRadius: '6px',
                            background: isSelected ? (diff > 0 ? '#f0fdf4' : '#fef2f2') : '#fff',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          <span className="round-off-value" style={{ fontSize: '12px', fontWeight: 700 }}>
                            {getCurrentSymbol()}{Number.isInteger(opt.value) ? opt.value : opt.value.toFixed(2)}
                          </span>
                          <span className={`round-off-diff ${diffClass}`} style={{ fontSize: '9px', fontWeight: 600 }}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Previous Due Row - only shown when included */}
              {calcPreviousDue() > 0 && (
                <div className="summary-row" style={{ color: '#c2410c', fontWeight: 600 }}>
                  <span className="summary-label"><i className="fa-solid fa-exclamation-triangle"></i> Previous Due:</span>
                  <span className="summary-value">+ <CurrencyDisplay value={calcPreviousDue()} /></span>
                </div>
              )}

              <hr style={{ margin: '6px 0', borderColor: 'var(--gray-200)' }} />

              <div className="grand-total-row" style={{ marginBottom: '10px' }}>
                <span>Final Grand Total:</span><span><CurrencyDisplay value={gt} cardMode={false} forceDecimals /></span>
              </div>

              {/* Previous Due - separate note */}
              {calcPreviousDue() > 0 && (
                <div style={{ fontSize: '11px', color: '#9a3412', marginBottom: '8px', padding: '4px 8px', background: '#fff7ed', borderRadius: '4px', textAlign: 'center' }}>
                  <i className="fa-solid fa-info-circle"></i> Previous due of <CurrencyDisplay value={calcPreviousDue()} /> added to invoice
                </div>
              )}

              <div className="form-group">
                <label>Payment Method</label>
                <div style={{
                  display: 'flex',
                  flexWrap: 'nowrap',
                  gap: '6px',
                  overflowX: 'auto',
                  paddingBottom: '4px',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'thin',
                }}>
                  {PAYMENT_METHODS.map(method => {
                    const isSelected = paymentMethod === method.value;
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => setPaymentMethod(method.value)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '3px',
                          flex: '1 0 auto',
                          minWidth: '0',
                          padding: '8px 6px',
                          border: `1.5px solid ${isSelected ? '#0ea5e9' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          background: isSelected ? 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)' : '#f8fafc',
                          color: isSelected ? '#0369a1' : '#64748b',
                          cursor: 'pointer',
                          fontSize: '10px',
                          fontWeight: isSelected ? 700 : 500,
                          transition: 'all 0.2s ease',
                          boxShadow: isSelected ? '0 2px 8px rgba(14, 165, 233, 0.25)' : 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <i className={method.icon} style={{ fontSize: '15px', color: isSelected ? method.iconColor : method.iconColor }}></i>
                        <span>{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label>Paid Amount</label>
                <input type="number" value={paidAmount} placeholder="Enter paid amount" onChange={(e) => {
                  const val = Number(e.target.value);
                  const finalTotal = calcGrandTotal();
                  if (val > finalTotal) {
                    showError(`Paid amount (${getCurrentSymbol()} ${val.toFixed(2)}) cannot exceed Final Grand Total (${getCurrentSymbol()} ${finalTotal.toFixed(2)})`);
                    return;
                  }
                  setPaidAmount(e.target.value);
                }}
                  className="form-select" style={{ width: '100%' }}
                  onWheel={(e) => e.target.blur()} />
              </div>

              {Number(paidAmount) > 0 && (
                <div className={`due-row ${Number(paidAmount) >= calcGrandTotal() ? 'positive' : 'negative'}`} style={{ padding: '8px 0' }}>
                  <span>Change/Due:</span><span className="due-value"><CurrencyDisplay value={Math.abs(gt - Number(paidAmount))} /></span>
                </div>
              )}

              <button
                className="btn btn-success btn-block"
                onClick={handleSubmit}
                disabled={submitting || items.length === 0}
                style={{ marginTop: '12px', padding: '10px', fontSize: '15px', fontWeight: 700 }}
              >
                {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
                {submitting ? ' Processing...' : ` ${getCurrentSymbol()} ${gt.toFixed(2)} • ${isEditing ? 'Update Sale' : 'Complete Sale'}`}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Substitute Suggestions Modal */}
      {substituteModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 5000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }} onClick={() => setSubstituteModal(null)}>
          <div className="substitute-modal" style={{
            background: '#fff', borderRadius: '12px', maxWidth: '600px',
            width: '100%', maxHeight: '80vh', overflow: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <div className="substitute-modal-header" style={{
              padding: '16px 20px', borderBottom: '1px solid var(--gray-200)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h5 style={{ margin: 0 }}>
                <i className="fa-solid fa-exchange-alt" style={{ color: 'var(--info)' }}></i>
                {' '}Substitute Suggestions
              </h5>
              <button className="btn btn-sm btn-light" onClick={() => setSubstituteModal(null)}
                style={{ border: 'none', fontSize: '18px', cursor: 'pointer' }}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="substitute-modal-body" style={{ padding: '16px 20px' }}>
              <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
                <strong>Original:</strong> {substituteModal.originalItem.medicineName}
                {' '}× {substituteModal.originalItem.quantity}
                <span style={{ marginLeft: '8px', color: 'var(--danger)' }}>
                  (Stock: {substituteModal.originalItem.currentStock})
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
                Select a substitute medicine below. It will replace the original item in the bill.
              </p>
              <div className="suggestion-list">
                {substituteModal.suggestions.map((suggestion, si) => (
                  <div key={suggestion._id} className="suggestion-item" style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px', marginBottom: '8px',
                    border: '1px solid var(--gray-200)', borderRadius: '8px',
                    background: '#fafafa',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{suggestion.medicineName}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>
                        {suggestion.genericName && <span>{suggestion.genericName} | </span>}
                        {suggestion.brand?.name && <span>{suggestion.brand.name} | </span>}
                        {suggestion.category?.name && <span>{suggestion.category.name}</span>}
                      </div>
                      <div style={{ fontSize: '12px', marginTop: '2px' }}>
                        <span style={{ color: 'var(--success)', fontWeight: 500 }}>
                          Stock: {suggestion.currentStock} {suggestion.unit}
                        </span>
                        {' | '}
                        <span style={{ fontWeight: 500 }}><CurrencyDisplay value={suggestion.sellingPrice} /></span>
                        {suggestion.gst > 0 && <span> (GST: {suggestion.gst}%)</span>}
                      </div>
                    </div>
                    <button className="btn btn-sm btn-primary" onClick={() => {
                      // Replace the original item with the substitute
                      const newItems = [...items];
                      newItems[substituteModal.index] = {
                        medicineId: suggestion._id,
                        medicineName: suggestion.medicineName,
                        batchNumber: suggestion.batchNumber || '',
                        quantity: Number(substituteModal.originalItem.quantity),
                        sellingPrice: suggestion.sellingPrice || 0,
                        purchasePrice: suggestion.purchasePrice || 0,
                        gst: suggestion.gst || 0,
                        discount: 0,
                        discountType: 'fixed',
                        currentStock: suggestion.currentStock || 0,
                      };
                      setItems(newItems);
                      setSubstituteModal(null);
                    }} style={{ whiteSpace: 'nowrap', marginLeft: '12px' }}>
                      <i className="fa-solid fa-check"></i> Use This
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="substitute-modal-footer" style={{
              padding: '12px 20px', borderTop: '1px solid var(--gray-200)',
              display: 'flex', justifyContent: 'flex-end', gap: '8px',
            }}>
              <button className="btn btn-secondary" onClick={() => setSubstituteModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}