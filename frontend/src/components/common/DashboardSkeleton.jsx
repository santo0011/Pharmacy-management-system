/**
 * DashboardSkeleton
 * YouTube-style shimmer skeleton loader for the Dashboard/Home page.
 * Mirrors the real dashboard layout:
 *   - Page header
 *   - Stats cards grid
 *   - Charts rows
 *   - Table / list sections
 */
export default function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" role="status" aria-label="Loading dashboard">
      {/* ===== Page Header ===== */}
      <div className="skel-page-header">
        <div>
          <div className="skel-line skel-line-title"></div>
          <div className="skel-line skel-line-sub"></div>
        </div>
        <div className="skel-page-header-actions">
          <div className="skel-btn"></div>
          <div className="skel-btn skel-btn-primary"></div>
        </div>
      </div>

      {/* ===== Stats Cards Grid ===== */}
      <div className="skel-stats-grid">
        {Array.from({ length: 7 }).map((_, i) => (
          <div className="skel-stat-card" key={i}>
            <div className="skel-icon"></div>
            <div className="skel-stat-text">
              <div className="skel-line skel-line-number"></div>
              <div className="skel-line skel-line-label"></div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== Charts Row 1 (2 charts) ===== */}
      <div className="skel-charts-row">
        {Array.from({ length: 2 }).map((_, i) => (
          <div className="skel-card" key={i}>
            <div className="skel-card-header">
              <div className="skel-line skel-line-title"></div>
              <div className="skel-line skel-line-sm"></div>
            </div>
            <div className="skel-chart-area">
              <div className="skel-chart-bars">
                {Array.from({ length: 8 }).map((_, b) => (
                  <div className="skel-chart-bar" key={b} style={{ height: `${20 + ((b * 37) % 70)}%` }}></div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== Charts Row 2 (3 cards) ===== */}
      <div className="skel-charts-row-three">
        {Array.from({ length: 3 }).map((_, i) => (
          <div className="skel-card" key={i}>
            <div className="skel-card-header">
              <div className="skel-line skel-line-title"></div>
            </div>
            <div className="skel-chart-area">
              <div className="skel-chart-bars">
                {Array.from({ length: 6 }).map((_, b) => (
                  <div className="skel-chart-bar" key={b} style={{ height: `${25 + ((b * 41) % 65)}%` }}></div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===== Expired Medicines Table Card ===== */}
      <div className="skel-card skel-table-card">
        <div className="skel-card-header">
          <div className="skel-line skel-line-title"></div>
          <div className="skel-btn skel-btn-sm"></div>
        </div>
        <div className="skel-table">
          {Array.from({ length: 5 }).map((_, r) => (
            <div className="skel-table-row" key={r}>
              <div className="skel-line skel-cell skel-cell-med"></div>
              <div className="skel-line skel-cell"></div>
              <div className="skel-line skel-cell"></div>
              <div className="skel-line skel-cell skel-cell-sm"></div>
              <div className="skel-line skel-cell"></div>
              <div className="skel-badge"></div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Low Stock Table Card ===== */}
      <div className="skel-card skel-table-card">
        <div className="skel-card-header">
          <div className="skel-line skel-line-title"></div>
          <div className="skel-btn skel-btn-sm"></div>
        </div>
        <div className="skel-table">
          {Array.from({ length: 4 }).map((_, r) => (
            <div className="skel-table-row" key={r}>
              <div className="skel-line skel-cell skel-cell-med"></div>
              <div className="skel-line skel-cell"></div>
              <div className="skel-line skel-cell skel-cell-sm"></div>
              <div className="skel-line skel-cell"></div>
              <div className="skel-badge"></div>
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Loading dashboard data...</span>
    </div>
  );
}