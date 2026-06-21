import express from 'express';
import { getSettings, updateSettings } from '../controllers/settingController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(authorize('super_admin'));

router.route('/')
  .get(getSettings)
  .put(updateSettings);

export default router;