import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  toggleSupplierStatus,
} from '../../redux/slices/supplierSlice';
import Drawer from '../../components/common/Drawer';
import { showSuccess, showError, confirmDelete } from '../../utils/sweetAlert';

const initialFormState = {
  supplierName: '',
  companyName: '',
  phone: '',
  email: '',
  address: '',
  gstNumber: '',
  status: true,
};

export default function Suppliers() {
  const dispatch = useDispatch();
  const { items, total, page, totalPages, loading } = useSelector(
    (state) => state.suppliers
  );

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
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

  const loadSuppliers = useCallback(() => {
    const params = { page: currentPage, limit: 10 };
    if (search) params.search = search;
    dispatch(fetchSuppliers(params));
  }, [dispatch, currentPage, search]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleSearch = (e) => setSearch(e.target.value);

  const openCreateDrawer = () => {
    setEditing(null);
    setFormData(initialFormState);
    setDrawerOpen(true);
  };

  const openEditDrawer = (supplier) => {
    setEditing(supplier);
    setFormData({
      supplierName: supplier.supplierName,
      companyName: supplier.companyName,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address || '',
      gstNumber: supplier.gstNumber || '',
      status: supplier.status,
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplierName.trim() || !formData.companyName.trim()) {
      showError('Supplier name and company name are required');
      return;
    }
    if (!formData.phone.trim() || !formData.email.trim()) {
      showError('Phone and email are required');
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await dispatch(updateSupplier({ id: editing._id, supplierData: formData })).unwrap();
        showSuccess('Supplier updated successfully');
      } else {
        await dispatch(createSupplier(formData)).unwrap();
        showSuccess('Supplier created successfully');
      }
      closeDrawer();
    } catch (error) {
      showError(error || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await confirmDelete();
    if (!confirmed) return;
    try {
      await dispatch(deleteSupplier(id)).unwrap();
      showSuccess('Supplier deleted successfully');
    } catch (error) {
      showError(error || 'Delete failed');
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await dispatch(toggleSupplierStatus(id)).unwrap();
      showSuccess('Status updated');
    } catch (error) {
      showError(error || 'Failed to update status');
    }
  };

  const drawerFooter = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closeDrawer}>Cancel</button>
      <button type="submit" form="supplierForm" className="btn btn-primary" disabled={submitting}>
        {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
        {editing ? 'Update' : 'Create'}
      </button>
    </>
  );

  // Mobile expandable row
  const renderMobileRow = (supplier, idx) => {
    const expanded = isRowExpanded(idx);
    return (
      <tbody key={supplier._id || idx}>
        <tr className="customer-mobile-row" onClick={() => toggleRow(idx)}>
          <td>
            <span style={{ fontWeight: 500, fontSize: '13px' }}>{supplier.supplierName}</span>
          </td>
          <td>
            <span className={`badge ${supplier.status ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '11px' }}>
              {supplier.status ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td className="customer-expand-cell">
            <button className="customer-expand-btn">
              <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`}></i>
            </button>
          </td>
        </tr>
        <tr className={`customer-detail-row ${expanded ? 'customer-detail-row-open' : ''}`}>
          <td colSpan={3} className="customer-detail-cell">
            <div className="customer-detail-inner">
              <div className="customer-detail-item">
                <span className="customer-detail-label">Company</span>
                <span className="customer-detail-value">{supplier.companyName}</span>
              </div>
              <div className="customer-detail-item">
                <span className="customer-detail-label">Contact</span>
                <span className="customer-detail-value">{supplier.email}<br />{supplier.phone}</span>
              </div>
              <div className="customer-detail-item">
                <span className="customer-detail-label">GST</span>
                <span className="customer-detail-value">{supplier.gstNumber || '-'}</span>
              </div>
              <div className="customer-detail-item">
                <span className="customer-detail-label">Actions</span>
                <span className="customer-detail-value">
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-warning btn-sm" onClick={(e) => { e.stopPropagation(); openEditDrawer(supplier); }}>
                      <i className="fa-solid fa-edit"></i>
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(supplier._id); }}>
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
          <h2>Suppliers</h2>
          <p>Manage product suppliers</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateDrawer}>
          <i className="fa-solid fa-plus"></i> Add Supplier
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h5>All Suppliers</h5>
          <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>Total: {total}</span>
        </div>
        <div className="card-body">
          <div className="search-bar">
            <div className="search-input">
              <i className="fa-solid fa-search"></i>
              <input type="text" placeholder="Search suppliers..." value={search} onChange={handleSearch} />
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
          ) : items?.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="customer-desktop-table">
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Supplier</th>
                        <th>Company</th>
                        <th>Contact</th>
                        <th>GST</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((supplier) => (
                        <tr key={supplier._id}>
                          <td style={{ fontWeight: 500 }}>{supplier.supplierName}</td>
                          <td>{supplier.companyName}</td>
                          <td>
                            <div style={{ fontSize: '13px' }}>
                              <div>{supplier.email}</div>
                              <div style={{ color: 'var(--gray-500)' }}>{supplier.phone}</div>
                            </div>
                          </td>
                          <td>{supplier.gstNumber || '-'}</td>
                          <td>
                            <label className="status-toggle">
                              <input type="checkbox" checked={supplier.status} onChange={() => handleToggleStatus(supplier._id)} />
                              <span className="slider"></span>
                            </label>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button className="btn btn-warning btn-sm" onClick={() => openEditDrawer(supplier)}>
                                <i className="fa-solid fa-edit"></i>
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(supplier._id)}>
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

              {/* Mobile table */}
              <div className="customer-mobile-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                      <th className="customer-expand-th"></th>
                    </tr>
                  </thead>
                  {items.map((supplier, idx) => renderMobileRow(supplier, idx))}
                </table>
              </div>

              <div className="pagination">
                <span>Showing page {page} of {totalPages} ({total} total)</span>
                <div className="page-buttons">
                  <button disabled={page <= 1} onClick={() => setCurrentPage(page - 1)}>
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} className={p === page ? 'active' : ''} onClick={() => setCurrentPage(p)}>{p}</button>
                  ))}
                  <button disabled={page >= totalPages} onClick={() => setCurrentPage(page + 1)}>
                    <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <i className="fa-solid fa-truck"></i>
              <h4>No Suppliers Found</h4>
              <p>Get started by adding a new supplier.</p>
              <button className="btn btn-primary" onClick={openCreateDrawer}>
                <i className="fa-solid fa-plus"></i> Add Supplier
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right-side Drawer */}
      <Drawer isOpen={drawerOpen} onClose={closeDrawer} title={editing ? 'Edit Supplier' : 'Add Supplier'} footer={drawerFooter}>
        <form id="supplierForm" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Supplier Name *</label>
              <input type="text" name="supplierName" value={formData.supplierName} onChange={handleChange} placeholder="Enter name" required />
            </div>
            <div className="form-group">
              <label>Company Name *</label>
              <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="Enter company" required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Phone *</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="Enter phone" required />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter email" required />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea name="address" value={formData.address} onChange={handleChange} placeholder="Enter address" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>GST Number</label>
              <input type="text" name="gstNumber" value={formData.gstNumber} onChange={handleChange} placeholder="Enter GST" />
            </div>
            <div className="form-group">
              <label>
                <input type="checkbox" checked={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.checked })} style={{ width: 'auto', marginRight: '8px' }} />
                Active
              </label>
            </div>
          </div>
        </form>
      </Drawer>
    </div>
  );
}