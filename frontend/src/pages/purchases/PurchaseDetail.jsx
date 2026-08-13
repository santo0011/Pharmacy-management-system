import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPurchase, clearSelectedPurchase, addPurchasePayment, fetchPurchasePayments } from '../../redux/slices/purchaseSlice';
import { fetchSuppliers } from '../../redux/slices/supplierSlice';
import CurrencyDisplay from '../../components/common/CurrencyDisplay';
import { getCurrentSymbol } from '../../utils/currency';
import { showSuccess, showError, confirmAction } from '../../utils/sweetAlert';

export default function PurchaseDetail() {
  const dispatch = useDispatch();
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedPurchase: purchase, payments, loading } = useSelector((state) => state.purchases);
  const { items: suppliers } = useSelector((state) => state.suppliers);

  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [showPayments, setShowPayments] = useState(true);

  useEffect(() => {
    dispatch(fetchPurchase(id));
    dispatch(fetchSuppliers({ limit: 200 }));
    return () => dispatch(clearSelectedPurchase());
  }, [dispatch, id]);

  const openPaymentDrawer = () => {
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setShowPaymentDrawer(true);
  };

  const closePaymentDrawer = () => setShowPaymentDrawer(false);

  const handleAddPayment = async (e) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) { showError('Enter a valid payment amount'); return; }
    if (amount > (purchase?.dueAmount || 0)) { showError(`Amount cannot exceed due amount of ${getCurrentSymbol()} ${purchase?.dueAmount?.toFixed(2)}`); return; }

    const confirmed = await confirmAction(
      'Record Payment',
      `Pay ${getCurrentSymbol()} ${amount.toFixed(2)} to ${purchase?.supplierName || purchase?.supplier?.supplierName}?`,
      'Yes, Record'
    );
    if (!confirmed) return;

    setSubmittingPayment(true);
    try {
      await dispatch(addPurchasePayment({
        id: purchase._id,
        paymentData: { amount, paymentMethod, paymentDate, notes: paymentNotes },
      })).unwrap();
      showSuccess('Payment recorded successfully');
      dispatch(fetchPurchasePayments(id));
      closePaymentDrawer();
      setPaymentAmount('');
      setPaymentNotes('');
    } catch (error) {
      showError(error || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading || !purchase) {
    return <div className="loading-spinner" style={{ marginTop: '40px' }}><i className="fa-solid fa-spinner fa-spin"></i></div>;
  }

  const InfoRow = ({ label, value }) => (
    <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
      <div style={{ width: '160px', fontWeight: 500, color: 'var(--gray-600)' }}>{label}</div>
      <div>{value || '-'}</div>
    </div>
  );

  const paymentStatusBadge = {
    paid: <span className="badge badge-success">Paid</span>,
    partial: <span className="badge badge-warning">Partial</span>,
    unpaid: <span className="badge badge-danger">Unpaid</span>,
  };

  const statusBadge = (status) => {
    const map = { completed: 'badge-success', pending: 'badge-warning', cancelled: 'badge-danger', returned: 'badge-info' };
    return <span className={`badge ${map[status] || 'badge-info'}`}>{status}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Purchase: {purchase.invoiceNumber}</h2>
          <p>{purchase.supplierName || purchase.supplier?.supplierName}</p>
        </div>
        <div className="btn-group-grid">
          <button className="btn btn-success" onClick={openPaymentDrawer} disabled={purchase.dueAmount <= 0 || purchase.status === 'cancelled' || purchase.status === 'returned'}>
            <i className="fa-solid fa-money-bill"></i> Pay Now
          </button>
          <button className="btn btn-warning" onClick={() => navigate(`/purchases/${id}/edit`)} disabled={purchase.status === 'cancelled' || purchase.status === 'returned'}>
            <i className="fa-solid fa-edit"></i> Edit
          </button>
          <button className="btn btn-danger" onClick={() => navigate(`/purchases/${id}/return`)} disabled={purchase.status === 'cancelled' || purchase.status === 'returned'}>
            <i className="fa-solid fa-undo"></i> Return
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/purchases')}>
            <i className="fa-solid fa-arrow-left"></i> Back
          </button>
        </div>
      </div>

      {/* Purchase Information */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><h5>Purchase Information</h5></div>
        <div className="card-body">
          <InfoRow label="Invoice Number" value={purchase.invoiceNumber} />
          <InfoRow label="Supplier" value={purchase.supplier?.supplierName || purchase.supplierName} />
          <InfoRow label="Company" value={purchase.supplier?.companyName} />
          <InfoRow label="Phone" value={purchase.supplier?.phone} />
          <InfoRow label="Supplier State" value={purchase.supplier?.state || purchase.supplierStateCode || '-'} />
          <InfoRow label="GST Number" value={purchase.supplier?.gstNumber} />
          <InfoRow label="Purchase Date" value={new Date(purchase.purchaseDate).toLocaleDateString()} />
          <InfoRow label="Status" value={statusBadge(purchase.status)} />
          <InfoRow label="Payment" value={paymentStatusBadge[purchase.paymentStatus]} />
          <InfoRow label="Payment Method" value={purchase.paymentMethod} />
          {purchase.invoiceAttachment && (
            <InfoRow
              label="Invoice Attachment"
              value={
                <a
                  href={purchase.invoiceAttachment}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-outline-info"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  <i className="fa-solid fa-eye"></i> View Invoice
                </a>
              }
            />
          )}
          {purchase.notes && <InfoRow label="Notes" value={purchase.notes} />}
        </div>
      </div>

      {/* Invoice Attachment Preview */}
      {purchase.invoiceAttachment && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <h5><i className="fa-solid fa-file-invoice"></i> Purchase Invoice Preview</h5>
            <a
              href={purchase.invoiceAttachment}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-outline-info"
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              <i className="fa-solid fa-external-link"></i> Open Full
            </a>
          </div>
          <div className="card-body" style={{ padding: 0, background: '#f1f5f9' }}>
            {purchase.invoiceAttachment.endsWith('.pdf') ? (
              <iframe
                src={purchase.invoiceAttachment}
                title="Purchase Invoice Preview"
                style={{ width: '100%', height: '500px', border: 'none', background: '#fff' }}
              />
            ) : (
              <img
                src={purchase.invoiceAttachment}
                alt="Purchase Invoice Preview"
                style={{ width: '100%', maxHeight: '500px', objectFit: 'contain', background: '#fff' }}
              />
            )}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><h5>Items</h5></div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Purchase Price</th><th>Selling Price</th><th>MRP</th><th>Expiry</th><th>GST</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                {purchase.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{item.medicineName}</td>
                    <td>{item.batchNumber}</td>
                    <td>{item.quantity}</td>
                    <td><CurrencyDisplay value={item.purchasePrice} /></td>
                    <td><CurrencyDisplay value={item.sellingPrice} /></td>
                    <td>{item.mrp ? <CurrencyDisplay value={item.mrp} /> : '-'}</td>
                    <td>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '-'}</td>
                    <td>{item.gst}%</td>
                    <td style={{ fontWeight: 600 }}><CurrencyDisplay value={Number(item.quantity) * Number(item.purchasePrice)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><h5>Payment Summary</h5></div>
        <div className="card-body">
          <div style={{ maxWidth: '400px' }}>
            <InfoRow label="Subtotal" value={<CurrencyDisplay value={purchase.subtotal} />} />
            <InfoRow label="Taxable Amount" value={<CurrencyDisplay value={purchase.taxableAmount} />} />
            <InfoRow label="Discount" value={<CurrencyDisplay value={purchase.discountAmount} />} />
            {purchase.isIntraState ? (
              <>
                <InfoRow label="CGST" value={<CurrencyDisplay value={purchase.cgstAmount} />} />
                <InfoRow label="SGST" value={<CurrencyDisplay value={purchase.sgstAmount} />} />
              </>
            ) : (
              <InfoRow label="IGST" value={<CurrencyDisplay value={purchase.igstAmount} />} />
            )}
            <InfoRow label="Total GST" value={<CurrencyDisplay value={purchase.taxAmount} />} />
            <InfoRow label="Shipping" value={<CurrencyDisplay value={purchase.shippingCost} />} />
            <InfoRow label="Other Cost" value={<CurrencyDisplay value={purchase.otherCost} />} />
            <div style={{ display: 'flex', padding: '12px 0', borderTop: '2px solid var(--gray-200)', fontWeight: 700, fontSize: '16px', color: 'var(--primary)' }}>
              <div style={{ width: '160px' }}>Grand Total</div>
              <div><CurrencyDisplay value={purchase.grandTotal} /></div>
            </div>
            <InfoRow label="Paid" value={<CurrencyDisplay value={purchase.paidAmount} />} />
            <InfoRow label="Due" value={<span style={{ color: purchase.dueAmount > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}><CurrencyDisplay value={purchase.dueAmount} /></span>} />
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h5>
            <i className="fa-solid fa-credit-card"></i> Payment History
            {payments?.length > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 400, marginLeft: '8px' }}>
                ({payments.length} payment(s))
              </span>
            )}
          </h5>
          <div style={{ display: 'flex', gap: '8px' }}>
            {purchase.dueAmount > 0 && purchase.status !== 'cancelled' && purchase.status !== 'returned' && (
              <button className="btn btn-success btn-sm" onClick={openPaymentDrawer}>
                <i className="fa-solid fa-plus"></i> Add Payment
              </button>
            )}
            {payments?.length > 0 && (
              <button className="btn btn-sm btn-secondary" onClick={() => setShowPayments(!showPayments)}>
                {showPayments ? 'Hide' : 'Show'}
              </button>
            )}
          </div>
        </div>
        {showPayments && (
          <div className="card-body" style={{ padding: payments?.length > 0 ? 0 : '20px' }}>
            {payments?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Notes</th>
                      <th>Recorded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, idx) => (
                      <tr key={p._id || idx}>
                        <td>{idx + 1}</td>
                        <td style={{ fontSize: '13px' }}>{new Date(p.paymentDate).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600, color: 'var(--success)' }}><CurrencyDisplay value={p.amount} /></td>
                        <td>
                          <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{p.paymentMethod || 'cash'}</span>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--gray-500)' }}>{p.notes || '-'}</td>
                        <td style={{ fontSize: '13px' }}>{p.createdBy?.name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--gray-500)' }}>
                <i className="fa-solid fa-info-circle"></i> No payments recorded yet.
              </div>
            )}
          </div>
        )}
        {payments?.length === 0 && (
          <div className="card-body" style={{ padding: '16px', textAlign: 'center', color: 'var(--gray-500)' }}>
            <i className="fa-solid fa-info-circle"></i> No payment history available for this invoice.
          </div>
        )}
      </div>

      {/* Record Payment Drawer */}
      <div className={`drawer-overlay ${showPaymentDrawer ? 'open' : ''}`} onClick={closePaymentDrawer}></div>
      <div className={`drawer ${showPaymentDrawer ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3><i className="fa-solid fa-money-bill"></i> Record Payment</h3>
          <button className="close-btn" onClick={closePaymentDrawer}>
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
        <form onSubmit={handleAddPayment} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="drawer-body">
            {/* Invoice Summary Card */}
            <div style={{ marginBottom: '20px', padding: '14px 16px', background: '#f0f5ff', borderRadius: 'var(--radius)', border: '1px solid #bfdbfe' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Supplier</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-800)' }}>{purchase.supplierName || purchase.supplier?.supplierName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Invoice</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-800)' }}>{purchase.invoiceNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--gray-600)' }}>Outstanding Due</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--danger)' }}><CurrencyDisplay value={purchase.dueAmount} /></span>
              </div>
            </div>

            <div className="form-group">
              <label>Payment Amount *</label>
              <input type="number" step="0.01" min="0" max={purchase.dueAmount} value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="form-select" style={{ width: '100%' }}
                placeholder={`Max: ${getCurrentSymbol()} ${purchase.dueAmount?.toFixed(2)}`} required />
            </div>
            <div className="form-group">
              <label>Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                className="form-select" style={{ width: '100%' }}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="credit">Credit</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Payment Date</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                className="form-select" style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)}
                className="form-select" style={{ width: '100%', minHeight: '60px', resize: 'vertical' }} rows={2} />
            </div>
          </div>
          <div className="drawer-footer">
            <button type="button" className="btn btn-secondary" onClick={closePaymentDrawer}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={submittingPayment}>
              {submittingPayment ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
              {submittingPayment ? ' Recording...' : ' Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}