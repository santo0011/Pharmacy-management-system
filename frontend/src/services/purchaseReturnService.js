import API from './api';

export const purchaseReturnService = {
  returnPurchase: (id, data) => API.post(`/purchases/${id}/return`, data),
  getPurchaseReturns: (id) => API.get(`/purchases/${id}/returns`),
  getAllReturns: (params) => API.get('/purchases/returns/all', { params }),
  getSupplierReturns: (supplierId, params) => API.get(`/purchases/supplier/${supplierId}/returns`, { params }),
};