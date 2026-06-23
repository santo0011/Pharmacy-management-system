import API from './api';

export const reportService = {
  getSalesReport: (params) => API.get('/reports/sales', { params }),
  getPurchaseReport: (params) => API.get('/reports/purchases', { params }),
  getProfitLoss: (params) => API.get('/reports/profit-loss', { params }),
  getStockReport: (params) => API.get('/reports/stock', { params }),
};