/**
 * Exchange Rate Service
 * 
 * Fetches live exchange rates from the free Frankfurter API (https://api.frankfurter.app).
 * Caches rates in localStorage with a 12-hour refresh interval.
 * All amounts are always stored in the pharmacy's base currency.
 * This service only provides DISPLAY conversion, never modifies stored values.
 */

const API_BASE = 'https://api.frankfurter.app';
const CACHE_KEY = 'pharmacy_exchange_rates';
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours
const DEFAULT_CURRENCY = 'INR';

// Popular currencies for conversion display
export const POPULAR_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: '₨' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: '₨' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
];

/**
 * Get cached exchange rate data from localStorage.
 * Returns null if cache is expired or doesn't exist.
 */
function getCachedRates() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid
    if (now - data.timestamp < CACHE_DURATION) {
      return data;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Save exchange rate data to localStorage cache.
 */
function setCachedRates(baseCurrency, rates, lastUpdated) {
  try {
    const data = {
      base: baseCurrency,
      rates,
      timestamp: Date.now(),
      lastUpdated: lastUpdated || new Date().toISOString(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be full - silently fail
  }
}

/**
 * Fetch live exchange rates from Frankfurter API.
 * @param {string} baseCurrency - 3-letter base currency code (e.g., 'INR')
 * @param {string[]} targetCurrencies - Array of target currency codes (e.g., ['USD', 'EUR', 'BDT'])
 * @returns {Promise<Object>} { rates: {USD: 0.012, ...}, lastUpdated: ISO string }
 */
async function fetchLiveRates(baseCurrency, targetCurrencies) {
  // Frankfurter API: /latest?from=BASE&to=TARGET1,TARGET2,...
  const toParam = targetCurrencies.join(',');
  const url = `${API_BASE}/latest?from=${baseCurrency}&to=${toParam}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Exchange rate API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Frankfurter returns: { amount: 1, base: "INR", date: "2026-07-15", rates: { USD: 0.012, ... } }
  return {
    rates: data.rates || {},
    lastUpdated: data.date ? new Date(data.date + 'T00:00:00Z').toISOString() : new Date().toISOString(),
  };
}

/**
 * Get exchange rates for the given base currency to target currencies.
 * Uses cached rates if available and fresh, otherwise fetches from API.
 * Falls back to cached rates on API failure.
 * 
 * @param {string} baseCurrency - 3-letter base currency code (default: from cache or INR)
 * @param {string[]} targetCurrencies - Array of target currency codes (default: popular currencies)
 * @returns {Promise<Object>} { rates: {USD: 0.012, ...}, lastUpdated: ISO string, fromCache: boolean, error: string|null }
 */
export async function getExchangeRates(baseCurrency, targetCurrencies) {
  // Determine base currency
  const base = baseCurrency || DEFAULT_CURRENCY;

  // Determine target currencies
  const targets = targetCurrencies && targetCurrencies.length > 0
    ? targetCurrencies
    : POPULAR_CURRENCIES.map(c => c.code);

  // Check cache first
  const cached = getCachedRates();
  if (cached && cached.base === base) {
    // Filter cached rates to only include requested targets
    const filteredRates = {};
    let hasAllTargets = true;
    for (const code of targets) {
      if (cached.rates[code] !== undefined) {
        filteredRates[code] = cached.rates[code];
      } else {
        hasAllTargets = false;
        break;
      }
    }

    if (hasAllTargets) {
      return {
        rates: filteredRates,
        lastUpdated: cached.lastUpdated,
        fromCache: true,
        error: null,
      };
    }
  }

  // Fetch live rates
  try {
    const live = await fetchLiveRates(base, targets);
    setCachedRates(base, live.rates, live.lastUpdated);

    return {
      rates: live.rates,
      lastUpdated: live.lastUpdated,
      fromCache: false,
      error: null,
    };
  } catch (error) {
    console.warn('Failed to fetch exchange rates:', error.message);

    // Fall back to cache even if expired
    if (cached && cached.base === base) {
      const filteredRates = {};
      for (const code of targets) {
        if (cached.rates[code] !== undefined) {
          filteredRates[code] = cached.rates[code];
        }
      }

      if (Object.keys(filteredRates).length > 0) {
        return {
          rates: filteredRates,
          lastUpdated: cached.lastUpdated,
          fromCache: true,
          error: 'Could not refresh rates. Showing last cached values.',
        };
      }
    }

    // No data available at all
    return {
      rates: {},
      lastUpdated: null,
      fromCache: false,
      error: 'Exchange rates unavailable. Please try again later.',
    };
  }
}

/**
 * Convert an amount from base currency to a target currency.
 * 
 * @param {number} amount - Amount in base currency
 * @param {string} baseCurrency - Base currency code
 * @param {string} targetCurrency - Target currency code
 * @param {Object} rates - Exchange rates object (from getExchangeRates)
 * @returns {number|null} Converted amount, or null if conversion is not possible
 */
export function convertCurrency(amount, baseCurrency, targetCurrency, rates) {
  if (!rates || !rates[targetCurrency]) return null;
  if (baseCurrency === targetCurrency) return amount;

  const rate = rates[targetCurrency];
  return amount * rate;
}

/**
 * Format a converted amount with its currency code.
 * 
 * @param {number} amount - The converted amount
 * @param {string} currencyCode - 3-letter currency code
 * @param {string} symbol - Currency symbol
 * @returns {string} Formatted string (e.g., "$ 11.65 USD")
 */
export function formatConvertedAmount(amount, currencyCode, symbol) {
  if (amount === null || amount === undefined) return '';
  const sym = symbol || currencyCode;
  const formatted = Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sym} ${formatted} ${currencyCode}`;
}

/**
 * Get the last cached update time as a formatted string.
 * @returns {string|null} Formatted date string or null
 */
export function getCachedUpdateTime() {
  const cached = getCachedRates();
  if (!cached || !cached.lastUpdated) return null;

  try {
    const date = new Date(cached.lastUpdated);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

/**
 * Check if cached rates are still fresh.
 * @returns {boolean}
 */
export function isCacheFresh() {
  const cached = getCachedRates();
  if (!cached) return false;

  const now = Date.now();
  return now - cached.timestamp < CACHE_DURATION;
}

/**
 * Get the base currency that the cache is using, if any.
 * @returns {string|null}
 */
export function getCachedBaseCurrency() {
  const cached = getCachedRates();
  return cached ? cached.base : null;
}