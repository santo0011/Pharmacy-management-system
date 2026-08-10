/**
 * TableSkeleton
 * YouTube-style shimmer skeleton loader for simple list pages
 * (Categories, Brands, Suppliers).
 * Mirrors:
 *   - Page header with action button
 *   - Table card with header + rows
 */
export default function TableSkeleton({ rows = 8 }) {
  return (
    <div className="table-skeleton" role="status" aria-label="Loading data">
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

      {/* ===== Table Card ===== */}
      <div className="skel-card skel-table-card">
        <div className="skel-card-header">
          <div className="skel-line skel-line-title"></div>
          <div className="skel-line skel-line-sm"></div>
        </div>
        <div className="skel-table">
          {Array.from({ length: rows }).map((_, r) => (
            <div className="skel-table-row skel-list-row" key={r}>
              <div className="skel-thumb"></div>
              <div className="skel-line skel-cell skel-cell-med"></div>
              <div className="skel-line skel-cell"></div>
              <div className="skel-line skel-cell"></div>
              <div className="skel-actions">
                <div className="skel-btn skel-btn-sm"></div>
                <div className="skel-btn skel-btn-sm"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Loading data...</span>
    </div>
  );
}