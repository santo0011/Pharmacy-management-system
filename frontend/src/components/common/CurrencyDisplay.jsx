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
 *   compact (boolean) - Use compact notation (K, L, Cr) (default: false)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentSymbol } from '../../utils/currency';

/**
 * Format a number with Indian numbering system (K, L, Cr) and strip trailing .00
 */
function formatCompactValue(num, decimals) {
  if (num === 0) return '0';

  const abs = Math.abs(num);
  let formatted;

  if (abs >= 10000000) {
    formatted = (num / 10000000).toFixed(2);
    formatted = parseFloat(formatted).toString();
    return formatted + 'Cr';
  } else if (abs >= 100000) {
    formatted = (num / 100000).toFixed(2);
    formatted = parseFloat(formatted).toString();
    return formatted + 'L';
  } else if (abs >= 1000) {
    formatted = (num / 1000).toFixed(1);
    formatted = parseFloat(formatted).toString();
    return formatted + 'K';
  }

  const intPart = Math.floor(Math.abs(num));
  const hasDecimals = decimals > 0 && num % 1 !== 0;

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

  if (hasDecimals) {
    const decPart = num.toFixed(decimals).split('.')[1];
    if (decPart && parseInt(decPart) > 0) {
      result += '.' + decPart;
    }
  }

  return (num < 0 ? '-' : '') + result;
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
}) {
  const sym = symbol || getCurrentSymbol();
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef(null);
  const rafRef = useRef(null);
  const prevValueRef = useRef(0);
  const containerRef = useRef(null);

  // Detect if this currency display is inside a card parent
  // Currency animations should ONLY run when inside cards, not tables/drawers/modals
  const isInsideCard = useCallback(() => {
    if (typeof document === 'undefined' || !containerRef.current) return false;
    let el = containerRef.current.parentElement;
    while (el) {
      if (el.classList && (
        el.classList.contains('card') ||
        el.classList.contains('stat-card') ||
        el.classList.contains('summary-item') ||
        el.classList.contains('purchase-item-card') ||
        el.classList.contains('dashboard-summary-grid')
      )) {
        return true;
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
  if (compact) {
    displayText = formatCompactValue(num, decimals);
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

    // Strip trailing .00 when decimals=2 but value is whole
    if (decimals > 0 && decimalPart) {
      const trimmedDec = decimalPart.replace(/0+$/, '');
      displayText = trimmedDec ? `${withCommas}.${trimmedDec}` : withCommas;
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