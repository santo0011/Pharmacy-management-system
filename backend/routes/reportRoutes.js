import express from 'express';
import {
  getSalesReport,
  getPurchaseReport,
  getProfitLossReport,
  getStockReport,
} from '../controllers/reportController.js';
import {
  getGstSummary,
  getHsnSummary,
  getGstRateSummary,
  getGstLiability,
} from '../controllers/gstReportController.js';
import { protect } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

router.get('/sales', protect, pharmacyScope, getSalesReport);
router.get('/purchases', protect, pharmacyScope, getPurchaseReport);
router.get('/profit-loss', protect, pharmacyScope, getProfitLossReport);
router.get('/stock', protect, pharmacyScope, getStockReport);

// GST Reports
router.get('/gst/summary', protect, pharmacyScope, getGstSummary);
router.get('/gst/hsn', protect, pharmacyScope, getHsnSummary);
router.get('/gst/rates', protect, pharmacyScope, getGstRateSummary);
router.get('/gst/liability', protect, pharmacyScope, getGstLiability);

export default router;