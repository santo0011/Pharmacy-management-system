import API from './api';

export const customerService = {
  getCustomers: (params) => API.get('/customers', { params }),
  getCustomer: (phoneOrId, params) => API.get(`/customers/${phoneOrId}`, { params }),
  getCustomerDues: (params) => API.get('/customers/dues', { params }),
  searchCustomers: (q) => API.get('/customers/search', { params: { q } }),
  createCustomer: (data) => API.post('/customers/create', data),
  getCustomerDueInvoices: (customerId, params) => API.get(`/customers/${customerId}/due-invoices`, { params }),
  payDue: (data) => API.post('/customers/pay-due', data),
  getPaymentHistory: (params) => API.get('/customers/payment-history', { params }),
};