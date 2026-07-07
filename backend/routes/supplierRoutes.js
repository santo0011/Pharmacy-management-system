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

router.route('/:id')
  .get(getSupplier)
  .put(updateSupplier)
  .delete(deleteSupplier);

router.post('/bulk-import', bulkImportSuppliers);
router.get('/dues', getSupplierDues);
router.patch('/:id/status', toggleSupplierStatus);

export default router;
