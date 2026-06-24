import { useState, useEffect } from 'react';
import Drawer from './Drawer';
import { customerService } from '../../services/customerService';
import { showSuccess, showError, confirmAction } from '../../utils/sweetAlert';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: 'fa-solid fa-money-bill-wave' },
  { value: 'card', label: 'Card', icon: 'fa-solid fa-credit-card' },
  { value: 'upi', label: 'UPI', icon: 'fa-solid fa-mobile-screen' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: 'fa-solid fa-building-columns' },
  { value: 'other', label: 'Other', icon: 'fa-solid fa-ellipsis' },
];

export default function PaymentDrawer({ isOpen, onClose, customer, onPaymentComplete }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [payments, setPayments] = useState({});
  const [paymentMethods, setPaymentMethods] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && customer) {
      fetchDueInvoices();
    }
  }, [isOpen, customer]);

  const fetchDueInvoices = async () => {
    setLoading(true);
    try {
      // Use the MongoDB _id (customerRef) for exact matching - never use name
      const customerId = customer.customerRef || customer._id || customer.customerPhone || '';
      const { data: res } = await customerService.getCustomerDueInvoices(customerId);
      if (res.data) {
        setData(res.data);
        // Initialize payment amounts and methods
        const initPayments = {};
        const initMethods = {};
        res.data.invoices.forEach(inv => {
          initPayments[inv._id] = '';
          initMethods[inv._id] = 'cash';
        });
        setPayments(initPayments);
        setPaymentMethods(initMethods);
      }
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to load due invoices');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (invoiceId) => {
    const amount = Number(payments[invoiceId]);
    if (!amount || amount <= 0) {
      showError('Enter a valid payment amount');
      return;
    }

    // Find invoice for confirmation details
    const invoice = data?.invoices?.find(inv => inv._id === invoiceId);
    const method = paymentMethods[invoiceId] || 'cash';
    const methodLabel = PAYMENT_METHODS.find(m => m.value === method)?.label || method;

    // Show confirmation before processing payment
    const confirmed = await confirmAction(
      'Confirm Payment',
      `Invoice: ${invoice?.invoiceNumber || ''}\nAmount: ₹${Number(amount).toFixed(2)}\nPayment Method: ${methodLabel}`,
      'Yes, Collect Payment'
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      await customerService.payDue({
        saleId: invoiceId,
        amount,
        paymentMethod: method,
      });
      showSuccess('Payment received successfully');
      // Refresh data
      await fetchDueInvoices();
      if (onPaymentComplete) onPaymentComplete();
    } catch (error) {
      showError(error.response?.data?.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayFull = async (invoice) => {
    setPayments(prev => ({ ...prev, [invoice._id]: invoice.dueAmount }));

    const method = paymentMethods[invoice._id] || 'cash';
    const methodLabel = PAYMENT_METHODS.find(m => m.value === method)?.label || method;

    // Show confirmation before processing full payment
    const confirmed = await confirmAction(
      'Confirm Full Payment',
      `Invoice: ${invoice.invoiceNumber}\nAmount: ₹${Number(invoice.dueAmount).toFixed(2)}\nPayment Method: ${methodLabel}`,
      'Yes, Pay Full Amount'
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      await customerService.payDue({
        saleId: invoice._id,
        amount: invoice.dueAmount,
        paymentMethod: method,
      });
      showSuccess('Payment received successfully');
      await fetchDueInvoices();
      if (onPaymentComplete) onPaymentComplete();
    } catch (error) {
      showError(error.response?.data?.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const totalOutstandingDue = data?.customer?.totalDue || 0;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Collect Payment"
    >
      {loading ? (
        <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
      ) : data ? (
        <div>
          {/* Customer Info */}
          <div className="card" style={{ marginBottom: '16px', borderLeft: '4px solid var(--primary)' }}>
            <div className="card-body" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h5 style={{ margin: '0 0 4px 0' }}>{data.customer.name}</h5>
                  <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>
                    <i className="fa-solid fa-phone"></i> {data.customer.phone}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Total Outstanding</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>
                    ₹{totalOutstandingDue.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Invoices */}
          <h5 style={{ marginBottom: '12px' }}>
            <i className="fa-solid fa-file-invoice"></i> Due Invoices
            <span style={{ fontSize: '12px', color: '#888', fontWeight: 400, marginLeft: '8px' }}>
              ({data.invoices.length} invoice(s))
            </span>
          </h5>

          {data.invoices.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px' }}>
              <i className="fa-solid fa-check-circle" style={{ fontSize: '36px', color: '#22c55e' }}></i>
              <h4>No Due Invoices</h4>
              <p>All invoices for this customer are paid.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {data.invoices.map((invoice) => (
                <div
                  key={invoice._id}
                  className="card"
                  style={{
                    margin: 0,
                    border: '1px solid var(--gray-200)',
                    borderLeft: '3px solid #f97316',
                  }}
                >
                  <div className="card-body" style={{ padding: '14px' }}>
                    {/* Invoice Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{invoice.invoiceNumber}</span>
                        <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
                          {new Date(invoice.saleDate).toLocaleDateString()}
                        </span>
                      </div>
                      <span className={`badge ${invoice.paymentStatus === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                        {invoice.paymentStatus}
                      </span>
                    </div>

                    {/* Invoice Details Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: '8px',
                      fontSize: '13px',
                      marginBottom: '12px',
                      padding: '8px',
                      background: '#f9fafb',
                      borderRadius: '6px',
                    }}>
                      <div>
                        <div style={{ color: '#888', fontSize: '11px' }}>Invoice Amount</div>
                        <div style={{ fontWeight: 600 }}>₹{Number(invoice.grandTotal).toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ color: '#888', fontSize: '11px' }}>Paid Amount</div>
                        <div style={{ fontWeight: 600, color: '#16a34a' }}>₹{Number(invoice.paidAmount).toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ color: '#888', fontSize: '11px' }}>Remaining Due</div>
                        <div style={{ fontWeight: 700, color: '#dc2626' }}>₹{Number(invoice.dueAmount).toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Payment History */}
                    {invoice.payments && invoice.payments.length > 0 && (
                      <div style={{ marginBottom: '10px', padding: '8px', background: '#f0fdf4', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600, marginBottom: '6px' }}>
                          <i className="fa-solid fa-clock-rotate-left"></i> Payment History
                        </div>
                        {invoice.payments.map((p, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '2px 0' }}>
                            <span>{new Date(p.paymentDate).toLocaleDateString()} - {p.paymentMethod}</span>
                            <span style={{ fontWeight: 600 }}>₹{Number(p.amount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Payment Input */}
                    {invoice.dueAmount > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Payment Method Selector */}
                        <div>
                          <label style={{ fontSize: '12px', color: '#666', fontWeight: 500, marginBottom: '4px', display: 'block' }}>
                            <i className="fa-solid fa-credit-card"></i> Payment Method
                          </label>
                          <div className="payment-method-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(5, 1fr)',
                            gap: '6px',
                          }}>
                            {PAYMENT_METHODS.map((method) => (
                              <button
                                key={method.value}
                                type="button"
                                className={`btn btn-sm ${paymentMethods[invoice._id] === method.value ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setPaymentMethods(prev => ({ ...prev, [invoice._id]: method.value }))}
                                style={{
                                  fontSize: '11px',
                                  padding: '6px 4px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '2px',
                                  border: paymentMethods[invoice._id] === method.value ? '2px solid var(--primary)' : '1px solid var(--gray-200)',
                                }}
                                title={method.label}
                              >
                                <i className={method.icon} style={{ fontSize: '14px' }}></i>
                                <span>{method.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Amount Input and Pay Buttons */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <span style={{
                              position: 'absolute',
                              left: '10px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: '#888',
                              fontWeight: 600,
                              fontSize: '14px',
                            }}>₹</span>
                            <input
                              type="number"
                              placeholder="Enter amount"
                              value={payments[invoice._id] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (Number(val) > invoice.dueAmount) {
                                  showError(`Maximum payable is ₹${invoice.dueAmount.toFixed(2)}`);
                                  return;
                                }
                                setPayments(prev => ({ ...prev, [invoice._id]: val }));
                              }}
                              style={{
                                width: '100%',
                                padding: '8px 8px 8px 28px',
                                border: '1px solid var(--gray-200)',
                                borderRadius: '6px',
                                fontSize: '14px',
                              }}
                              min="0"
                              max={invoice.dueAmount}
                              step="0.01"
                              onWheel={(e) => e.target.blur()}
                            />
                          </div>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handlePay(invoice._id)}
                            disabled={submitting || !payments[invoice._id] || Number(payments[invoice._id]) <= 0}
                            style={{ whiteSpace: 'nowrap', height: '38px' }}
                          >
                            {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Pay'}
                          </button>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handlePayFull(invoice)}
                            disabled={submitting}
                            style={{ whiteSpace: 'nowrap', height: '38px' }}
                          >
                            {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Full Pay'}
                          </button>
                        </div>
                      </div>
                    )}

                    {invoice.dueAmount <= 0 && (
                      <div style={{ textAlign: 'center', padding: '8px', color: '#16a34a', fontWeight: 600, fontSize: '13px' }}>
                        <i className="fa-solid fa-check-circle"></i> Fully Paid
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <p>Failed to load customer details.</p>
        </div>
      )}
    </Drawer>
  );
}