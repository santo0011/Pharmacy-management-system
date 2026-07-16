import express from 'express';
import {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  toggleSupplierStatus,
  getSupplierDues,
} from '../controllers/supplierController.js';
import { getSupplierLedger } from '../controllers/customerLedgerController.js';
import { bulkImportSuppliers } from '../controllers/bulkSupplierController.js';
import { protect } from '../middleware/auth.js';
import { pharmacyScope, pharmacyOnly } from '../middleware/pharmacyAccess.js';

const router = express.Router();

router.use(protect);
router.use(pharmacyScope);
router.use(pharmacyOnly);

router.route('/')
  .get(getSuppliers)
  .post(createSupplier);

// Static routes must come before /:id to avoid "bulk-import" being matched as :id
router.post('/bulk-import', bulkImportSuppliers);
router.get('/dues', getSupplierDues);

router.route('/:id')
  .get(getSupplier)
  .put(updateSupplier)
  .delete(deleteSupplier);

router.get('/:id/ledger', getSupplierLedger);
router.patch('/:id/status', toggleSupplierStatus);

export default router;
