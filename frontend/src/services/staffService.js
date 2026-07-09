import API from './api';

export const staffService = {
  getStaff: (params) => API.get('/staff', { params }),
  createStaff: (data) => API.post('/staff', data),
  updateStaff: (id, data) => API.put(`/staff/${id}`, data),
  deleteStaff: (id) => API.delete(`/staff/${id}`),
  toggleStatus: (id) => API.patch(`/staff/${id}/status`),
};