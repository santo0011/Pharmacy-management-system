/**
 * CurrencyDisplay Component
 * 
 * Displays a currency amount with the pharmacy's configured currency symbol.
 * The symbol is rendered slightly larger and bolder than the amount for better visibility.
 * Uses AnimatedCounter internally for smooth number animation on dashboard cards.
 * 
 * Props:
 *   value (number) - The amount to display
 *   decimals (number) - Number of decimal places (default: 2)
 *   symbol (string) - Override currency symbol
 *   className (string) - Additional CSS class
 *   style (object) - Additional inline styles
 *   symbolStyle (object) - Additional styles for the symbol span
 *   amountStyle (object) - Additional styles for the amount span
 *   animate (boolean) - Enable/disable number animation (default: true)
 *   duration (number) - Animation duration in ms (default: 1000)
 *   compact (boolean) - Use compact notation (K, M, B) (default: false)
 *   cardMode (boolean) - Force card mode / compact mode. If not set, auto-detects card context.
 *   forceDecimals (boolean) - Always show the full decimal places (e.g., 1050.00) even when trailing zeros (default: false)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentSymbol } from '../../utils/currency';

/**
 * Format a number with standard compact notation (K, M, B).
 * Examples:
 *   1026.72 → 1K
 *   15420.50 → 15.4K
 *   1250000 → 1.25M
 *   999 → 999
 */
function formatCompactValue(num) {
  if (num === 0) return '0';

  const abs = Math.abs(num);
  let formatted;
  let suffix;

  if (abs >= 1e9) {
    formatted = (num / 1e9).toFixed(2);
    suffix = 'B';
  } else if (abs >= 1e7) {
    // 10M+ → round to whole millions: 12.5M
    formatted = (num / 1e6).toFixed(1);
    suffix = 'M';
  } else if (abs >= 1e6) {
    // 1M - 9.99M → 2 decimals: 1.25M
    formatted = (num / 1e6).toFixed(2);
    suffix = 'M';
  } else if (abs >= 1000) {
    // 1K - 999K → 1 decimal: 15.4K, but strip trailing .0
    formatted = (num / 1000).toFixed(1);
    suffix = 'K';
  } else {
    // Below 1000, just show the number as-is
    return (num < 0 ? '-' : '') + String(Math.round(num));
  }

  // Strip unnecessary trailing zeros from decimals
  formatted = parseFloat(formatted).toString();

  return (num < 0 ? '-' : '') + formatted + suffix;
}

/**
 * Format a number with Indian comma grouping for the tooltip
 */
function formatFullValue(num) {
  if (typeof num !== 'number' || isNaN(num)) return String(num || 0);
  const abs = Math.abs(num);
  const intPart = Math.floor(abs);
  const hasDecimal = abs % 1 !== 0;

  let result = '';
  const numStr = intPart.toString();
  const len = numStr.length;

  if (len <= 3) {
    result = numStr;
  } else {
    const lastThree = numStr.slice(-3);
    const rest = numStr.slice(0, -3);
    const restGroups = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    result = restGroups + ',' + lastThree;
  }

  if (hasDecimal) {
    const decStr = abs.toFixed(2).split('.')[1];
    if (decStr && parseInt(decStr) > 0) {
      result += '.' + decStr;
    }
  }

  return (num < 0 ? '-' : '') + result;
}

export default function CurrencyDisplay({
  value,
  decimals = 2,
  symbol,
  className = '',
  style = {},
  symbolStyle = {},
  amountStyle = {},
  animate = true,
  duration = 1000,
  compact = false,
  cardMode,
  forceDecimals = false,
}) {
  const sym = symbol || getCurrentSymbol();
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef(null);
  const rafRef = useRef(null);
  const prevValueRef = useRef(0);
  const containerRef = useRef(null);

  // Detect if this currency display is inside a card parent
  const isInsideCard = useCallback(() => {
    if (typeof document === 'undefined' || !containerRef.current) return false;
    let el = containerRef.current.parentElement;
    while (el) {
      if (el.classList && (
        el.classList.contains('card') ||
        el.classList.contains('stat-card') ||
        el.classList.contains('summary-item') ||
        el.classList.contains('purchase-item-card') ||
        el.classList.contains('dashboard-summary-grid') ||
        el.classList.contains('report-card') ||
        el.classList.contains('summary-cards-grid')
      )) {
        return true;
      }
      // Also detect compact summary cards (styled divs with specific inline backgrounds)
      if (el.style && el.style.borderRadius === '10px' && el.style.padding === '14px' && el.tagName === 'DIV') {
        const bg = el.style.background || '';
        const border = el.style.border || '';
        if ((bg.includes('#fff7ed') || bg.includes('#f0fdf4') || bg.includes('#eff6ff') ||
             bg.includes('#fef2f2') || bg.includes('#f8fafc') || bg.includes('#f0f5ff')) &&
            (border.includes('solid') || border.includes('1px'))) {
          return true;
        }
      }
      // Stop traversing if we hit a table, drawer, or modal boundary
      if (el.tagName === 'TABLE' || el.tagName === 'TR' || el.tagName === 'TD' || el.tagName === 'TH' ||
          el.classList.contains('drawer') ||
          el.classList.contains('drawer-body') ||
          el.classList.contains('modal') ||
          el.classList.contains('modal-body')) {
        return false;
      }
      el = el.parentElement;
    }
    return false;
  }, []);

  // Determine effective animation state based on parent context
  const effectiveAnimate = animate && isInsideCard();

  // Determine effective compact mode:
  // - If cardMode prop is explicitly provided, use it
  // - Else if compact prop is true, use it
  // - Else auto-enable compact when inside a card
  const effectiveCompact = cardMode !== undefined ? cardMode : (compact || isInsideCard());

  // Animated counter logic
  useEffect(() => {
    if (!effectiveAnimate) {
      setDisplayValue(Number(value) || 0);
      return;
    }

    const startValue = prevValueRef.current;
    const endValue = Number(value) || 0;
    const delta = endValue - startValue;

    if (delta === 0) {
      setDisplayValue(endValue);
      return;
    }

    const animateFn = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + delta * eased;

      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animateFn);
      } else {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
        startTimeRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(animateFn);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration, effectiveAnimate]);

  const num = displayValue;
  const fullVal = Number(value) || 0;

  // Build the tooltip with the full exact value
  const tooltipText = formatFullValue(fullVal);

  let displayText;
  if (effectiveCompact) {
    displayText = formatCompactValue(num);
  } else {
    const formatted = num.toFixed(decimals);
    const parts = formatted.split('.');
    const integerPart = parts[0];
    const decimalPart = parts.length > 1 ? parts[1] : '';

    // Indian numbering: last 3 digits, then groups of 2
    let withCommas;
    if (integerPart.length <= 3) {
      withCommas = integerPart;
    } else {
      const lastThree = integerPart.slice(-3);
      const rest = integerPart.slice(0, -3);
      const restGroups = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
      withCommas = restGroups + ',' + lastThree;
    }

    // Strip trailing .00 when decimals=2 but value is whole (unless forceDecimals is true)
    if (decimals > 0 && decimalPart) {
      if (forceDecimals) {
        displayText = `${withCommas}.${decimalPart}`;
      } else {
        const trimmedDec = decimalPart.replace(/0+$/, '');
        displayText = trimmedDec ? `${withCommas}.${trimmedDec}` : withCommas;
      }
    } else {
      displayText = withCommas;
    }
  }

  return (
    <span
      ref={containerRef}
      className={`currency-display ${className}`}
      title={tooltipText}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '2px',
        whiteSpace: 'nowrap',
        cursor: 'default',
        ...style,
      }}
    >
      <span
        className="currency-display-symbol"
        style={{
          fontSize: '1.15em',
          fontWeight: 700,
          lineHeight: 1,
          ...symbolStyle,
        }}
      >
        {sym}
      </span>
      <span
        className="currency-display-amount"
        style={{
          fontSize: 'inherit',
          fontWeight: 'inherit',
          ...amountStyle,
        }}
      >
        {displayText}
      </span>
    </span>
  );
}