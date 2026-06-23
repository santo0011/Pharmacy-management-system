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

router.get('/dues', getSupplierDues);
router.patch('/:id/status', toggleSupplierStatus);

export default router;
