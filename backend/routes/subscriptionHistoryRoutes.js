import express from 'express';
import {
  getSubscriptionHistory,
  getMySubscriptionHistory,
  getAllSubscriptionHistory,
  deleteSubscriptionHistory,
} from '../controllers/subscriptionHistoryController.js';
import { protect, authorize } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin self-service route
router.get('/my', pharmacyScope, getMySubscriptionHistory);

// Super Admin routes
router.get('/', authorize('super_admin'), getAllSubscriptionHistory);
router.get('/:pharmacyId', authorize('super_admin'), getSubscriptionHistory);
router.delete('/:id', authorize('super_admin'), deleteSubscriptionHistory);

export default router;
