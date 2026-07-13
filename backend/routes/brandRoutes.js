import express from 'express';
import {
  getBrands,
  getBrand,
  createBrand,
  updateBrand,
  deleteBrand,
  toggleBrandStatus,
} from '../controllers/brandController.js';
import { bulkImportBrands } from '../controllers/bulkBrandController.js';
import { protect } from '../middleware/auth.js';
import { pharmacyScope, pharmacyOnly } from '../middleware/pharmacyAccess.js';
import { uploadBrandLogo, handleUploadError } from '../middleware/upload.js';

const router = express.Router();

router.use(protect);
router.use(pharmacyScope);
router.use(pharmacyOnly);

router.route('/')
  .get(getBrands)
  .post(uploadBrandLogo.single('logo'), handleUploadError, createBrand);

// Static routes must come before /:id to avoid "bulk-import" being matched as :id
router.post('/bulk-import', bulkImportBrands);

router.route('/:id')
  .get(getBrand)
  .put(uploadBrandLogo.single('logo'), handleUploadError, updateBrand)
  .delete(deleteBrand);

router.patch('/:id/status', toggleBrandStatus);

export default router;