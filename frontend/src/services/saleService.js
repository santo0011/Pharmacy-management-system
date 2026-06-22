import API from './api';

export const saleService = {
  getSales: (params) => API.get('/sales', { params }),
  getSale: (id) => API.get(`/sales/${id}`),
  createSale: (data) => API.post('/sales', data),
  returnSale: (id) => API.post(`/sales/${id}/return`),
  deleteSale: (id) => API.delete(`/sales/${id}`),
  getSaleStats: () => API.get('/sales/stats'),
};