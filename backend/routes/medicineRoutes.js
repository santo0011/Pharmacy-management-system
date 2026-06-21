import express from 'express';
import {
  getMedicines,
  getMedicine,
  getMedicineStats,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  toggleMedicineStatus,
} from '../controllers/medicineController.js';
import { protect, authorize } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';
import { uploadMedicineImage, handleUploadError } from '../middleware/upload.js';
import { createMedicineValidator, updateMedicineValidator } from '../validators/medicineValidator.js';
import validate from '../validators/validate.js';

const router = express.Router();

router.use(protect);
router.use(pharmacyScope);

// Stats route must come before /:id
router.get('/stats', getMedicineStats);

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

export default router;