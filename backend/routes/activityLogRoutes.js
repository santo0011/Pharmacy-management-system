import express from 'express';
import {
  getActivityLogs,
  getActivitySummary,
  cleanupActivityLogs,
} from '../controllers/activityLogController.js';
import { protect, authorize } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

router.use(protect);
router.use(pharmacyScope);

router.get('/', authorize('admin', 'super_admin'), getActivityLogs);
router.get('/summary', authorize('admin', 'super_admin'), getActivitySummary);
router.delete('/cleanup', authorize('super_admin'), cleanupActivityLogs);

export default router;