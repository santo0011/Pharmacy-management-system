import API from './api';

export const subscriptionHistoryService = {
  getAll: (params) => API.get('/subscription-history', { params }),
  getByPharmacy: (pharmacyId, params) => API.get(`/subscription-history/${pharmacyId}`, { params }),
  getMyHistory: (params) => API.get('/subscription-history/my', { params }),
  deleteRecord: (id) => API.delete(`/subscription-history/${id}`),
};
