/**
 * Centralized Currency Utility
 * 
 * Provides currency symbol and formatting based on the pharmacy's own currency setting.
 * The system works as follows:
 *   1. On login/app load, platform settings are loaded (old behavior) → cachedSymbol
 *   2. After pharmacy profile is loaded, pharmacy.currencySymbol overrides → pharmacySymbol
 *   3. formatCurrency() uses pharmacySymbol first, falls back to cachedSymbol, then ₹
 * 
 * This ensures the pharmacy's own currency is always the single source of truth.
 */

// Currency code to symbol mapping (used by both country and currency code lookups)
const CURRENCY_SYMBOL_MAP = {
  INR: '₹',
  USD: '$',
  GBP: '£',
  EUR: '€',
  AED: 'د.إ',
  SAR: '﷼',
  PKR: '₨',
  BDT: '৳',
  LKR: '₨',
  NPR: '₨',
  PHP: '₱',
  MYR: 'RM',
  SGD: 'S$',
  AUD: 'A$',
  CAD: 'C$',
};

// Country code to currency code mapping
const COUNTRY_TO_CURRENCY = {
  IN: 'INR',
  US: 'USD',
  GB: 'GBP',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
  AE: 'AED',
  SA: 'SAR',
  PK: 'PKR',
  BD: 'BDT',
  LK: 'LKR',
  NP: 'NPR',
  PH: 'PHP',
  MY: 'MYR',
  SG: 'SGD',
  AU: 'AUD',
  CA: 'CAD',
};

// Default fallback
const DEFAULT_SYMBOL = '₹';
const DEFAULT_CURRENCY = 'INR';

// Cache: platform-level (from settings API)
let platformCachedSymbol = null;

// Cache: pharmacy-level (from pharmacy profile) — higher priority
let pharmacyCachedSymbol = null;
let pharmacyCachedCurrency = null;

/**
 * Set the cache from pharmacy profile data.
 * This is called after the pharmacy profile is loaded.
 * Has higher priority than platform settings.
 * @param {string} currency - 3-letter currency code (e.g. 'BDT')
 * @param {string} symbol - Currency symbol (e.g. '৳')
 */
export const setPharmacyCurrency = (currency, symbol) => {
  pharmacyCachedCurrency = currency || null;
  pharmacyCachedSymbol = symbol || null;
};

/**
 * Get the currency symbol for a given code.
 * @param {string} code - 3-letter currency code (e.g. 'INR', 'BDT')
 * @returns {string} Currency symbol
 */
export const getCurrencySymbol = (code) => {
  if (!code) return DEFAULT_SYMBOL;
  const upper = code.toUpperCase();
  return CURRENCY_SYMBOL_MAP[upper] || DEFAULT_SYMBOL;
};

/**
 * Get the currency code for a given country code.
 * @param {string} countryCode - 2-letter ISO country code
 * @returns {string} 3-letter currency code
 */
export const getCurrencyFromCountry = (countryCode) => {
  if (!countryCode) return DEFAULT_CURRENCY;
  const upper = countryCode.toUpperCase();
  return COUNTRY_TO_CURRENCY[upper] || DEFAULT_CURRENCY;
};

/**
 * Format an amount with the currency symbol.
 * Uses pharmacy-level symbol first, then platform-level, then default ₹.
 * @param {number} amount - The amount to format
 * @param {string} overrideSymbol - Optional override symbol
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted amount with currency symbol
 */
export const formatCurrency = (amount, overrideSymbol = null, decimals = 2) => {
  // Priority: override > pharmacy cache > platform cache > default
  const sym = overrideSymbol || pharmacyCachedSymbol || platformCachedSymbol || DEFAULT_SYMBOL;
  const value = Number(amount) || 0;
  return `${sym} ${value.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

/**
 * Set the platform-level cached currency symbol (called when platform settings are loaded).
 * @param {string} symbol - The currency symbol to cache
 */
export const setPlatformCurrencySymbol = (symbol) => {
  platformCachedSymbol = symbol;
};

/**
 * Get the current effective currency symbol.
 * @returns {string} Current effective currency symbol
 */
export const getCurrentSymbol = () => {
  return pharmacyCachedSymbol || platformCachedSymbol || DEFAULT_SYMBOL;
};

/**
 * Get the current effective currency code.
 * @returns {string} Current effective currency code
 */
export const getCurrentCurrency = () => {
  return pharmacyCachedCurrency || DEFAULT_CURRENCY;
};

/**
 * Clear all caches (e.g., on logout).
 */
export const clearCurrencyCache = () => {
  platformCachedSymbol = null;
  pharmacyCachedSymbol = null;
  pharmacyCachedCurrency = null;
};

export default {
  getCurrencySymbol,
  getCurrencyFromCountry,
  formatCurrency,
  setPharmacyCurrency,
  setPlatformCurrencySymbol,
  getCurrentSymbol,
  getCurrentCurrency,
  clearCurrencyCache,
  DEFAULT_SYMBOL,
  DEFAULT_CURRENCY,
};