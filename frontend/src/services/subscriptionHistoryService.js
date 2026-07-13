import API from './api';

export const subscriptionHistoryService = {
  getAll: (params) => API.get('/subscription-history', { params }),
  getByPharmacy: (pharmacyId, params) => API.get(`/subscription-history/${pharmacyId}`, { params }),
  getMyHistory: (params) => API.get('/subscription-history/my', { params }),
  deleteRecord: (id) => API.delete(`/subscription-history/${id}`),

  // New subscription management endpoints
  addSubscription: (data) => API.post('/subscriptions', data),
  cancelSubscription: (id, data) => API.post(`/subscriptions/${id}/cancel`, data),
  previewSubscription: (data) => API.post('/subscriptions/preview', data),
  getSubscriptionStatus: (pharmacyId) => API.get(`/subscriptions/status/${pharmacyId}`),
  getMySubscriptionStatus: () => API.get('/subscriptions/my-status'),
  getAllSubscriptions: (params) => API.get('/subscriptions', { params }),
  reactivateSubscription: (id) => API.post(`/subscriptions/${id}/reactivate`),
};