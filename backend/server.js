import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';
import seedSuperAdmin from './config/seed.js';
import errorHandler from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import pharmacyRoutes from './routes/pharmacyRoutes.js';
import subscriptionPlanRoutes from './routes/subscriptionPlanRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Connect to MongoDB and seed super admin
connectDB().then(() => {
  seedSuperAdmin();
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
app.use('/api/pharmacies', pharmacyRoutes);
app.use('/api/subscription-plans', subscriptionPlanRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});