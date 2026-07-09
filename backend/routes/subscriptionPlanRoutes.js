import express from 'express';
import {
  createPlan,
  getPlans,
  getActivePlans,
  getPlan,
  updatePlan,
  togglePlanStatus,
  deletePlan,
} from '../controllers/subscriptionPlanController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All subscription plan routes are Super Admin only
router.use(protect);
router.use(authorize('super_admin'));

// Active plans route (must come before /:id)
router.get('/active', getActivePlans);

router.route('/')
  .get(getPlans)
  .post(createPlan);

router.route('/:id')
  .get(getPlan)
  .put(updatePlan)
  .delete(deletePlan);

router.patch('/:id/status', togglePlanStatus);

export default router;