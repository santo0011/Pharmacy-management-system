import API from './api';

export const ledgerService = {
  getCustomerLedger: (customerId, params) => API.get(`/customers/${customerId}/ledger`, { params }),
  getSupplierLedger: (supplierId, params) => API.get(`/suppliers/${supplierId}/ledger`, { params }),
};