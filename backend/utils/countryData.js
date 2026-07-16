/**
 * Country Data Utility
 * 
 * Maps countries to their default currency, timezone, and date format.
 * Used during pharmacy creation to auto-populate localization settings.
 * Super Admin can override these values later in Platform Settings.
 */

const COUNTRY_DATA = {
  IN: {
    name: 'India',
    code: 'IN',
    currency: 'INR',
    currencySymbol: '₹',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    phoneCode: '+91',
  },
  US: {
    name: 'United States',
    code: 'US',
    currency: 'USD',
    currencySymbol: '$',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    phoneCode: '+1',
  },
  GB: {
    name: 'United Kingdom',
    code: 'GB',
    currency: 'GBP',
    currencySymbol: '£',
    timezone: 'Europe/London',
    dateFormat: 'DD/MM/YYYY',
    phoneCode: '+44',
  },
  AE: {
    name: 'United Arab Emirates',
    code: 'AE',
    currency: 'AED',
    currencySymbol: 'د.إ',
    timezone: 'Asia/Dubai',
    dateFormat: 'DD/MM/YYYY',
    phoneCode: '+971',
  },
  SA: {
    name: 'Saudi Arabia',
    code: 'SA',
    currency: 'SAR',
    currencySymbol: '﷼',
    timezone: 'Asia/Riyadh',
    dateFormat: 'DD/MM/YYYY',
    phoneCode: '+966',
  },
  EU: {
    name: 'European Union',
    code: 'EU',
    currency: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Berlin',
    dateFormat: 'DD/MM/YYYY',
    phoneCode: '+',
  },
  PK: {
    name: 'Pakistan',
    code: 'PK',
    currency: 'PKR',
    currencySymbol: '₨',
    timezone: 'Asia/Karachi',
    dateFormat: 'DD/MM/YYYY',
    phoneCode: '+92',
  },
  BD: {
    name: 'Bangladesh',
    code: 'BD',
    currency: 'BDT',
    currencySymbol: '৳',
    timezone: 'Asia/Dhaka',
    dateFormat: 'DD/MM/YYYY',
    phoneCode: '+880',
  },
  LK: {
    name: 'Sri Lanka',
    code: 'LK',
    currency: 'LKR',
    currencySymbol: '₨',
    timezone: 'Asia/Colombo',
    dateFormat: 'DD/MM/YYYY',
    phoneCode: '+94',
  },
  NP: {
    name: 'Nepal',
    code: 'NP',
    currency: 'NPR',
    currencySymbol: '₨',
    timezone: 'Asia/Kathmandu',
    dateFormat: 'DD/MM/YYYY',
    phoneCode: '+977',
  },
  PH: {
    name: 'Philippines',
    code: 'PH',
    currency: 'PHP',
    currencySymbol: '₱',
    timezone: 'Asia/Manila',
    dateFormat: 'MM/DD/YYYY',
    phoneCode: '+63',
  },
  MY: {
    name: 'Malaysia',
    code: 'MY',
    currency: 'MYR',
    currencySymbol: 'RM',
    timezone: 'Asia/Kuala_Lumpur',
    dateFormat: 'DD/MM/YYYY',
    phoneCode: '+60',
  },
  SG: {
    name: 'Singapore',
    code: 'SG',
    currency: 'SGD',
    currencySymbol: 'S$',
    timezone: 'Asia/Singapore',
    dateFormat: 'DD/MM/YYYY',
    phoneCode: '+65',
  },
  AU: {
    name: 'Australia',
    code: 'AU',
    currency: 'AUD',
    currencySymbol: 'A$',
    timezone: 'Australia/Sydney',
    dateFormat: 'DD/MM/YYYY',
    phoneCode: '+61',
  },
  CA: {
    name: 'Canada',
    code: 'CA',
    currency: 'CAD',
    currencySymbol: 'C$',
    timezone: 'America/Toronto',
    dateFormat: 'YYYY-MM-DD',
    phoneCode: '+1',
  },
};

/**
 * Get country data by country code
 * @param {string} code - ISO 2-letter country code
 * @returns {object|null} Country data object or null if not found
 */
export const getCountryByCode = (code) => {
  return COUNTRY_DATA[code] || null;
};

/**
 * Get all countries as an array
 * @returns {Array} Array of country data objects
 */
export const getAllCountries = () => {
  return Object.values(COUNTRY_DATA);
};

/**
 * Get country options for dropdown/select inputs
 * @returns {Array} Array of { value, label } objects sorted by label
 */
export const getCountryOptions = () => {
  return Object.values(COUNTRY_DATA)
    .map(c => ({ value: c.code, label: `${c.name} (${c.currency} - ${c.currencySymbol})` }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

/**
 * Get currency options for dropdown/select inputs
 * @returns {Array} Array of { value, label, symbol } objects
 */
export const getCurrencyOptions = () => {
  const seen = new Set();
  return Object.values(COUNTRY_DATA)
    .filter(c => {
      if (seen.has(c.currency)) return false;
      seen.add(c.currency);
      return true;
    })
    .map(c => ({ value: c.currency, label: `${c.currency} (${c.currencySymbol})`, symbol: c.currencySymbol }))
    .sort((a, b) => a.value.localeCompare(b.value));
};

/**
 * Get timezone options for dropdown/select inputs
 * @returns {Array} Array of { value, label } objects
 */
export const getTimezoneOptions = () => {
  const seen = new Set();
  return Object.values(COUNTRY_DATA)
    .filter(c => {
      if (seen.has(c.timezone)) return false;
      seen.add(c.timezone);
      return true;
    })
    .map(c => ({ value: c.timezone, label: c.timezone }))
    .sort((a, b) => a.value.localeCompare(b.value));
};

export default COUNTRY_DATA;