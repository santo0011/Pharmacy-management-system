import API from './api';

export const purchaseService = {
  getPurchases: (params) => API.get('/purchases', { params }),
  getPurchase: (id) => API.get(`/purchases/${id}`),
  createPurchase: (data) => {
    // If data contains a File, send as FormData for multipart upload.
    // Let axios set the Content-Type with boundary automatically.
    if (data instanceof FormData) {
      return API.post('/purchases', data, {
        headers: { 'Content-Type': undefined },
      });
    }
    return API.post('/purchases', data);
  },
  updatePurchase: (id, data) => {
    // If data contains a File, send as FormData for multipart upload.
    // Let axios set the Content-Type with boundary automatically.
    if (data instanceof FormData) {
      return API.put(`/purchases/${id}`, data, {
        headers: { 'Content-Type': undefined },
      });
    }
    return API.put(`/purchases/${id}`, data);
  },
  deletePurchase: (id) => API.delete(`/purchases/${id}`),
  getPurchaseStats: () => API.get('/purchases/stats'),
  addPurchasePayment: (id, data) => API.post(`/purchases/${id}/payments`, data),
  getPurchasePayments: (id) => API.get(`/purchases/${id}/payments`),
  getSupplierLedger: (supplierId, params) => API.get(`/purchases/supplier/${supplierId}/ledger`, { params }),
  getSupplierDueInvoices: (supplierId) => API.get(`/purchases/supplier/${supplierId}/due-invoices`),
};
