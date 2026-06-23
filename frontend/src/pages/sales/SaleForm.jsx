import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { createSale, updateSale, fetchSale, clearSelectedSale } from '../../redux/slices/saleSlice';
import { fetchMedicines } from '../../redux/slices/medicineSlice';
import { showSuccess, showError } from '../../utils/sweetAlert';
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
    setCustomerSearchQuery(value);
    setCustomerName(value);
    // Clear customer ref if name is manually changed
    setCustomerRef(null);

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
  const calcGrandTotal = () => calcSubtotal() + calcTax() - calcDiscount();

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

    setSubmitting(true);
    try {
      // If customerRef exists, use the customer with customerId
      let finalCustomerId = '';
      let finalCustomerName = customerName;
      let finalCustomerPhone = customerPhone;

      if (customerRef && customerRef._id) {
        finalCustomerId = customerRef._id;
      } else if (customerName && customerPhone) {
        // Try to find/create customer
        try {
          const { data } = await customerService.createCustomer({
            name: customerName,
            phone: customerPhone,
          });
          if (data.data && data.data._id) {
            finalCustomerId = data.data._id;
          }
        } catch (err) {
          // Silently continue - customer creation is a bonus feature
          console.error('Could not create customer record:', err);
        }
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
        paidAmount: Number(paidAmount) || calcGrandTotal(),
        paymentMethod,
      };

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
                  {customerRef && (
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
            </div>
          </div>

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

              <hr style={{ margin: '12px 0', borderColor: 'var(--gray-200)' }} />

              <div className="grand-total-row" style={{ marginBottom: '16px' }}>
                <span>Grand Total:</span><span>₹{gt.toFixed(2)}</span>
              </div>

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
                  if (val > gt) {
                    showError(`Paid amount (₹${val.toFixed(2)}) cannot exceed Grand Total (₹${gt.toFixed(2)})`);
                    return;
                  }
                  setPaidAmount(e.target.value);
                }}
                  className="form-select" style={{ width: '100%' }}
                  onWheel={(e) => e.target.blur()} />
              </div>

              {Number(paidAmount) > 0 && (
                <div className={`due-row ${Number(paidAmount) >= gt ? 'positive' : 'negative'}`} style={{ padding: '8px 0' }}>
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