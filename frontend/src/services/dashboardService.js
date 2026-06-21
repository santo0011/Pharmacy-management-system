import API from './api';

export const dashboardService = {
  getSuperAdminDashboard: () => API.get('/dashboard/super-admin'),
  getPharmacyDashboard: () => API.get('/dashboard/pharmacy'),
  getSubscriptionStatus: () => API.get('/dashboard/subscription-status'),
};