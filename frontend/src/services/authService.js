import API from './api';

export const authService = {
  login: (credentials) => API.post('/auth/login', credentials),
  getProfile: () => API.get('/auth/me'),
  updateProfile: (data) => API.put('/auth/profile', data),
  // Super Admin only
  getUsers: (params) => API.get('/auth/users', { params }),
  createUser: (data) => API.post('/auth/users', data),
  updateUser: (id, data) => API.put(`/auth/users/${id}`, data),
  deleteUser: (id) => API.delete(`/auth/users/${id}`),
  resetPassword: (id, data) => API.put(`/auth/users/${id}/reset-password`, data),
};
