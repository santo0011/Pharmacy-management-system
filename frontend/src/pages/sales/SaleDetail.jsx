import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchSale, clearSelectedSale, returnSale } from '../../redux/slices/saleSlice';
import CurrencyDisplay from '../../components/common/CurrencyDisplay';
import { getCurrentSymbol } from '../../utils/currency';
import { showSuccess, showError, confirmAction } from '../../utils/sweetAlert';
import { saleService } from '../../services/saleService';

export default function SaleDetail() {
  const dispatch = useDispatch();
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedSale: sale, loading } = useSelector((state) => state.sales);
  const [editHistory, setEditHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [showPayments, setShowPayments] = useState(false);

  useEffect(() => {
    dispatch(fetchSale(id));
    fetchEditHistory();
    fetchPaymentHistory();
    return () => dispatch(clearSelectedSale());
  }, [dispatch, id]);

  const fetchEditHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await saleService.getSaleEditHistory(id);
      if (data.data) {
        setEditHistory(data.data);
      }
    } catch (error) {
      console.error('Failed to load edit history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    setPaymentsLoading(true);
    try {
      const { data } = await saleService.getSalePayments(id);
      if (data.data) {
        setPaymentHistory(data.data);
      }
    } catch (error) {
      console.error('Failed to load payment history');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/sales/${id}/edit`);
  };

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

  // Determine if a field is monetary (should show currency symbol)
  const isMonetaryField = (field) => {
    const monetaryFields = [
      'subtotal', 'taxAmount', 'discountAmount', 'discount', 'grandTotal',
      'paidAmount', 'dueAmount', 'sellingPrice', 'price', 'total',
      'amount', 'previousDue', 'remainingDue', 'roundOff',
    ];
    const fieldLower = (field || '').toLowerCase();
    return monetaryFields.some(mf => fieldLower.includes(mf));
  };

  const InfoRow = ({ label, value }) => (
    <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
      <div style={{ width: '160px', fontWeight: 500, color: 'var(--gray-600)' }}>{label}</div>
      <div>{value || '-'}</div>
    </div>
  );

  // === Recompute GST-first from stored item data (matching Invoice/Edit page) ===
  // GST is calculated FIRST on the full subtotal, then discount is applied
  // AFTER GST on the GST-inclusive total. Uses only stored transaction item
  // values (quantity, price, gst) and the stored grand total — never the
  // current Product Master price. This keeps Sales Details consistent with
  // the Invoice/Edit page, Print Invoice, and Returns.
  const itemRows = (sale.items || []).map(item => {
    const base = Number(item.subtotal) > 0
      ? Number(item.subtotal)
      : Number(item.quantity) * Number(item.sellingPrice);
    const gstPct = Number(item.gst) || 0;
    const gstAmt = Number((base * (gstPct / 100)).toFixed(2));
    return { item, base, gstPct, gstAmt, gstInclusive: Number((base + gstAmt).toFixed(2)) };
  });
  const displaySubtotal = itemRows.reduce((s, it) => s + it.base, 0);
  const displayTotalGst = itemRows.reduce((s, it) => s + it.gstAmt, 0);
  const displayGstInclusive = Number((displaySubtotal + displayTotalGst).toFixed(2));
  // Total Discount = GST Inclusive Total − Grand Total (includes any round-off)
  const displayTotalDiscount = Math.max(0, Number((displayGstInclusive - Number(sale.grandTotal || 0)).toFixed(2)));
  const displayCgst = Number((displayTotalGst / 2).toFixed(2));
  const displaySgst = Number((displayTotalGst - displayCgst).toFixed(2));

  // Dynamic percentage labels (same as Invoice page) — computed from actual values
  const pctBaseAmount = displaySubtotal > 0 ? displaySubtotal : 1;
  const displayTotalDiscountPct = Math.round((displayTotalDiscount / pctBaseAmount) * 10000) / 100;
  const displayCgstPct = Math.round((displayCgst / pctBaseAmount) * 10000) / 100;
  const displaySgstPct = Math.round((displaySgst / pctBaseAmount) * 10000) / 100;
  const displayTotalGstPct = Math.round((displayTotalGst / pctBaseAmount) * 10000) / 100;

  // Allocate Total Discount proportionally to each item based on its
  // GST-inclusive value. The sum of allocations equals Total Discount exactly.
  const totalGstInclusiveAlloc = itemRows.reduce((s, it) => s + it.gstInclusive, 0);
  let runningDiscountAlloc = 0;
  const itemDiscountValues = itemRows.map((it, idx) => {
    if (idx === itemRows.length - 1 && itemRows.length > 0) {
      return Math.max(0, Number((displayTotalDiscount - runningDiscountAlloc).toFixed(2)));
    }
    const alloc = Number((totalGstInclusiveAlloc > 0 ? (it.gstInclusive / totalGstInclusiveAlloc) * displayTotalDiscount : 0).toFixed(2));
    runningDiscountAlloc += alloc;
    return alloc;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Sale: {sale.invoiceNumber}</h2>
          <p>{sale.customerName}</p>
        </div>
        <div className="btn-group-grid">
          <button className="btn btn-success" onClick={() => navigate(`/sales/${id}/invoice`)}>
            <i className="fa-solid fa-print"></i> Invoice
          </button>
          {sale.status === 'completed' && (
            <button className="btn btn-warning" onClick={handleEdit}>
              <i className="fa-solid fa-edit"></i> Edit
            </button>
          )}
          {sale.status === 'completed' && (
            <button className="btn btn-danger" onClick={() => navigate(`/sales/${id}/return`)}>
              <i className="fa-solid fa-undo"></i> Return Items
            </button>
          )}
          {/* {(sale.status === 'completed' || sale.status === 'cancelled') && (
            <button className="btn btn-info" onClick={handleReturn}>
              <i className="fa-solid fa-undo"></i> {sale.status === 'cancelled' ? 'Re-stock & Close' : 'Full Return'}
            </button>
          )} */}
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
          <InfoRow label="Payment Method" value={
            <span className={`badge ${sale.paymentMethod === 'cash' ? 'badge-success' : sale.paymentMethod === 'card' ? 'badge-info' : sale.paymentMethod === 'upi' ? 'badge-primary' : 'badge-warning'}`}>
              {sale.paymentMethod ? sale.paymentMethod.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Cash'}
            </span>
          } />
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
                      <td><CurrencyDisplay value={item.sellingPrice} /></td>
                      <td>{item.gst}%</td>
                      <td>
                        <CurrencyDisplay value={itemDiscountValues[idx] || 0} />
                      </td>
                      <td style={{ fontWeight: 600 }}><CurrencyDisplay value={item.total} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><h5>Payment Summary</h5></div>
        <div className="card-body">
          <div style={{ maxWidth: '400px' }}>
            <InfoRow label="Subtotal" value={<CurrencyDisplay value={displaySubtotal} />} />
            <InfoRow label={`Total Discount (${displayTotalDiscountPct}%):`} value={
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                − <CurrencyDisplay value={displayTotalDiscount} />
              </span>
            } />
            {sale.isIntraState !== false ? (
              <>
                <InfoRow label={`CGST (${displayCgstPct}%):`} value={<CurrencyDisplay value={displayCgst} />} />
                <InfoRow label={`SGST (${displaySgstPct}%):`} value={<CurrencyDisplay value={displaySgst} />} />
              </>
            ) : (
              <InfoRow label={`IGST (${displayTotalGstPct}%):`} value={<CurrencyDisplay value={displayTotalGst} />} />
            )}
            <InfoRow label={`Total GST (${displayTotalGstPct}%):`} value={<CurrencyDisplay value={displayTotalGst} />} />
            <div style={{ display: 'flex', padding: '12px 0', borderTop: '2px solid var(--gray-200)', fontWeight: 700, fontSize: '16px', color: 'var(--primary-color)' }}>
              <div style={{ width: '160px' }}>Grand Total</div>
              <div><CurrencyDisplay value={sale.grandTotal} /></div>
            </div>
            {/* Previous Due Payment Allocation Summary */}
            {Number(sale.previousDueAmount || 0) > 0 && (
              <div style={{ marginTop: '8px', padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '12px' }}>
                <div style={{ fontWeight: 700, marginBottom: '6px', color: '#166534' }}>
                  <i className="fa-solid fa-circle-dollar"></i> Payment Allocation
                </div>
                <InfoRow label="Previous Due" value={<CurrencyDisplay value={sale.previousDueAmount} />} />
                <InfoRow label="Previous Due Paid" value={<span style={{ color: '#16a34a', fontWeight: 600 }}><CurrencyDisplay value={sale.previousDuePaid} /></span>} />
                {Number(sale.previousDueRemaining) > 0 && (
                  <InfoRow label="Previous Due Remaining" value={<span style={{ color: sale.previousDueRemaining > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}><CurrencyDisplay value={sale.previousDueRemaining} /></span>} />
                )}
                <InfoRow label="Current Invoice Paid" value={<CurrencyDisplay value={sale.currentInvoicePaid} />} />
                <InfoRow label="Current Invoice Due" value={<span style={{ color: sale.currentInvoiceDue > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}><CurrencyDisplay value={sale.currentInvoiceDue} /></span>} />
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #bbf7d0', marginTop: '4px', paddingTop: '6px', fontWeight: 700 }}>
                  <span>Total Customer Due</span>
                  <span style={{ color: '#dc2626' }}><CurrencyDisplay value={Number(sale.currentInvoiceDue || 0) + Number(sale.previousDueRemaining || 0)} /></span>
                </div>
              </div>
            )}
            <InfoRow label="Paid" value={<CurrencyDisplay value={sale.paidAmount} />} />
            <InfoRow label="Due" value={<span style={{ color: sale.dueAmount > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}><CurrencyDisplay value={sale.dueAmount} /></span>} />
            {sale.notes && <InfoRow label="Notes" value={sale.notes} />}
          </div>
        </div>
      </div>

      {/* Bill Payment History Section */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h5>
            <i className="fa-solid fa-credit-card"></i> Bill Payment History
            {paymentHistory.length > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 400, marginLeft: '8px' }}>
                ({paymentHistory.length} payment(s))
              </span>
            )}
          </h5>
          {paymentHistory.length > 0 && (
            <button className="btn btn-sm btn-secondary" onClick={() => setShowPayments(!showPayments)}>
              {showPayments ? 'Hide' : 'Show'} Payments
            </button>
          )}
        </div>
        {showPayments && (
          <div className="card-body" style={{ padding: 0 }}>
            {paymentsLoading ? (
              <div className="loading-spinner" style={{ padding: '30px' }}>
                <i className="fa-solid fa-spinner fa-spin"></i>
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px' }}>
                <i className="fa-solid fa-check-circle" style={{ fontSize: '36px', color: '#22c55e' }}></i>
                <h4>No Payment History</h4>
                <p>No payments have been recorded for this invoice.</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date & Time</th>
                      <th>Amount</th>
                      <th>Remaining Due</th>
                      <th>Payment Method</th>
                      <th>Collected By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.map((payment, idx) => (
                      <tr key={payment._id}>
                        <td>{idx + 1}</td>
                        <td>{new Date(payment.paymentDate || payment.createdAt).toLocaleString()}</td>
                        <td style={{ fontWeight: 600, color: '#16a34a' }}><CurrencyDisplay value={payment.amount} /></td>
                        <td style={{ fontWeight: 600, color: Number(payment.remainingDue) > 0 ? '#dc2626' : '#16a34a' }}>
                          <CurrencyDisplay value={payment.remainingDue} />
                        </td>
                        <td>
                          <span className={`badge ${payment.paymentMethod === 'cash' ? 'badge-success' : payment.paymentMethod === 'card' ? 'badge-info' : payment.paymentMethod === 'upi' ? 'badge-primary' : 'badge-warning'}`}>
                            {payment.paymentMethod ? payment.paymentMethod.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Cash'}
                          </span>
                        </td>
                        <td>{payment.createdBy?.name || 'Unknown'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {paymentHistory.length === 0 && (
          <div className="card-body" style={{ padding: '16px', textAlign: 'center', color: 'var(--gray-500)' }}>
            <i className="fa-solid fa-info-circle"></i> No payment history available for this invoice.
          </div>
        )}
      </div>

      {/* Edit History Section */}
      <div className="card">
        <div className="card-header">
          <h5>
            <i className="fa-solid fa-clock-rotate-left"></i> Edit History / Audit Log
            {editHistory.length > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 400, marginLeft: '8px' }}>
                ({editHistory.length} edit(s))
              </span>
            )}
          </h5>
          {editHistory.length > 0 && (
            <button className="btn btn-sm btn-secondary" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? 'Hide' : 'Show'} History
            </button>
          )}
        </div>
        {showHistory && (
          <div className="card-body">
            {historyLoading ? (
              <div className="loading-spinner" style={{ padding: '30px' }}>
                <i className="fa-solid fa-spinner fa-spin"></i>
              </div>
            ) : editHistory.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px' }}>
                <i className="fa-solid fa-check-circle" style={{ fontSize: '36px', color: '#22c55e' }}></i>
                <h4>No Edit History</h4>
                <p>This sale has not been edited yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {editHistory.map((entry, historyIdx) => (
                  <div
                    key={entry._id}
                    className="card"
                    style={{
                      margin: 0,
                      border: '1px solid var(--gray-200)',
                      borderLeft: '4px solid var(--primary)',
                    }}
                  >
                    <div className="card-body" style={{ padding: '16px' }}>
                      {/* Edit Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '14px' }}>Edit #{editHistory.length - historyIdx}</span>
                          <span style={{ fontSize: '12px', color: '#888', marginLeft: '10px' }}>
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="badge badge-info" style={{ fontSize: '11px' }}>
                            by {entry.editedByName || 'Unknown'}
                          </span>
                        </div>
                      </div>

                      {entry.reason && (
                        <div style={{ marginBottom: '10px', padding: '8px 12px', background: '#f0f9ff', borderRadius: '6px', fontSize: '13px' }}>
                          <strong>Reason:</strong> {entry.reason}
                        </div>
                      )}

                      {/* Changes List */}
                      {entry.changes && entry.changes.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', color: '#888', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>
                            Changes Made
                          </div>
                          <div className="table-container">
                            <table style={{ fontSize: '13px' }}>
                              <thead>
                                <tr>
                                  <th>Field</th>
                                  <th>Before</th>
                                  <th>After</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.changes.map((change, changeIdx) => (
                                  <tr key={changeIdx}>
                                    <td style={{ fontWeight: 500 }}>{change.label || change.field}</td>
                                    <td style={{ color: change.changeType === 'added' ? '#16a34a' : '#dc2626' }}>
                                      {change.previousValue !== null && change.previousValue !== undefined
                                        ? (isMonetaryField(change.field) ? `${getCurrentSymbol()} ${Number(change.previousValue).toFixed(2)}` : String(change.previousValue))
                                        : <span style={{ color: '#888', fontStyle: 'italic' }}>none</span>
                                      }
                                    </td>
                                    <td style={{ color: change.changeType === 'removed' ? '#dc2626' : '#16a34a' }}>
                                      {change.newValue !== null && change.newValue !== undefined
                                        ? (isMonetaryField(change.field) ? `${getCurrentSymbol()} ${Number(change.newValue).toFixed(2)}` : String(change.newValue))
                                        : <span style={{ color: '#888', fontStyle: 'italic' }}>removed</span>
                                      }
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {(!entry.changes || entry.changes.length === 0) && (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
                          No detailed change tracking for this edit.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}