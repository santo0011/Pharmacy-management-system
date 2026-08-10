/**
 * ReportsSkeleton
 * YouTube-style shimmer skeleton loader for the Reports & GST Report pages.
 * Reuses the EXACT same skeleton design system (skel-* classes, shimmer
 * animation, shapes, spacing, border radius, animation speed) as the
 * Categories page TableSkeleton.
 */
export default function ReportsSkeleton({ type = 'reports', tab = 'sales' }) {
  const summaryCard = () => (
    <div className="card report-summary-card skel-card" style={{ borderLeft: '4px solid #e2e8f0' }}>
      <div className="card-body report-card-body-sm" style={{ padding: 14 }}>
        <div className="report-card-content" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="skel-icon" style={{ width: 32, height: 32, flexShrink: 0 }}></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="skel-line skel-line-sm" style={{ width: '70%', height: 10 }}></div>
            <div className="skel-line skel-cell-med" style={{ width: '50%', height: 16, marginTop: 6 }}></div>
          </div>
        </div>
      </div>
    </div>
  );

  const tableSkeleton = (cols = 4, rows = 6) => (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <div className="skel-line skel-line-title" style={{ width: 160, height: 20 }}></div>
        <div className="skel-line skel-line-sm" style={{ width: 80, height: 12 }}></div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <div className="table-container">
          <div style={{ minWidth: cols * 80, padding: '8px 16px' }}>
            <div className="skel-table-row" style={{ gridTemplateColumns: `repeat(${Math.min(cols, 4)}, 1fr)`, gap: 16, padding: '12px 0' }}>
              {Array.from({ length: Math.min(cols, 4) }).map((_, i) => (
                <div className="skel-line skel-cell" key={i} style={{ height: 12 }}></div>
              ))}
            </div>
            {Array.from({ length: rows }).map((_, r) => (
              <div className="skel-table-row" key={r} style={{ gridTemplateColumns: `repeat(${Math.min(cols, 4)}, 1fr)`, gap: 16 }}>
                <div className="skel-line skel-cell skel-cell-med" style={{ width: '70%' }}></div>
                <div className="skel-line skel-cell" style={{ width: '60%' }}></div>
                <div className="skel-line skel-cell" style={{ width: '50%' }}></div>
                <div className="skel-line skel-cell" style={{ width: '40%' }}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const trendChartSkeleton = () => (
    <div className="skel-card" style={{ marginBottom: 20, padding: 16 }}>
      <div className="skel-line skel-line-title" style={{ width: 120, height: 18, marginBottom: 12 }}></div>
      <div className="skel-chart-area" style={{ height: 160, padding: '10px 0', display: 'flex', alignItems: 'flex-end' }}>
        <div className="skel-chart-bars" style={{ display: 'flex', gap: 8, width: '100%', height: '100%', alignItems: 'flex-end' }}>
          {[35, 55, 40, 70, 45, 80, 60, 50, 75, 38, 65, 48].map((h, i) => (
            <div key={i} className="skel-chart-bar" style={{ height: `${h}%`, width: '100%' }}></div>
          ))}
        </div>
      </div>
    </div>
  );

  const filterBar = () => (
    <div className="skel-card skel-filter-card" style={{ marginBottom: 16 }}>
      <div className="skel-filter-row" style={{ padding: '12px 16px' }}>
        <div className="skel-filter-field" style={{ flex: '0 0 auto', minWidth: 80 }}>
          <div className="skel-line skel-line-sm"></div>
          <div className="skel-input" style={{ height: 30, marginTop: 6 }}></div>
        </div>
        <div className="skel-filter-field" style={{ flex: '0 0 auto', minWidth: 80 }}>
          <div className="skel-line skel-line-sm"></div>
          <div className="skel-input" style={{ height: 30, marginTop: 6 }}></div>
        </div>
        <div className="skel-filter-field" style={{ flex: '0 0 auto', minWidth: 80 }}>
          <div className="skel-line skel-line-sm"></div>
          <div className="skel-input" style={{ height: 30, marginTop: 6 }}></div>
        </div>
      </div>
    </div>
  );

  const tabsBar = (tabs) => (
    <div className="report-tabs-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
      {Array.from({ length: tabs }).map((_, i) => (
        <div key={i} className="skel-btn skel-btn-sm" style={{ width: 100, height: 32 }}></div>
      ))}
    </div>
  );

  const renderReportsTab = () => {
    switch (tab) {
      case 'sales':
        return (
          <>
            {tabsBar(4)}
            {filterBar()}
            <div className="report-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {Array.from({ length: 6 }).map((_, i) => summaryCard())}
            </div>
            {trendChartSkeleton()}
            <div className="report-two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {tableSkeleton(3, 4)}
              {tableSkeleton(3, 4)}
            </div>
          </>
        );

      case 'purchases':
        return (
          <>
            {tabsBar(4)}
            {filterBar()}
            <div className="report-purchase-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {Array.from({ length: 3 }).map((_, i) => summaryCard())}
            </div>
            {trendChartSkeleton()}
          </>
        );

      case 'profit-loss':
        return (
          <>
            {tabsBar(4)}
            {filterBar()}
            <div className="report-pl-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {Array.from({ length: 4 }).map((_, i) => summaryCard())}
            </div>
            {tableSkeleton(8, 6)}
          </>
        );

      case 'stock':
        return (
          <>
            {tabsBar(4)}
            <div className="skel-card skel-filter-card" style={{ marginBottom: 16 }}>
              <div className="skel-filter-row" style={{ padding: '12px 16px' }}>
                <div className="skel-line skel-line-sm" style={{ width: 120, height: 16 }}></div>
              </div>
            </div>
            <div className="report-summary-grid-three" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {Array.from({ length: 3 }).map((_, i) => summaryCard())}
            </div>
            {tableSkeleton(9, 7)}
          </>
        );

      default:
        return null;
    }
  };

  const renderGstReport = () => (
    <>
      {filterBar()}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="gst-summary-card" style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 10, padding: 12 }}>
            <div className="skel-line skel-line-sm" style={{ width: '60%', height: 10 }}></div>
            <div className="skel-line skel-cell-med" style={{ width: '50%', height: 20, marginTop: 6 }}></div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 10, padding: 12 }}>
            <div className="skel-line skel-line-sm" style={{ width: '50%', height: 10 }}></div>
            <div className="skel-line skel-cell-med" style={{ width: '55%', height: 18, marginTop: 6 }}></div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skel-btn skel-btn-sm" style={{ width: 120, height: 34 }}></div>
        ))}
      </div>
      {tableSkeleton(11, 6)}
    </>
  );

  return (
    <div className="reports-skeleton" role="status" aria-label={`Loading ${type === 'gst' ? 'GST Report' : 'Reports'} data`}>
      {type === 'gst' ? renderGstReport() : renderReportsTab()}
      <span className="sr-only">Loading report data...</span>
    </div>
  );
}