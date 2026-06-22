import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchSale, clearSelectedSale, returnSale } from '../../redux/slices/saleSlice';
import { showSuccess, showError, confirmAction } from '../../utils/sweetAlert';

export default function SaleDetail() {
  const dispatch = useDispatch();
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedSale: sale, loading } = useSelector((state) => state.sales);

  useEffect(() => {
    dispatch(fetchSale(id));
    return () => dispatch(clearSelectedSale());
  }, [dispatch, id]);

  const handleReturn = async () => {
    const confirmed = await confirmAction('Return Sale', 'Stock will be added back. Continue?');
    if (!confirmed) return;
    try {
      await dispatch(returnSale(id)).unwrap();
      showSuccess('Sale returned successfully');
    } catch (error) {
      showError(error || 'Return failed');
    }
  };

  if (loading || !sale) {
    return <div className="loading-spinner" style={{ marginTop: '40px' }}><i className="fa-solid fa-spinner fa-spin"></i></div>;
  }

  const InfoRow = ({ label, value }) => (
    <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
      <div style={{ width: '160px', fontWeight: 500, color: 'var(--gray-600)' }}>{label}</div>
      <div>{value || '-'}</div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Sale: {sale.invoiceNumber}</h2>
          <p>{sale.customerName}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-success" onClick={() => navigate(`/sales/${id}/invoice`)}>
            <i className="fa-solid fa-print"></i> Invoice
          </button>
          {sale.status === 'completed' && (
            <button className="btn btn-info" onClick={handleReturn}>
              <i className="fa-solid fa-undo"></i> Return
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => navigate('/sales')}>
            <i className="fa-solid fa-arrow-left"></i> Back
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><h5>Sale Information</h5></div>
        <div className="card-body">
          <InfoRow label="Invoice Number" value={sale.invoiceNumber} />
          <InfoRow label="Customer" value={sale.customerName} />
          <InfoRow label="Phone" value={sale.customerPhone} />
          <InfoRow label="Date" value={new Date(sale.saleDate).toLocaleString()} />
          <InfoRow label="Status" value={<span className={`badge ${sale.status === 'completed' ? 'badge-success' : 'badge-info'}`}>{sale.status}</span>} />
          <InfoRow label="Payment" value={<span className={`badge ${sale.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>{sale.paymentStatus}</span>} />
          <InfoRow label="Payment Method" value={sale.paymentMethod} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><h5>Items</h5></div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Medicine</th><th>Qty</th><th>Price</th><th>GST</th><th>Discount</th><th>Total</th></tr>
              </thead>
              <tbody>
                {sale.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{item.medicineName}</td>
                    <td>{item.quantity}</td>
                    <td>₹{item.sellingPrice?.toFixed(2)}</td>
                    <td>{item.gst}%</td>
                    <td>₹{item.discountAmount?.toFixed(2)}</td>
                    <td style={{ fontWeight: 600 }}>₹{item.total?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h5>Payment Summary</h5></div>
        <div className="card-body">
          <div style={{ maxWidth: '400px' }}>
            <InfoRow label="Subtotal" value={`₹${sale.subtotal?.toFixed(2)}`} />
            <InfoRow label="Tax (GST)" value={`₹${sale.taxAmount?.toFixed(2)}`} />
            <InfoRow label="Discount" value={`₹${sale.discountAmount?.toFixed(2)}`} />
            <div style={{ display: 'flex', padding: '12px 0', borderTop: '2px solid var(--gray-200)', fontWeight: 700, fontSize: '16px', color: 'var(--primary-color)' }}>
              <div style={{ width: '160px' }}>Grand Total</div>
              <div>₹{sale.grandTotal?.toFixed(2)}</div>
            </div>
            <InfoRow label="Paid" value={`₹${sale.paidAmount?.toFixed(2)}`} />
            <InfoRow label="Due" value={<span style={{ color: sale.dueAmount > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>₹{sale.dueAmount?.toFixed(2)}</span>} />
            {sale.notes && <InfoRow label="Notes" value={sale.notes} />}
          </div>
        </div>
      </div>
    </div>
  );
}