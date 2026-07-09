import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  toggleBrandStatus,
} from '../../redux/slices/brandSlice';
import Drawer from '../../components/common/Drawer';
import BulkImportSimple from '../../components/common/BulkImportSimple';
import { showSuccess, showError, confirmDelete } from '../../utils/sweetAlert';

const initialFormState = {
  name: '',
  description: '',
  logo: null,
  status: true,
};

export default function Brands() {
  const dispatch = useDispatch();
  const { items, total, page, totalPages, loading } = useSelector(
    (state) => state.brands
  );

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [logoPreview, setLogoPreview] = useState('');
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

  const loadBrands = useCallback(() => {
    const params = { page: currentPage, limit: 10 };
    if (search) params.search = search;
    dispatch(fetchBrands(params));
  }, [dispatch, currentPage, search]);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleSearch = (e) => setSearch(e.target.value);

  const openCreateDrawer = () => {
    setEditing(null);
    setFormData(initialFormState);
    setLogoPreview('');
    setDrawerOpen(true);
  };

  const openEditDrawer = (brand) => {
    setEditing(brand);
    setFormData({
      name: brand.name,
      description: brand.description || '',
      logo: null,
      status: brand.status,
    });
    setLogoPreview(brand.logo || '');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, logo: file });
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showError('Brand name is required');
      return;
    }
    setSubmitting(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('name', formData.name);
      formDataObj.append('description', formData.description);
      formDataObj.append('status', formData.status);
      if (formData.logo) formDataObj.append('logo', formData.logo);

      if (editing) {
        await dispatch(updateBrand({ id: editing._id, formData: formDataObj })).unwrap();
        showSuccess('Brand updated successfully');
      } else {
        await dispatch(createBrand(formDataObj)).unwrap();
        showSuccess('Brand created successfully');
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
      await dispatch(deleteBrand(id)).unwrap();
      showSuccess('Brand deleted successfully');
    } catch (error) {
      showError(error || 'Delete failed');
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await dispatch(toggleBrandStatus(id)).unwrap();
      showSuccess('Status updated');
    } catch (error) {
      showError(error || 'Failed to update status');
    }
  };

  const drawerFooter = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closeDrawer}>Cancel</button>
      <button type="submit" form="brandForm" className="btn btn-primary" disabled={submitting}>
        {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
        {editing ? 'Update' : 'Create'}
      </button>
    </>
  );

  // Mobile expandable row
  const renderMobileRow = (brand, idx) => {
    const expanded = isRowExpanded(idx);
    return (
      <tbody key={brand._id || idx}>
        <tr className="customer-mobile-row" onClick={() => toggleRow(idx)}>
          <td>
            <span style={{ fontWeight: 500, fontSize: '13px' }}>{brand.name}</span>
          </td>
          <td>
            <span className={`badge ${brand.status ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '11px' }}>
              {brand.status ? 'Active' : 'Inactive'}
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
                <span className="customer-detail-label">Logo</span>
                <span className="customer-detail-value">
                  {brand.logo ? (
                    <img src={brand.logo} alt={brand.name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px' }} />
                  ) : (
                    <i className="fa-solid fa-building" style={{ color: 'var(--gray-400)', fontSize: '24px' }}></i>
                  )}
                </span>
              </div>
              <div className="customer-detail-item">
                <span className="customer-detail-label">Description</span>
                <span className="customer-detail-value">{brand.description || '-'}</span>
              </div>
              <div className="customer-detail-item">
                <span className="customer-detail-label">Actions</span>
                <span className="customer-detail-value">
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-warning btn-sm" onClick={(e) => { e.stopPropagation(); openEditDrawer(brand); }}>
                      <i className="fa-solid fa-edit"></i>
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(brand._id); }}>
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
          <h2>Brands</h2>
          <p>Manage product brands</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <BulkImportSimple
            title="Bulk Import Brands"
            entityName="brands"
            endpoint="/brands/bulk-import"
            sampleFormat="Name, Description\nCipla, Cipla pharmaceuticals\nSun Pharma, Sun pharmaceutical products\nDr Reddys, Dr Reddys medicines"
            fields={[
              { key: 'name', label: 'Name', required: true, sample: 'Cipla' },
              { key: 'description', label: 'Description', required: false, sample: 'Cipla pharmaceuticals' },
            ]}
            onComplete={() => loadBrands()}
          />
          <button className="btn btn-primary" onClick={openCreateDrawer}>
            <i className="fa-solid fa-plus"></i> Add Brand
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h5>All Brands</h5>
          <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>Total: {total}</span>
        </div>
        <div className="card-body">
          <div className="search-bar">
            <div className="search-input">
              <i className="fa-solid fa-search"></i>
              <input type="text" placeholder="Search brands..." value={search} onChange={handleSearch} />
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
                        <th>Logo</th>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((brand) => (
                        <tr key={brand._id}>
                          <td>
                            {brand.logo ? (
                              <img src={brand.logo} alt={brand.name} style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)' }}>
                                <i className="fa-solid fa-building"></i>
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: 500 }}>{brand.name}</td>
                          <td style={{ color: 'var(--gray-500)' }}>{brand.description || '-'}</td>
                          <td>
                            <label className="status-toggle">
                              <input type="checkbox" checked={brand.status} onChange={() => handleToggleStatus(brand._id)} />
                              <span className="slider"></span>
                            </label>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button className="btn btn-warning btn-sm" onClick={() => openEditDrawer(brand)}>
                                <i className="fa-solid fa-edit"></i>
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(brand._id)}>
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
                  {items.map((brand, idx) => renderMobileRow(brand, idx))}
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
              <i className="fa-solid fa-copyright"></i>
              <h4>No Brands Found</h4>
              <p>Get started by creating a new brand.</p>
              <button className="btn btn-primary" onClick={openCreateDrawer}>
                <i className="fa-solid fa-plus"></i> Add Brand
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right-side Drawer */}
      <Drawer isOpen={drawerOpen} onClose={closeDrawer} title={editing ? 'Edit Brand' : 'Add Brand'} footer={drawerFooter}>
        <form id="brandForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Brand Name *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter brand name" required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Enter description" />
          </div>
          <div className="form-group">
            <label>Logo</label>
            <input type="file" accept="image/*" onChange={handleLogoChange} style={{ padding: '8px' }} />
            {logoPreview && (
              <div style={{ marginTop: '8px' }}>
                <img src={logoPreview} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" checked={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.checked })} style={{ width: 'auto', marginRight: '8px' }} />
              Active
            </label>
          </div>
        </form>
      </Drawer>
    </div>
  );
}