import express from 'express';
import {
  getSales,
  getSale,
  createSale,
  updateSale,
  deleteSale,
  returnSale,
  getSaleStats,
} from '../controllers/saleController.js';
import { protect, authorize } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

router.use(protect);
router.use(pharmacyScope);

router.get('/stats', getSaleStats);
router.route('/')
  .get(getSales)
  .post(authorize('admin', 'pharmacist', 'cashier'), createSale);

router.post('/:id/return', authorize('admin', 'pharmacist'), returnSale);

router.route('/:id')
  .get(getSale)
  .put(authorize('admin', 'pharmacist'), updateSale)
  .delete(authorize('admin', 'pharmacist'), deleteSale);

export default router;