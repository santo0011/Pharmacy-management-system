import API from './api';

export const customerService = {
  getCustomers: (params) => API.get('/customers', { params }),
  getCustomer: (phone, params) => API.get(`/customers/${phone}`, { params }),
  getCustomerDues: (params) => API.get('/customers/dues', { params }),
};
