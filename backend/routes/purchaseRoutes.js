import express from 'express';
import {
  getPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
  getPurchaseStats,
} from '../controllers/purchaseController.js';
import { protect, authorize } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

router.use(protect);
router.use(pharmacyScope);

router.get('/stats', getPurchaseStats);
router.route('/')
  .get(getPurchases)
  .post(authorize('admin', 'pharmacist'), createPurchase);

router.route('/:id')
  .get(getPurchase)
  .put(authorize('admin', 'pharmacist'), updatePurchase)
  .delete(authorize('admin'), deletePurchase);

export default router;