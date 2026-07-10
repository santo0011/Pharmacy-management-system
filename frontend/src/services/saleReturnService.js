import API from './api';

export const saleReturnService = {
  returnSaleItems: (id, data) => API.post(`/sales/${id}/return-items`, data),
  getSaleReturns: (id) => API.get(`/sales/${id}/returns`),
  getAllSaleReturns: (params) => API.get('/sales/returns/all', { params }),
  getCustomerSaleReturns: (customerId, params) => API.get(`/sales/customer/${customerId}/returns`, { params }),
};