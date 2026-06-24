import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { createSale, updateSale, fetchSale, clearSelectedSale } from '../../redux/slices/saleSlice';
import { fetchMedicines } from '../../redux/slices/medicineSlice';
import { showSuccess, showError, confirmAction } from '../../utils/sweetAlert';
import { customerService } from '../../services/customerService';

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
  const [customerDueInfo, setCustomerDueInfo] = useState(null);
  const [includePreviousDue, setIncludePreviousDue] = useState(false);
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('percentage');
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Customer search states
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerVerified, setCustomerVerified] = useState(false);

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
      }
    } catch (error) {
      console.error('Customer search error:', error);
    } finally {
      setCustomerSearchLoading(false);
    }
  }, []);

  const debounceTimer = useRef(null);

  const handleCustomerSearch = (value) => {
    // Only update the search query, NOT the customer name
    setCustomerSearchQuery(value);

    // Clear customer selection when manually typing
    setCustomerRef(null);
    setCustomerDueInfo(null);
    setIncludePreviousDue(false);
    setCustomerVerified(false);

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
    setCustomerVerified(true);

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
    return () => {
      dispatch(clearSelectedSale());
    };
  }, [dispatch, id, isEditing]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const results = medicines?.filter(m =>
        (m.medicineName?.toLowerCase().includes(q) || m.barcode?.includes(q) || m.genericName?.toLowerCase().includes(q)) &&
        m.currentStock > 0
      ) || [];
      setSearchResults(results.slice(0, 10));
      setShowDropdown(true);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [searchQuery, medicines]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (customerContainerRef.current && !customerContainerRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
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

  const handleScanBarcode = async () => {
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(t => t.stop());
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('pos-scanner');
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 5, qrbox: { width: 200, height: 100 } },
        async (decodedText) => {
          await scanner.stop();
          scanner.clear();
          setScanning(false);
          const med = medicines?.find(m => m.barcode === decodedText && m.currentStock > 0);
          if (med) {
            addItem(med);
          } else {
            showError('Medicine not found for this barcode');
          }
        },
        () => { }
      );
    } catch (err) {
      setScanning(false);
      showError('Scanner failed. Please search manually.');
    }
  };

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
    const gstAmt = (sub - disc) * (Number(item.gst) / 100);
    return sub - disc + gstAmt;
  };
  const calcSubtotal = () => items.reduce((sum, i) => sum + calcItemSubtotal(i), 0);
  const calcTax = () => items.reduce((sum, i) => {
    const sub = calcItemSubtotal(i);
    const disc = calcItemDiscount(i);
    return sum + (sub - disc) * (Number(i.gst) / 100);
  }, 0);
  const calcDiscount = () => discountType === 'percentage' ? calcSubtotal() * (Number(discount) / 100) : Number(discount);

  // Current bill total (without previous due) - this is what gets sent to backend
  const calcCurrentBillTotal = () => calcSubtotal() + calcTax() - calcDiscount();

  // Previous due amount (if included)
  const calcPreviousDue = () => (includePreviousDue && customerDueInfo ? customerDueInfo.totalDue : 0);

  // Final Grand Total displayed in UI (includes previous due if toggled)
  const calcGrandTotal = () => calcCurrentBillTotal() + calcPreviousDue();

  const calcNetDue = () => Math.max(0, calcGrandTotal() - Number(paidAmount || 0));

  // Load sale data when editing
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
      setDiscount(selectedSale.discount || 0);
      setDiscountType(selectedSale.discountType || 'percentage');
      setPaidAmount(selectedSale.paidAmount || 0);
      setPaymentMethod(selectedSale.paymentMethod || 'cash');
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
    const currentBillGrandTotal = calcCurrentBillTotal();
    const finalGrandTotal = calcGrandTotal();
    const paid = Number(paidAmount) || 0;

    // Show confirmation before completing the sale
    const dueAfterPayment = Math.max(0, finalGrandTotal - paid);
    const confirmed = await confirmAction(
      `${isEditing ? 'Update' : 'Complete'} Sale`,
      `Customer: ${customerName}\nItems: ${items.length}\nTotal: ₹${currentBillGrandTotal.toFixed(2)}\nPrevious Due: ₹${calcPreviousDue().toFixed(2)}\nFinal Grand Total: ₹${finalGrandTotal.toFixed(2)}\nPaid: ₹${paid.toFixed(2)}\nDue: ₹${dueAfterPayment.toFixed(2)}\nMethod: ${paymentMethod}`,
      `Yes, ${isEditing ? 'Update' : 'Complete'}`
    );
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    try {
      // If customerRef exists, use the customer with customerId
      let finalCustomerId = '';
      let finalCustomerName = customerName;
      let finalCustomerPhone = customerPhone;

      if (customerRef && customerRef._id) {
        finalCustomerId = customerRef._id;
      } else if (customerName) {
        // Create customer record - let backend generate placeholder if no phone
        try {
          const { data } = await customerService.createCustomer({
            name: customerName,
            phone: customerPhone || '',
          });
          if (data.data && data.data._id) {
            finalCustomerId = data.data._id;
            // If customer already existed, use the existing data
            if (data.message === 'Customer already exists') {
              finalCustomerId = data.data._id;
            }
          }
        } catch (err) {
          // Silently continue - customer creation is a bonus feature
          console.error('Could not create customer record:', err);
        }
      }

      // Compute FIFO payment allocation if previous due is included
      // FIFO: Always pay the oldest unpaid invoice first before paying the new invoice
      let previousDuePayments = [];
      let paidForNewInvoice = paid;

      if (includePreviousDue && customerDueInfo && customerDueInfo.invoices && customerDueInfo.invoices.length > 0) {
        // Sort old invoices by oldest saleDate first (FIFO)
        const sortedInvoices = [...customerDueInfo.invoices].sort(
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
        showError(`Total paid (₹${paid.toFixed(2)}) minus previous due allocation (₹${previousDuePayments.reduce((s,p)=>s+p.amount,0).toFixed(2)}) = ₹${paidForNewInvoice.toFixed(2)} exceeds the current bill total (₹${currentBillGrandTotal.toFixed(2)})`);
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
        // Send the total amount paid by the customer
        paidAmount: paid,
        paymentMethod,
        notes: includePreviousDue && customerDueInfo ? `Previous due of ₹${customerDueInfo.totalDue.toFixed(2)} included` : '',
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
                  {showDropdown && searchResults.length > 0 && (
                    <div className="search-dropdown">
                      {searchResults.map(med => (
                        <div key={med._id} onClick={() => addItem(med)}
                          className="search-dropdown-item">
                          <div>
                            <div className="item-name">{med.medicineName}</div>
                            <div className="item-details">{med.genericName} | {med.barcode}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="item-price">₹{med.sellingPrice}</div>
                            <div className={`item-stock ${med.currentStock <= 10 ? 'low' : ''}`}>Stock: {med.currentStock}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {showDropdown && searchQuery.trim() && searchResults.length === 0 && (
                    <div className="search-dropdown">
                      <div className="search-dropdown-empty">No medicines found</div>
                    </div>
                  )}
                </div>
                <button type="button" className="btn btn-info" onClick={handleScanBarcode} disabled={scanning} style={{ height: '46px', whiteSpace: 'nowrap' }}>
                  {scanning ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-camera"></i>} Scan
                </button>
              </div>
              {scanning && <div id="pos-scanner" style={{ width: '100%', maxWidth: '300px', marginTop: '8px' }}></div>}
            </div>
          </div>

          <div className="card customer-card-no-clip">
            <div className="card-header">
              <h5>Customer</h5>
            </div>
            <div className="card-body" ref={customerContainerRef}>
              <div className="customer-grid">
                <div className="form-group customer-search-wrapper">
                  <input
                    type="text"
                    placeholder="Search customer by name or phone..."
                    value={customerSearchQuery}
                    onChange={(e) => handleCustomerSearch(e.target.value)}
                    className="form-select"
                    style={{ width: '100%' }}
                    ref={customerSearchRef}
                    autoComplete="off"
                  />
                  {showCustomerDropdown && customerSearchResults.length > 0 && (
                    <div className="customer-dropdown">
                      {customerSearchResults.map(c => (
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
                      ))}
                    </div>
                  )}
                  {showCustomerDropdown && customerSearchQuery.trim() && customerSearchResults.length === 0 && !customerSearchLoading && (
                    <div className="customer-dropdown" style={{ textAlign: 'center', padding: '14px', color: '#888', fontSize: '13px' }}>
                      No customer found. A new customer will be created on billing.
                    </div>
                  )}
                  {customerSearchLoading && (
                    <div className="customer-dropdown" style={{ textAlign: 'center', padding: '14px', color: '#888', fontSize: '13px' }}>
                      <i className="fa-solid fa-spinner fa-spin"></i> Searching...
                    </div>
                  )}
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
                  {customerRef && customerName && !customerVerified && (
                    <div style={{
                      marginTop: '4px',
                      fontSize: '11px',
                      color: 'var(--primary)',
                      fontWeight: 500,
                    }}>
                      <i className="fa-solid fa-check-circle"></i> Existing customer selected
                    </div>
                  )}
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <input type="text" placeholder="Phone (optional)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                    className="form-select" style={{ width: '100%' }} />
                </div>
              </div>
              {/* Show customer name input separately only when no customer is selected from dropdown */}
              {!customerRef && (
                <div className="form-group" style={{ marginTop: '8px' }}>
                  <input
                    type="text"
                    placeholder="Enter customer name (will be created as new customer)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="form-select"
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Due Notice Card - Only shown when customer is explicitly verified */}
          {customerVerified && customerDueInfo && (
            <div className="card" style={{
              marginTop: '16px',
              borderLeft: '4px solid #f97316',
              background: '#fff7ed',
            }}>
              <div className="card-body" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#9a3412' }}>
                      <i className="fa-solid fa-exclamation-triangle"></i> Outstanding Due
                    </div>
                    <div style={{ fontSize: '12px', color: '#c2410c', marginTop: '2px' }}>
                      {customerDueInfo.invoiceCount} invoice(s) - Total Due: <strong>₹{customerDueInfo.totalDue.toFixed(2)}</strong>
                    </div>
                  </div>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '6px 10px',
                    background: includePreviousDue ? '#dc2626' : '#16a34a',
                    color: '#fff',
                    borderRadius: '6px',
                    userSelect: 'none',
                  }}>
                    <input
                      type="checkbox"
                      checked={includePreviousDue}
                      onChange={(e) => setIncludePreviousDue(e.target.checked)}
                      style={{ accentColor: '#fff' }}
                    />
                    {includePreviousDue ? 'Due Included (+₹' + customerDueInfo.totalDue.toFixed(2) + ')' : 'Add to Bill'}
                  </label>
                </div>
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
                        <th style={{ width: '60px' }}>Disc</th>
                        <th style={{ width: '90px' }}>Total</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: '13px' }}>{item.medicineName}</div>
                            <div className="gst-label">Stock: {item.currentStock}</div>
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
                            {item.gst > 0 && <div>GST: {item.gst}%</div>}
                          </td>
                          <td style={{ fontWeight: 600, fontSize: '13px' }}>₹{calcItemTotal(item).toFixed(2)}</td>
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
              <div style={{ marginBottom: '12px' }}>
                {items.map((item, idx) => (
                  <div key={idx} className="cart-item-row">
                    <div>
                      <span className="cart-item-name">{item.medicineName}</span>
                      <span className="cart-item-quantity"> × {item.quantity}</span>
                    </div>
                    <span className="cart-item-total">₹{calcItemTotal(item).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <hr style={{ margin: '12px 0', borderColor: 'var(--gray-200)' }} />

              <div className="summary-row">
                <span className="summary-label">Subtotal:</span><span className="summary-value">₹{calcSubtotal().toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Tax (GST):</span><span className="summary-value">₹{calcTax().toFixed(2)}</span>
              </div>
              <div className="summary-row" style={{ alignItems: 'center' }}>
                <span className="summary-label">Discount:</span>
                <div className="inline-discount">
                  <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} onWheel={(e) => e.target.blur()} />
                  <select value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                    <option value="fixed">₹</option>
                    <option value="percentage">%</option>
                  </select>
                </div>
              </div>

              {/* Current Bill Total */}
              <div className="summary-row" style={{ fontWeight: 500 }}>
                <span className="summary-label">Current Bill:</span>
                <span className="summary-value">₹{currentBillTotal.toFixed(2)}</span>
              </div>

              {/* Previous Due Row - only shown when included */}
              {calcPreviousDue() > 0 && (
                <div className="summary-row" style={{ color: '#c2410c', fontWeight: 600 }}>
                  <span className="summary-label"><i className="fa-solid fa-exclamation-triangle"></i> Previous Due:</span>
                  <span className="summary-value">+ ₹{calcPreviousDue().toFixed(2)}</span>
                </div>
              )}

              <hr style={{ margin: '12px 0', borderColor: 'var(--gray-200)' }} />

              <div className="grand-total-row" style={{ marginBottom: '16px' }}>
                <span>Final Grand Total:</span><span>₹{gt.toFixed(2)}</span>
              </div>

              {/* Previous Due - separate note */}
              {calcPreviousDue() > 0 && (
                <div style={{ fontSize: '11px', color: '#9a3412', marginBottom: '8px', padding: '4px 8px', background: '#fff7ed', borderRadius: '4px', textAlign: 'center' }}>
                  <i className="fa-solid fa-info-circle"></i> Previous due of ₹{calcPreviousDue().toFixed(2)} added to invoice
                </div>
              )}

              <div className="form-group">
                <label>Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                  className="form-select" style={{ width: '100%' }}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit">Credit</option>
                </select>
              </div>

              <div className="form-group">
                <label>Paid Amount</label>
                <input type="number" value={paidAmount} onChange={(e) => {
                  const val = Number(e.target.value);
                  const finalTotal = calcGrandTotal();
                  if (val > finalTotal) {
                    showError(`Paid amount (₹${val.toFixed(2)}) cannot exceed Final Grand Total (₹${finalTotal.toFixed(2)})`);
                    return;
                  }
                  setPaidAmount(e.target.value);
                }}
                  className="form-select" style={{ width: '100%' }}
                  onWheel={(e) => e.target.blur()} />
              </div>

              {Number(paidAmount) > 0 && (
                <div className={`due-row ${Number(paidAmount) >= calcGrandTotal() ? 'positive' : 'negative'}`} style={{ padding: '8px 0' }}>
                  <span>Change/Due:</span><span className="due-value">₹{Math.abs(gt - Number(paidAmount)).toFixed(2)}</span>
                </div>
              )}

              <button
                className="btn btn-success btn-block"
                onClick={handleSubmit}
                disabled={submitting || items.length === 0}
                style={{ marginTop: '16px', padding: '14px', fontSize: '16px', fontWeight: 700 }}
              >
                {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
                {submitting ? ' Processing...' : ` ₹${gt.toFixed(2)} • ${isEditing ? 'Update Sale' : 'Complete Sale'}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}