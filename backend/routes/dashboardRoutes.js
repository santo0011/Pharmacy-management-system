import express from 'express';
import { getSuperAdminDashboard, getPharmacyDashboard, getSubscriptionStatus } from '../controllers/dashboardController.js';
import { protect } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

router.get('/super-admin', protect, getSuperAdminDashboard);
router.get('/pharmacy', protect, pharmacyScope, getPharmacyDashboard);
router.get('/subscription-status', protect, getSubscriptionStatus);

export default router;
