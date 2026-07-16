import express from 'express';
import { globalSearch } from '../controllers/globalSearchController.js';
import { protect } from '../middleware/auth.js';
import { pharmacyScope } from '../middleware/pharmacyAccess.js';

const router = express.Router();

router.get('/', protect, pharmacyScope, globalSearch);

export default router;