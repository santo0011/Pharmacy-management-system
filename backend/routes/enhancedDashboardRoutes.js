import express from 'express';
import {
  getComprehensiveDashboard,
  getProfitLossSummary,
} from '../controllers/enhancedDashboardController.js';
import { protect } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';
import { checkSubscription } from '../middleware/subscriptionCheck.js';

const router = express.Router();

router.use(protect);
router.use(pharmacyScope);
router.use(checkSubscription);

router.get('/comprehensive', getComprehensiveDashboard);
router.get('/profit-loss', getProfitLossSummary);

export default router;