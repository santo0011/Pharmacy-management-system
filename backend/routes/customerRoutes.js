import express from 'express';
import { getCustomers, getCustomer, getCustomerDues, payDue } from '../controllers/customerController.js';
import { protect } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

router.get('/', protect, pharmacyScope, getCustomers);
router.get('/dues', protect, pharmacyScope, getCustomerDues);
router.post('/pay-due', protect, pharmacyScope, payDue);
router.get('/:phone', protect, pharmacyScope, getCustomer);

export default router;
