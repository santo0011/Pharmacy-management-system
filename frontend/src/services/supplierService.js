import API from './api';

export const supplierService = {
  getAll: (params) => API.get('/suppliers', { params }),
  getById: (id) => API.get(`/suppliers/${id}`),
  create: (data) => API.post('/suppliers', data),
  update: (id, data) => API.put(`/suppliers/${id}`, data),
  delete: (id) => API.delete(`/suppliers/${id}`),
  toggleStatus: (id) => API.patch(`/suppliers/${id}/status`),
  getSupplierDues: (params) => API.get('/suppliers/dues', { params }),
};
