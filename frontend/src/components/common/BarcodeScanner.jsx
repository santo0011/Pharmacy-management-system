import { useEffect, useRef } from 'react';
import useBarcodeScanner from '../../hooks/useBarcodeScanner';

/**
 * BarcodeScanner Component
 * 
 * A professional, reusable barcode/QR scanner overlay with:
 *  - Camera switching (front/back)
 *  - Flashlight toggle
 *  - Loading/error states with smart capability detection
 *  - Fallback UI when camera is unavailable (USB scanner / manual input)
 *  - Mobile-first responsive design
 *  - Proper permission handling
 * 
 * Usage:
 *   <BarcodeScanner
 *     open={showScanner}
 *     onScan={(barcode) => handleScan(barcode)}
 *     onClose={() => setShowScanner(false)}
 *     scannerId="my-scanner"
 *     stopAfterScan={true}
 *   />
 * 
 * Props:
 *   open (boolean) - Show/hide the scanner overlay
 *   onScan (function) - Callback when barcode is scanned, receives decoded text
 *   onClose (function) - Callback to close the scanner
 *   scannerId (string) - Unique DOM element ID for the scanner container
 *   stopAfterScan (boolean) - Auto-close scanner after successful scan (default: true)
 *   fps (number) - Scanning FPS for performance tuning (default: 5)
 */
export default function BarcodeScanner({
  open,
  onScan,
  onClose,
  scannerId = 'barcode-scanner',
  stopAfterScan = true,
  fps = 5,
}) {
  const {
    isScanning,
    isLoading,
    cameras,
    currentCameraId,
    hasFlashlight,
    flashlightOn,
    error,
    cameraCapability,
    startScanner,
    stopScanner,
    switchCamera,
    toggleFlashlight,
  } = useBarcodeScanner({
    onScan,
    stopAfterScan,
    fps,
    scannerId,
    suppressErrors: true, // Component handles its own error display
  });

  const hasStarted = useRef(false);

  // Auto-start scanner when overlay opens (only if camera is available)
  useEffect(() => {
    if (open && !hasStarted.current && cameraCapability.canRequest) {
      hasStarted.current = true;
      startScanner();
    }
    if (!open) {
      hasStarted.current = false;
    }
  }, [open, startScanner, cameraCapability.canRequest]);

  // Stop scanner when overlay closes
  useEffect(() => {
    if (!open) {
      stopScanner();
    }
  }, [open, stopScanner]);

  // Stop scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  if (!open) return null;

  // Determine if camera is fundamentally unavailable
  const cameraUnavailable = !cameraCapability?.canRequest;

  return (
    <div className="scanner-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose?.();
    }}>
      {/* Fallback UI when camera is not available */}
      {cameraUnavailable && !isScanning && !isLoading && (
        <div className="scanner-fallback" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <i className="fa-solid fa-qrcode" style={{ fontSize: '32px', color: '#d97706' }}></i>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
            Camera Scanning Unavailable
          </h3>
          <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.7', marginBottom: '6px' }}>
            {cameraCapability?.reason === 'INSECURE_CONTEXT'
              ? 'Camera access requires a secure connection (HTTPS).'
              : 'Your browser or device does not support camera scanning.'}
          </p>
          <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.7', marginBottom: '24px' }}>
            You can still use a <strong>USB barcode scanner</strong> (it works like a keyboard — just click into the barcode field and scan) or <strong>enter the barcode manually</strong>.
          </p>
          <button type="button" className="btn btn-primary" onClick={onClose} style={{ minWidth: '160px' }}>
            <i className="fa-solid fa-check"></i> Got It
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !cameraUnavailable && (
        <div className="scanner-loading">
          <i className="fa-solid fa-spinner fa-spin"></i>
          <div>Opening Camera...</div>
          <p>Please allow camera access when prompted</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && !cameraUnavailable && (
        <div className="scanner-error">
          <i className="fa-solid fa-exclamation-triangle"></i>
          <div>Camera Error</div>
          <p>{error}</p>
          <div className="scanner-error-actions">
            <button type="button" className="btn btn-info" onClick={() => startScanner()}>
              <i className="fa-solid fa-redo"></i> Try Again
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <i className="fa-solid fa-times"></i> Close
            </button>
          </div>
        </div>
      )}

      {/* Active Scanner */}
      {isScanning && !isLoading && !error && !cameraUnavailable && (
        <>
          {/* Header */}
          <div className="scanner-header">
            <div className="scanner-header-left">
              <i className="fa-solid fa-camera"></i> Point camera at barcode
            </div>
            <div className="scanner-header-right">
              {/* Flashlight Toggle */}
              {hasFlashlight && (
                <button
                  type="button"
                  className="scanner-tool-btn"
                  onClick={toggleFlashlight}
                  title={flashlightOn ? 'Turn off flash' : 'Turn on flash'}
                >
                  <i className="fa-solid fa-lightbulb"
                    style={{ color: flashlightOn ? '#f59e0b' : '#94a3b8' }}
                  ></i>
                </button>
              )}
              {/* Camera Switch */}
              {cameras.length > 1 && (
                <button
                  type="button"
                  className="scanner-tool-btn"
                  onClick={() => {
                    const currentIdx = cameras.findIndex(c => c.deviceId === currentCameraId);
                    const nextIdx = (currentIdx + 1) % cameras.length;
                    switchCamera(cameras[nextIdx].deviceId);
                  }}
                  title="Switch Camera"
                >
                  <i className="fa-solid fa-camera-rotate"></i>
                </button>
              )}
            </div>
          </div>

          {/* Scanner Viewfinder */}
          <div id={scannerId} className="scanner-reader" />

          {/* Camera Selection */}
          {cameras.length > 1 && (
            <div className="scanner-cameras">
              {cameras.map((cam) => (
                <button
                  key={cam.deviceId}
                  type="button"
                  className={`btn btn-sm ${cam.deviceId === currentCameraId ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => switchCamera(cam.deviceId)}
                >
                  {cam.label || `Camera ${cameras.indexOf(cam) + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* Cancel Button */}
          <button
            type="button"
            className="btn btn-danger scanner-cancel"
            onClick={onClose}
          >
            <i className="fa-solid fa-times"></i> Cancel
          </button>
        </>
      )}
    </div>
  );
}