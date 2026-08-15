import { useState, useEffect, useCallback } from 'react';
import CurrencyDisplay from '../../components/common/CurrencyDisplay';
import { reportService } from '../../services/reportService';
import { showError } from '../../utils/sweetAlert';
import ReportsSkeleton from '../../components/common/ReportsSkeleton';

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom Date' },
];

const DEFAULT_PRESET = '30days';

const TABS = [
  { value: 'sales', label: 'Sales GST', icon: 'fa-solid fa-cart-shopping' },
  { value: 'purchases', label: 'Purchase GST', icon: 'fa-solid fa-boxes-stacked' },
  { value: 'summary', label: 'GST Summary', icon: 'fa-solid fa-chart-pie' },
];

export default function GstReport() {
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [activeTab, setActiveTab] = useState('sales');
  const [summary, setSummary] = useState(null);
  const [rates, setRates] = useState({ sales: [], purchases: [] });
  const [transactions, setTransactions] = useState({ sales: [], purchases: [] });
  const [loading, setLoading] = useState(true);
  const [salesSearch, setSalesSearch] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [gstRateFilter, setGstRateFilter] = useState('all');

  // Compute date range based on preset
  const getDateRange = useCallback(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    let start = new Date();

    if (preset === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (preset === '7days') {
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (preset === '30days') {
      start.setDate(end.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else if (preset === 'month') {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    } else if (preset === 'custom') {
      if (!customStart || !customEnd) return null;
      start = new Date(customStart);
      start.setHours(0, 0, 0, 0);
      end.setTime(new Date(customEnd).getTime());
      end.setHours(23, 59, 59, 999);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  }, [preset, customStart, customEnd]);

  const loadData = useCallback(async () => {
    const range = getDateRange();
    if (!range) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = { startDate: range.start, endDate: range.end };
    try {
      const [summaryRes, ratesRes, salesTxRes, purchaseTxRes] = await Promise.all([
        reportService.getGstSummary(params),
        reportService.getGstRates(params),
        reportService.getGstTransactions({ ...params, type: 'sale' }),
        reportService.getGstTransactions({ ...params, type: 'purchase' }),
      ]);
      if (summaryRes.data?.data) setSummary(summaryRes.data.data);
      if (ratesRes.data?.data) setRates(ratesRes.data.data);
      if (salesTxRes.data?.data) setTransactions(prev => ({ ...prev, sales: salesTxRes.data.data.sales || [] }));
      if (purchaseTxRes.data?.data) setTransactions(prev => ({ ...prev, purchases: purchaseTxRes.data.data.purchases || [] }));
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to load GST report');
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter helper
  const filterByGstRate = (items) => {
    if (gstRateFilter === 'all') return items;
    return items.filter(item => Number(item.gstPct) === Number(gstRateFilter));
  };

  const filteredSales = filterByGstRate(
    transactions.sales.filter(s =>
      s.invoiceNo?.toLowerCase().includes(salesSearch.toLowerCase()) ||
      s.customer?.toLowerCase().includes(salesSearch.toLowerCase()) ||
      s.gstin?.toLowerCase().includes(salesSearch.toLowerCase())
    )
  );

  const filteredPurchases = filterByGstRate(
    transactions.purchases.filter(p =>
      p.invoiceNo?.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
      p.supplier?.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
      p.gstin?.toLowerCase().includes(purchaseSearch.toLowerCase())
    )
  );

  // Available GST rates for filter (from rates data)
  const availableRates = [...new Set([
    ...rates.sales.map(r => Number(r.gstPct)),
    ...rates.purchases.map(r => Number(r.gstPct)),
  ])].sort((a, b) => a - b);

  // CSV export
  const exportCsv = () => {
    const rows = activeTab === 'sales'
      ? filteredSales
      : activeTab === 'purchases'
        ? filteredPurchases
        : [];
    if (rows.length === 0) return;
    const headers = activeTab === 'sales'
      ? ['Invoice No', 'Date', 'Customer', 'GSTIN', 'Taxable Amount', 'GST %', 'CGST', 'SGST', 'IGST', 'Total GST', 'Grand Total']
      : ['Purchase Invoice', 'Date', 'Supplier', 'GSTIN', 'Taxable Amount', 'GST %', 'CGST', 'SGST', 'IGST', 'Total GST', 'Grand Total'];
    const csvRows = [headers.join(',')];
    rows.forEach(r => {
      csvRows.push([
        `"${r.invoiceNo}"`, new Date(r.date).toLocaleDateString(), `"${r.customer || r.supplier}"`,
        `"${r.gstin || ''}"`, r.taxableAmount, r.gstPct, r.cgst, r.sgst, r.igst, r.totalGst, r.grandTotal,
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gst-${activeTab}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    window.print();
  };

  const sumField = (items, field) => items.reduce((sum, it) => sum + (Number(it[field]) || 0), 0);

  // Summary derived values
  const salesGst = summary?.sales?.totalGst || 0;
  const purchaseGst = summary?.purchases?.totalGst || 0;
  const netGst = salesGst - purchaseGst;

  if (loading && !summary) {
    return <ReportsSkeleton type="gst" />;
  }

  return (
    <div className="gst-report-page">
      <div className="page-header gst-report-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2><i className="fa-solid fa-file-invoice"></i> GST Report</h2>
          <p>Indian GST summary for Sales & Purchases</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={exportCsv} title="Export CSV" style={{ fontSize: '13px' }}>
            <i className="fa-solid fa-file-csv"></i> Export CSV
          </button>
          <button className="btn btn-primary" onClick={printReport} title="Print Report" style={{ fontSize: '13px' }}>
            <i className="fa-solid fa-print"></i> Print
          </button>
        </div>
      </div>

      {/* Date Filter Card */}
      <div className="card gst-filter-card" style={{ marginBottom: '16px' }}>
        <div className="card-body" style={{ padding: '14px 18px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-600)' }}>Period</label>
            <select
              className="form-select"
              style={{ minWidth: '150px' }}
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
            >
              {DATE_PRESETS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          {preset === 'custom' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-600)' }}>From Date</label>
                <input type="date" className="form-select" style={{ minWidth: '140px' }} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-600)' }}>To Date</label>
                <input type="date" className="form-select" style={{ minWidth: '140px' }} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </div>
            </>
          )}

        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <div className="gst-summary-card" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Sales Taxable</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}><CurrencyDisplay value={summary?.sales?.taxableValue || 0} cardMode={false} forceDecimals /></div>
        </div>
        <div className="gst-summary-card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#166534', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Sales GST</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}><CurrencyDisplay value={salesGst} cardMode={false} forceDecimals /></div>
        </div>
        <div className="gst-summary-card" style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#9a3412', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Purchase Taxable</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#c2410c', marginTop: '4px' }}><CurrencyDisplay value={summary?.purchases?.taxableValue || 0} cardMode={false} forceDecimals /></div>
        </div>
        <div className="gst-summary-card" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Purchase GST</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626', marginTop: '4px' }}><CurrencyDisplay value={purchaseGst} cardMode={false} forceDecimals /></div>
        </div>
        <div className="gst-summary-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Net GST</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: netGst >= 0 ? '#16a34a' : '#dc2626', marginTop: '4px' }}>
            <CurrencyDisplay value={netGst} cardMode={false} forceDecimals />
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Output − Input</div>
        </div>
      </div>

      {/* CGST / SGST / IGST / Net breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>CGST</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gray-800)', marginTop: '2px' }}><CurrencyDisplay value={(summary?.sales?.cgst || 0) - (summary?.purchases?.cgst || 0)} cardMode={false} forceDecimals /></div>
          <div style={{ fontSize: '10px', color: 'var(--gray-400)' }}>Output − Input</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>SGST</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gray-800)', marginTop: '2px' }}><CurrencyDisplay value={(summary?.sales?.sgst || 0) - (summary?.purchases?.sgst || 0)} cardMode={false} forceDecimals /></div>
          <div style={{ fontSize: '10px', color: 'var(--gray-400)' }}>Output − Input</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>IGST</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gray-800)', marginTop: '2px' }}><CurrencyDisplay value={(summary?.sales?.igst || 0) - (summary?.purchases?.igst || 0)} cardMode={false} forceDecimals /></div>
          <div style={{ fontSize: '10px', color: 'var(--gray-400)' }}>Output − Input</div>
        </div>
        <div style={{ background: netGst >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${netGst >= 0 ? '#bbf7d0' : '#fecaca'}`, borderRadius: '10px', padding: '12px' }}>
          <div style={{ fontSize: '11px', color: netGst >= 0 ? '#166534' : '#991b1b', fontWeight: 600, textTransform: 'uppercase' }}>Net GST</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: netGst >= 0 ? '#16a34a' : '#dc2626', marginTop: '2px' }}><CurrencyDisplay value={netGst} cardMode={false} forceDecimals /></div>
          <div style={{ fontSize: '10px', color: 'var(--gray-400)' }}>Liability / Credit</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', borderBottom: '2px solid var(--gray-200)', paddingBottom: '8px', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.value}
            className={`btn ${activeTab === tab.value ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '8px 8px 0 0', fontSize: '13px', border: 'none' }}
            onClick={() => setActiveTab(tab.value)}
          >
            <i className={tab.icon}></i> {tab.label}
          </button>
        ))}
      </div>

      {/* Search input per tab */}
      {activeTab !== 'summary' && (
        <div style={{ marginBottom: '12px', position: 'relative', maxWidth: '400px' }}>
          <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontSize: '13px' }}></i>
          <input
            type="text"
            placeholder={activeTab === 'sales' ? 'Search by invoice, customer or GSTIN...' : 'Search by invoice, supplier or GSTIN...'}
            className="form-select"
            style={{ width: '100%', paddingLeft: '36px', fontSize: '13px' }}
            value={activeTab === 'sales' ? salesSearch : purchaseSearch}
            onChange={(e) => activeTab === 'sales' ? setSalesSearch(e.target.value) : setPurchaseSearch(e.target.value)}
          />
        </div>
      )}

      {/* Tab Content */}
      <div className="card">
        <div className="card-header" style={{ padding: '12px 16px' }}>
          <h5 style={{ fontSize: '14px' }}>
            {activeTab === 'sales' && 'Sales GST Transactions'}
            {activeTab === 'purchases' && 'Purchase GST Transactions'}
            {activeTab === 'summary' && 'GST Rate Summary'}
          </h5>
          <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
            {activeTab === 'sales' && `${filteredSales.length} invoice(s)`}
            {activeTab === 'purchases' && `${filteredPurchases.length} invoice(s)`}
            {activeTab === 'summary' && `${rates.sales.length} rate(s)`}
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <ReportsSkeleton type="gst" />
          ) : activeTab === 'sales' ? (
            <div className="table-container">
              <table className="gst-report-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>GSTIN</th>
                    <th>Taxable</th>
                    <th>GST %</th>
                    <th>CGST</th>
                    <th>SGST</th>
                    <th>IGST</th>
                    <th>Total GST</th>
                    <th>Grand Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 ? (
                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--gray-500)' }}>No sales GST transactions found</td></tr>
                  ) : (
                    filteredSales.map((s, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{s.invoiceNo}</td>
                        <td style={{ fontSize: '12px' }}>{new Date(s.date).toLocaleDateString()}</td>
                        <td>{s.customer}</td>
                        <td style={{ fontSize: '12px' }}>{s.gstin || '-'}</td>
                        <td style={{ textAlign: 'right' }}><CurrencyDisplay value={s.taxableAmount} cardMode={false} forceDecimals /></td>
                        <td style={{ textAlign: 'center' }}><span className="badge badge-info">{s.gstPct}%</span></td>
                        <td style={{ textAlign: 'right' }}><CurrencyDisplay value={s.cgst} cardMode={false} forceDecimals /></td>
                        <td style={{ textAlign: 'right' }}><CurrencyDisplay value={s.sgst} cardMode={false} forceDecimals /></td>
                        <td style={{ textAlign: 'right' }}><CurrencyDisplay value={s.igst} cardMode={false} forceDecimals /></td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#d97706' }}><CurrencyDisplay value={s.totalGst} cardMode={false} forceDecimals /></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}><CurrencyDisplay value={s.grandTotal} cardMode={false} forceDecimals /></td>
                      </tr>
                    ))
                  )}
                </tbody>

              </table>
            </div>
          ) : activeTab === 'purchases' ? (
            <div className="table-container">
              <table className="gst-report-table">
                <thead>
                  <tr>
                    <th>Purchase Invoice</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>GSTIN</th>
                    <th>Taxable</th>
                    <th>GST %</th>
                    <th>CGST</th>
                    <th>SGST</th>
                    <th>IGST</th>
                    <th>Total GST</th>
                    <th>Grand Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.length === 0 ? (
                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--gray-500)' }}>No purchase GST transactions found</td></tr>
                  ) : (
                    filteredPurchases.map((p, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{p.invoiceNo}</td>
                        <td style={{ fontSize: '12px' }}>{new Date(p.date).toLocaleDateString()}</td>
                        <td>{p.supplier}</td>
                        <td style={{ fontSize: '12px' }}>{p.gstin || '-'}</td>
                        <td style={{ textAlign: 'right' }}><CurrencyDisplay value={p.taxableAmount} cardMode={false} forceDecimals /></td>
                        <td style={{ textAlign: 'center' }}><span className="badge badge-info">{p.gstPct}%</span></td>
                        <td style={{ textAlign: 'right' }}><CurrencyDisplay value={p.cgst} cardMode={false} forceDecimals /></td>
                        <td style={{ textAlign: 'right' }}><CurrencyDisplay value={p.sgst} cardMode={false} forceDecimals /></td>
                        <td style={{ textAlign: 'right' }}><CurrencyDisplay value={p.igst} cardMode={false} forceDecimals /></td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#d97706' }}><CurrencyDisplay value={p.totalGst} cardMode={false} forceDecimals /></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}><CurrencyDisplay value={p.grandTotal} cardMode={false} forceDecimals /></td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredPurchases.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ fontWeight: 700, textAlign: 'right' }}>Total ({filteredPurchases.length})</td>
                      <td style={{ fontWeight: 700, textAlign: 'right' }}><CurrencyDisplay value={sumField(filteredPurchases, 'taxableAmount')} cardMode={false} forceDecimals /></td>
                      <td></td>
                      <td style={{ fontWeight: 700, textAlign: 'right' }}><CurrencyDisplay value={sumField(filteredPurchases, 'cgst')} cardMode={false} forceDecimals /></td>
                      <td style={{ fontWeight: 700, textAlign: 'right' }}><CurrencyDisplay value={sumField(filteredPurchases, 'sgst')} cardMode={false} forceDecimals /></td>
                      <td style={{ fontWeight: 700, textAlign: 'right' }}><CurrencyDisplay value={sumField(filteredPurchases, 'igst')} cardMode={false} forceDecimals /></td>
                      <td style={{ fontWeight: 700, textAlign: 'right', color: '#d97706' }}><CurrencyDisplay value={sumField(filteredPurchases, 'totalGst')} cardMode={false} forceDecimals /></td>
                      <td style={{ fontWeight: 700, textAlign: 'right' }}><CurrencyDisplay value={sumField(filteredPurchases, 'grandTotal')} cardMode={false} forceDecimals /></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            /* GST Rate Summary */
            <div className="table-container">
              <table className="gst-report-table">
                <thead>
                  <tr>
                    <th>GST Rate</th>
                    <th>Type</th>
                    <th>Taxable Amount</th>
                    <th>CGST</th>
                    <th>SGST</th>
                    <th>IGST</th>
                    <th>Total GST</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Sales rates */}
                  {rates.sales.map((r, idx) => (
                    <tr key={`s-${idx}`}>
                      <td><span className="badge badge-info">{r.gstPct}%</span></td>
                      <td><span className="badge badge-success">Sales</span></td>
                      <td style={{ textAlign: 'right' }}><CurrencyDisplay value={r.taxableValue} cardMode={false} forceDecimals /></td>
                      <td style={{ textAlign: 'right' }}><CurrencyDisplay value={r.cgst} cardMode={false} forceDecimals /></td>
                      <td style={{ textAlign: 'right' }}><CurrencyDisplay value={r.sgst} cardMode={false} forceDecimals /></td>
                      <td style={{ textAlign: 'right' }}><CurrencyDisplay value={r.igst} cardMode={false} forceDecimals /></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#d97706' }}><CurrencyDisplay value={r.totalGst} cardMode={false} forceDecimals /></td>
                    </tr>
                  ))}
                  {/* Purchase rates */}
                  {rates.purchases.map((r, idx) => (
                    <tr key={`p-${idx}`}>
                      <td><span className="badge badge-info">{r.gstPct}%</span></td>
                      <td><span className="badge badge-warning">Purchase</span></td>
                      <td style={{ textAlign: 'right' }}><CurrencyDisplay value={r.taxableValue} cardMode={false} forceDecimals /></td>
                      <td style={{ textAlign: 'right' }}><CurrencyDisplay value={r.cgst} cardMode={false} forceDecimals /></td>
                      <td style={{ textAlign: 'right' }}><CurrencyDisplay value={r.sgst} cardMode={false} forceDecimals /></td>
                      <td style={{ textAlign: 'right' }}><CurrencyDisplay value={r.igst} cardMode={false} forceDecimals /></td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#d97706' }}><CurrencyDisplay value={r.totalGst} cardMode={false} forceDecimals /></td>
                    </tr>
                  ))}
                  {rates.sales.length === 0 && rates.purchases.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--gray-500)' }}>No GST rate data found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}