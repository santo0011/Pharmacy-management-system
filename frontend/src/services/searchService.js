import API from './api';

export const searchService = {
  globalSearch: (q) => API.get('/search', { params: { q } }),
};