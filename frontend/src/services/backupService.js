import api from './api';

export const backupService = {
  getInfo: () => api.get('/backup/info'),
  exportData: () => api.get('/backup/export'),
  importData: (backup) => api.post('/backup/import', { backup }),
};