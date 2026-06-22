import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import userReducer from './slices/userSlice';
import categoryReducer from './slices/categorySlice';
import brandReducer from './slices/brandSlice';
import supplierReducer from './slices/supplierSlice';
import pharmacyReducer from './slices/pharmacySlice';
import subscriptionPlanReducer from './slices/subscriptionPlanSlice';
import staffReducer from './slices/staffSlice';
import medicineReducer from './slices/medicineSlice';
import purchaseReducer from './slices/purchaseSlice';
import saleReducer from './slices/saleSlice';
import dashboardReducer from './slices/dashboardSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    users: userReducer,
    categories: categoryReducer,
    brands: brandReducer,
    suppliers: supplierReducer,
    pharmacies: pharmacyReducer,
    subscriptionPlans: subscriptionPlanReducer,
    staff: staffReducer,
    medicines: medicineReducer,
    purchases: purchaseReducer,
    sales: saleReducer,
    dashboard: dashboardReducer,
  },
});
