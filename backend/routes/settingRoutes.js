import express from 'express';
import { getSettings, updateSettings, initializeDefaults, getSettingByKey } from '../controllers/settingController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public/protected routes (for specific key lookups)
router.get('/:key', protect, getSettingByKey);

// Super Admin only routes
router.use(protect);
router.use(authorize('super_admin'));

router.post('/init', initializeDefaults);
router.route('/')
  .get(getSettings)
  .put(updateSettings);

export default router;