import { useState, useEffect, useCallback, useRef } from 'react';
import { getExchangeRates, POPULAR_CURRENCIES, getCachedUpdateTime, isCacheFresh, getCachedBaseCurrency } from '../services/exchangeRateService';
import { getCurrentCurrency } from '../utils/currency';

/**
 * useExchangeRates — React hook for fetching and caching exchange rates.
 * 
 * Automatically fetches rates on mount using the pharmacy's base currency.
 * Refreshes when base currency changes.
 * Provides loading, error, and cached states.
 * 
 * @param {Object} options
 * @param {string} options.baseCurrency - Override base currency (default: from currency utils)
 * @param {boolean} options.autoFetch - Auto-fetch on mount (default: true)
 * @returns {Object} { rates, loading, error, lastUpdated, fromCache, refresh, targetCurrencies }
 */
export default function useExchangeRates(options = {}) {
  const { baseCurrency: overrideBase, autoFetch = true } = options;

  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState(overrideBase || getCurrentCurrency());
  const fetchedRef = useRef(false);

  const fetchRates = useCallback(async (currency) => {
    const base = currency || baseCurrency;
    setLoading(true);
    setError(null);

    try {
      const result = await getExchangeRates(base);
      setRates(result.rates);
      setLastUpdated(result.lastUpdated);
      setFromCache(result.fromCache);
      if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to fetch exchange rates');
      console.error('Exchange rates error:', err);
    } finally {
      setLoading(false);
    }
  }, [baseCurrency]);

  // Auto-fetch on mount if configured
  useEffect(() => {
    if (autoFetch && !fetchedRef.current) {
      fetchedRef.current = true;
      // Try to use cached base currency if available
      const cachedBase = getCachedBaseCurrency();
      const effectiveBase = overrideBase || cachedBase || getCurrentCurrency();
      setBaseCurrency(effectiveBase);
      fetchRates(effectiveBase);
    }
  }, [autoFetch, fetchRates, overrideBase]);

  // Refresh function for manual refresh
  const refresh = useCallback(() => {
    fetchRates(baseCurrency);
  }, [fetchRates, baseCurrency]);

  return {
    rates,
    loading,
    error,
    lastUpdated,
    fromCache,
    baseCurrency,
    refresh,
    isFresh: isCacheFresh(),
    targetCurrencies: POPULAR_CURRENCIES,
  };
}