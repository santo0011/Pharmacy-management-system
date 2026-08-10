/**
 * MedicinesSkeleton
 * YouTube-style shimmer skeleton loader for the Medicines page.
 * Mirrors the real Medicines layout:
 *   - Page header with action buttons
 *   - Filter bar card
 *   - Table card with header + rows
 */
export default function MedicinesSkeleton() {
  return (
    <div className="medicines-skeleton" role="status" aria-label="Loading medicines">
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

      {/* ===== Filter Bar Card ===== */}
      <div className="skel-card skel-filter-card">
        <div className="skel-filter-row">
          <div className="skel-filter-field skel-filter-search">
            <div className="skel-line skel-line-sm"></div>
            <div className="skel-input"></div>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="skel-filter-field" key={i}>
              <div className="skel-line skel-line-sm"></div>
              <div className="skel-input"></div>
            </div>
          ))}
          <div className="skel-filter-field skel-filter-btn">
            <div className="skel-btn skel-btn-sm"></div>
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
            <div className="skel-table-row skel-med-row" key={r}>
              <div className="skel-thumb"></div>
              <div className="skel-line skel-cell skel-cell-med"></div>
              <div className="skel-line skel-cell"></div>
              <div className="skel-line skel-cell"></div>
              <div className="skel-badge"></div>
              <div className="skel-line skel-cell"></div>
              <div className="skel-toggle"></div>
              <div className="skel-actions">
                <div className="skel-btn skel-btn-sm"></div>
                <div className="skel-btn skel-btn-sm"></div>
                <div className="skel-btn skel-btn-sm"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Loading medicines data...</span>
    </div>
  );
}