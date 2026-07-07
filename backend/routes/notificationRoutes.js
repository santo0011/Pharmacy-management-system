import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  getUnreadCount,
  generateNotifications,
} from '../controllers/notificationController.js';
import { protect, authorize } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscriptionCheck.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

router.use(protect);
router.use(pharmacyScope);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.delete('/:id', dismissNotification);
router.post('/generate', authorize('admin', 'super_admin'), checkSubscription, generateNotifications);

export default router;