import express from 'express';
import {
  getMedicines,
  getMedicine,
  getMedicineStats,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  toggleMedicineStatus,
  checkBarcode,
  lookupBarcode,
  updateSubstitutes,
  getSubstitutes,
  getSubstituteSuggestions,
} from '../controllers/medicineController.js';
import { bulkImportMedicines } from '../controllers/bulkImportController.js';
import { protect, authorize } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';
import { uploadMedicineImage, handleUploadError } from '../middleware/upload.js';
import { createMedicineValidator, updateMedicineValidator } from '../validators/medicineValidator.js';
import validate from '../validators/validate.js';

const router = express.Router();

router.use(protect);
router.use(pharmacyScope);

// Stats must come before /:id
router.get('/stats', getMedicineStats);

// Barcode routes must come before /:id to prevent route collision
router.post('/check-barcode', checkBarcode);
router.post('/lookup-barcode', lookupBarcode);

// Bulk import (must come before /:id)
router.post('/bulk-import', authorize('admin', 'pharmacist'), bulkImportMedicines);

router.route('/')
  .get(getMedicines)
  .post(
    authorize('admin', 'pharmacist'),
    uploadMedicineImage.single('medicineImage'),
    handleUploadError,
    createMedicineValidator,
    validate,
    createMedicine
  );

router.route('/:id')
  .get(getMedicine)
  .put(
    authorize('admin', 'pharmacist'),
    uploadMedicineImage.single('medicineImage'),
    handleUploadError,
    updateMedicineValidator,
    validate,
    updateMedicine
  )
  .delete(authorize('admin'), deleteMedicine);

router.patch('/:id/status', authorize('admin', 'pharmacist'), toggleMedicineStatus);

// Substitute management routes
router.put('/:id/substitutes', authorize('admin', 'pharmacist'), updateSubstitutes);
router.get('/:id/substitutes', getSubstitutes);
router.get('/substitute-suggestions/:medicineId', getSubstituteSuggestions);

export default router;
