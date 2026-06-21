import express from 'express';
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
} from '../controllers/categoryController.js';
import { protect } from '../middleware/auth.js';
import { pharmacyScope, pharmacyOnly } from '../middleware/pharmacyAccess.js';
import { uploadCategoryImage, handleUploadError } from '../middleware/upload.js';

const router = express.Router();

router.use(protect);
router.use(pharmacyScope);
router.use(pharmacyOnly);

router.route('/')
  .get(getCategories)
  .post(uploadCategoryImage.single('image'), handleUploadError, createCategory);

router.route('/:id')
  .get(getCategory)
  .put(uploadCategoryImage.single('image'), handleUploadError, updateCategory)
  .delete(deleteCategory);

router.patch('/:id/status', toggleCategoryStatus);

export default router;