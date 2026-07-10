import express from 'express';
import {
  getSales,
  getSale,
  createSale,
  updateSale,
  deleteSale,
  returnSale,
  getSaleStats,
  getSaleEditHistory,
  getSalePayments,
} from '../controllers/saleController.js';
import {
  returnSaleItems,
  getSaleReturns,
  getAllSaleReturns,
  getCustomerSaleReturns,
} from '../controllers/saleReturnController.js';
import { protect, authorize } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

router.use(protect);
router.use(pharmacyScope);

router.get('/stats', getSaleStats);
router.get('/:id/payments', getSalePayments);
router.get('/:id/history', getSaleEditHistory);
router.route('/')
  .get(getSales)
  .post(authorize('admin', 'pharmacist', 'cashier'), createSale);

router.post('/:id/return', authorize('admin', 'pharmacist'), returnSale);
router.post('/:id/return-items', authorize('admin', 'pharmacist'), returnSaleItems);
router.get('/returns/all', authorize('admin', 'pharmacist'), getAllSaleReturns);
router.get('/customer/:customerId/returns', getCustomerSaleReturns);
router.get('/:id/returns', getSaleReturns);

router.route('/:id')
  .get(getSale)
  .put(authorize('admin', 'pharmacist'), updateSale)
  .delete(authorize('admin', 'pharmacist'), deleteSale);

export default router;