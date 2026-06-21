import API from './api';

export const categoryService = {
  getAll: (params) => API.get('/categories', { params }),
  getById: (id) => API.get(`/categories/${id}`),
  create: (data) => API.post('/categories', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => API.put(`/categories/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => API.delete(`/categories/${id}`),
  toggleStatus: (id) => API.patch(`/categories/${id}/status`),
};