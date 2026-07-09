import api from './api';

export const notificationService = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  dismiss: (id) => api.delete(`/notifications/${id}`),
  generate: () => api.post('/notifications/generate'),
};

export const activityLogService = {
  getAll: (params) => api.get('/activity-logs', { params }),
  getSummary: () => api.get('/activity-logs/summary'),
  cleanup: (days) => api.delete(`/activity-logs/cleanup?days=${days}`),
};