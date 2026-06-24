import express from 'express';
import {
  getCustomers,
  getCustomer,
  getCustomerDues,
  getCustomerDueInvoices,
  payDue,
  getPaymentHistory,
  getCustomerPaymentHistory,
  searchCustomers,
  createCustomer,
  updateCustomer,
} from '../controllers/customerController.js';
import { protect } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

router.get('/search', protect, pharmacyScope, searchCustomers);
router.post('/create', protect, pharmacyScope, createCustomer);
router.get('/dues', protect, pharmacyScope, getCustomerDues);
router.get('/payment-history', protect, pharmacyScope, getPaymentHistory);
router.post('/pay-due', protect, pharmacyScope, payDue);
router.get('/:phoneOrId/payments', protect, pharmacyScope, getCustomerPaymentHistory);
router.get('/:phoneOrId/due-invoices', protect, pharmacyScope, getCustomerDueInvoices);
router.put('/:phoneOrId', protect, pharmacyScope, updateCustomer);
router.get('/:phoneOrId', protect, pharmacyScope, getCustomer);
router.get('/', protect, pharmacyScope, getCustomers);

export default router;