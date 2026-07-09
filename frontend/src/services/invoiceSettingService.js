import API from './api';

export const invoiceSettingService = {
  getMySettings: () => API.get('/pharmacies/my/invoice-settings'),
  updateMySettings: (data) => API.put('/pharmacies/my/invoice-settings', data),
};