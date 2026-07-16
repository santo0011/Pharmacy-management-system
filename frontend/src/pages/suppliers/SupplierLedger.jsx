import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AnimatedCounter from '../../components/common/AnimatedCounter';
import { ledgerService } from '../../services/ledgerService';
import { showError } from '../../utils/sweetAlert';

export default function SupplierLedger() {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [expandedInvoice, setExpandedInvoice] = useState(null);

  const fetchLedger = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await ledgerService.getSupplierLedger(supplierId, { page, limit });
      if (res.data) {
        setData(res.data);
      }
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to load supplier ledger');
      navigate('/suppliers');
    } finally {
      setLoading(false);
    }
  }, [supplierId, page, limit, navigate]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const togglePayments = (invoiceNumber) => {
    setExpandedInvoice(prev => prev === invoiceNumber ? null : invoiceNumber);
  };

  if (loading) {
    return (
      <div className="loading-spinner" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', color: 'var(--primary)' }}></i>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <i className="fa-solid fa-book" style={{ fontSize: '48px', color: 'var(--gray-300)' }}></i>
        <h4>Ledger Not Available</h4>
        <p>Unable to load the supplier ledger.</p>
        <button className="btn btn-primary" onClick={() => navigate('/suppliers')}>
          <i className="fa-solid fa-arrow-left"></i> Back to Suppliers
        </button>
      </div>
    );
  }

  const { supplier, summary, ledger, pagination } = data;

  return (
    <div className="ledger-page">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ borderRadius: '8px' }}>
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h2><i className="fa-solid fa-truck"></i> Supplier Ledger</h2>
            <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>{supplier.supplierName} • {supplier.companyName || ''}</p>
          </div>
        </div>
        <div style={{ fontSize: '13px', color: '#888' }}>
          {supplier.phone && <span><i className="fa-solid fa-phone"></i> {supplier.phone}</span>}
          {supplier.email && <span style={{ marginLeft: '12px' }}><i className="fa-solid fa-envelope"></i> {supplier.email}</span>}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="ledger-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div className="ledger-summary-card" style={{ background: '#f0fdf4', borderRadius: '12px', padding: '16px', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '11px', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Total Purchases</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}>
            <AnimatedCounter value={summary.totalPurchases} duration={800} />
          </div>
        </div>
        <div className="ledger-summary-card" style={{ background: '#eff6ff', borderRadius: '12px', padding: '16px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: '11px', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Total Amount</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
            ₹<AnimatedCounter value={summary.totalAmount} duration={800} decimals={2} />
          </div>
        </div>
        <div className="ledger-summary-card" style={{ background: '#f0fdf4', borderRadius: '12px', padding: '16px', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '11px', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Total Paid</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}>
            ₹<AnimatedCounter value={summary.totalPaid} duration={800} decimals={2} />
          </div>
        </div>
        <div className="ledger-summary-card" style={{ background: summary.totalDue > 0 ? '#fff7ed' : '#f0fdf4', borderRadius: '12px', padding: '16px', border: `1px solid ${summary.totalDue > 0 ? '#fed7aa' : '#bbf7d0'}` }}>
          <div style={{ fontSize: '11px', color: summary.totalDue > 0 ? '#9a3412' : '#166534', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Current Balance</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: summary.totalDue > 0 ? '#c2410c' : '#16a34a', marginTop: '4px' }}>
            {summary.totalDue > 0 ? '₹' : '₹'}<AnimatedCounter value={summary.totalDue} duration={800} decimals={2} />
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h5><i className="fa-solid fa-list"></i> Ledger Entries</h5>
          <span style={{ fontSize: '13px', color: '#888' }}>Showing page {pagination?.page || 1} of {pagination?.totalPages || 1}</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {ledger.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px' }}>
              <i className="fa-solid fa-receipt" style={{ fontSize: '48px', color: 'var(--gray-300)' }}></i>
              <h4>No Ledger Entries</h4>
              <p>No purchase transactions found for this supplier.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Purchase #</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                    <th style={{ textAlign: 'right' }}>Paid Amount</th>
                    <th style={{ textAlign: 'right' }}>Due Amount</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Running Balance</th>
                    <th style={{ textAlign: 'center' }}>Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry, idx) => (
                    <>
                      <tr key={entry.invoiceNumber} className="ledger-row">
                        <td>{(page - 1) * limit + idx + 1}</td>
                        <td>{new Date(entry.date).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 500 }}>{entry.invoiceNumber}</td>
                        <td style={{ fontSize: '13px', color: '#555' }}>{entry.description}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{Number(entry.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>₹{Number(entry.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: entry.dueAmount > 0 ? '#dc2626' : '#16a34a' }}>
                          {entry.dueAmount > 0 ? `₹${Number(entry.dueAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00'}
                        </td>
                        <td>
                          <span className={`badge ${entry.paymentStatus === 'paid' ? 'badge-success' : entry.paymentStatus === 'partial' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '10px' }}>
                            {entry.paymentStatus}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: entry.runningBalance > 0 ? '#c2410c' : '#16a34a' }}>
                          ₹{Number(entry.runningBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {entry.payments && entry.payments.length > 0 && (
                            <button
                              className="btn btn-sm btn-info"
                              onClick={() => togglePayments(entry.invoiceNumber)}
                              title="View Payment History"
                              style={{ fontSize: '11px', padding: '2px 8px' }}
                            >
                              <i className="fa-solid fa-credit-card"></i> {expandedInvoice === entry.invoiceNumber ? 'Hide' : `${entry.payments.length}`}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedInvoice === entry.invoiceNumber && entry.payments && entry.payments.length > 0 && (
                        <tr key={`${entry.invoiceNumber}-payments`} className="ledger-payments-row">
                          <td colSpan={10} style={{ padding: '12px 20px', background: '#f9fafb' }}>
                            <div style={{ fontSize: '12px', color: '#888', fontWeight: 600, marginBottom: '8px' }}>
                              <i className="fa-solid fa-credit-card"></i> Payment History for {entry.invoiceNumber}
                            </div>
                            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#888' }}>#</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#888' }}>Date</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'right', color: '#888' }}>Amount</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#888' }}>Method</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#888' }}>Collected By</th>
                                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#888' }}>Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {entry.payments.map((payment, pidx) => (
                                  <tr key={payment._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '6px 8px' }}>{pidx + 1}</td>
                                    <td style={{ padding: '6px 8px' }}>{new Date(payment.paymentDate).toLocaleString()}</td>
                                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>₹{Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td style={{ padding: '6px 8px' }}>
                                      <span className={`badge ${payment.paymentMethod === 'cash' ? 'badge-success' : payment.paymentMethod === 'card' ? 'badge-info' : payment.paymentMethod === 'bank_transfer' ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: '10px' }}>
                                        {payment.paymentMethod ? payment.paymentMethod.replace('_', ' ') : 'Cash'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '6px 8px' }}>{payment.collectedBy || 'Unknown'}</td>
                                    <td style={{ padding: '6px 8px', color: '#888', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {payment.notes || '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '16px' }}>
              <button className="btn btn-sm btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <i className="fa-solid fa-chevron-left"></i> Previous
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPage(p)}
                  style={{ minWidth: '32px' }}
                >
                  {p}
                </button>
              ))}
              <button className="btn btn-sm btn-secondary" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                Next <i className="fa-solid fa-chevron-right"></i>
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .ledger-table th {
          white-space: nowrap;
          font-size: 12px;
        }
        .ledger-row:hover {
          background: #f8fafc;
        }
        .ledger-payments-row td {
          border-bottom: 2px solid #e5e7eb;
        }
        .ledger-payments-row table th {
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}