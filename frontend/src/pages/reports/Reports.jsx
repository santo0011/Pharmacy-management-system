import { useState, useEffect } from 'react';
import { reportService } from '../../services/reportService';
import { showError } from '../../utils/sweetAlert';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales');
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState(null);
  const [purchaseData, setPurchaseData] = useState(null);
  const [profitLossData, setProfitLossData] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [filters, setFilters] = useState({
    period: 'daily',
    startDate: '',
    endDate: '',
  });

  const fetchSalesReport = async () => {
    setLoading(true);
    try {
      const params = { period: filters.period };
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const { data } = await reportService.getSalesReport(params);
      setSalesData(data.data);
    } catch (error) {
      showError('Failed to load sales report');
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseReport = async () => {
    setLoading(true);
    try {
      const params = { period: filters.period };
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const { data } = await reportService.getPurchaseReport(params);
      setPurchaseData(data.data);
    } catch (error) {
      showError('Failed to load purchase report');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfitLoss = async () => {
    setLoading(true);
    try {
      const params = { period: filters.period };
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const { data } = await reportService.getProfitLoss(params);
      setProfitLossData(data.data);
    } catch (error) {
      showError('Failed to load profit & loss report');
    } finally {
      setLoading(false);
    }
  };

  const fetchStockReport = async () => {
    setLoading(true);
    try {
      const { data } = await reportService.getStockReport({ lowStock: filters.lowStockOnly ? 'true' : 'false' });
      setStockData(data.data);
    } catch (error) {
      showError('Failed to load stock report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sales') fetchSalesReport();
    else if (activeTab === 'purchases') fetchPurchaseReport();
    else if (activeTab === 'profit-loss') fetchProfitLoss();
    else if (activeTab === 'stock') fetchStockReport();
  }, [activeTab, filters.period, filters.lowStockOnly]);

  const tabs = [
    { id: 'sales', label: 'Sales Report', icon: 'fa-solid fa-chart-line' },
    { id: 'purchases', label: 'Purchase Report', icon: 'fa-solid fa-cart-plus' },
    { id: 'profit-loss', label: 'Profit & Loss', icon: 'fa-solid fa-coins' },
    { id: 'stock', label: 'Stock Report', icon: 'fa-solid fa-warehouse' },
  ];

  const renderSummaryCards = (summary) => {
    if (!summary) return null;
    const cards = [
      { label: 'Total Sales', value: summary.totalSales || 0, color: 'var(--primary)', icon: 'fa-solid fa-shopping-cart' },
      { label: 'Total Revenue', value: `₹${Number(summary.totalRevenue || 0).toFixed(2)}`, color: '#22c55e', icon: 'fa-solid fa-indian-rupee-sign' },
      { label: 'Total Discount', value: `₹${Number(summary.totalDiscount || 0).toFixed(2)}`, color: '#f59e0b', icon: 'fa-solid fa-tags' },
      { label: 'Total Tax', value: `₹${Number(summary.totalTax || 0).toFixed(2)}`, color: '#3b82f6', icon: 'fa-solid fa-receipt' },
      { label: 'Total Paid', value: `₹${Number(summary.totalPaid || 0).toFixed(2)}`, color: '#22c55e', icon: 'fa-solid fa-check-circle' },
      { label: 'Total Due', value: `₹${Number(summary.totalDue || 0).toFixed(2)}`, color: '#ef4444', icon: 'fa-solid fa-exclamation-circle' },
    ];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {cards.map((card, idx) => (
          <div key={idx} className="card" style={{ borderLeft: `4px solid ${card.color}` }}>
            <div className="card-body" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className={card.icon} style={{ fontSize: '20px', color: card.color }}></i>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase' }}>{card.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: card.color }}>{card.value}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTrendChart = (trend, valueKey, labelKey) => {
    if (!trend || trend.length === 0) return <div className="empty-state" style={{ padding: '20px' }}><p>No data available</p></div>;
    const maxVal = Math.max(...trend.map(t => t[valueKey]));
    return (
      <div style={{ marginBottom: '20px' }}>
        <h5 style={{ marginBottom: '12px' }}>Trend ({filters.period})</h5>
        <div style={{ display: 'flex', alignItems: 'end', gap: '4px', height: '200px', padding: '10px 0', borderBottom: '1px solid var(--gray-200)' }}>
          {trend.map((item, idx) => (
            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--gray-500)', marginBottom: '2px' }}>{item[valueKey]?.toFixed?.(0) || item[valueKey]}</div>
              <div
                style={{
                  width: '100%',
                  height: `${maxVal > 0 ? ((item[valueKey] || 0) / maxVal) * 170 : 0}px`,
                  minHeight: item[valueKey] > 0 ? '4px' : '0',
                  background: 'var(--primary)',
                  borderRadius: '4px 4px 0 0',
                  opacity: 0.7 + (idx / trend.length) * 0.3,
                }}
              ></div>
              <div style={{ fontSize: '9px', color: 'var(--gray-500)', marginTop: '4px', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                {item[labelKey] || item._id}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSalesReport = () => {
    if (loading) return <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>;
    if (!salesData) return null;
    const { summary, trend, paymentBreakdown, topProducts } = salesData;
    return (
      <div>
        {renderSummaryCards(summary)}
        {renderTrendChart(trend, 'revenue', 'sales')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="card">
            <div className="card-header"><h5>Payment Method Breakdown</h5></div>
            <div className="card-body" style={{ padding: 0 }}>
              {paymentBreakdown?.length > 0 ? (
                <table>
                  <thead>
                    <tr><th>Method</th><th>Count</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {paymentBreakdown.map((p, idx) => (
                      <tr key={idx}>
                        <td style={{ textTransform: 'capitalize' }}>{p._id}</td>
                        <td>{p.count}</td>
                        <td style={{ fontWeight: 600 }}>₹{Number(p.total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="empty-state" style={{ padding: '20px' }}><p>No data</p></div>}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h5>Top Selling Products</h5></div>
            <div className="card-body" style={{ padding: 0 }}>
              {topProducts?.length > 0 ? (
                <table>
                  <thead>
                    <tr><th>Medicine</th><th>Qty Sold</th><th>Revenue</th></tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{p._id}</td>
                        <td>{p.totalQty}</td>
                        <td style={{ fontWeight: 600 }}>₹{Number(p.totalRevenue).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="empty-state" style={{ padding: '20px' }}><p>No data</p></div>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPurchaseReport = () => {
    if (loading) return <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>;
    if (!purchaseData) return null;
    const { summary, trend } = purchaseData;
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div className="card-body" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Total Purchases</div>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{summary?.totalPurchases || 0}</div>
            </div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid #22c55e' }}>
            <div className="card-body" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Total Cost</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e' }}>₹{Number(summary?.totalCost || 0).toFixed(2)}</div>
            </div>
          </div>
        </div>
        {renderTrendChart(trend, 'cost', 'purchases')}
      </div>
    );
  };

  const renderProfitLoss = () => {
    if (loading) return <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>;
    if (!profitLossData) return null;
    const { profitLoss, totals } = profitLossData;
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div className="card" style={{ borderLeft: '4px solid #22c55e' }}>
            <div className="card-body" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Total Revenue</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#22c55e' }}>₹{Number(totals?.totalRevenue || 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
            <div className="card-body" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Total Cost</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#ef4444' }}>₹{Number(totals?.totalCost || 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="card" style={{ borderLeft: `4px solid ${totals?.totalProfit >= 0 ? '#22c55e' : '#ef4444'}` }}>
            <div className="card-body" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Total Profit</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: totals?.totalProfit >= 0 ? '#22c55e' : '#ef4444' }}>₹{Number(totals?.totalProfit || 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="card-body" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Total Discount</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#f59e0b' }}>₹{Number(totals?.totalDiscount || 0).toFixed(2)}</div>
            </div>
          </div>
        </div>

        {profitLoss?.length > 0 ? (
          <div className="card">
            <div className="card-header"><h5>Profit & Loss Breakdown ({filters.period})</h5></div>
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Qty Sold</th>
                    <th>Revenue</th>
                    <th>Cost</th>
                    <th>Discount</th>
                    <th>GST</th>
                    <th>Profit</th>
                    <th>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {profitLoss.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>{item.period}</td>
                      <td>{item.quantity}</td>
                      <td>₹{item.revenue.toFixed(2)}</td>
                      <td>₹{item.cost.toFixed(2)}</td>
                      <td>₹{item.discount.toFixed(2)}</td>
                      <td>₹{item.gst.toFixed(2)}</td>
                      <td style={{ fontWeight: 600, color: item.profit >= 0 ? '#22c55e' : '#ef4444' }}>₹{item.profit.toFixed(2)}</td>
                      <td>
                        <span className="badge" style={{ background: item.margin >= 0 ? '#dcfce7' : '#fce4ec', color: item.margin >= 0 ? '#16a34a' : '#e53935' }}>
                          {item.margin}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="empty-state"><p>No profit & loss data available</p></div>
        )}
      </div>
    );
  };

  const renderStockReport = () => {
    if (loading) return <div className="loading-spinner"><i className="fa-solid fa-spinner fa-spin"></i></div>;
    if (!stockData) return null;
    const { summary, medicines } = stockData;
    return (
      <div>
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-body">
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={filters.lowStockOnly || false}
                  onChange={(e) => setFilters({ ...filters, lowStockOnly: e.target.checked })}
                />
                <span>Low Stock Only</span>
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div className="card" style={{ borderLeft: '4px solid #3b82f6' }}>
            <div className="card-body" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Total Items</div>
              <div style={{ fontSize: '24px', fontWeight: 700 }}>{summary?.totalItems || 0}</div>
            </div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid #22c55e' }}>
            <div className="card-body" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Stock Value</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#22c55e' }}>₹{Number(summary?.totalStockValue || 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
            <div className="card-body" style={{ padding: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--gray-500)', textTransform: 'uppercase' }}>Low Stock Items</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#ef4444' }}>{summary?.lowStockItems || 0}</div>
            </div>
          </div>
        </div>

        {medicines?.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Category</th>
                  <th>Supplier</th>
                  <th>Stock</th>
                  <th>Min Alert</th>
                  <th>Unit</th>
                  <th>Purchase Price</th>
                  <th>Selling Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((med, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{med.medicineName}</td>
                    <td>{med.category?.name || '-'}</td>
                    <td>{med.supplier?.supplierName || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{med.currentStock}</td>
                    <td>{med.minStockAlert}</td>
                    <td>{med.unit || 'unit'}</td>
                    <td>₹{Number(med.purchasePrice).toFixed(2)}</td>
                    <td>₹{Number(med.sellingPrice).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${med.currentStock <= med.minStockAlert ? 'badge-warning' : 'badge-success'}`}>
                        {med.currentStock <= med.minStockAlert ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><p>No medicines found</p></div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><i className="fa-solid fa-chart-bar"></i> Reports</h2>
          <p>View and analyze your business performance</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <i className={tab.icon} style={{ marginRight: '6px' }}></i>
                {tab.label}
              </button>
            ))}
          </div>
          {activeTab !== 'stock' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={filters.period}
                onChange={(e) => setFilters({ ...filters, period: e.target.value })}
                className="form-select"
                style={{ width: '120px', padding: '4px 8px' }}
              >
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="form-select"
                style={{ width: '150px', padding: '4px 8px' }}
                placeholder="Start Date"
              />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="form-select"
                style={{ width: '150px', padding: '4px 8px' }}
                placeholder="End Date"
              />
            </div>
          )}
        </div>
        <div className="card-body">
          {activeTab === 'sales' && renderSalesReport()}
          {activeTab === 'purchases' && renderPurchaseReport()}
          {activeTab === 'profit-loss' && renderProfitLoss()}
          {activeTab === 'stock' && renderStockReport()}
        </div>
      </div>
    </div>
  );
}