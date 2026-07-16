import API from './api';

export const countryService = {
  getCountries: () => API.get('/countries'),
  getCountry: (code) => API.get(`/countries/${code}`),
  getCurrencies: () => API.get('/countries/currencies'),
  getTimezones: () => API.get('/countries/timezones'),
};