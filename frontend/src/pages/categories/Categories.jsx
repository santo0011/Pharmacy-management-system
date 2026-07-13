import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
} from '../../redux/slices/categorySlice';
import Drawer from '../../components/common/Drawer';
import BulkImportSimple from '../../components/common/BulkImportSimple';
import { showSuccess, showError, confirmDelete } from '../../utils/sweetAlert';

const initialFormState = {
  name: '',
  description: '',
  image: null,
  status: true,
};

export default function Categories() {
  const dispatch = useDispatch();
  const { items, total, page, limit, totalPages, loading } = useSelector(
    (state) => state.categories
  );

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [imagePreview, setImagePreview] = useState('');
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

  const loadCategories = useCallback(() => {
    const params = { page: currentPage, limit: 10 };
    if (search) params.search = search;
    dispatch(fetchCategories(params));
  }, [dispatch, currentPage, search]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
  };

  const openCreateDrawer = () => {
    setEditing(null);
    setFormData(initialFormState);
    setImagePreview('');
    setDrawerOpen(true);
  };

  const openEditDrawer = (category) => {
    setEditing(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      image: null,
      status: category.status,
    });
    setImagePreview(category.image || '');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, image: file });
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showError('Category name is required');
      return;
    }
    setSubmitting(true);
    try {
      const formDataObj = new FormData();
      formDataObj.append('name', formData.name);
      formDataObj.append('description', formData.description);
      formDataObj.append('status', formData.status);
      if (formData.image) formDataObj.append('image', formData.image);

      if (editing) {
        await dispatch(updateCategory({ id: editing._id, formData: formDataObj })).unwrap();
        showSuccess('Category updated successfully');
      } else {
        await dispatch(createCategory(formDataObj)).unwrap();
        showSuccess('Category created successfully');
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
      await dispatch(deleteCategory(id)).unwrap();
      showSuccess('Category deleted successfully');
    } catch (error) {
      showError(error || 'Delete failed');
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await dispatch(toggleCategoryStatus(id)).unwrap();
      showSuccess('Status updated');
    } catch (error) {
      showError(error || 'Failed to update status');
    }
  };

  const drawerFooter = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closeDrawer}>
        Cancel
      </button>
      <button type="submit" form="categoryForm" className="btn btn-primary" disabled={submitting}>
        {submitting ? <i className="fa-solid fa-spinner fa-spin"></i> : null}
        {editing ? 'Update' : 'Create'}
      </button>
    </>
  );

  // Mobile expandable row
  const renderMobileRow = (category, idx) => {
    const expanded = isRowExpanded(idx);
    return (
      <tbody key={category._id || idx}>
        <tr className="customer-mobile-row" onClick={() => toggleRow(idx)}>
          <td>
            <span style={{ fontWeight: 500, fontSize: '13px' }}>{category.name}</span>
          </td>
          <td>
            <span className={`badge ${category.status ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '11px' }}>
              {category.status ? 'Active' : 'Inactive'}
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
                <span className="customer-detail-label">Image</span>
                <span className="customer-detail-value">
                  {category.image ? (
                    <img src={category.image} alt={category.name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px' }} />
                  ) : (
                    <i className="fa-solid fa-image" style={{ color: 'var(--gray-400)', fontSize: '24px' }}></i>
                  )}
                </span>
              </div>
              <div className="customer-detail-item">
                <span className="customer-detail-label">Description</span>
                <span className="customer-detail-value">{category.description || '-'}</span>
              </div>
              <div className="customer-detail-item">
                <span className="customer-detail-label">Actions</span>
                <span className="customer-detail-value">
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-warning btn-sm" onClick={(e) => { e.stopPropagation(); openEditDrawer(category); }}>
                      <i className="fa-solid fa-edit"></i>
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(category._id); }}>
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
          <h2><i className="fa-solid fa-tags" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>Categories</h2>
          <p>Manage product categories for your pharmacy inventory</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <BulkImportSimple
            title="Bulk Import Categories"
            entityName="categories"
            endpoint="/categories/bulk-import"
            headerIncluded={false}
            fields={[
              { key: 'name', label: 'Category Name', required: true, sample: 'Pain Relief' },
              { key: 'description', label: 'Description', required: false, sample: 'Medicines for pain management' },
            ]}
            onComplete={() => loadCategories()}
          />
          <button className="btn btn-primary" onClick={openCreateDrawer}>
            <i className="fa-solid fa-plus"></i> Add Category
          </button>
        </div>
      </div>

      {/* Search & Filter Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-body">
          <div className="search-bar" style={{ marginBottom: 0 }}>
            <div className="search-input">
              <i className="fa-solid fa-search"></i>
              <input type="text" placeholder="Search categories by name..." value={search} onChange={handleSearch} />
            </div>
            {search && (
              <button className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>
                <i className="fa-solid fa-times"></i> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h5><i className="fa-solid fa-list" style={{ marginRight: '8px', color: '#3b82f6' }}></i>All Categories</h5>
          <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>Total: {total}</span>
        </div>
        <div className="card-body" style={{ padding: items?.length > 0 ? '0' : '20px' }}>

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
                        <th>Image</th>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((category) => (
                        <tr key={category._id}>
                          <td>
                            {category.image ? (
                              <img src={category.image} alt={category.name} style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)' }}>
                                <i className="fa-solid fa-image"></i>
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: 500 }}>{category.name}</td>
                          <td style={{ color: 'var(--gray-500)' }}>{category.description || '-'}</td>
                          <td>
                            <label className="status-toggle">
                              <input type="checkbox" checked={category.status} onChange={() => handleToggleStatus(category._id)} />
                              <span className="slider"></span>
                            </label>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button className="btn btn-warning btn-sm" onClick={() => openEditDrawer(category)}>
                                <i className="fa-solid fa-edit"></i>
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(category._id)}>
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
                  {items.map((category, idx) => renderMobileRow(category, idx))}
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
              <i className="fa-solid fa-tags"></i>
              <h4>No Categories Found</h4>
              <p>Get started by creating a new category.</p>
              <button className="btn btn-primary" onClick={openCreateDrawer}>
                <i className="fa-solid fa-plus"></i> Add Category
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right-side Drawer */}
      <Drawer isOpen={drawerOpen} onClose={closeDrawer} title={editing ? 'Edit Category' : 'Add Category'} footer={drawerFooter}>
        <form id="categoryForm" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Category Name *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter category name" required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Enter description" />
          </div>
          <div className="form-group">
            <label>Image</label>
            <input type="file" accept="image/*" onChange={handleImageChange} style={{ padding: '8px' }} />
            {imagePreview && (
              <div style={{ marginTop: '8px' }}>
                <img src={imagePreview} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
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