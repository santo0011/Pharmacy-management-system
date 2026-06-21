import API from './api';

export const dashboardService = {
  getSuperAdminDashboard: () => API.get('/dashboard/super-admin'),
};