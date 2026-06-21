import API from './api';

export const pharmacyService = {
  getPharmacies: (params) => API.get('/pharmacies', { params }),
  getPharmacy: (id) => API.get(`/pharmacies/${id}`),
  createPharmacy: (data) => API.post('/pharmacies', data),
  updatePharmacy: (id, data) => API.put(`/pharmacies/${id}`, data),
  deletePharmacy: (id) => API.delete(`/pharmacies/${id}`),
  assignAdmin: (id, userId) => API.post(`/pharmacies/${id}/assign-admin`, { userId }),
  toggleStatus: (id, status) => API.patch(`/pharmacies/${id}/status`, { status }),
  updateSubscription: (id, data) => API.put(`/pharmacies/${id}/subscription`, data),
};