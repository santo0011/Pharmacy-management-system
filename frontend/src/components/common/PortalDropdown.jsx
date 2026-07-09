import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * PortalDropdown - Renders dropdown content at document.body level
 * using React Portal to escape all parent stacking contexts.
 * Uses position:fixed with computed coordinates from trigger element.
 */
export default function PortalDropdown({ triggerRef, show, onClose, children, style }) {
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);

  const updateCoords = useCallback(() => {
    if (triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [triggerRef]);

  useEffect(() => {
    if (show) {
      updateCoords();
      // Update coords on scroll / resize
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
      return () => {
        window.removeEventListener('scroll', updateCoords, true);
        window.removeEventListener('resize', updateCoords);
      };
    }
  }, [show, updateCoords]);

  // Close on escape
  useEffect(() => {
    if (!show) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [show, onClose]);

  // Prevent body scroll when dropdown is open on mobile
  useEffect(() => {
    if (show) {
      // Don't prevent scroll, just let dropdown overlay
    }
  }, [show]);

  if (!show) return null;

  const isMobile = window.innerWidth <= 768;

  const portalContent = (
    <>
      {/* Transparent backdrop to catch clicks outside - use onMouseDown instead of onClick to allow item onMouseDown to preventDefault */}
      <div
        onMouseDown={(e) => {
          // Only close if the backdrop itself was clicked directly, not an item inside the dropdown
          if (!dropdownRef.current || !dropdownRef.current.contains(e.target)) {
            onClose?.();
          }
        }}
        onTouchEnd={(e) => {
          if (!dropdownRef.current || !dropdownRef.current.contains(e.target)) {
            onClose?.();
          }
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1149,
          background: 'transparent',
        }}
      />
      <div
        ref={dropdownRef}
        className="portal-dropdown"
        style={{
          position: 'fixed',
          zIndex: 1150,
          top: isMobile ? Math.min(coords.top, window.innerHeight - 300) : coords.top,
          left: isMobile ? 12 : coords.left,
          width: isMobile ? `calc(100vw - 24px)` : (style?.width || `${coords.width}px`),
          maxHeight: '250px',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          border: '1px solid #e2e8f0',
          ...style,
        }}
      >
        {children}
      </div>
    </>
  );

  return createPortal(portalContent, document.body);
}