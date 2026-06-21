import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import categoryReducer from './slices/categorySlice';
import brandReducer from './slices/brandSlice';
import supplierReducer from './slices/supplierSlice';
import pharmacyReducer from './slices/pharmacySlice';
import staffReducer from './slices/staffSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: userReducer,
    categories: categoryReducer,
    brands: brandReducer,
    suppliers: supplierReducer,
    pharmacies: pharmacyReducer,
    staff: staffReducer,
  },
});
