import API from './api';

export const reportService = {
  getSalesReport: (params) => API.get('/reports/sales', { params }),
  getPurchaseReport: (params) => API.get('/reports/purchases', { params }),
  getProfitLoss: (params) => API.get('/reports/profit-loss', { params }),
  getStockReport: (params) => API.get('/reports/stock', { params }),
  getGstSummary: (params) => API.get('/reports/gst/summary', { params }),
  getGstHsn: (params) => API.get('/reports/gst/hsn', { params }),
  getGstRates: (params) => API.get('/reports/gst/rates', { params }),
  getGstLiability: (params) => API.get('/reports/gst/liability', { params }),
  getGstTransactions: (params) => API.get('/reports/gst/transactions', { params }),
};
