import API from './api';

export const profileService = {
  getPharmacyProfile: () => API.get('/pharmacies/my/profile'),
  updatePharmacyProfile: (data) => API.put('/pharmacies/my/profile', data),
};