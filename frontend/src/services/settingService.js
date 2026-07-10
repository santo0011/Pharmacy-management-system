import API from './api';

export const settingService = {
  getSettings: () => API.get('/settings'),
  updateSettings: (data) => API.put('/settings', data),
  initDefaults: () => API.post('/settings/init'),
  getSettingByKey: (key) => API.get(`/settings/${key}`),
};