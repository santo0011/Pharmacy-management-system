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
          <div className="search-bar" style={{ marginBottom: '12px' }}>
            <div className="search-input" style={{ maxWidth: '400px' }}>
              <i className="fa-solid fa-search"></i>
              <input type="text" placeholder="Search by invoice or supplier..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'end' }}>
            <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Status</label>
              <select value={filters.status} onChange={(e) => setFilters(p => ({ ...p, status: e.target.value }))} style={{ padding: '6px 10px' }}>
                <option value="">All</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
                <option value="returned">Returned</option>
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
          <h5>All Purchases</h5>
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