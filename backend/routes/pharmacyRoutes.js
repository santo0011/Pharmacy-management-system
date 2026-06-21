import express from 'express';
import {
  createPharmacy,
  getPharmacies,
  getPharmacy,
  updatePharmacy,
  deletePharmacy,
  assignPharmacyAdmin,
  togglePharmacyStatus,
  updateSubscription,
} from '../controllers/pharmacyController.js';
import { protect, authorize } from '../middleware/auth.js';
import { superAdminOnly } from '../middleware/pharmacyAccess.js';

const router = express.Router();

// All pharmacy routes are Super Admin only
router.use(protect);
router.use(authorize('super_admin'));

router.route('/')
  .get(getPharmacies)
  .post(createPharmacy);

router.route('/:id')
  .get(getPharmacy)
  .put(updatePharmacy)
  .delete(deletePharmacy);

router.post('/:id/assign-admin', assignPharmacyAdmin);
router.patch('/:id/status', togglePharmacyStatus);
router.put('/:id/subscription', updateSubscription);

export default router;