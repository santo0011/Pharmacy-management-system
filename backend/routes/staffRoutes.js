import express from 'express';
import {
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  toggleStaffStatus,
} from '../controllers/staffController.js';
import { protect } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

// All staff routes are protected and scoped to the user's pharmacy
router.use(protect);
router.use(pharmacyScope);

router.route('/')
  .get(getStaff)
  .post(createStaff);

router.route('/:id')
  .put(updateStaff)
  .delete(deleteStaff);

router.patch('/:id/status', toggleStaffStatus);

export default router;