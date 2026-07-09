import { useState, useEffect, useRef } from 'react';

/**
 * Format a number with Indian numbering system (K, L, Cr) and strip trailing .00
 */
function formatCompactValue(num, decimals) {
  if (num === 0) return '0';

  const abs = Math.abs(num);
  let formatted;

  if (abs >= 10000000) {
    // Crores
    formatted = (num / 10000000).toFixed(2);
    formatted = parseFloat(formatted).toString(); // strip trailing zeros
    return formatted + 'Cr';
  } else if (abs >= 100000) {
    // Lakhs
    formatted = (num / 100000).toFixed(2);
    formatted = parseFloat(formatted).toString();
    return formatted + 'L';
  } else if (abs >= 1000) {
    // Thousands
    formatted = (num / 1000).toFixed(1);
    formatted = parseFloat(formatted).toString();
    return formatted + 'K';
  }

  // Below 1000: format with commas in Indian style
  const intPart = Math.floor(Math.abs(num));
  const hasDecimals = decimals > 0 && num % 1 !== 0;

  let result = '';
  const numStr = intPart.toString();
  const len = numStr.length;

  if (len <= 3) {
    result = numStr;
  } else {
    // Indian numbering: last 3 digits, then groups of 2
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

  // Only show decimal if it's not .00
  if (hasDecimal) {
    const decStr = abs.toFixed(2).split('.')[1];
    if (decStr && parseInt(decStr) > 0) {
      result += '.' + decStr;
    }
  }

  return (num < 0 ? '-' : '') + result;
}

export default function AnimatedCounter({ value, duration = 1000, prefix = '', suffix = '', decimals = 0, compact = false }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef(null);
  const rafRef = useRef(null);
  const prevValueRef = useRef(0);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = Number(value) || 0;
    const delta = endValue - startValue;

    if (delta === 0) {
      setDisplayValue(endValue);
      return;
    }

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + delta * eased;

      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
        startTimeRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, duration]);

  // Build the tooltip with the full exact value
  const fullVal = Number(value) || 0;
  const tooltipText = prefix + formatFullValue(fullVal) + suffix;

  let displayText;
  if (compact) {
    displayText = formatCompactValue(displayValue, decimals);
  } else {
    const formatted = displayValue.toFixed(decimals);
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
      title={tooltipText}
      style={{ wordBreak: 'break-word', overflowWrap: 'break-word', cursor: 'default' }}
    >
      {prefix}{displayText}{suffix}
    </span>
  );
}