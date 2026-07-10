import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchService } from '../../services/searchService';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const debounceTimer = useRef(null);

  const handleSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 1) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await searchService.globalSearch(q);
      if (data.data) {
        setResults(data.data);
        setIsOpen(true);
        setActiveIndex(-1);
      }
    } catch (error) {
      // Silently fail
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const onInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!results || !isOpen) return;

    const allItems = getAllItems();
    if (allItems.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % allItems.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + allItems.length) % allItems.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < allItems.length) {
          allItems[activeIndex].onClick();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const getAllItems = () => {
    if (!results) return [];
    const items = [];
    const sections = [
      { key: 'medicines', label: 'Medicines', icon: 'fa-solid fa-pills' },
      { key: 'customers', label: 'Customers', icon: 'fa-solid fa-users' },
      { key: 'suppliers', label: 'Suppliers', icon: 'fa-solid fa-truck' },
      { key: 'sales', label: 'Sales', icon: 'fa-solid fa-cash-register' },
      { key: 'purchases', label: 'Purchases', icon: 'fa-solid fa-cart-plus' },
    ];

    sections.forEach(section => {
      const sectionItems = results[section.key] || [];
      sectionItems.forEach(item => {
        items.push({
          ...item,
          sectionLabel: section.label,
          sectionIcon: section.icon,
          onClick: () => {
            setIsOpen(false);
            setQuery('');
            if (item.link) {
              navigate(item.link);
            }
          },
        });
      });
    });

    return items;
  };

  const getTotalCount = () => {
    if (!results) return 0;
    return Object.values(results).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  };

  const renderSection = (key, label, icon, items) => {
    if (!items || items.length === 0) return null;

    let globalIdx = 0;
    // Calculate starting index for this section
    const sections = ['medicines', 'customers', 'suppliers', 'sales', 'purchases'];
    for (const s of sections) {
      if (s === key) break;
      globalIdx += (results?.[s]?.length || 0);
    }

    return (
      <div key={key} className="global-search-section">
        <div className="global-search-section-header">
          <i className={icon} style={{ fontSize: '12px' }}></i>
          <span>{label}</span>
          <span className="global-search-count">{items.length}</span>
        </div>
        {items.map((item, idx) => {
          const itemIndex = globalIdx + idx;
          return (
            <div
              key={item._id || idx}
              className={`global-search-item ${activeIndex === itemIndex ? 'global-search-item-active' : ''}`}
              onClick={() => {
                setIsOpen(false);
                setQuery('');
                if (item.link) {
                  navigate(item.link);
                }
              }}
              onMouseEnter={() => setActiveIndex(itemIndex)}
            >
              <div className="global-search-item-icon">
                {key === 'medicines' && <i className="fa-solid fa-pills"></i>}
                {key === 'customers' && <i className="fa-solid fa-user"></i>}
                {key === 'suppliers' && <i className="fa-solid fa-truck"></i>}
                {key === 'sales' && <i className="fa-solid fa-receipt"></i>}
                {key === 'purchases' && <i className="fa-solid fa-cart-shopping"></i>}
              </div>
              <div className="global-search-item-content">
                <div className="global-search-item-title">
                  {key === 'medicines' && (item.name || '')}
                  {key === 'customers' && (item.name || '')}
                  {key === 'suppliers' && (item.supplierName || '')}
                  {key === 'sales' && (item.invoiceNumber || '')}
                  {key === 'purchases' && (item.invoiceNumber || '')}
                </div>
                <div className="global-search-item-subtitle">
                  {key === 'medicines' && (
                    <span>
                      {item.genericName && <span>{item.genericName}</span>}
                      {item.brandName && <span> • {item.brandName}</span>}
                      {item.currentStock !== undefined && <span> • Stock: {item.currentStock}</span>}
                    </span>
                  )}
                  {key === 'customers' && (
                    <span>
                      {item.phone && <span>{item.phone}</span>}
                      {item.totalSpent !== undefined && <span> • Spent: ₹{Number(item.totalSpent).toFixed(2)}</span>}
                    </span>
                  )}
                  {key === 'suppliers' && (
                    <span>
                      {item.companyName && <span>{item.companyName}</span>}
                      {item.phone && <span> • {item.phone}</span>}
                    </span>
                  )}
                  {key === 'sales' && (
                    <span>
                      {item.customerName && <span>{item.customerName}</span>}
                      {item.grandTotal !== undefined && <span> • ₹{Number(item.grandTotal).toFixed(2)}</span>}
                      {item.paymentStatus && (
                        <span className={`badge ${item.paymentStatus === 'paid' ? 'badge-success' : item.paymentStatus === 'partial' ? 'badge-warning' : 'badge-danger'}`} style={{ marginLeft: '6px', fontSize: '9px' }}>
                          {item.paymentStatus}
                        </span>
                      )}
                    </span>
                  )}
                  {key === 'purchases' && (
                    <span>
                      {item.supplierName && <span>{item.supplierName}</span>}
                      {item.grandTotal !== undefined && <span> • ₹{Number(item.grandTotal).toFixed(2)}</span>}
                    </span>
                  )}
                </div>
              </div>
              <div className="global-search-item-arrow">
                <i className="fa-solid fa-arrow-right" style={{ fontSize: '11px', color: '#bbb' }}></i>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="global-search-container" ref={dropdownRef}>
      <div className={`global-search-input-wrapper ${isOpen && query ? 'global-search-input-focused' : ''}`}>
        <i className="fa-solid fa-search global-search-input-icon"></i>
        <input
          ref={inputRef}
          type="text"
          className="global-search-input"
          placeholder="Search medicines, customers, invoices..."
          value={query}
          onChange={onInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results && getTotalCount() > 0) setIsOpen(true); }}
        />
        {loading && (
          <i className="fa-solid fa-spinner fa-spin global-search-spinner"></i>
        )}
        {query && !loading && (
          <button className="global-search-clear" onClick={() => { setQuery(''); setResults(null); setIsOpen(false); inputRef.current?.focus(); }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>

      {isOpen && results && getTotalCount() > 0 && (
        <div className="global-search-dropdown">
          {renderSection('medicines', 'Medicines', 'fa-solid fa-pills', results.medicines)}
          {renderSection('customers', 'Customers', 'fa-solid fa-users', results.customers)}
          {renderSection('suppliers', 'Suppliers', 'fa-solid fa-truck', results.suppliers)}
          {renderSection('sales', 'Sales', 'fa-solid fa-cash-register', results.sales)}
          {renderSection('purchases', 'Purchases', 'fa-solid fa-cart-plus', results.purchases)}
        </div>
      )}

      {isOpen && query && !loading && getTotalCount() === 0 && (
        <div className="global-search-dropdown global-search-no-results">
          <div className="global-search-empty">
            <i className="fa-solid fa-search" style={{ fontSize: '24px', color: '#ccc', marginBottom: '8px' }}></i>
            <p>No results found for "{query}"</p>
          </div>
        </div>
      )}

      <style>{`
        .global-search-container {
          position: relative;
          flex: 1;
          max-width: 420px;
          min-width: 200px;
        }

        .global-search-input-wrapper {
          display: flex;
          align-items: center;
          background: var(--gray-100);
          border: 2px solid transparent;
          border-radius: 10px;
          padding: 0 12px;
          transition: all 0.2s ease;
        }

        .global-search-input-wrapper:hover {
          background: var(--gray-50);
          border-color: var(--gray-200);
        }

        .global-search-input-focused {
          background: #fff !important;
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }

        .global-search-input-icon {
          color: var(--gray-400);
          font-size: 14px;
          margin-right: 8px;
          flex-shrink: 0;
        }

        .global-search-input {
          border: none;
          background: transparent;
          padding: 8px 0;
          font-size: 13px;
          width: 100%;
          outline: none;
          color: var(--gray-700);
        }

        .global-search-input::placeholder {
          color: var(--gray-400);
        }

        .global-search-spinner {
          color: var(--primary);
          font-size: 14px;
          flex-shrink: 0;
        }

        .global-search-clear {
          background: none;
          border: none;
          color: var(--gray-400);
          cursor: pointer;
          padding: 4px;
          font-size: 14px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.15s;
        }

        .global-search-clear:hover {
          background: var(--gray-200);
          color: var(--gray-600);
        }

        .global-search-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(0, 0, 0, 0.06);
          border: 1px solid var(--gray-200);
          max-height: 480px;
          overflow-y: auto;
          z-index: 1000;
          animation: globalSearchFadeIn 0.15s ease;
        }

        @keyframes globalSearchFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .global-search-no-results {
          padding: 0;
        }

        .global-search-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          color: var(--gray-500);
          font-size: 13px;
        }

        .global-search-section {
          padding: 6px 0;
        }

        .global-search-section:not(:last-child) {
          border-bottom: 1px solid var(--gray-100);
        }

        .global-search-section-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          font-size: 11px;
          font-weight: 600;
          color: var(--gray-500);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .global-search-count {
          margin-left: auto;
          background: var(--gray-100);
          padding: 1px 6px;
          border-radius: 10px;
          font-size: 10px;
          color: var(--gray-500);
        }

        .global-search-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          cursor: pointer;
          transition: background 0.1s;
        }

        .global-search-item:hover,
        .global-search-item-active {
          background: var(--gray-50);
        }

        .global-search-item-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--gray-100);
          border-radius: 8px;
          color: var(--gray-500);
          font-size: 12px;
          flex-shrink: 0;
        }

        .global-search-item-content {
          flex: 1;
          min-width: 0;
        }

        .global-search-item-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--gray-800);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .global-search-item-subtitle {
          font-size: 11px;
          color: var(--gray-500);
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .global-search-item-arrow {
          flex-shrink: 0;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .global-search-item:hover .global-search-item-arrow,
        .global-search-item-active .global-search-item-arrow {
          opacity: 1;
        }

        /* Scrollbar styling */
        .global-search-dropdown::-webkit-scrollbar {
          width: 6px;
        }

        .global-search-dropdown::-webkit-scrollbar-track {
          background: transparent;
        }

        .global-search-dropdown::-webkit-scrollbar-thumb {
          background: var(--gray-300);
          border-radius: 3px;
        }

        .global-search-dropdown::-webkit-scrollbar-thumb:hover {
          background: var(--gray-400);
        }
      `}</style>
    </div>
  );
}