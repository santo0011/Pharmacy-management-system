import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchMedicines,
  deleteMedicine,
  toggleMedicineStatus,
} from '../../redux/slices/medicineSlice';
import { fetchCategories } from '../../redux/slices/categorySlice';
import { fetchBrands } from '../../redux/slices/brandSlice';
import { fetchSuppliers } from '../../redux/slices/supplierSlice';
import { showSuccess, showError, confirmDelete } from '../../utils/sweetAlert';
import { useAuth } from '../../hooks/useAuth';

export default function Medicines() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, total, loading } = useSelector((state) => state.medicines);
  const { items: categories } = useSelector((state) => state.categories);
  const { items: brands } = useSelector((state) => state.brands);
  const { items: suppliers } = useSelector((state) => state.suppliers);
  const { isSuperAdmin, isCashier, isPharmacist } = useAuth();

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    category: '',
    brand: '',
    supplier: '',
    status: '',
    expired: '',
    lowStock: '',
    expiringSoon: '',
    sort: 'newest',
  });

  const loadMedicines = useCallback(() => {
    const params = { page: currentPage, limit: 10, ...filters };
    if (search) params.search = search;
    // Remove empty filters
    Object.keys(params).forEach((key) => {
      if (params[key] === '' || params[key] === undefined) delete params[key];
    });
    dispatch(fetchMedicines(params));
  }, [dispatch, currentPage, search, filters]);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filters]);

  useEffect(() => {
    if (!isSuperAdmin) {
      dispatch(fetchCategories({ limit: 100 }));
      dispatch(fetchBrands({ limit: 100 }));
      dispatch(fetchSuppliers({ limit: 100 }));
    }
  }, [dispatch, isSuperAdmin]);

  const handleSearch = (e) => setSearch(e.target.value);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ category: '', brand: '', supplier: '', status: '', expired: '', lowStock: '', expiringSoon: '', sort: 'newest' });
    setSearch('');
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmDelete('this medicine');
    if (!confirmed) return;
    try {
      await dispatch(deleteMedicine(id)).unwrap();
      showSuccess('Medicine deleted successfully');
    } catch (error) {
      showError(error || 'Delete failed');
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await dispatch(toggleMedicineStatus(id)).unwrap();
      showSuccess('Status updated');
    } catch (error) {
      showError(error || 'Failed to update status');
    }
  };

  const isExpired = (expiryDate) => new Date(expiryDate) < new Date();
  const isExpiringSoon = (expiryDate) => {
    const diff = new Date(expiryDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 30;
  };
  const isLowStock = (stock, minAlert) => stock <= minAlert;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Medicines</h2>
          <p>Manage your pharmacy medicine inventory</p>
        </div>
        {!isCashier && !isSuperAdmin && (
          <button className="btn btn-primary" onClick={() => navigate('/medicines/new')}>
            <i className="fa-solid fa-plus"></i> Add Medicine
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-body">
          <div className="search-bar" style={{ marginBottom: '12px' }}>
            <div className="search-input" style={{ maxWidth: '400px' }}>
              <i className="fa-solid fa-search"></i>
              <input
                type="text"
                placeholder="Search by name, generic, barcode or batch..."
                value={search}
                onChange={handleSearch}
              />
            </div>
            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
              <i className="fa-solid fa-rotate"></i> Clear
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'end' }}>
            <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Category</label>
              <select value={filters.category} onChange={(e) => handleFilterChange('category', e.target.value)} style={{ padding: '6px 10px' }}>
                <option value="">All Categories</option>
                {categories?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Brand</label>
              <select value={filters.brand} onChange={(e) => handleFilterChange('brand', e.target.value)} style={{ padding: '6px 10px' }}>
                <option value="">All Brands</option>
                {brands?.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Supplier</label>
              <select value={filters.supplier} onChange={(e) => handleFilterChange('supplier', e.target.value)} style={{ padding: '6px 10px' }}>
                <option value="">All Suppliers</option>
                {suppliers?.map((s) => <option key={s._id} value={s._id}>{s.supplierName}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ minWidth: '130px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Status</label>
              <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} style={{ padding: '6px 10px' }}>
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Quick Filters</label>
              <select value="" onChange={(e) => {
                const val = e.target.value;
                if (val) handleFilterChange(val.split('=')[0], val.split('=')[1]);
              }} style={{ padding: '6px 10px' }}>
                <option value="">Select Filter</option>
                <option value="expired=true">Expired</option>
                <option value="lowStock=true">Low Stock</option>
                <option value="expiringSoon=true">Expiring in 30 Days</option>
              </select>
            </div>
            <div className="form-group" style={{ minWidth: '130px', marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Sort By</label>
              <select value={filters.sort} onChange={(e) => handleFilterChange('sort', e.target.value)} style={{ padding: '6px 10px' }}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name_asc">Name A-Z</option>
                <option value="name_desc">Name Z-A</option>
                <option value="expiry_asc">Expiry (Soon)</option>
                <option value="stock_asc">Stock (Low)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <h5>All Medicines</h5>
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
                    <th>Image</th>
                    <th>Medicine Name</th>
                    {/* <th>Category</th>
                    <th>Brand</th>
                    <th>Supplier</th> */}
                    <th>Purchase Price</th>
                    <th>Selling Price</th>
                    <th>Stock</th>
                    <th>Expiry</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((med) => (
                    <tr key={med._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/medicines/${med._id}`)}>
                      <td onClick={(e) => e.stopPropagation()}>
                        {med.medicineImage ? (
                          <img src={med.medicineImage} alt={med.medicineName} className="image-preview" style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} />
                        ) : (
                          <div className="image-preview" style={{ width: '40px', height: '40px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', color: 'var(--gray-400)' }}>
                            <i className="fa-solid fa-pills" style={{ fontSize: '16px' }}></i>
                          </div>
                        )}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {med.medicineName}
                        {med.genericName && <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{med.genericName}</div>}
                      </td>
                      {/* <td>{med.category?.name || '-'}</td>
                      <td>{med.brand?.name || '-'}</td>
                      <td>{med.supplier?.supplierName || '-'}</td> */}
                      <td>₹{med.purchasePrice?.toFixed(2)}</td>
                      <td>₹{med.sellingPrice?.toFixed(2)}</td>
                      <td>
                        <span className={`badge ${isLowStock(med.currentStock, med.minStockAlert) ? 'badge-danger' : 'badge-success'}`}>
                          {med.currentStock} {med.unit}
                        </span>
                      </td>
                      <td>
                        {isExpired(med.expiryDate) ? (
                          <span className="badge badge-danger">Expired</span>
                        ) : isExpiringSoon(med.expiryDate) ? (
                          <span className="badge badge-warning">
                            {new Date(med.expiryDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span style={{ fontSize: '13px' }}>{new Date(med.expiryDate).toLocaleDateString()}</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <label className="status-toggle">
                          <input type="checkbox" checked={med.status} onChange={() => handleToggleStatus(med._id)} />
                          <span className="slider"></span>
                        </label>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="action-buttons">
                          <button className="btn btn-info btn-sm" onClick={() => navigate(`/medicines/${med._id}`)} title="View">
                            <i className="fa-solid fa-eye"></i>
                          </button>
                          {!isCashier && (
                            <button className="btn btn-warning btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/medicines/${med._id}/edit`); }} title="Edit">
                              <i className="fa-solid fa-edit"></i>
                            </button>
                          )}
                          {!isCashier && !isPharmacist && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(med._id)} title="Delete">
                              <i className="fa-solid fa-trash"></i>
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
              <i className="fa-solid fa-pills"></i>
              <h4>No Medicines Found</h4>
              <p>Get started by adding medicines to your inventory.</p>
              {!isCashier && (
                <button className="btn btn-primary" onClick={() => navigate('/medicines/new')}>
                  <i className="fa-solid fa-plus"></i> Add Medicine
                </button>
              )}
            </div>
          )}

          {/* Pagination */}
          {items?.length > 0 && (
            <div className="pagination">
              <span>Page {currentPage} of {Math.ceil(total / 10)} ({total} total)</span>
              <div className="page-buttons">
                <button disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}>
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <span style={{ padding: '6px 12px', background: 'var(--gray-100)', borderRadius: '6px' }}>{currentPage}</span>
                <button disabled={currentPage >= Math.ceil(total / 10)} onClick={() => setCurrentPage(currentPage + 1)}>
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