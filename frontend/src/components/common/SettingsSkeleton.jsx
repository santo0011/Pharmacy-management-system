/**
 * SettingsSkeleton
 * YouTube-style shimmer skeleton loader for the Settings page sections.
 * Reuses the EXACT same skeleton design system (skel-* classes, shimmer
 * animation, shapes, spacing, border radius, animation speed) as the
 * Categories page TableSkeleton.
 */
export default function SettingsSkeleton({ section = 'shop', historyOnly = false }) {
  const sectionHeader = (
    <div className="settings-section-header" style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--gray-100)' }}>
      <div className="skel-line skel-line-title" style={{ width: 180, height: 24 }}></div>
      <div className="skel-line skel-line-sub" style={{ width: 240, height: 12, marginTop: 8 }}></div>
    </div>
  );

  const formField = (full = false) => (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      <div className="skel-line skel-line-sm" style={{ width: 90, height: 12 }}></div>
      <div className="skel-input" style={{ height: 38, marginTop: 8 }}></div>
    </div>
  );

  const saveBar = (
    <div className="settings-save-bar" style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'flex-end' }}>
      <div className="skel-btn skel-btn-primary" style={{ width: 120, height: 38 }}></div>
    </div>
  );

  const renderHistoryTable = () => (
    <div className="skel-card skel-table-card">
      <div className="skel-table" style={{ padding: '8px 20px' }}>
        <div className="skel-table-row" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 12, padding: '12px 0' }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div className="skel-line skel-cell" key={i} style={{ height: 12 }}></div>
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, r) => (
          <div className="skel-table-row" key={r} style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 12 }}>
            <div className="skel-line skel-cell skel-cell-med"></div>
            <div className="skel-line skel-cell"></div>
            <div className="skel-line skel-cell"></div>
            <div className="skel-line skel-cell"></div>
            <div className="skel-line skel-cell"></div>
            <div className="skel-badge" style={{ width: 60, height: 18 }}></div>
            <div className="skel-line skel-cell"></div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSection = () => {
    if (historyOnly) {
      return (
        <>
          <div className="settings-section-header" style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--gray-100)' }}>
            <div className="skel-line skel-line-title" style={{ width: 160, height: 20 }}></div>
            <div className="skel-line skel-line-sub" style={{ width: 200, height: 12, marginTop: 6 }}></div>
          </div>
          {renderHistoryTable()}
        </>
      );
    }
    switch (section) {
      case 'gst':
        return (
          <>
            {sectionHeader}
            <div className="gst-explainer-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="skel-card" style={{ padding: 14, borderRadius: 10, display: 'flex', gap: 12 }}>
                  <div className="skel-icon" style={{ width: 40, height: 40, flexShrink: 0 }}></div>
                  <div style={{ flex: 1 }}>
                    <div className="skel-line skel-cell-med" style={{ width: '60%', height: 14 }}></div>
                    <div className="skel-line skel-cell" style={{ width: '90%', height: 12, marginTop: 6 }}></div>
                    <div className="skel-line skel-cell" style={{ width: '75%', height: 12, marginTop: 6 }}></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {formField()}
              {formField()}
            </div>
            {saveBar}
          </>
        );

      case 'invoice':
        return (
          <>
            {sectionHeader}
            <div className="invoice-template-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skel-card" style={{ padding: 16, borderRadius: 10, textAlign: 'center' }}>
                  <div className="skel-icon" style={{ width: 48, height: 48, margin: '0 auto 8px', borderRadius: 8 }}></div>
                  <div className="skel-line skel-cell-med" style={{ width: '50%', height: 14, margin: '0 auto' }}></div>
                  <div className="skel-line skel-cell" style={{ width: '80%', height: 12, margin: '8px auto 0' }}></div>
                </div>
              ))}
            </div>
            <div className="invoice-format-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skel-card" style={{ padding: 14, borderRadius: 10, textAlign: 'center' }}>
                  <div className="skel-icon" style={{ width: 40, height: 40, margin: '0 auto 6px', borderRadius: 8 }}></div>
                  <div className="skel-line skel-cell-med" style={{ width: '50%', height: 14, margin: '0 auto' }}></div>
                  <div className="skel-line skel-cell" style={{ width: '70%', height: 12, margin: '6px auto 0' }}></div>
                </div>
              ))}
            </div>
            {saveBar}
          </>
        );

      case 'profile':
        return (
          <>
            {sectionHeader}
            <div className="subscription-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="subscription-info-item" style={{ padding: '10px 12px', background: 'var(--gray-50)', borderRadius: 8 }}>
                  <div className="skel-line skel-line-sm" style={{ width: 60, height: 10 }}></div>
                  <div className="skel-line skel-cell-med" style={{ width: '70%', height: 14, marginTop: 6 }}></div>
                </div>
              ))}
            </div>
          </>
        );

      case 'subscription':
        return (
          <>
            {sectionHeader}
            <div className="subscription-status-card" style={{ border: '1px solid var(--gray-200)', borderRadius: 10, padding: 20, background: '#fff', marginBottom: 24 }}>
              <div className="skel-badge" style={{ width: 90, height: 24, marginBottom: 16, borderRadius: 999 }}></div>
              <div className="subscription-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="subscription-info-item" style={{ padding: '10px 12px', background: 'var(--gray-50)', borderRadius: 8 }}>
                    <div className="skel-line skel-line-sm" style={{ width: 60, height: 10 }}></div>
                    <div className="skel-line skel-cell-med" style={{ width: '60%', height: 14, marginTop: 6 }}></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="settings-section-header" style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--gray-100)' }}>
              <div className="skel-line skel-line-title" style={{ width: 160, height: 20 }}></div>
              <div className="skel-line skel-line-sub" style={{ width: 200, height: 12, marginTop: 6 }}></div>
            </div>
            <div className="skel-card skel-table-card">
              <div className="skel-table" style={{ padding: '8px 20px' }}>
                <div className="skel-table-row" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 12, padding: '12px 0' }}>
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div className="skel-line skel-cell" key={i} style={{ height: 12 }}></div>
                  ))}
                </div>
                {Array.from({ length: 5 }).map((_, r) => (
                  <div className="skel-table-row" key={r} style={{ gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 12 }}>
                    <div className="skel-line skel-cell skel-cell-med"></div>
                    <div className="skel-line skel-cell"></div>
                    <div className="skel-line skel-cell"></div>
                    <div className="skel-line skel-cell"></div>
                    <div className="skel-line skel-cell"></div>
                    <div className="skel-badge" style={{ width: 60, height: 18 }}></div>
                    <div className="skel-line skel-cell"></div>
                  </div>
                ))}
              </div>
            </div>
          </>
        );

      case 'shop':
      default:
        return (
          <>
            {sectionHeader}
            <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {formField()}
              {formField()}
              {formField()}
              {formField()}
              {formField(true)}
              {formField()}
            </div>
            {saveBar}
          </>
        );
    }
  };

  return (
    <div className="settings-skeleton" role="status" aria-label={`Loading ${section} settings`}>
      {renderSection()}
      <span className="sr-only">Loading {section} settings...</span>
    </div>
  );
}