import API from './api';

export const medicineService = {
  getMedicines: (params) => API.get('/medicines', { params }),
  getMedicine: (id) => API.get(`/medicines/${id}`),
  getMedicineStats: () => API.get('/medicines/stats'),
  createMedicine: (data) => API.post('/medicines', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateMedicine: (id, data) => API.put(`/medicines/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteMedicine: (id) => API.delete(`/medicines/${id}`),
  toggleStatus: (id) => API.patch(`/medicines/${id}/status`),
  checkBarcode: (barcode, excludeId = null) => API.post('/medicines/check-barcode', { barcode, excludeId }),
  lookupBarcode: (barcode) => API.post('/medicines/lookup-barcode', { barcode }),
  bulkImport: (data) => API.post('/medicines/bulk-import', data),
  // Substitute management
  getSubstitutes: (id) => API.get(`/medicines/${id}/substitutes`),
  updateSubstitutes: (id, substituteIds) => API.put(`/medicines/${id}/substitutes`, { substituteIds }),
  getSubstituteSuggestions: (medicineId, requiredQty = 1) => API.get(`/medicines/substitute-suggestions/${medicineId}`, { params: { requiredQty } }),
};
