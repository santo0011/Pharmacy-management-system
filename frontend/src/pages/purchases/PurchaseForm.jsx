import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { createPurchase, updatePurchase, fetchPurchase, clearSelectedPurchase } from '../../redux/slices/purchaseSlice';
import { fetchSuppliers } from '../../redux/slices/supplierSlice';
import { fetchMedicines } from '../../redux/slices/medicineSlice';
import { showSuccess, showError } from '../../utils/sweetAlert';

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
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([{ medicineId: '', medicineName: '', batchNumber: '', quantity: 1, purchasePrice: 0, sellingPrice: 0, mrp: 0, expiryDate: '', gst: 0, barcode: '' }]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('percentage');
  const [shippingCost, setShippingCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef(null);

  const selectedSupplier = suppliers?.find(s => s._id === supplier);

  useEffect(() => {
    dispatch(fetchSuppliers({ limit: 200 }));
    dispatch(fetchMedicines({ limit: 200 }));
    if (isEditing && id) dispatch(fetchPurchase(id));
    return () => { dispatch(clearSelectedPurchase()); };
  }, [dispatch, id, isEditing]);

  useEffect(() => {
    if (isEditing && selectedPurchase) {
      const p = selectedPurchase.purchase || selectedPurchase;
      setSupplier(p.supplier?._id || '');
      setSupplierName(p.supplierName || '');
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
    }
  }, [selectedPurchase, isEditing]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    };
    if (showSearchDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showSearchDropdown]);

  const filteredMedicines = medicines?.filter(m =>
    m.medicineName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.barcode?.includes(searchTerm) ||
    m.genericName?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const calcSubtotal = () => items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.purchasePrice)), 0);
  const calcTax = () => items.reduce((sum, item) => {
    const sub = Number(item.quantity) * Number(item.purchasePrice);
    return sum + sub * (Number(item.gst) / 100);
  }, 0);
  const calcDiscount = () => discountType === 'percentage' ? calcSubtotal() * (Number(discount) / 100) : Number(discount);
  const calcGrandTotal = () => calcSubtotal() + calcTax() + Number(shippingCost) + Number(otherCost) - calcDiscount();

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplier && !supplierName) { showError('Please select a supplier'); return; }
    if (items.length === 0) { showError('Add at least one item'); return; }

    setSubmitting(true);
    try {
      const data = {
        purchaseDate,
        supplier: supplier || null,
        supplierName,
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
        paidAmount: Number(paidAmount) || calcGrandTotal(),
        paymentMethod,
        notes,
      };

      if (isEditing) {
        await dispatch(updatePurchase({ id, formData: data })).unwrap();
        showSuccess('Purchase updated');
      } else {
        await dispatch(createPurchase(data)).unwrap();
        showSuccess('Purchase created');
      }
      navigate('/purchases');
    } catch (error) {
      showError(error || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const gt = calcGrandTotal();
  const due = Math.max(0, gt - Number(paidAmount));

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{isEditing ? 'Edit Purchase' : 'New Purchase'}</h2>
          <p>{isEditing ? 'Update purchase order' : 'Create a new purchase order'}</p>
        </div>
      </div>

      <div className="sale-layout">
        {/* Left - Product Selection */}
        <div>
          <div className="card search-card-no-clip" style={{ marginBottom: '16px' }}>
            <div className="card-header">
              <h5><i className="fa-solid fa-truck"></i> Purchase Details</h5>
            </div>
            <div className="card-body">
              <div className="purchase-form-grid">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Supplier *</label>
                  <select value={supplier} onChange={(e) => { setSupplier(e.target.value); if (e.target.value) setSupplierName(''); }} className="form-select" style={{ width: '100%' }}>
                    <option value="">Select Supplier</option>
                    {suppliers?.map(s => (
                      <option key={s._id} value={s._id}>
                        {s.supplierName} {s.companyName ? `(${s.companyName})` : ''}
                      </option>
                    ))}
                  </select>
                  <input type="text" placeholder="Or type new supplier name" value={supplierName} onChange={(e) => { setSupplierName(e.target.value); if (e.target.value) setSupplier(''); }} className="input-sm" style={{ marginTop: '4px', width: '100%' }} />
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

              {selectedSupplier && (
                <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f0f5ff', borderRadius: '8px', border: '1px solid #bfdbfe', display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '13px' }}>
                  <div><span style={{ color: 'var(--gray-500)' }}>Total Purchases:</span> <strong>{selectedSupplier.totalPurchases || 0}</strong></div>
                  <div><span style={{ color: 'var(--gray-500)' }}>Total Spent:</span> <strong>₹{(selectedSupplier.totalSpent || 0).toFixed(2)}</strong></div>
                  <div><span style={{ color: 'var(--gray-500)' }}>Total Paid:</span> <strong style={{ color: 'var(--success)' }}>₹{(selectedSupplier.totalPaid || 0).toFixed(2)}</strong></div>
                  <div><span style={{ color: 'var(--gray-500)' }}>Outstanding Due:</span> <strong style={{ color: (selectedSupplier.totalDue || 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>₹{(selectedSupplier.totalDue || 0).toFixed(2)}</strong></div>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header">
              <h5><i className="fa-solid fa-cart-plus"></i> Items</h5>
            </div>
            <div className="card-body">
              <div className="search-box-wrapper" ref={searchContainerRef}>
                <div className="search-input-wrap">
                  <input
                    type="text"
                    placeholder="🔍 Search medicine by name or barcode..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setShowSearchDropdown(true); }}
                  />
                  {showSearchDropdown && searchTerm && (
                    <div className="search-dropdown">
                      {filteredMedicines.slice(0, 10).map(med => (
                        <div key={med._id} onClick={() => { addItem(); selectMedicine(items.length, med); }}
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
                      {filteredMedicines.length === 0 && <div className="search-dropdown-empty">No medicines found</div>}
                    </div>
                  )}
                </div>
                <button type="button" className="btn btn-secondary" onClick={addItem} style={{ height: '46px', whiteSpace: 'nowrap' }}>
                  <i className="fa-solid fa-plus"></i> Add Item
                </button>
              </div>

              <div className="table-container" style={{ marginTop: '12px' }}>
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
                        <td><input type="number" min="0" max="100" value={item.gst} onChange={(e) => handleItemChange(index, 'gst', e.target.value)} className="input-sm" style={{ width: '50px' }} /></td>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap', fontSize: '13px' }}>₹{(Number(item.quantity) * Number(item.purchasePrice)).toFixed(2)}</td>
                        <td>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(index)} disabled={items.length === 1} style={{ padding: '4px 8px' }}>
                            <i className="fa-solid fa-times"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

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
                    <span className="cart-item-total">₹{(Number(item.quantity) * Number(item.purchasePrice)).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <hr style={{ margin: '6px 0', borderColor: 'var(--gray-200)' }} />

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
                    <option value="percentage">%</option>
                    <option value="fixed">₹</option>
                  </select>
                </div>
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
                <span>Grand Total:</span><span>₹{gt.toFixed(2)}</span>
              </div>

              <div className="form-group">
                <label>Paid Amount</label>
                <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="form-select" style={{ width: '100%' }} onWheel={(e) => e.target.blur()} />
              </div>

              <div className={`due-row ${Number(paidAmount) >= gt ? 'positive' : 'negative'}`} style={{ padding: '8px 0' }}>
                <span>Due Amount:</span><span className="due-value">₹{due.toFixed(2)}</span>
              </div>

              <button
                type="submit"
                className="btn btn-success btn-block"
                onClick={handleSubmit}
                disabled={submitting || items.length === 0}
                style={{ marginTop: '12px', padding: '10px', fontSize: '15px', fontWeight: 700 }}
              >
                {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
                {submitting ? ' Processing...' : ` ₹${gt.toFixed(2)} • ${isEditing ? 'Update Purchase' : 'Create Purchase'}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}