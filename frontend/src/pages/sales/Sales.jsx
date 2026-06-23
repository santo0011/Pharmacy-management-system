import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchSales } from '../../redux/slices/saleSlice';

export default function Sales() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, total, loading } = useSelector((state) => state.sales);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', startDate: '', endDate: '' });

  const loadData = useCallback(() => {
    const params = { page: currentPage, limit: 10, ...filters };
    if (search) params.search = search;
    Object.keys(params).forEach((k) => { if (params[k] === '' || params[k] === undefined) delete params[k]; });
    dispatch(fetchSales(params));
  }, [dispatch, currentPage, search, filters]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setCurrentPage(1); }, [search, filters]);

  const totalPages = Math.ceil(total / 10);

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

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-body">
          <div className="search-bar" style={{ marginBottom: '12px' }}>
            <div className="search-input" style={{ maxWidth: '400px' }}>
              <i className="fa-solid fa-search"></i>
              <input type="text" placeholder="Search by invoice or customer..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'end' }}>
            <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Status</label>
              <select value={filters.status} onChange={(e) => setFilters(p => ({ ...p, status: e.target.value }))} style={{ padding: '6px 10px' }}>
                <option value="">All</option>
                <option value="completed">Completed</option>
                <option value="returned">Returned</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>From</label>
              <input type="date" value={filters.startDate} onChange={(e) => setFilters(p => ({ ...p, startDate: e.target.value }))} style={{ padding: '6px 10px' }} />
            </div>
            <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>To</label>
              <input type="date" value={filters.endDate} onChange={(e) => setFilters(p => ({ ...p, endDate: e.target.value }))} style={{ padding: '6px 10px' }} />
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
                    <tr key={s._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/sales/${s._id}`)}>
                      <td style={{ fontWeight: 500 }}>{s.invoiceNumber}</td>
                      <td>{s.customerName}</td>
                      <td style={{ fontSize: '13px' }}>{new Date(s.saleDate).toLocaleDateString()}</td>
                      <td>{s.items?.length || 0}</td>
                      <td style={{ fontWeight: 600 }}>₹{s.grandTotal?.toFixed(2)}</td>
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
                          {s.status === 'completed' && (
                            <button className="btn btn-danger btn-sm" onClick={() => navigate(`/sales/${s._id}`)} title="Cancel / Return">
                              <i className="fa-solid fa-ban"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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