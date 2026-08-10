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
import CurrencyDisplay from '../../components/common/CurrencyDisplay';
import MedicinesSkeleton from '../../components/common/MedicinesSkeleton';
import { showSuccess, showError, confirmDelete } from '../../utils/sweetAlert';
import { useAuth } from '../../hooks/useAuth';

export default function Medicines() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, total, loading } = useSelector((state) => state.medicines);

  // Parse URL query params for pre-applied filters
  const urlParams = new URLSearchParams(window.location.search);
  const urlExpired = urlParams.get('expired');
  const urlLowStock = urlParams.get('lowStock');
  const urlExpiringSoon = urlParams.get('expiringSoon');
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
    expired: urlExpired || '',
    lowStock: urlLowStock || '',
    expiringSoon: urlExpiringSoon || '',
    sort: 'newest',
  });
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

  // --- Render Mobile Expandable Row (matching Sales/Purchases page pattern) ---
  const renderMedicineMobileRow = (med, idx) => {
    const expanded = isRowExpanded(idx);
    const stockBadgeClass = isLowStock(med.currentStock, med.minStockAlert) ? 'badge-danger' : 'badge-success';
    return (
      <tbody key={med._id || idx}>
        <tr className="sales-mobile-row" onClick={() => toggleRow(idx)}>
          <td>
            <span style={{ fontWeight: 500, fontSize: '13px' }}>{med.medicineName}</span>
            {med.genericName && <div style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{med.genericName}</div>}
          </td>
          <td>
            <span className={`badge ${stockBadgeClass}`} style={{ fontSize: '12px' }}>
              {med.currentStock} {med.unit}
            </span>
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
                <span className="sales-detail-label">Image</span>
                <span className="sales-detail-value">
                  {med.medicineImage ? (
                    <img src={med.medicineImage} alt={med.medicineName} style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '36px', height: '36px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', color: 'var(--gray-400)' }}>
                      <i className="fa-solid fa-pills" style={{ fontSize: '14px' }}></i>
                    </div>
                  )}
                </span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Purchase Price</span>
                <span className="sales-detail-value"><CurrencyDisplay value={med.purchasePrice} /></span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Selling Price</span>
                <span className="sales-detail-value"><CurrencyDisplay value={med.sellingPrice} /></span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Expiry</span>
                <span className="sales-detail-value">
                  {isExpired(med.expiryDate) ? (
                    <span className="badge badge-danger">Expired</span>
                  ) : isExpiringSoon(med.expiryDate) ? (
                    <span className="badge badge-warning">{new Date(med.expiryDate).toLocaleDateString()}</span>
                  ) : (
                    <span style={{ fontSize: '13px' }}>{new Date(med.expiryDate).toLocaleDateString()}</span>
                  )}
                </span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Status</span>
                <span className="sales-detail-value">
                  <label className="status-toggle" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={med.status} onChange={() => handleToggleStatus(med._id)} />
                    <span className="slider"></span>
                  </label>
                </span>
              </div>
              <div className="sales-detail-item">
                <span className="sales-detail-label">Actions</span>
                <span className="sales-detail-value">
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-info btn-sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`/medicines/${med._id}`); }}
                      title="View Details"
                    >
                      <i className="fa-solid fa-eye"></i>
                    </button>
                    {!isCashier && (
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={(e) => { e.stopPropagation(); navigate(`/medicines/${med._id}/edit`); }}
                        title="Edit"
                      >
                        <i className="fa-solid fa-edit"></i>
                      </button>
                    )}
                    {!isCashier && !isPharmacist && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={(e) => { e.stopPropagation(); handleDelete(med._id); }}
                        title="Delete"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    )}
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
          <h2>Medicines</h2>
          <p>Manage your pharmacy medicine inventory</p>
        </div>
        {!isCashier && !isSuperAdmin && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-success" onClick={() => navigate('/medicines/bulk-import')}>
              <i className="fa-solid fa-cloud-arrow-up"></i> Bulk Import
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/medicines/new')}>
              <i className="fa-solid fa-plus"></i> Add Medicine
            </button>
          </div>
        )}
      </div>

      {/* Filters (matching Sales/Purchases filter row pattern) */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-body">
          <div className="sales-filter-row" style={{ marginBottom: '12px' }}>
            <div className="sales-filter-search-group">
              <label style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Search</label>
              <div className="search-input" style={{ maxWidth: '100%' }}>
                <i className="fa-solid fa-search"></i>
                <input
                  type="text"
                  placeholder="Search by name, generic, barcode or batch..."
                  value={search}
                  onChange={handleSearch}
                />
              </div>
            </div>
            <div className="form-group sales-filter-field" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Category</label>
              <select className="sales-filter-select" value={filters.category} onChange={(e) => handleFilterChange('category', e.target.value)}>
                <option value="">All Categories</option>
                {categories?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group sales-filter-field" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Brand</label>
              <select className="sales-filter-select" value={filters.brand} onChange={(e) => handleFilterChange('brand', e.target.value)}>
                <option value="">All Brands</option>
                {brands?.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group sales-filter-field" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Supplier</label>
              <select className="sales-filter-select" value={filters.supplier} onChange={(e) => handleFilterChange('supplier', e.target.value)}>
                <option value="">All Suppliers</option>
                {suppliers?.map((s) => <option key={s._id} value={s._id}>{s.supplierName}</option>)}
              </select>
            </div>
            <div className="form-group sales-filter-field" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Status</label>
              <select className="sales-filter-select" value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="form-group sales-filter-field" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Quick Filters</label>
              <select className="sales-filter-select" value="" onChange={(e) => {
                const val = e.target.value;
                if (val) handleFilterChange(val.split('=')[0], val.split('=')[1]);
              }}>
                <option value="">Select Filter</option>
                <option value="expired=true">Expired</option>
                <option value="lowStock=true">Low Stock</option>
                <option value="expiringSoon=true">Expiring in 30 Days</option>
              </select>
            </div>
            <div className="form-group sales-filter-field" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px' }}>Sort By</label>
              <select className="sales-filter-select" value={filters.sort} onChange={(e) => handleFilterChange('sort', e.target.value)}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name_asc">Name A-Z</option>
                <option value="name_desc">Name Z-A</option>
                <option value="expiry_asc">Expiry (Soon)</option>
                <option value="stock_asc">Stock (Low)</option>
              </select>
            </div>
            <div className="sales-filter-field" style={{ marginBottom: 0, alignSelf: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={clearFilters} style={{ width: '100%' }}>
                <i className="fa-solid fa-rotate"></i> Clear
              </button>
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
            <MedicinesSkeleton />
          ) : items?.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="sales-desktop-table">
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Image</th>
                        <th>Medicine Name</th>
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
                        <tr key={med._id} style={{ cursor: 'pointer' }} >
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
                          <td><CurrencyDisplay value={med.purchasePrice} /></td>
                          <td><CurrencyDisplay value={med.sellingPrice} /></td>
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
              </div>

              {/* Mobile expandable rows (matching Sales/Purchases page) */}
              <div className="sales-mobile-table">
                <table>
                  <thead>
                    <tr>
                      <th>Medicine</th>
                      <th>Stock</th>
                      <th className="sales-expand-th"></th>
                    </tr>
                  </thead>
                  {items.map((med, idx) => renderMedicineMobileRow(med, idx))}
                </table>
              </div>
            </>
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