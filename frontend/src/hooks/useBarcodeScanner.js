import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { showError } from '../utils/sweetAlert';

/**
 * useBarcodeScanner — A reusable hook for barcode/QR scanning using html5-qrcode.
 *
 * Features:
 *  - Automatic camera permission detection with environment detection
 *  - Front/back camera switching
 *  - Flashlight toggle
 *  - Duplicate scan prevention
 *  - Mobile-first with optimized fps for low-end devices
 *  - Smart error handling for all scenarios:
 *     - Insecure HTTP context
 *     - Unsupported browser
 *     - Permission denied
 *     - No camera detected
 *     - Camera already in use
 *  - Fallback recommendation when camera is unavailable
 *  - Stops scanner after successful scan (configurable)
 *
 * @param {Object} options
 * @param {Function} options.onScan — called with (decodedText) when a barcode is successfully scanned
 * @param {boolean} options.stopAfterScan — auto-stop scanner after a successful scan (default: true)
 * @param {number} options.fps — scanning frames per second (default: 5, lower = better performance)
 * @param {number} options.qrboxWidth — scanner viewfinder width (default: 220)
 * @param {number} options.qrboxHeight — scanner viewfinder height (default: 150)
 * @param {boolean} options.suppressErrors — if true, won't show error toasts (default: false)
 * @param {string} options.scannerId — unique DOM element ID for the scanner (default: 'barcode-scanner')
 */
export default function useBarcodeScanner(options = {}) {
  const {
    onScan,
    stopAfterScan = true,
    fps = 5,
    qrboxWidth = 220,
    qrboxHeight = 150,
    suppressErrors = false,
    scannerId = 'barcode-scanner',
  } = options;

  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [currentCameraId, setCurrentCameraId] = useState(null);
  const [hasFlashlight, setHasFlashlight] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [capabilityChecked, setCapabilityChecked] = useState(false);

  const scannerRef = useRef(null);
  const isProcessingRef = useRef(false);
  const stopAfterScanRef = useRef(stopAfterScan);
  const onScanRef = useRef(onScan);

  // Keep callback ref up to date
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    stopAfterScanRef.current = stopAfterScan;
  }, [stopAfterScan]);

  /**
   * Detect camera availability on this device/browser.
   * Returns an object with availability info.
   * 
   * NOTE: We do NOT block HTTP/LAN IPs here because many mobile browsers
   * (Chrome on Android, Safari, etc.) allow getUserMedia on local network
   * addresses. The actual permission error will be caught by getUserMedia.
   */
  const checkCameraCapability = useCallback(() => {
    const result = {
      available: false,
      reason: '',
      canRequest: false,
    };

    // Check 1: Is navigator.mediaDevices available?
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      result.reason = 'BROWSER_UNSUPPORTED';
      return result;
    }

    // Check 2: Is getUserMedia available?
    if (typeof navigator.mediaDevices.getUserMedia !== 'function') {
      result.reason = 'BROWSER_UNSUPPORTED';
      return result;
    }

    // Check 3: Check if we might be in an insecure context that blocks camera
    // We warn but don't block — let getUserMedia decide
    if (window.location && window.location.protocol !== 'https:' && 
        window.location.hostname !== 'localhost' && 
        window.location.hostname !== '127.0.0.1') {
      // Some browsers may block. We'll try anyway and catch the error.
      result.reason = 'POSSIBLY_INSECURE';
    }

    result.canRequest = true;
    result.available = true;
    return result;
  }, []);

  /**
   * Camera availability state — computed once at mount.
   * Consumers can use this to show fallback UI.
   */
  const cameraCapability = useMemo(() => {
    return checkCameraCapability();
  }, [checkCameraCapability]);

  /**
   * Enumerate available cameras and check flashlight support.
   */
  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setCameras(videoDevices);
      if (videoDevices.length > 0 && !currentCameraId) {
        // Default to back camera (environment)
        const backCam = videoDevices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('environment') ||
          d.label.toLowerCase().includes('rear')
        );
        setCurrentCameraId(backCam?.deviceId || videoDevices[0].deviceId);
      }
      return videoDevices;
    } catch {
      return [];
    }
  }, [currentCameraId]);

  /**
   * Request camera permission explicitly before starting scanner.
   */
  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      stream.getTracks().forEach(t => t.stop());
      setHasPermission(true);
      setError('');
      setCapabilityChecked(true);
      return true;
    } catch (err) {
      setHasPermission(false);
      setCapabilityChecked(true);

      const errName = (err.name || '').toLowerCase();
      const errMsg = (err.message || '').toLowerCase();

      let msg;
      // Permission denied
      if (errName.includes('notallowederror') || errName.includes('permissiondenied') ||
          errMsg.includes('permission') || errMsg.includes('not allowed')) {
        msg = 'Camera permission denied. Please allow camera access in your browser settings, or use a barcode scanner device / manual input.';
      }
      // No camera / source unavailable
      else if (errName.includes('notfound') || errName.includes('sourceunavailable') ||
               errName.includes('devicenotfound') ||
               errMsg.includes('no camera') || errMsg.includes('no device')) {
        msg = 'No camera found on this device. You can still use a USB barcode scanner or enter the barcode manually.';
      }
      // Camera in use
      else if (errName.includes('notreadable') || errMsg.includes('in use') || errMsg.includes('busy')) {
        msg = 'Camera is already in use by another application. Please close other apps and try again, or use manual input.';
      }
      // Security / HTTPS required  
      else if (errName.includes('security') || errName.includes('aborterror') ||
               errMsg.includes('https') || errMsg.includes('secure')) {
        msg = 'Camera access requires a secure connection (HTTPS). Camera scanning is unavailable. You can still use a USB barcode scanner or enter the barcode manually.';
      }
      // Unknown / fallback
      else {
        msg = 'Camera scanning is unavailable. You can still scan using a barcode scanner device or enter the barcode manually.';
      }
      setError(msg);
      if (!suppressErrors) showError(msg);
      return false;
    }
  }, [suppressErrors]);

  /**
   * Start the barcode scanner.
   * @param {string} [cameraId] — optional specific camera device ID
   */
  const startScanner = useCallback(async (cameraId) => {
    if (isProcessingRef.current) return;

    setIsLoading(true);
    setError('');

    // Run capability check
    const capability = checkCameraCapability();

    if (!capability.canRequest) {
      setIsLoading(false);
      let msg;
      if (capability.reason === 'INSECURE_CONTEXT') {
        msg = 'Camera access requires a secure connection (HTTPS). Camera scanning is unavailable. You can still use a USB barcode scanner or enter the barcode manually.';
      } else if (capability.reason === 'BROWSER_UNSUPPORTED') {
        msg = 'Your browser does not support camera scanning. You can still use a USB barcode scanner or enter the barcode manually.';
      } else {
        msg = 'Camera scanning is unavailable. You can still scan using a barcode scanner device or enter the barcode manually.';
      }
      setError(msg);
      if (!suppressErrors) showError(msg);
      return;
    }

    try {
      // Request permission first
      const permitted = await requestPermission();
      if (!permitted) {
        setIsLoading(false);
        return;
      }

      // Get available cameras before creating scanner
      const videoDevices = await enumerateCameras();

      // Double-check no cameras were found
      if (!videoDevices || videoDevices.length === 0) {
        setIsLoading(false);
        const msg = 'No camera found on this device. You can still use a USB barcode scanner or enter the barcode manually.';
        setError(msg);
        if (!suppressErrors) showError(msg);
        return;
      }

      // Dynamically import html5-qrcode
      const { Html5Qrcode } = await import('html5-qrcode');

      // Clean up any existing scanner instance
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop().catch(() => {});
          scannerRef.current.clear().catch(() => {});
        } catch {}
        scannerRef.current = null;
      }

      // Ensure the scanner container exists and is empty
      const container = document.getElementById(scannerId);
      if (container) {
        container.innerHTML = '';
      }

      // Create new scanner instance
      scannerRef.current = new Html5Qrcode(scannerId);

      // Build camera config
      const effectiveCamerId = cameraId || currentCameraId;
      const cameraConfig = effectiveCamerId
        ? { deviceId: { exact: effectiveCamerId } }
        : { facingMode: 'environment' };

      // Check flashlight support (back camera only)
      try {
        const track = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', advanced: [{ torch: true }] },
        });
        track.getTracks().forEach(t => t.stop());
        setHasFlashlight(true);
      } catch {
        setHasFlashlight(false);
        setFlashlightOn(false);
      }

      // Start scanning with lower fps for better compatibility on low-end devices
      await scannerRef.current.start(
        cameraConfig,
        {
          fps,
          qrbox: { width: qrboxWidth, height: qrboxHeight },
          aspectRatio: 1.7777,
        },
        async (decodedText) => {
          // Prevent duplicate scan events
          if (isProcessingRef.current) return;
          isProcessingRef.current = true;

          try {
            if (onScanRef.current) {
              await onScanRef.current(decodedText);
            }
          } catch {}

          if (stopAfterScanRef.current) {
            await stopScanner();
          }
          isProcessingRef.current = false;
        },
        () => {
          // QR code not found — fires on every frame, ignore it
        }
      );

      setIsScanning(true);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      setIsScanning(false);
      console.error('Scanner start error:', err);

      let msg;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera access and try again, or use a barcode scanner device.';
      } else if (err.name === 'NotFoundError') {
        msg = 'No camera found on this device. You can still use a USB barcode scanner or enter the barcode manually.';
      } else if (err.name === 'NotReadableError') {
        msg = 'Camera is already in use by another application. Please close other apps and try again, or use manual input.';
      } else if (err.message && err.message.includes('NotAllowedError')) {
        msg = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else {
        msg = 'Camera scanning is unavailable. You can still scan using a barcode scanner device or enter the barcode manually.';
      }
      setError(msg);
      if (!suppressErrors) showError(msg);
    }
  }, [fps, qrboxWidth, qrboxHeight, requestPermission, suppressErrors, scannerId, enumerateCameras,
      checkCameraCapability, currentCameraId]);

  /**
   * Switch to a specific camera by device ID.
   */
  const switchCamera = useCallback(async (deviceId) => {
    if (!deviceId || isProcessingRef.current) return;
    setCurrentCameraId(deviceId);

    if (scannerRef.current) {
      try {
        await scannerRef.current.stop().catch(() => {});
      } catch {}
    }

    await startScanner(deviceId);
  }, [startScanner]);

  /**
   * Toggle flashlight on/off (only available on some back cameras).
   */
  const toggleFlashlight = useCallback(async () => {
    if (!hasFlashlight || !scannerRef.current) return;

    try {
      const newState = !flashlightOn;
      await scannerRef.current['_']?.torch?.(newState);
      setFlashlightOn(newState);
    } catch {
      // Flashlight not supported
    }
  }, [hasFlashlight, flashlightOn]);

  /**
   * Stop the scanner and clean up.
   */
  const stopScanner = useCallback(async () => {
    isProcessingRef.current = true;
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
      } catch {}
      scannerRef.current = null;
    }
    setIsScanning(false);
    setIsLoading(false);
    setError('');
    isProcessingRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
          scannerRef.current.clear().catch(() => {});
        } catch {}
        scannerRef.current = null;
      }
    };
  }, []);

  return {
    isScanning,
    isLoading,
    hasPermission,
    cameras,
    currentCameraId,
    hasFlashlight,
    flashlightOn,
    error,
    capabilityChecked,
    cameraCapability,
    startScanner,
    stopScanner,
    switchCamera,
    toggleFlashlight,
    setHasPermission,
    requestPermission,
  };
}