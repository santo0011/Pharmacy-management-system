import express from 'express';
import {
  getPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
  getPurchaseStats,
  addPurchasePayment,
  getPurchasePayments,
  getSupplierLedger,
  getSupplierDueInvoices,
} from '../controllers/purchaseController.js';
import {
  returnPurchase,
  getPurchaseReturns,
  getAllReturns,
  getSupplierReturns,
} from '../controllers/purchaseReturnController.js';
import { protect, authorize } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';
import { uploadPurchaseInvoice, handleUploadError } from '../middleware/upload.js';

const router = express.Router();

router.use(protect);
router.use(pharmacyScope);

router.get('/stats', getPurchaseStats);
router.get('/supplier/:supplierId/ledger', getSupplierLedger);
router.get('/supplier/:supplierId/due-invoices', getSupplierDueInvoices);

router.route('/')
  .get(getPurchases)
  .post(authorize('admin', 'pharmacist'), uploadPurchaseInvoice.single('invoiceAttachment'), handleUploadError, createPurchase);

router.route('/:id')
  .get(getPurchase)
  .put(authorize('admin', 'pharmacist'), uploadPurchaseInvoice.single('invoiceAttachment'), handleUploadError, updatePurchase)
  .delete(authorize('admin'), deletePurchase);

router.get('/returns/all', authorize('admin', 'pharmacist'), getAllReturns);
router.get('/supplier/:supplierId/returns', getSupplierReturns);
router.get('/:id/returns', getPurchaseReturns);
router.post('/:id/return', authorize('admin', 'pharmacist'), returnPurchase);

router.route('/:id/payments')
  .get(getPurchasePayments)
  .post(authorize('admin', 'pharmacist'), addPurchasePayment);

export default router;
