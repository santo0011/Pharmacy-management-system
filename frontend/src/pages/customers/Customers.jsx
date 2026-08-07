import { useState, useEffect, useCallback, useRef } from 'react';
import AnimatedCounter from '../../components/common/AnimatedCounter';
import CurrencyDisplay from '../../components/common/CurrencyDisplay';
import { customerService } from '../../services/customerService';
import { pharmacyService } from '../../services/pharmacyService';
import { formatCurrency, getCurrentSymbol } from '../../utils/currency';
import { showSuccess, showError, confirmAction } from '../../utils/sweetAlert';
import PaymentDrawer from '../../components/common/PaymentDrawer';
import Drawer from '../../components/common/Drawer';
import { INDIAN_STATES, getStateCodeByName } from '../../utils/indianStates';

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
  const [customerStats, setCustomerStats] = useState({ totalCustomers: 0, totalReceivable: 0, totalCollected: 0 });
  const [topSellingCustomers, setTopSellingCustomers] = useState([]);
  const [topSellingLoading, setTopSellingLoading] = useState(false);
  const [dueTotals, setDueTotals] = useState({ totalDueAmount: 0, totalOutstanding: 0, totalCustomers: 0 });
  const [limit] = useState(10);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [detailTab, setDetailTab] = useState('purchases');
  const [expandedRows, setExpandedRows] = useState({});

  // --- Add Customer States ---
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newState, setNewState] = useState('');
  const [newStateSearch, setNewStateSearch] = useState('');
  const [newStateDropdownOpen, setNewStateDropdownOpen] = useState(false);
  const [newSaving, setNewSaving] = useState(false);
  const newStateSearchRef = useRef(null);

  // --- Edit Customer States ---
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editState, setEditState] = useState('');
  const [editStateSearch, setEditStateSearch] = useState('');
  const [editStateDropdownOpen, setEditStateDropdownOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const stateSearchRef = useRef(null);

  // --- Edit History States ---
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [editHistory, setEditHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // --- Fetch Customer Stats (summary cards) ---
  const fetchCustomerStats = useCallback(async () => {
    try {
      const { data } = await customerService.getCustomerStats();
      if (data.data) {
        setCustomerStats(data.data);
      }
    } catch (error) {
      // Stats are non-critical - silently fail
    }
  }, []);

  useEffect(() => {
    fetchCustomerStats();
  }, [fetchCustomerStats]);

  // --- Fetch Top Selling Customers ---
  const fetchTopSellingCustomers = useCallback(async () => {
    setTopSellingLoading(true);
    try {
      const { data } = await customerService.getTopSellingCustomers({ limit: 5 });
      if (data.data) {
        setTopSellingCustomers(data.data);
      }
    } catch (error) {
      // Silently fail
    } finally {
      setTopSellingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopSellingCustomers();
  }, [fetchTopSellingCustomers]);

  const toggleRow = (tableKey, rowIdx) => {
    const key = `${tableKey}-${rowIdx}`;
    setExpandedRows(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const isRowExpanded = (tableKey, rowIdx) => {
    return !!expandedRows[`${tableKey}-${rowIdx}`];
  };

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

  // --- View Customer Detail ---
  const handleViewCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setDetailTab('purchases');
    setDetailLoading(true);
    try {
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

  const closeViewDrawer = () => {
    setSelectedCustomer(null);
    setCustomerDetail(null);
  };

  // --- View Edit History ---
  const handleViewHistory = async (customer) => {
    setHistoryCustomer(customer);
    setHistoryLoading(true);
    try {
      const identifier = customer._id || customer.customerRef;
      if (!identifier) {
        showError('Cannot load edit history - no customer ID available.');
        setHistoryLoading(false);
        return;
      }
      const { data } = await customerService.getCustomerEditHistory(identifier);
      if (data.data) {
        setEditHistory(data.data);
      }
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to load edit history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryDrawer = () => {
    setHistoryCustomer(null);
    setEditHistory([]);
  };

  // --- Edit Customer ---
  const handleAddCustomer = async () => {
    setAddCustomerOpen(true);
    setNewName('');
    setNewPhone('');
    setNewAddress('');
    setNewState('');
    setNewStateSearch('');
    setNewStateDropdownOpen(false);
    setNewSaving(false);

    // Pre-fill the Default Business State from the pharmacy profile (Settings → GST Configuration)
    try {
      const { data } = await pharmacyService.getMyPharmacyProfile();
      if (data?.data?.state) {
        const defaultState = data.data.state;
        setNewState(defaultState);
        setNewStateSearch(defaultState);
      }
    } catch (error) {
      // Silently fail — keep the State field empty if the profile cannot be loaded
    }
  };

  const closeAddCustomerDrawer = () => {
    setAddCustomerOpen(false);
  };

  const handleSaveNewCustomer = async () => {
    if (!newName.trim()) {
      showError('Customer name is required');
      return;
    }
    if (!newPhone.trim()) {
      showError('Phone number is required');
      return;
    }
    if (!newState) {
      showError('Please select a state');
      return;
    }
    setNewSaving(true);
    try {
      await customerService.createCustomer({
        name: newName.trim(),
        phone: newPhone.trim(),
        address: newAddress.trim(),
        state: newState,
        stateCode: getStateCodeByName(newState),
      });
      showSuccess('Customer added successfully');
      setAddCustomerOpen(false);
      fetchCustomers();
      fetchCustomerStats();
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to add customer');
    } finally {
      setNewSaving(false);
    }
  };

  // Close add state dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (newStateSearchRef.current && !newStateSearchRef.current.contains(event.target)) {
        setNewStateDropdownOpen(false);
      }
    };
    if (newStateDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [newStateDropdownOpen]);

  const filteredNewStates = INDIAN_STATES.filter(s =>
    s.name.toLowerCase().includes(newStateSearch.toLowerCase())
  );

  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setEditName(customer.customerName || '');
    setEditPhone(customer.customerPhone || '');
    const stateName = customer.state || '';
    setEditState(stateName);
    setEditStateSearch(stateName);
  };

  const closeEditDrawer = () => {
    setEditingCustomer(null);
  };

  const handleSaveCustomer = async () => {
    if (!editName.trim()) {
      showError('Customer name is required');
      return;
    }
    setEditSaving(true);
    try {
      await customerService.updateCustomer(editingCustomer._id, { name: editName.trim(), phone: editPhone.trim(), state: editState, stateCode: getStateCodeByName(editState) });
      showSuccess('Customer updated successfully');
      setEditingCustomer(null);
      fetchCustomers();
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to update customer');
    } finally {
      setEditSaving(false);
    }
  };

  // Close state dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (stateSearchRef.current && !stateSearchRef.current.contains(event.target)) {
        setEditStateDropdownOpen(false);
      }
    };
    if (editStateDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editStateDropdownOpen]);

  const filteredStates = INDIAN_STATES.filter(s =>
    s.name.toLowerCase().includes(editStateSearch.toLowerCase())
  );

  const totalPages = Math.ceil(total / limit);
  const dueTotalPages = Math.ceil(dueTotal / limit);

  // --- Render Mobile Expandable Row ---
  const renderExpandableRow = (item, idx, tableKey, isExpanded, onToggle, mainCols, detailRows) => {
    return (
      <tbody key={idx}>
        <tr className="customer-mobile-row" onClick={onToggle}>
          {mainCols.map((col, ci) => (
            <td key={ci} className={col.className || ''} style={col.style || {}}>
              {col.render(item)}
            </td>
          ))}
          <td className="customer-expand-cell">
            <button className="customer-expand-btn">
              <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
            </button>
          </td>
        </tr>
        <tr className={`customer-detail-row ${isExpanded ? 'customer-detail-row-open' : ''}`}>
          <td colSpan={mainCols.length + 1} className="customer-detail-cell">
            <div className="customer-detail-inner">
              {detailRows.map((detail, di) => (
                <div key={di} className="customer-detail-item">
                  <span className="customer-detail-label">{detail.label}</span>
                  <span className="customer-detail-value" style={detail.style || {}}>
                    {detail.render(item)}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      </tbody>
    );
  };

  // --- Render Payment Mobile Expandable Row (same pattern but different CSS classes) ---
  const renderPaymentExpandableRow = (item, idx, isExpanded, onToggle, mainCols, detailRows) => {
    return (
      <tbody key={idx}>
        <tr className="customer-payment-mobile-row" onClick={onToggle}>
          {mainCols.map((col, ci) => (
            <td key={ci} className={col.className || ''} style={col.style || {}}>
              {col.render(item)}
            </td>
          ))}
          <td className="customer-payment-expand-cell">
            <button className="customer-payment-expand-btn">
              <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
            </button>
          </td>
        </tr>
        <tr className={`customer-payment-detail-row ${isExpanded ? 'customer-payment-detail-row-open' : ''}`}>
          <td colSpan={mainCols.length + 1} className="customer-payment-detail-cell">
            <div className="customer-payment-detail-inner">
              {detailRows.map((detail, di) => (
                <div key={di} className="customer-payment-detail-item">
                  <span className="customer-payment-detail-label">{detail.label}</span>
                  <span className="customer-payment-detail-value" style={detail.style || {}}>
                    {detail.render(item)}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      </tbody>
    );
  };

  // --- Render All Customers Tab ---
  const renderAllCustomers = () => (
    <div>
      {/* Summary Cards - compact style like due customer cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '14px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: 500 }}>Total Customers</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>{customerStats.totalCustomers}</div>
        </div>
        <div style={{ background: '#fff7ed', borderRadius: '10px', padding: '14px', border: '1px solid #fed7aa' }}>
          <div style={{ fontSize: '12px', color: '#9a3412', fontWeight: 500 }}>Total Receivable</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#c2410c', marginTop: '4px' }}><CurrencyDisplay value={customerStats.totalReceivable} /></div>
        </div>
        <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '14px', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '12px', color: '#166534', fontWeight: 500 }}>Total Collected</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}><CurrencyDisplay value={customerStats.totalCollected} /></div>
        </div>
      </div>

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
            <>
              {/* Desktop table */}
              <div className="customer-desktop-table">
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
                        <th>View</th>
                        <th>Edit</th>
                        <th>History</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((customer, idx) => (
                        <tr key={customer._id || idx}>
                          <td>{(page - 1) * limit + idx + 1}</td>
                          <td style={{ fontWeight: 500 }}>{customer.customerName}</td>
                          <td>{customer.customerPhone || '-'}</td>
                          <td>{customer.totalPurchases}</td>
                          <td style={{ fontWeight: 600 }}><CurrencyDisplay value={customer.totalSpent} /></td>
                          <td>{customer.lastPurchaseDate ? new Date(customer.lastPurchaseDate).toLocaleDateString() : '-'}</td>
                          <td>
                            <button className="btn btn-info btn-sm" onClick={() => handleViewCustomer(customer)} title="View Details">
                              <i className="fa-solid fa-eye"></i> View
                            </button>
                          </td>
                          <td>
                            <button className="btn btn-warning btn-sm" onClick={() => handleEditCustomer(customer)} title="Edit Customer">
                              <i className="fa-solid fa-edit"></i> Edit
                            </button>
                          </td>
                          <td>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleViewHistory(customer)} title="Edit History">
                              <i className="fa-solid fa-history"></i> History
                            </button>
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
                      <th>Customer Name</th>
                      <th>Total Spent</th>
                      <th className="customer-expand-th"></th>
                    </tr>
                  </thead>
                  {customers.map((customer, idx) => {
                    const expanded = isRowExpanded('all', idx);
                    const mainCols = [
                      { render: (c) => <span style={{ fontWeight: 500, fontSize: '13px' }}>{c.customerName}</span> },
                      { render: (c) => <CurrencyDisplay value={c.totalSpent} style={{ fontWeight: 600, color: 'var(--primary)' }} /> },
                    ];
                    const detailRows = [
                      { label: 'Phone', render: (c) => c.customerPhone || '-' },
                      { label: 'Total Purchases', render: (c) => c.totalPurchases },
                      { label: 'Last Purchase', render: (c) => c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString() : '-' },
                      {
                        label: 'Actions', render: (c) => (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button className="btn btn-info btn-sm" onClick={(e) => { e.stopPropagation(); handleViewCustomer(c); }} title="View Details">
                              <i className="fa-solid fa-eye"></i>
                            </button>
                            <button className="btn btn-warning btn-sm" onClick={(e) => { e.stopPropagation(); handleEditCustomer(c); }} title="Edit Customer">
                              <i className="fa-solid fa-edit"></i>
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleViewHistory(c); }} title="Edit History">
                              <i className="fa-solid fa-history"></i>
                            </button>
                          </div>
                        )
                      },
                    ];
                    return renderExpandableRow(customer, idx, 'all', expanded, () => toggleRow('all', idx), mainCols, detailRows);
                  })}
                </table>
              </div>
            </>
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
    </div>
  );

  // --- Render Top Selling Tab ---
  const renderTopSelling = () => (
    <div className="card">
      <div className="card-header">
        <h5><i className="fa-solid fa-trophy" style={{ color: '#f59e0b' }}></i> Top Selling Customers</h5>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {topSellingLoading ? (
          <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
        ) : topSellingCustomers.length === 0 ? (
          <div className="empty-state">
            <i className="fa-solid fa-users" style={{ fontSize: '48px', color: 'var(--gray-300)' }}></i>
            <h4>No Data Available</h4>
            <p>Customer sales data will appear here as purchases are made.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>Purchases</th>
                  <th>Total Amount</th>
                  <th>Total Paid</th>
                  <th>Total Due</th>
                </tr>
              </thead>
              <tbody>
                {topSellingCustomers.map((customer, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700, color: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#cd7f32' : 'inherit' }}>
                      {idx === 0 ? <i className="fa-solid fa-crown" style={{ color: '#f59e0b' }}></i> : idx + 1}
                    </td>
                    <td style={{ fontWeight: 500 }}>{customer.customerName}</td>
                    <td>{customer.customerPhone || '-'}</td>
                    <td>{customer.totalPurchases}</td>
                    <td style={{ fontWeight: 600 }}><CurrencyDisplay value={customer.totalAmount} /></td>
                    <td style={{ fontWeight: 600, color: '#16a34a' }}><CurrencyDisplay value={customer.totalPaid} /></td>
                    <td style={{ fontWeight: 700, color: customer.totalDue > 0 ? '#dc2626' : '#16a34a' }}><CurrencyDisplay value={customer.totalDue} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            placeholder="Search by name or phone..."
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
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#c2410c', marginTop: '4px' }}><CurrencyDisplay value={dueTotals.totalDueAmount} decimals={2} /></div>
          </div>
          <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '14px', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '12px', color: '#166534', fontWeight: 500 }}>Total Outstanding</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}><CurrencyDisplay value={dueTotals.totalOutstanding} decimals={2} /></div>
          </div>
          <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '14px', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: 500 }}>Customers with Due</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}><AnimatedCounter value={dueTotals.totalCustomers} /></div>
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
          <>
            {/* Desktop table */}
            <div className="customer-desktop-table">
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
                      <th>View</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueCustomers.map((customer, idx) => (
                      <tr key={idx}>
                        <td>{(duePage - 1) * limit + idx + 1}</td>
                        <td style={{ fontWeight: 500 }}>{customer.customerName}</td>
                        <td>{customer.customerPhone || '-'}</td>
                        <td>{customer.totalPurchases}</td>
                        <td style={{ fontWeight: 600, color: '#16a34a' }}><CurrencyDisplay value={customer.totalPaid} /></td>
                        <td style={{ fontWeight: 700, color: customer.totalDue > 0 ? '#dc2626' : '#16a34a' }}>
                          <CurrencyDisplay value={customer.totalDue} />
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
                            <i className="fa-solid fa-money-bill-wave"></i> Payment
                          </button>
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
                    <th>Customer Name</th>
                    <th>Total Due</th>
                    <th className="customer-expand-th"></th>
                  </tr>
                </thead>
                {dueCustomers.map((customer, idx) => {
                  const expanded = isRowExpanded('due', idx);
                  const mainCols = [
                    { render: (c) => <span style={{ fontWeight: 500, fontSize: '13px' }}>{c.customerName}</span> },
                    {
                      render: (c) => (
                        <span style={{ fontWeight: 700, color: c.totalDue > 0 ? '#dc2626' : '#16a34a' }}>
                          <CurrencyDisplay value={c.totalDue} />
                        </span>
                      )
                    },
                  ];
                  const detailRows = [
                    { label: 'Phone', render: (c) => c.customerPhone || '-' },
                    { label: 'Total Sales', render: (c) => c.totalPurchases },
                    { label: 'Total Paid', render: (c) => <CurrencyDisplay value={c.totalPaid} style={{ fontWeight: 600, color: '#16a34a' }} /> },
                    { label: 'Last Purchase', render: (c) => c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString() : '-' },
                    {
                      label: 'Actions', render: (c) => (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button className="btn btn-info btn-sm" onClick={(e) => { e.stopPropagation(); handleViewCustomer(c); }} title="View Details">
                            <i className="fa-solid fa-eye"></i>
                          </button>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={(e) => { e.stopPropagation(); setPaymentCustomer(c); setPaymentDrawerOpen(true); }}
                            disabled={c.totalDue <= 0}
                            title="Collect Payment"
                          >
                            <i className="fa-solid fa-money-bill-wave"></i>
                          </button>
                        </div>
                      )
                    },
                  ];
                  return renderExpandableRow(customer, idx, 'due', expanded, () => toggleRow('due', idx), mainCols, detailRows);
                })}
              </table>
            </div>
          </>
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
      <div className="page-header page-header-inline-mobile">
        <div>
          <h2><i className="fa-solid fa-users"></i> Customers</h2>
          <p>Manage your pharmacy customers</p>
        </div>
        <div className="btn-group-grid">
          <button
            className="btn btn-primary add-customer-btn"
            onClick={handleAddCustomer}
            title="Add Customer"
            style={{
              borderRadius: '10px',
              padding: '10px 20px',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(14, 165, 233, 0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            <i className="fa-solid fa-user-plus"></i>
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      <div className="customer-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid var(--gray-200)', paddingBottom: '8px' }}>
        <button
          className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ border: 'none', borderRadius: '8px 8px 0 0', fontSize: '13px' }}
          onClick={() => { setActiveTab('all'); setSearch(''); setPage(1); }}
        >
          <i className="fa-solid fa-users"></i> All Customers
        </button>
        <button
          className={`btn ${activeTab === 'top-selling' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ border: 'none', borderRadius: '8px 8px 0 0', fontSize: '13px' }}
          onClick={() => { setActiveTab('top-selling'); }}
        >
          <i className="fa-solid fa-trophy" style={{ color: '#f59e0b' }}></i> Top Selling
        </button>
        <button
          className={`btn ${activeTab === 'due' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ border: 'none', borderRadius: '8px 8px 0 0', fontSize: '13px' }}
          onClick={() => { setActiveTab('due'); setDueSearch(''); setDuePage(1); }}
        >
          <i className="fa-solid fa-exclamation-triangle"></i> Due Customers
        </button>
      </div>

      {activeTab === 'all' && renderAllCustomers()}
      {activeTab === 'top-selling' && renderTopSelling()}
      {activeTab === 'due' && renderDueCustomers()}

      {/* Enhanced Customer Detail Drawer */}
      <Drawer
        isOpen={!!selectedCustomer}
        onClose={closeViewDrawer}
        title={
          <span>
            <i className="fa-solid fa-user"></i> {selectedCustomer?.customerName || 'Customer Details'}
          </span>
        }
        width="1100px"
        className="customer-detail-drawer"
      >
        {detailLoading ? (
          <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
        ) : customerDetail ? (
          <>
            <div className="card" style={{ marginBottom: '16px', borderLeft: '4px solid var(--primary)', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' }}>
              <div className="card-body">
                <div className="customer-detail-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</label>
                    <div style={{ fontWeight: 600, fontSize: '16px', marginTop: '2px', color: '#0f172a' }}>{customerDetail.customer?.customerName}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</label>
                    <div style={{ fontWeight: 500, marginTop: '2px' }}>{customerDetail.customer?.customerPhone || '-'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Address</label>
                    <div style={{ fontWeight: 500, marginTop: '2px', fontSize: '13px' }}>{customerDetail.customer?.customerAddress || '-'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        const customerId = customerDetail.customer?._id || selectedCustomer?._id || selectedCustomer?.customerRef;
                        if (customerId) {
                          window.location.href = `/customers/${customerId}/ledger`;
                        }
                      }}
                      title="View Full Ledger"
                      style={{ borderRadius: '8px', whiteSpace: 'nowrap' }}
                    >
                      <i className="fa-solid fa-book"></i> Ledger
                    </button>
                  </div>
                </div>
                <div className="customer-detail-stats-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '12px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Purchases</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}>{customerDetail.customer?.totalPurchases || 0}</div>
                  </div>
                  <div style={{ background: '#eff6ff', borderRadius: '10px', padding: '12px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Paid</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
                      <CurrencyDisplay value={customerDetail.customer?.totalPaid || 0} />
                    </div>
                  </div>
                  <div style={{ background: Number(customerDetail.customer?.totalDue || 0) > 0 ? '#fff7ed' : '#f0fdf4', borderRadius: '10px', padding: '12px', border: `1px solid ${Number(customerDetail.customer?.totalDue || 0) > 0 ? '#fed7aa' : '#bbf7d0'}`, textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: Number(customerDetail.customer?.totalDue || 0) > 0 ? '#9a3412' : '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Due</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: Number(customerDetail.customer?.totalDue || 0) > 0 ? '#c2410c' : '#16a34a', marginTop: '4px' }}>
                      <CurrencyDisplay value={customerDetail.customer?.totalDue || 0} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="customer-detail-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '12px', borderBottom: '2px solid var(--gray-200)', paddingBottom: '8px' }}>
              <button className={`btn btn-sm ${detailTab === 'purchases' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDetailTab('purchases')} style={{ borderRadius: '6px' }}>
                <i className="fa-solid fa-receipt"></i> Purchase History {customerDetail.total > 0 && <span style={{ marginLeft: '4px', fontSize: '11px' }}>({customerDetail.total})</span>}
              </button>
              <button className={`btn btn-sm ${detailTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDetailTab('payments')} style={{ borderRadius: '6px' }}>
                <i className="fa-solid fa-credit-card"></i> Payment History {customerDetail.paymentHistory?.length > 0 && <span style={{ marginLeft: '4px', fontSize: '11px' }}>({customerDetail.paymentHistory.length})</span>}
              </button>
            </div>
            {detailTab === 'purchases' && (
              <>
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
                          <div className="customer-detail-invoice-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: '14px' }}>{sale.invoiceNumber}</span>
                              <span style={{ fontSize: '12px', color: '#888', marginLeft: '8px' }}>
                                {new Date(sale.saleDate).toLocaleDateString()}
                              </span>
                            </div>
                            <span className={`badge ${sale.paymentStatus === 'paid' ? 'badge-success' : sale.paymentStatus === 'partial' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '10px' }}>
                              {sale.paymentStatus}
                            </span>
                          </div>

                          {/* Medicine Items */}
                          {sale.items && sale.items.length > 0 && (
                            <div className="customer-detail-invoice-items" style={{ marginBottom: '8px', padding: '6px 10px', background: '#f9fafb', borderRadius: '6px' }}>
                              <div style={{ fontSize: '11px', color: '#888', fontWeight: 600, marginBottom: '4px' }}>MEDICINES</div>
                              <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
                                {sale.items.map((item, i) => (
                                  <span key={i}>
                                    {i > 0 && ', '}
                                    <strong>{item.medicineName}</strong> × {item.quantity}
                                    {item.sellingPrice ? ` (${formatCurrency(item.sellingPrice)}/pc)` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Payment Summary */}
                          <div className="customer-detail-invoice-summary" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '12px', padding: '6px 10px', background: sale.dueAmount > 0 ? '#fff7ed' : '#f0fdf4', borderRadius: '6px' }}>
                            <div>
                              <span style={{ color: '#888' }}>Amount: </span>
                              <span style={{ fontWeight: 600 }}><CurrencyDisplay value={sale.grandTotal} /></span>
                            </div>
                            <div>
                              <span style={{ color: '#888' }}>Paid: </span>
                              <span style={{ fontWeight: 600, color: '#16a34a' }}><CurrencyDisplay value={sale.paidAmount} /></span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ color: '#888' }}>Due: </span>
                              <span style={{ fontWeight: 700, color: sale.dueAmount > 0 ? '#dc2626' : '#16a34a' }}>
                                {sale.dueAmount > 0 ? <CurrencyDisplay value={sale.dueAmount} /> : 'Cleared'}
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
            )}
            {detailTab === 'payments' && (
              <>
                {customerDetail.paymentHistory && customerDetail.paymentHistory.length > 0 ? (
                  <>
                    {/* Desktop table */}
                    <div className="customer-payment-desktop-table">
                      <div className="table-container">
                        <table>
                          <thead><tr><th>#</th><th>Date & Time</th><th>Invoice</th><th>Amount</th><th>Method</th><th>Remaining Due</th><th>Collected By</th></tr></thead>
                          <tbody>
                            {customerDetail.paymentHistory.map((payment, idx) => (
                              <tr key={payment._id}>
                                <td>{idx + 1}</td>
                                <td>{new Date(payment.paymentDate || payment.createdAt).toLocaleString()}</td>
                                <td style={{ fontWeight: 500 }}>{payment.sale?.invoiceNumber || '-'}</td>
                                <td style={{ fontWeight: 600, color: '#16a34a' }}><CurrencyDisplay value={payment.amount} /></td>
                                <td><span className={`badge ${payment.paymentMethod === 'cash' ? 'badge-success' : payment.paymentMethod === 'card' ? 'badge-info' : payment.paymentMethod === 'upi' ? 'badge-primary' : 'badge-warning'}`}>{payment.paymentMethod ? payment.paymentMethod.replace('_', ' ') : 'Cash'}</span></td>
                                <td style={{ fontWeight: 600, color: Number(payment.remainingDue) > 0 ? '#dc2626' : '#16a34a' }}><CurrencyDisplay value={payment.remainingDue} /></td>
                                <td>{payment.createdBy?.name || 'Unknown'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Mobile expandable rows */}
                    <div className="customer-payment-mobile-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Date & Time</th>
                            <th>Amount</th>
                            <th className="customer-payment-expand-th"></th>
                          </tr>
                        </thead>
                        {customerDetail.paymentHistory.map((payment, idx) => {
                          const expanded = isRowExpanded('pay', idx);
                          const mainCols = [
                            { render: (p) => <span style={{ fontSize: '12px' }}>{new Date(p.paymentDate || p.createdAt).toLocaleString()}</span> },
                            { render: (p) => <CurrencyDisplay value={p.amount} style={{ fontWeight: 600, color: '#16a34a' }} /> },
                          ];
                          const detailRows = [
                            { label: 'Invoice', render: (p) => p.sale?.invoiceNumber || '-' },
                            {
                              label: 'Method', render: (p) => (
                                <span className={`badge ${p.paymentMethod === 'cash' ? 'badge-success' : p.paymentMethod === 'card' ? 'badge-info' : p.paymentMethod === 'upi' ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: '11px' }}>
                                  {p.paymentMethod ? p.paymentMethod.replace('_', ' ') : 'Cash'}
                                </span>
                              )
                            },
                            {
                              label: 'Remaining Due', render: (p) => (
                                <span style={{ fontWeight: 600, color: Number(p.remainingDue) > 0 ? '#dc2626' : '#16a34a' }}>
                                  <CurrencyDisplay value={p.remainingDue} />
                                </span>
                              )
                            },
                            { label: 'Collected By', render: (p) => p.createdBy?.name || 'Unknown' },
                          ];
                          return renderPaymentExpandableRow(payment, `pay-${idx}`, expanded, () => toggleRow('pay', idx), mainCols, detailRows);
                        })}
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="empty-state" style={{ padding: '20px' }}><i className="fa-solid fa-credit-card" style={{ fontSize: '36px', color: 'var(--gray-300)' }}></i><p>No payment history available.</p></div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="empty-state"><p>Failed to load details</p></div>
        )}
      </Drawer>

      {/* Add Customer Drawer */}
      <Drawer
        isOpen={addCustomerOpen}
        onClose={closeAddCustomerDrawer}
        title={<span><i className="fa-solid fa-user-plus"></i> Add Customer</span>}
        className="edit-customer-drawer"
        footer={
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={closeAddCustomerDrawer}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveNewCustomer} disabled={newSaving}>
              {newSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-check"></i>} Add Customer
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label>Customer Name <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input type="text" className="form-select" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: '100%' }} placeholder="Enter customer name" />
        </div>
        <div className="form-group" style={{ marginTop: '12px' }}>
          <label>Phone Number <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input type="text" className="form-select" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={{ width: '100%' }} placeholder="Enter mobile number" />
        </div>
        <div className="form-group" style={{ marginTop: '12px' }}>
          <label>Address</label>
          <input type="text" className="form-select" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} style={{ width: '100%' }} placeholder="Enter customer address" />
        </div>
        <div className="form-group" style={{ marginTop: '12px' }}>
          <label>State <span style={{ color: 'var(--danger)' }}>*</span></label>
          <div style={{ position: 'relative' }} ref={newStateSearchRef}>
            <input
              type="text"
              className="form-select"
              value={newStateSearch}
              onChange={(e) => {
                setNewStateSearch(e.target.value);
                setNewState('');
                setNewStateDropdownOpen(true);
              }}
              onFocus={() => setNewStateDropdownOpen(true)}
              style={{ width: '100%' }}
              placeholder="Search state..."
            />
            {newStateDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#fff',
                border: '1px solid var(--gray-200)',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                zIndex: 100,
                maxHeight: '220px',
                overflowY: 'auto',
                marginTop: '4px',
              }}>
                {filteredNewStates.length > 0 ? (
                  filteredNewStates.map(state => (
                    <div
                      key={state.code}
                      onClick={() => {
                        setNewState(state.name);
                        setNewStateSearch(state.name);
                        setNewStateDropdownOpen(false);
                      }}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--gray-100)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: newState === state.name ? 'var(--primary-light)' : '#fff',
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--gray-50)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = newState === state.name ? 'var(--primary-light)' : '#fff'}
                    >
                      <span style={{ fontWeight: 500, fontSize: '13px' }}>{state.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Code: {state.code}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '12px 14px', color: '#888', fontSize: '13px', textAlign: 'center' }}>
                    No states found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {/* Edit Customer Drawer */}
      <Drawer
        isOpen={!!editingCustomer}
        onClose={closeEditDrawer}
        title={<span><i className="fa-solid fa-edit"></i> Edit Customer</span>}
        className="edit-customer-drawer"
        footer={
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={closeEditDrawer}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveCustomer} disabled={editSaving}>
              {editSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : null} Save Changes
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label>Customer Name <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input type="text" className="form-select" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%' }} placeholder="Enter customer name" />
        </div>
        <div className="form-group" style={{ marginTop: '12px' }}>
          <label>Phone Number <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input type="text" className="form-select" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={{ width: '100%' }} placeholder="Enter mobile number" />
        </div>
        <div className="form-group" style={{ marginTop: '12px' }}>
          <label>State <span style={{ color: 'var(--danger)' }}>*</span></label>
          <div style={{ position: 'relative' }} ref={stateSearchRef}>
            <input
              type="text"
              className="form-select"
              value={editStateSearch}
              onChange={(e) => {
                setEditStateSearch(e.target.value);
                setEditState('');
                setEditStateDropdownOpen(true);
              }}
              onFocus={() => setEditStateDropdownOpen(true)}
              style={{ width: '100%' }}
              placeholder="Search state..."
            />
            {editStateDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#fff',
                border: '1px solid var(--gray-200)',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                zIndex: 100,
                maxHeight: '220px',
                overflowY: 'auto',
                marginTop: '4px',
              }}>
                {filteredStates.length > 0 ? (
                  filteredStates.map(state => (
                    <div
                      key={state.code}
                      onClick={() => {
                        setEditState(state.name);
                        setEditStateSearch(state.name);
                        setEditStateDropdownOpen(false);
                      }}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--gray-100)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: editState === state.name ? 'var(--primary-light)' : '#fff',
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--gray-50)'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = editState === state.name ? 'var(--primary-light)' : '#fff'}
                    >
                      <span style={{ fontWeight: 500, fontSize: '13px' }}>{state.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Code: {state.code}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '12px 14px', color: '#888', fontSize: '13px', textAlign: 'center' }}>
                    No states found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {/* Payment Drawer */}
      <div className="payment-drawer-wrapper">
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

      {/* Edit History Drawer */}
      <Drawer
        isOpen={!!historyCustomer}
        onClose={closeHistoryDrawer}
        title={
          <span>
            <i className="fa-solid fa-history"></i> Edit History - {historyCustomer?.customerName || ''}
          </span>
        }
        className="edit-history-drawer"
      >
        {historyLoading ? (
          <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>
        ) : editHistory.length === 0 ? (
          <div className="empty-state">
            <i className="fa-solid fa-history" style={{ fontSize: '48px', color: 'var(--gray-300)' }}></i>
            <h4>No Edit History</h4>
            <p>This customer has not been edited yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {editHistory.map((record, idx) => (
              <div key={record._id || idx} className="card edit-history-card" style={{
                margin: 0,
                border: '1px solid var(--gray-200)',
                borderLeft: '4px solid #f59e0b',
              }}>
                <div className="card-body" style={{ padding: '14px' }}>
                  <div className="edit-history-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12px', color: '#888' }}>
                    <span>
                      <i className="fa-solid fa-user-edit"></i> Edited by <strong>{record.editedByName || 'Unknown'}</strong>
                    </span>
                    <span>{new Date(record.createdAt).toLocaleString()}</span>
                  </div>

                  {/* Change details */}
                  {record.changes && record.changes.length > 0 && (
                    <div className="edit-history-changes" style={{ background: '#fffbeb', borderRadius: '6px', padding: '10px', border: '1px solid #fde68a' }}>
                      {record.changes.map((change, ci) => (
                        <div key={ci} className="change-row" style={{ marginBottom: ci < record.changes.length - 1 ? '8px' : 0, fontSize: '13px' }}>
                          <div style={{ fontWeight: 600, color: '#92400e', marginBottom: '2px' }}>
                            <i className="fa-solid fa-pen"></i> {change.label || change.field}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            <span style={{ background: '#fef2f2', color: '#991b1b', padding: '2px 8px', borderRadius: '4px', textDecoration: 'line-through', fontSize: '12px' }}>
                              {change.previousValue || '(empty)'}
                            </span>
                            <i className="fa-solid fa-arrow-right" style={{ color: '#d97706', fontSize: '12px' }}></i>
                            <span style={{ background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                              {change.newValue || '(empty)'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}