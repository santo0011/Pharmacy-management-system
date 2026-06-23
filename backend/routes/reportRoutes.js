import express from 'express';
import {
  getSalesReport,
  getPurchaseReport,
  getProfitLossReport,
  getStockReport,
} from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

router.get('/sales', protect, pharmacyScope, getSalesReport);
router.get('/purchases', protect, pharmacyScope, getPurchaseReport);
router.get('/profit-loss', protect, pharmacyScope, getProfitLossReport);
router.get('/stock', protect, pharmacyScope, getStockReport);

export default router;