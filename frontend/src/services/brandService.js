import API from './api';

export const brandService = {
  getAll: (params) => API.get('/brands', { params }),
  getById: (id) => API.get(`/brands/${id}`),
  create: (data) => API.post('/brands', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => API.put(`/brands/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => API.delete(`/brands/${id}`),
  toggleStatus: (id) => API.patch(`/brands/${id}/status`),
};