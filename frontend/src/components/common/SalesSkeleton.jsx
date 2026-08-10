/**
 * SalesSkeleton
 * YouTube-style shimmer skeleton loader for the Sales page.
 * Mirrors the real Sales layout:
 *   - Page header with New Sale button
 *   - Summary cards (Total Sales, Paid, Due, Yearly)
 *   - Filter bar card (search, status, date range)
 *   - Table card with header + rows
 */
export default function SalesSkeleton() {
  return (
    <div className="sales-skeleton" role="status" aria-label="Loading sales">
      {/* ===== Page Header ===== */}
      <div className="skel-page-header">
        <div>
          <div className="skel-line skel-line-title"></div>
          <div className="skel-line skel-line-sub"></div>
        </div>
        <div className="skel-page-header-actions">
          <div className="skel-btn skel-btn-primary"></div>
        </div>
      </div>

      {/* ===== Summary Cards ===== */}
      <div className="skel-summary-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="skel-stat-card" key={i}>
            <div className="skel-icon"></div>
            <div className="skel-stat-text">
              <div className="skel-line skel-line-number"></div>
              <div className="skel-line skel-line-label"></div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== Filter Bar Card ===== */}
      <div className="skel-card skel-filter-card">
        <div className="skel-filter-row">
          <div className="skel-filter-field skel-filter-search">
            <div className="skel-line skel-line-sm"></div>
            <div className="skel-input"></div>
          </div>
          <div className="skel-filter-field">
            <div className="skel-line skel-line-sm"></div>
            <div className="skel-input"></div>
          </div>
          <div className="skel-filter-field">
            <div className="skel-line skel-line-sm"></div>
            <div className="skel-input"></div>
          </div>
          <div className="skel-filter-field">
            <div className="skel-line skel-line-sm"></div>
            <div className="skel-input"></div>
          </div>
        </div>
      </div>

      {/* ===== Table Card ===== */}
      <div className="skel-card skel-table-card">
        <div className="skel-card-header">
          <div className="skel-line skel-line-title"></div>
          <div className="skel-line skel-line-sm"></div>
        </div>
        <div className="skel-table">
          {Array.from({ length: 8 }).map((_, r) => (
            <div className="skel-table-row skel-sales-row" key={r}>
              <div className="skel-line skel-cell skel-cell-med"></div>
              <div className="skel-line skel-cell"></div>
              <div className="skel-line skel-cell"></div>
              <div className="skel-line skel-cell"></div>
              <div className="skel-badge"></div>
              <div className="skel-line skel-cell"></div>
              <div className="skel-actions">
                <div className="skel-btn skel-btn-sm"></div>
                <div className="skel-btn skel-btn-sm"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Loading sales data...</span>
    </div>
  );
}