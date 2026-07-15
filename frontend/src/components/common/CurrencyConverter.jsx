import { convertCurrency, formatConvertedAmount, POPULAR_CURRENCIES } from '../../services/exchangeRateService';
import { getCurrentSymbol } from '../../utils/currency';
import useExchangeRates from '../../hooks/useExchangeRates';

/**
 * CurrencyConverter Component
 * 
 * Displays a monetary amount in the pharmacy's base currency alongside
 * equivalent values in other selected currencies.
 * 
 * All financial data remains stored in the base currency.
 * Converted values are DISPLAY ONLY.
 * 
 * Usage:
 *   <CurrencyConverter
 *     value={1000}
 *     showCurrencies={['USD', 'BDT', 'EUR']}
 *     compact={true}
 *   />
 * 
 * Props:
 *   value (number) - The amount in base currency (required)
 *   showCurrencies (array) - Currencies to show (default: ['USD', 'BDT'])
 *   compact (boolean) - Compact row display (default: false)
 *   showBase (boolean) - Show base currency amount (default: true)
 *   className (string) - Additional CSS class
 */
export default function CurrencyConverter({
  value,
  showCurrencies = ['USD', 'BDT'],
  compact = false,
  showBase = true,
  className = '',
}) {
  const { rates, loading, error, lastUpdated, fromCache, baseCurrency } = useExchangeRates();
  const baseSymbol = getCurrentSymbol();

  if (!value && value !== 0) return null;

  const baseAmount = Number(value);
  const getConvertedValue = (targetCode) => {
    const converted = convertCurrency(baseAmount, baseCurrency, targetCode, rates);
    if (converted === null) return null;
    const target = POPULAR_CURRENCIES.find(c => c.code === targetCode);
    return formatConvertedAmount(converted, targetCode, target?.symbol);
  };

  if (compact) {
    // Compact: single line with currency badges
    const convertedItems = showCurrencies
      .map(code => ({ code, display: getConvertedValue(code) }))
      .filter(item => item.display !== null);

    if (convertedItems.length === 0) return null;

    return (
      <span className={`currency-converter ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: 'inherit' }}>
        {/* Show refresh indicator for cached rates */}
        {fromCache && !error && (
          <i className="fa-solid fa-clock" style={{ fontSize: '10px', color: '#94a3b8', cursor: 'help' }}
            title={lastUpdated ? `Rates from ${lastUpdated}` : 'Cached rates'}></i>
        )}
        {error && (
          <i className="fa-solid fa-exclamation-triangle" style={{ fontSize: '10px', color: '#f59e0b', cursor: 'help' }}
            title={error}></i>
        )}
        {convertedItems.map((item) => (
          <span key={item.code} className="currency-converter-badge"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              padding: '1px 6px', borderRadius: '4px',
              background: '#f1f5f9', fontSize: '11px', fontWeight: 500,
              color: '#475569', whiteSpace: 'nowrap',
            }}
            title={`1 ${baseCurrency} = ${rates[item.code] || '?'} ${item.code} (${baseCurrency} ${baseSymbol}${Number(value).toLocaleString('en-US', {minimumFractionDigits: 2})})`}
          >
            {item.display}
          </span>
        ))}
      </span>
    );
  }

  // Full: stacked display
  return (
    <div className={`currency-converter ${className}`} style={{ fontSize: 'inherit' }}>
      {/* Error/warning indicator */}
      {error && (
        <div style={{ fontSize: '11px', color: '#f59e0b', marginBottom: '4px' }}>
          <i className="fa-solid fa-exclamation-triangle"></i> {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
          <i className="fa-solid fa-spinner fa-spin"></i> Loading rates...
        </div>
      )}

      {/* Converted values */}
      {!loading && Object.keys(rates).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {showCurrencies.map(code => {
            const display = getConvertedValue(code);
            if (!display) return null;
            return (
              <div key={code} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '11px', color: '#64748b', lineHeight: '1.6',
              }}>
                <span style={{ fontWeight: 600, color: '#475569' }}>{display}</span>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                  (1 {baseCurrency} = {rates[code]?.toFixed(6)} {code})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Update time */}
      {lastUpdated && (
        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
          <i className="fa-solid fa-clock"></i> {fromCache ? 'Cached: ' : ''}{lastUpdated}
        </div>
      )}
    </div>
  );
}