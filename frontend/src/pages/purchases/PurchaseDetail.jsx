import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPurchase, clearSelectedPurchase } from '../../redux/slices/purchaseSlice';

export default function PurchaseDetail() {
  const dispatch = useDispatch();
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedPurchase: purchase, loading } = useSelector((state) => state.purchases);

  useEffect(() => {
    dispatch(fetchPurchase(id));
    return () => dispatch(clearSelectedPurchase());
  }, [dispatch, id]);

  if (loading || !purchase) {
    return <div className="loading-spinner" style={{ marginTop: '40px' }}><i className="fa-solid fa-spinner fa-spin"></i></div>;
  }

  const InfoRow = ({ label, value }) => (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value || '-'}</span>
    </div>
  );

  const SummaryRow = ({ label, value, isTotal = false }) => (
    <div className={`summary-row ${isTotal ? 'summary-total' : ''}`}>
      <span className="summary-label">{label}</span>
      <span className="summary-amount">{value}</span>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Purchase: {purchase.invoiceNumber}</h2>
          <p>{purchase.supplierName || purchase.supplier?.supplierName}</p>
        </div>
        <div className="btn-group-grid">
          <button className="btn btn-warning" onClick={() => navigate(`/purchases/${id}/edit`)} disabled={purchase.status === 'cancelled' || purchase.status === 'returned'}>
            <i className="fa-solid fa-edit"></i> Edit
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/purchases')}>
            <i className="fa-solid fa-arrow-left"></i> Back
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><h5>Purchase Information</h5></div>
        <div className="card-body detail-card-body">
          <div className="detail-grid">
            <InfoRow label="Invoice Number" value={purchase.invoiceNumber} />
            <InfoRow label="Supplier" value={purchase.supplier?.supplierName || purchase.supplierName} />
            <InfoRow label="Purchase Date" value={new Date(purchase.purchaseDate).toLocaleDateString()} />
            <InfoRow label="Status" value={<span className={`badge ${purchase.status === 'completed' ? 'badge-success' : purchase.status === 'pending' ? 'badge-warning' : purchase.status === 'cancelled' ? 'badge-danger' : 'badge-info'}`}>{purchase.status}</span>} />
            <InfoRow label="Payment" value={<span className={`badge ${purchase.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>{purchase.paymentStatus}</span>} />
            <InfoRow label="Payment Method" value={purchase.paymentMethod} />
            {purchase.notes && <InfoRow label="Notes" value={purchase.notes} />}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><h5>Items</h5></div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Purchase Price</th><th>Selling Price</th><th>Expiry</th><th>GST</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                {purchase.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{item.medicineName}</td>
                    <td>{item.batchNumber}</td>
                    <td>{item.quantity}</td>
                    <td>₹{item.purchasePrice?.toFixed(2)}</td>
                    <td>₹{item.sellingPrice?.toFixed(2)}</td>
                    <td>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '-'}</td>
                    <td>{item.gst}%</td>
                    <td style={{ fontWeight: 600 }}>₹{item.subtotal?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><h5>Payment Summary</h5></div>
        <div className="card-body detail-card-body">
          <div className="summary-grid">
            <SummaryRow label="Subtotal" value={`₹${purchase.subtotal?.toFixed(2)}`} />
            <SummaryRow label="Tax (GST)" value={`₹${purchase.taxAmount?.toFixed(2)}`} />
            <SummaryRow label="Discount" value={`₹${purchase.discountAmount?.toFixed(2)}`} />
            <SummaryRow label="Shipping" value={`₹${purchase.shippingCost?.toFixed(2)}`} />
            <SummaryRow label="Other" value={`₹${purchase.otherCost?.toFixed(2)}`} />
            <SummaryRow label="Grand Total" value={`₹${purchase.grandTotal?.toFixed(2)}`} isTotal />
            <SummaryRow label="Paid Amount" value={`₹${purchase.paidAmount?.toFixed(2)}`} />
            <SummaryRow label="Due Amount" value={<span style={{ color: purchase.dueAmount > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>₹{purchase.dueAmount?.toFixed(2)}</span>} />
          </div>
        </div>
      </div>
    </div>
  );
}