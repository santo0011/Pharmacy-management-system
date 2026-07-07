import express from 'express';
import {
  exportBackup,
  importBackup,
  getBackupInfo,
} from '../controllers/backupController.js';
import { protect, authorize } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';
import { checkSubscription } from '../middleware/subscriptionCheck.js';

const router = express.Router();

router.use(protect);
router.use(pharmacyScope);

router.get('/info', getBackupInfo);
router.get('/export', authorize('admin', 'super_admin'), checkSubscription, exportBackup);
router.post('/import', authorize('super_admin'), importBackup);

export default router;