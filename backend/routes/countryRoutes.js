import express from 'express';
import { getCountries, getCountry, getCurrencies, getTimezones } from '../controllers/countryController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.use(protect);

// Currencies and timezones
router.get('/currencies', getCurrencies);
router.get('/timezones', getTimezones);

// Countries
router.get('/', getCountries);
router.get('/:code', getCountry);

export default router;