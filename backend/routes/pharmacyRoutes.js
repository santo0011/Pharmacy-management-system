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
  getMyPharmacyProfile,
  updateMyPharmacyProfile,
  getMyInvoiceSettings,
  updateMyInvoiceSettings,
} from '../controllers/pharmacyController.js';
import { protect, authorize } from '../middleware/auth.js';
import { superAdminOnly, pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

// Protected routes - require authentication
router.use(protect);

// Admin self-service routes (no super_admin restriction)
router.get('/my/profile', pharmacyScope, getMyPharmacyProfile);
router.put('/my/profile', pharmacyScope, updateMyPharmacyProfile);
router.get('/my/invoice-settings', pharmacyScope, getMyInvoiceSettings);
router.put('/my/invoice-settings', pharmacyScope, updateMyInvoiceSettings);

// Super Admin only routes below
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