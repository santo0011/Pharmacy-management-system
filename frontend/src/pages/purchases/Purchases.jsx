import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchPurchases, deletePurchase } from '../../redux/slices/purchaseSlice';
import { showSuccess, showError, confirmDelete } from '../../utils/sweetAlert';

export default function Purchases() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, total, loading } = useSelector((state) => state.purchases);

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
    dispatch(fetchPurchases(params));
  }, [dispatch, currentPage, search, filters]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setCurrentPage(1); }, [search, filters]);

  const handleDelete = async (id) => {
    const confirmed = await confirmDelete('this purchase');
    if (!confirmed) return;
    try {
      await dispatch(deletePurchase(id)).unwrap();
      showSuccess('Purchase deleted');
    } catch (error) {
      showError(error || 'Delete failed');
    }
  };

  const totalPages = Math.ceil(total / 10);

  // --- Render Mobile Expandable Row (matching Sales page pattern) ---
  const renderPurchaseMobileRow = (purchase, idx) => {
    const expanded = isRowExpanded(idx);
    const statusBadgeClass = purchase.status === 'completed' ? 'badge-success' : purchase.status === 'pending' ? 'badge-warning' : purchase.status === 'cancelled' ? 'badge-danger' : 'badge-info';
    return (
      <tbody key={purchase._id || idx}>
        <tr className="sales-mobile-row" onClick={() => toggleRow(idx)}>
          <td>
            <span style={{ fontWeight: 500, fontSize: '13px' }}>{purchase.invoiceNumber}</span>
          </td>
          <td>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>₹{purchase.grandTotal?.toFixed(2)}</span>
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
                <span className="sales-detail-label">Supplier</span>
                <span className="sales-detail-value">{purchase.supplierName || purchase.supplier?.supplierName || '-'}</span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Date</span>
                <span className="sales-detail-value">{new Date(purchase.purchaseDate).toLocaleDateString()}</span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Items</span>
                <span className="sales-detail-value">{purchase.items?.length || 0}</span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Paid</span>
                <span className="sales-detail-value">₹{purchase.paidAmount?.toFixed(2)}</span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Status</span>
                <span className="sales-detail-value">
                  <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '11px' }}>{purchase.status}</span>
                </span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Actions</span>
                <span className="sales-detail-value">
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-info btn-sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`/purchases/${purchase._id}`); }}
                      title="View Details"
                    >
                      <i className="fa-solid fa-eye"></i>
                    </button>
                    {purchase.status !== 'cancelled' && purchase.status !== 'returned' && (
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={(e) => { e.stopPropagation(); navigate(`/purchases/${purchase._id}/edit`); }}
                        title="Edit"
                      >
                        <i className="fa-solid fa-edit"></i>
                      </button>
                    )}
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleDelete(purchase._id); }}
                      title="Delete"
                    >
                      <i className="fa-solid fa-trash"></i>
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
          <h2>Purchases</h2>
          <p>Manage purchase orders and stock</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/purchases/new')}>
          <i className="fa-solid fa-plus"></i> New Purchase
        </button>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-body">
          <div className="sales-filter-row">
            <div className="sales-filter-search-group">
              <label style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Search</label>
              <div className="search-input" style={{ maxWidth: '100%' }}>
                <i className="fa-solid fa-search"></i>
                <input type="text" placeholder="Invoice or supplier..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="form-group sales-filter-field" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Status</label>
              <select className="sales-filter-select" value={filters.status} onChange={(e) => setFilters(p => ({ ...p, status: e.target.value }))}>
                <option value="">All</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
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
          <h5>All Purchases</h5>
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
                        <th>Supplier</th>
                        <th>Date</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Paid</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/purchases/${p._id}`)}>
                          <td style={{ fontWeight: 500 }}>{p.invoiceNumber}</td>
                          <td>{p.supplierName || p.supplier?.supplierName || '-'}</td>
                          <td style={{ fontSize: '13px' }}>{new Date(p.purchaseDate).toLocaleDateString()}</td>
                          <td>{p.items?.length || 0}</td>
                          <td style={{ fontWeight: 600 }}>₹{p.grandTotal?.toFixed(2)}</td>
                          <td>₹{p.paidAmount?.toFixed(2)}</td>
                          <td>
                            <span className={`badge ${p.status === 'completed' ? 'badge-success' : p.status === 'pending' ? 'badge-warning' : p.status === 'cancelled' ? 'badge-danger' : 'badge-info'}`}>
                              {p.status}
                            </span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="action-buttons">
                              <button className="btn btn-info btn-sm" onClick={() => navigate(`/purchases/${p._id}`)} title="View">
                                <i className="fa-solid fa-eye"></i>
                              </button>
                              {p.status !== 'cancelled' && p.status !== 'returned' && (
                                <button className="btn btn-warning btn-sm" onClick={() => navigate(`/purchases/${p._id}/edit`)} title="Edit">
                                  <i className="fa-solid fa-edit"></i>
                                </button>
                              )}
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p._id)} title="Delete">
                                <i className="fa-solid fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile expandable rows (matching Sales page) */}
              <div className="sales-mobile-table">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Total</th>
                      <th className="sales-expand-th"></th>
                    </tr>
                  </thead>
                  {items.map((purchase, idx) => renderPurchaseMobileRow(purchase, idx))}
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <i className="fa-solid fa-truck-loading"></i>
              <h4>No Purchases Found</h4>
              <p>Start by creating a new purchase order.</p>
              <button className="btn btn-primary" onClick={() => navigate('/purchases/new')}>
                <i className="fa-solid fa-plus"></i> New Purchase
              </button>
            </div>
          )}

          {items?.length > 0 && totalPages > 1 && (
            <div className="pagination">
              <span>Page {currentPage} of {totalPages} ({total} total)</span>
              <div className="page-buttons">
                <button disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}>
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <span style={{ padding: '6px 12px', background: 'var(--gray-100)', borderRadius: '6px' }}>{currentPage}</span>
                <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}