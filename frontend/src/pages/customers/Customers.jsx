import { useState, useEffect, useCallback } from 'react';
import { customerService } from '../../services/customerService';
import { showError } from '../../utils/sweetAlert';
import PaymentDrawer from '../../components/common/PaymentDrawer';

export default function Customers() {
  const [activeTab, setActiveTab] = useState('all');
  const [customers, setCustomers] = useState([]);
  const [dueCustomers, setDueCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dueLoading, setDueLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dueSearch, setDueSearch] = useState('');
  const [page, setPage] = useState(1);
  const [duePage, setDuePage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dueTotal, setDueTotal] = useState(0);
  const [dueTotals, setDueTotals] = useState({ totalDueAmount: 0, totalOutstanding: 0, totalCustomers: 0 });
  const [limit] = useState(10);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);

  // --- Fetch All Customers ---
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await customerService.getCustomers({ page, limit, search });
      if (data.data) {
        setCustomers(data.data);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    if (activeTab === 'all') fetchCustomers();
  }, [fetchCustomers, activeTab]);

  // --- Fetch Due Customers ---
  const fetchDueCustomers = useCallback(async () => {
    setDueLoading(true);
    try {
      const { data } = await customerService.getCustomerDues({ page: duePage, limit, search: dueSearch });
      if (data.data) {
        setDueCustomers(data.data.customers || []);
        setDueTotal(data.pagination?.total || 0);
        setDueTotals(data.data.totals || { totalDueAmount: 0, totalOutstanding: 0, totalCustomers: 0 });
      }
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to load due customers');
    } finally {
      setDueLoading(false);
    }
  }, [duePage, limit, dueSearch]);

  useEffect(() => {
    if (activeTab === 'due') fetchDueCustomers();
  }, [fetchDueCustomers, activeTab]);

  // --- View Customer Detail (Enhanced) ---
  const handleViewCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setDetailLoading(true);
    try {
      // Priority: customerRef (MongoDB ObjectId from due pipeline), _id (from all customers), phone, name
      const identifier = customer.customerRef || customer._id || customer.customerPhone || customer.customerName;
      if (!identifier) {
        showError('Cannot load customer details - no identifier available.');
        setDetailLoading(false);
        return;
      }
      const { data } = await customerService.getCustomer(identifier);
      if (data.data) {
        setCustomerDetail(data.data);
      }
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to load customer details');
    } finally {
      setDetailLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const dueTotalPages = Math.ceil(dueTotal / limit);

  // --- Render All Customers Tab ---
  const renderAllCustomers = () => (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h5>All Customers</h5>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="form-select"
            style={{ width: '250px' }}
          />
          <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>Total: {total}</span>
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {loading ? (
          <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <i className="fa-solid fa-users" style={{ fontSize: '48px', color: 'var(--gray-300)' }}></i>
            <h4>No Customers Found</h4>
            <p>Customers will appear here after they make purchases.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>Total Purchases</th>
                  <th>Total Spent</th>
                  <th>Last Purchase</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer, idx) => (
                  <tr key={customer._id || idx}>
                    <td>{(page - 1) * limit + idx + 1}</td>
                    <td style={{ fontWeight: 500 }}>{customer.customerName}</td>
                    <td>{customer.customerPhone || '-'}</td>
                    <td>{customer.totalPurchases}</td>
                    <td style={{ fontWeight: 600 }}>₹{Number(customer.totalSpent).toFixed(2)}</td>
                    <td>{customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate).toLocaleDateString() : '-'}</td>
                    <td>
                      <button className="btn btn-info btn-sm" onClick={() => handleViewCustomer(customer)} title="View Details">
                        <i className="fa-solid fa-eye"></i> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '16px' }}>
            <button className="btn btn-sm btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="btn btn-sm btn-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );

  // --- Render Due Customers Tab ---
  const renderDueCustomers = () => (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h5>Due Customers</h5>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by name, phone or invoice #..."
            value={dueSearch}
            onChange={(e) => { setDueSearch(e.target.value); setDuePage(1); }}
            className="form-select"
            style={{ width: '280px' }}
          />
        </div>
      </div>

      {!dueLoading && dueCustomers.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', padding: '16px' }}>
          <div style={{ background: '#fff7ed', borderRadius: '10px', padding: '14px', border: '1px solid #fed7aa' }}>
            <div style={{ fontSize: '12px', color: '#9a3412', fontWeight: 500 }}>Total Due Amount</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#c2410c', marginTop: '4px' }}>₹{Number(dueTotals.totalDueAmount).toFixed(2)}</div>
          </div>
          <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '14px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '12px', color: '#166534', fontWeight: 500 }}>Total Outstanding</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}>₹{Number(dueTotals.totalOutstanding).toFixed(2)}</div>
          </div>
          <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '14px', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: 500 }}>Customers with Due</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>{dueTotals.totalCustomers}</div>
          </div>
        </div>
      )}

      <div className="card-body" style={{ padding: 0 }}>
        {dueLoading ? (
          <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
        ) : dueCustomers.length === 0 ? (
          <div className="empty-state">
            <i className="fa-solid fa-check-circle" style={{ fontSize: '48px', color: '#22c55e' }}></i>
            <h4>No Due Customers</h4>
            <p>All customers have cleared their payments.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>Total Sales</th>
                  <th>Total Paid</th>
                  <th>Total Due</th>
                  <th>Last Purchase</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dueCustomers.map((customer, idx) => (
                  <tr key={idx}>
                    <td>{(duePage - 1) * limit + idx + 1}</td>
                    <td style={{ fontWeight: 500 }}>{customer.customerName}</td>
                    <td>{customer.customerPhone || '-'}</td>
                    <td>{customer.totalPurchases}</td>
                    <td style={{ fontWeight: 600, color: '#16a34a' }}>₹{Number(customer.totalPaid).toFixed(2)}</td>
                    <td style={{ fontWeight: 700, color: customer.totalDue > 0 ? '#dc2626' : '#16a34a' }}>
                      ₹{Number(customer.totalDue).toFixed(2)}
                    </td>
                    <td>{customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate).toLocaleDateString() : '-'}</td>
                    <td>
                      <button
                        className="btn btn-info btn-sm"
                        onClick={() => handleViewCustomer(customer)}
                        title="View Details"
                      >
                        <i className="fa-solid fa-eye"></i>
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => {
                          setPaymentCustomer(customer);
                          setPaymentDrawerOpen(true);
                        }}
                        disabled={customer.totalDue <= 0}
                        title="Collect Payment"
                      >
                        <i className="fa-solid fa-indian-rupee-sign"></i> Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {dueTotalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '16px' }}>
            <button className="btn btn-sm btn-secondary" disabled={duePage === 1} onClick={() => setDuePage(p => p - 1)}>Previous</button>
            {Array.from({ length: dueTotalPages }, (_, i) => i + 1).map(p => (
              <button key={p} className={`btn btn-sm ${p === duePage ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDuePage(p)}>{p}</button>
            ))}
            <button className="btn btn-sm btn-secondary" disabled={duePage === dueTotalPages} onClick={() => setDuePage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-users"></i> Customers</h2>
          <p>Manage your pharmacy customers</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid var(--gray-200)', paddingBottom: '8px' }}>
        <button
          className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ border: 'none', borderRadius: '8px 8px 0 0', fontSize: '13px' }}
          onClick={() => { setActiveTab('all'); setSearch(''); setPage(1); }}
        >
          <i className="fa-solid fa-users"></i> All Customers
        </button>
        <button
          className={`btn ${activeTab === 'due' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ border: 'none', borderRadius: '8px 8px 0 0', fontSize: '13px' }}
          onClick={() => { setActiveTab('due'); setDueSearch(''); setDuePage(1); }}
        >
          <i className="fa-solid fa-exclamation-triangle"></i> Due Customers
        </button>
      </div>

      {activeTab === 'all' ? renderAllCustomers() : renderDueCustomers()}

      {/* Enhanced Customer Detail Drawer */}
      {selectedCustomer && (
        <div className="modal-overlay" onClick={() => { setSelectedCustomer(null); setCustomerDetail(null); }}>
          <div className="drawer open" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="drawer-header">
              <h3>
                <i className="fa-solid fa-user"></i> {selectedCustomer.customerName}
              </h3>
              <button className="btn btn-sm btn-secondary" onClick={() => { setSelectedCustomer(null); setCustomerDetail(null); }}>
                <i className="fa-solid fa-times"></i>
              </button>
            </div>
            <div className="drawer-body">
              {detailLoading ? (
                <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
              ) : customerDetail ? (
                <>
                  {/* Customer Info Card - Enhanced */}
                  <div className="card" style={{ marginBottom: '16px', borderLeft: '4px solid var(--primary)', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' }}>
                    <div className="card-body">
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</label>
                          <div style={{ fontWeight: 600, fontSize: '16px', marginTop: '2px', color: '#0f172a' }}>{customerDetail.customer?.customerName}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</label>
                          <div style={{ fontWeight: 500, marginTop: '2px' }}>{customerDetail.customer?.customerPhone || '-'}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Bills</label>
                          <div style={{ fontWeight: 500, marginTop: '2px' }}>{customerDetail.customer?.totalPurchases || 0}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Spent</label>
                          <div style={{ fontWeight: 700, color: 'var(--primary)', marginTop: '2px', fontSize: '18px' }}>₹{Number(customerDetail.customer?.totalSpent || 0).toFixed(2)}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>First Bill</label>
                          <div style={{ fontWeight: 500, marginTop: '2px', fontSize: '13px' }}>
                            {customerDetail.customer?.firstPurchaseDate ? new Date(customerDetail.customer.firstPurchaseDate).toLocaleDateString() : '-'}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last Bill</label>
                          <div style={{ fontWeight: 500, marginTop: '2px', fontSize: '13px' }}>
                            {customerDetail.customer?.lastPurchaseDate ? new Date(customerDetail.customer.lastPurchaseDate).toLocaleDateString() : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Purchase History with Medicine Details */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h5 style={{ margin: 0 }}>
                      <i className="fa-solid fa-receipt"></i> Bill History
                    </h5>
                    {customerDetail.total > 0 && (
                      <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{customerDetail.total} bill(s)</span>
                    )}
                  </div>
                  {customerDetail.sales?.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {customerDetail.sales.map((sale, idx) => (
                        <div key={idx} className="card" style={{
                          margin: 0,
                          border: '1px solid var(--gray-200)',
                          borderLeft: `4px solid ${sale.dueAmount > 0 ? '#f97316' : '#22c55e'}`,
                        }}>
                          <div className="card-body" style={{ padding: '14px' }}>
                            {/* Bill Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div>
                                <span style={{ fontWeight: 600, fontSize: '14px' }}>{sale.invoiceNumber}</span>
                                <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
                                  {new Date(sale.saleDate).toLocaleDateString()}
                                </span>
                              </div>
                              <span style={{ fontWeight: 600, color: sale.dueAmount > 0 ? '#dc2626' : '#16a34a', fontSize: '14px' }}>
                                ₹{Number(sale.grandTotal).toFixed(2)}
                              </span>
                            </div>

                            {/* Medicine Items */}
                            {sale.items && sale.items.length > 0 && (
                              <div style={{ marginBottom: '8px', padding: '6px 10px', background: '#f9fafb', borderRadius: '6px' }}>
                                <div style={{ fontSize: '11px', color: '#888', fontWeight: 600, marginBottom: '4px' }}>MEDICINES</div>
                                <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
                                  {sale.items.map((item, i) => (
                                    <span key={i}>
                                      {i > 0 && ', '}
                                      <strong>{item.medicineName}</strong> × {item.quantity}
                                      {item.sellingPrice ? ` (₹${Number(item.sellingPrice).toFixed(2)}/pc)` : ''}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Payment Summary */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '12px', padding: '6px 10px', background: sale.dueAmount > 0 ? '#fff7ed' : '#f0fdf4', borderRadius: '6px' }}>
                              <div>
                                <span style={{ color: '#888' }}>Paid: </span>
                                <span style={{ fontWeight: 600, color: '#16a34a' }}>₹{Number(sale.paidAmount).toFixed(2)}</span>
                              </div>
                              <div>
                                <span style={{ color: '#888' }}>Due: </span>
                                <span style={{ fontWeight: 700, color: sale.dueAmount > 0 ? '#dc2626' : '#16a34a' }}>
                                  {sale.dueAmount > 0 ? `₹${Number(sale.dueAmount).toFixed(2)}` : 'Cleared'}
                                </span>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span className={`badge ${sale.paymentStatus === 'paid' ? 'badge-success' : sale.paymentStatus === 'partial' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '10px' }}>
                                  {sale.paymentStatus}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: '20px' }}>
                      <i className="fa-solid fa-receipt" style={{ fontSize: '36px', color: 'var(--gray-300)' }}></i>
                      <p>No purchase history available.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state"><p>Failed to load details</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Drawer */}
      <PaymentDrawer
        isOpen={paymentDrawerOpen}
        onClose={() => {
          setPaymentDrawerOpen(false);
          setPaymentCustomer(null);
        }}
        customer={paymentCustomer}
        onPaymentComplete={() => {
          fetchDueCustomers();
        }}
      />
    </div>
  );
}