import express from 'express';
import { getSuperAdminDashboard } from '../controllers/dashboardController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/super-admin', protect, getSuperAdminDashboard);

export default router;