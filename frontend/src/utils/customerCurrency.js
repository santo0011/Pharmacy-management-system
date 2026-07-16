/**
 * Customer Module Currency Formatter
 * 
 * Provides styled currency display for the Customer module only.
 * Renders the currency symbol slightly larger and bolder than the amount,
 * with a space between them for better visibility.
 */

import { formatCurrency, getCurrentSymbol } from './currency';

/**
 * Format an amount for customer module display with styled symbol.
 * Returns a React span element with the symbol styled larger/bolder.
 * 
 * @param {number} amount - The amount to display
 * @param {object} options - Display options
 * @param {string} options.symbol - Override currency symbol
 * @param {number} options.decimals - Number of decimal places
 * @param {string} options.className - Additional CSS class
 * @param {object} options.style - Additional inline styles
 * @returns {object} React element configuration { type: 'span', props }
 */
export const formatCustomerCurrency = (amount, options = {}) => {
  const sym = options.symbol || getCurrentSymbol();
  const value = Number(amount) || 0;
  const decimals = options.decimals !== undefined ? options.decimals : 2;
  const formattedValue = value.toLocaleString('en-IN', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
  
  return {
    type: 'span',
    props: {
      className: options.className || '',
      style: {
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '2px',
        ...(options.style || {}),
      },
      children: [
        {
          type: 'span',
          props: {
            style: {
              fontSize: '1.15em',
              fontWeight: 700,
              lineHeight: 1,
            },
            children: sym,
          },
        },
        {
          type: 'span',
          props: {
            style: {
              fontSize: 'inherit',
              fontWeight: 'inherit',
            },
            children: formattedValue,
          },
        },
      ],
    },
  };
};

/**
 * Create a styled currency symbol string for use in non-React contexts.
 * @param {string} symbol - Override currency symbol
 * @returns {string} The current currency symbol
 */
export const getStyledCurrencySymbol = (symbol = null) => {
  return symbol || getCurrentSymbol();
};

export default {
  formatCustomerCurrency,
  getStyledCurrencySymbol,
  getCurrentSymbol,
  formatCurrency,
};