import ApiResponse from '../utils/apiResponse.js';
import { getAllCountries, getCountryByCode, getCountryOptions, getCurrencyOptions, getTimezoneOptions } from '../utils/countryData.js';

// @desc    Get all countries
// @route   GET /api/countries
// @access  Private/SuperAdmin
export const getCountries = async (req, res, next) => {
  try {
    const countries = getCountryOptions();
    return ApiResponse.success(res, countries, 'Countries fetched successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get country data by code
// @route   GET /api/countries/:code
// @access  Private
export const getCountry = async (req, res, next) => {
  try {
    const { code } = req.params;
    const country = getCountryByCode(code.toUpperCase());
    if (!country) {
      return ApiResponse.error(res, 'Country not found', 404);
    }
    return ApiResponse.success(res, country, 'Country fetched successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get all currency options
// @route   GET /api/countries/currencies
// @access  Private/SuperAdmin
export const getCurrencies = async (req, res, next) => {
  try {
    const currencies = getCurrencyOptions();
    return ApiResponse.success(res, currencies, 'Currencies fetched successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get all timezone options
// @route   GET /api/countries/timezones
// @access  Private
export const getTimezones = async (req, res, next) => {
  try {
    const timezones = getTimezoneOptions();
    return ApiResponse.success(res, timezones, 'Timezones fetched successfully');
  } catch (error) {
    next(error);
  }
};