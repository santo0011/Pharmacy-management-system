import API from './api';

export const subscriptionPlanService = {
  getPlans: (params) => API.get('/subscription-plans', { params }),
  getActivePlans: () => API.get('/subscription-plans/active'),
  getPlan: (id) => API.get(`/subscription-plans/${id}`),
  createPlan: (data) => API.post('/subscription-plans', data),
  updatePlan: (id, data) => API.put(`/subscription-plans/${id}`, data),
  toggleStatus: (id) => API.patch(`/subscription-plans/${id}/status`),
  deletePlan: (id) => API.delete(`/subscription-plans/${id}`),
};