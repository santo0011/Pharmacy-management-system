import { useState, useEffect, useCallback } from 'react';
import AnimatedCounter from '../../components/common/AnimatedCounter';
import CurrencyDisplay from '../../components/common/CurrencyDisplay';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchSales, fetchSaleStats } from '../../redux/slices/saleSlice';

export default function Sales() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, total, loading, stats } = useSelector((state) => state.sales);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', startDate: '', endDate: '' });
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRow = (rowIdx) => {
    setExpandedRows(prev => ({
      ...prev,
      [rowIdx]: !prev[rowIdx],
    }));
  };

  const isRowExpanded = (rowIdx) => {
    return !!expandedRows[rowIdx];
  };

  const loadData = useCallback(() => {
    const params = { page: currentPage, limit: 10, ...filters };
    if (search) params.search = search;
    Object.keys(params).forEach((k) => { if (params[k] === '' || params[k] === undefined) delete params[k]; });
    dispatch(fetchSales(params));
  }, [dispatch, currentPage, search, filters]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setCurrentPage(1); }, [search, filters]);
  useEffect(() => { dispatch(fetchSaleStats()); }, [dispatch]);

  const totalPages = Math.ceil(total / 10);

  // --- Render Mobile Expandable Row ---
  const renderSalesMobileRow = (sale, idx) => {
    const expanded = isRowExpanded(idx);
    const paymentBadgeClass = sale.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning';
    const statusBadgeClass = sale.status === 'completed' ? 'badge-success' : sale.status === 'returned' ? 'badge-info' : 'badge-danger';
    return (
      <tbody key={sale._id || idx}>
        <tr className="sales-mobile-row" onClick={() => toggleRow(idx)}>
          <td>
            <span style={{ fontWeight: 500, fontSize: '13px' }}>{sale.invoiceNumber}</span>
          </td>
          <td>
            <span style={{ fontWeight: 600, fontSize: '13px' }}><CurrencyDisplay value={sale.grandTotal} /></span>
          </td>
          <td className="sales-expand-cell">
            <button className="sales-expand-btn">
              <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`}></i>
            </button>
          </td>
        </tr>
        <tr className={`sales-detail-row ${expanded ? 'sales-detail-row-open' : ''}`}>
          <td colSpan={3} className="sales-detail-cell">
            <div className="sales-detail-inner">
              <div className="sales-detail-item">
                <span className="sales-detail-label">Customer</span>
                <span className="sales-detail-value">{sale.customerName}</span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Date</span>
                <span className="sales-detail-value">{new Date(sale.saleDate).toLocaleDateString()}</span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Items</span>
                <span className="sales-detail-value">{sale.items?.length || 0}</span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Payment</span>
                <span className="sales-detail-value">
                  <span className={`badge ${paymentBadgeClass}`} style={{ fontSize: '11px' }}>{sale.paymentStatus}</span>
                </span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Status</span>
                <span className="sales-detail-value">
                  <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '11px' }}>{sale.status}</span>
                </span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Actions</span>
                <span className="sales-detail-value">
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-info btn-sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`/sales/${sale._id}`); }}
                      title="View Details"
                    >
                      <i className="fa-solid fa-eye"></i>
                    </button>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`/sales/${sale._id}/invoice`); }}
                      title="Invoice / Print"
                    >
                      <i className="fa-solid fa-print"></i>
                    </button>
                  </div>
                </span>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Sales</h2>
          <p>Manage sales and invoices</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-success" onClick={() => navigate('/sales/new')}>
            <i className="fa-solid fa-cash-register"></i> New Sale
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="dashboard-summary-grid" style={{ marginBottom: '20px' }}>
        <div className="summary-item summary-item-blue">
          <div className="summary-label">Total Sales</div>
          <div className="summary-value summary-value-blue" style={{ fontSize: '22px' }}><CurrencyDisplay value={stats?.totalAmount || 0} /></div>
          <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '2px' }}>{stats?.totalSales || 0} invoices</div>
        </div>
        <div className="summary-item summary-item-green">
          <div className="summary-label">Total Paid</div>
          <div className="summary-value summary-value-green" style={{ fontSize: '22px' }}><CurrencyDisplay value={stats?.totalPaid || 0} /></div>
          <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '2px' }}>This month: <CurrencyDisplay value={stats?.monthlyAmount || 0} /></div>
        </div>
        <div className="summary-item summary-item-red">
          <div className="summary-label">Outstanding Due</div>
          <div className="summary-value summary-value-red" style={{ fontSize: '22px' }}><CurrencyDisplay value={stats?.totalDue || 0} /></div>
          <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '2px' }}>{stats?.totalSales || 0} total invoices</div>
        </div>
        <div className="summary-item summary-item-gray">
          <div className="summary-label">Yearly Sales</div>
          <div className="summary-value summary-value-dark" style={{ fontSize: '22px' }}><CurrencyDisplay value={stats?.yearlyAmount || 0} /></div>
          <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '2px' }}>{stats?.yearlySales || 0} sales this year</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-body">
          <div className="sales-filter-row">
            <div className="sales-filter-search-group">
              <label style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Search</label>
              <div className="search-input" style={{ maxWidth: '100%' }}>
                <i className="fa-solid fa-search"></i>
                <input type="text" placeholder="Invoice or customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="form-group sales-filter-field" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Status</label>
              <select className="sales-filter-select" value={filters.status} onChange={(e) => setFilters(p => ({ ...p, status: e.target.value }))}>
                <option value="">All</option>
                <option value="completed">Completed</option>
                <option value="returned">Returned</option>
              </select>
            </div>
            <div className="form-group sales-filter-field" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>From</label>
              <input type="date" className="sales-filter-select" value={filters.startDate} onChange={(e) => setFilters(p => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div className="form-group sales-filter-field" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>To</label>
              <input type="date" className="sales-filter-select" value={filters.endDate} onChange={(e) => setFilters(p => ({ ...p, endDate: e.target.value }))} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h5>All Sales</h5>
          <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>Total: {total}</span>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
          ) : items?.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="sales-desktop-table">
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((s) => (
                        <tr key={s._id} style={{ cursor: 'pointer' }}>
                          <td style={{ fontWeight: 500 }}>{s.invoiceNumber}</td>
                          <td>{s.customerName}</td>
                          <td style={{ fontSize: '13px' }}>{new Date(s.saleDate).toLocaleDateString()}</td>
                          <td>{s.items?.length || 0}</td>
                          <td style={{ fontWeight: 600 }}><CurrencyDisplay value={s.grandTotal} /></td>
                          <td><span className={`badge ${s.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>{s.paymentStatus}</span></td>
                          <td>
                            <span className={`badge ${s.status === 'completed' ? 'badge-success' : s.status === 'returned' ? 'badge-info' : 'badge-danger'}`}>
                              {s.status}
                            </span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="action-buttons">
                              <button className="btn btn-info btn-sm" onClick={() => navigate(`/sales/${s._id}`)} title="View Details">
                                <i className="fa-solid fa-eye"></i>
                              </button>
                              <button className="btn btn-success btn-sm" onClick={() => navigate(`/sales/${s._id}/invoice`)} title="Invoice / Print">
                                <i className="fa-solid fa-print"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile expandable rows */}
              <div className="sales-mobile-table">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Total</th>
                      <th className="sales-expand-th"></th>
                    </tr>
                  </thead>
                  {items.map((sale, idx) => renderSalesMobileRow(sale, idx))}
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <i className="fa-solid fa-receipt"></i>
              <h4>No Sales Found</h4>
              <p>Start by creating a new sale.</p>
              <button className="btn btn-success" onClick={() => navigate('/sales/new')}>
                <i className="fa-solid fa-plus"></i> New Sale
              </button>
            </div>
          )}

          {items?.length > 0 && totalPages > 1 && (
            <div className="pagination">
              <span>Page {currentPage} of {totalPages} ({total} total)</span>
              <div className="page-buttons">
                <button disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}><i className="fa-solid fa-chevron-left"></i></button>
                <span style={{ padding: '6px 12px', background: 'var(--gray-100)', borderRadius: '6px' }}>{currentPage}</span>
                <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(currentPage + 1)}><i className="fa-solid fa-chevron-right"></i></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}