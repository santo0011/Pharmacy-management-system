import express from 'express';
import {
  addSubscription,
  cancelSubscription,
  previewSubscription,
  getSubscriptionStatus,
  getMySubscriptionStatus,
  getAllSubscriptions,
  reactivateSubscription,
} from '../controllers/subscriptionController.js';
import { protect, authorize } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Admin self-service route
router.get('/my-status', pharmacyScope, getMySubscriptionStatus);

// Super Admin routes
router.get('/', authorize('super_admin'), getAllSubscriptions);
router.post('/preview', authorize('super_admin'), previewSubscription);
router.post('/', authorize('super_admin'), addSubscription);
router.post('/:id/cancel', authorize('super_admin'), cancelSubscription);
router.post('/:id/reactivate', authorize('super_admin'), reactivateSubscription);
router.get('/status/:pharmacyId', authorize('super_admin'), getSubscriptionStatus);

export default router;