import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';
import seedSuperAdmin from './config/seed.js';
import errorHandler from './middleware/errorHandler.js';
import { syncMedicineIndexes } from './config/syncIndexes.js';
import { fixCancelledSales } from './config/fixCancelledSales.js';

import authRoutes from './routes/authRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import pharmacyRoutes from './routes/pharmacyRoutes.js';
import subscriptionPlanRoutes from './routes/subscriptionPlanRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import saleRoutes from './routes/saleRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import subscriptionHistoryRoutes from './routes/subscriptionHistoryRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import activityLogRoutes from './routes/activityLogRoutes.js';
import enhancedDashboardRoutes from './routes/enhancedDashboardRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import countryRoutes from './routes/countryRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Connect to MongoDB, seed super admin, and sync indexes
connectDB().then(async () => {
  seedSuperAdmin();
  await syncMedicineIndexes();
  await fixCancelledSales();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/suppliers', supplierRoutes);
// Pharmacy main router (contains /my/invoice-settings via checkSubscription applied above)
app.use('/api/pharmacies', pharmacyRoutes);
app.use('/api/subscription-plans', subscriptionPlanRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/subscription-history', subscriptionHistoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/dashboard/enhanced', enhancedDashboardRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/countries', countryRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
