import { body } from 'express-validator';

export const createMedicineValidator = [
  body('medicineName')
    .notEmpty()
    .withMessage('Medicine name is required')
    .trim(),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isMongoId()
    .withMessage('Invalid category'),
  body('brand')
    .notEmpty()
    .withMessage('Brand is required')
    .isMongoId()
    .withMessage('Invalid brand'),
  body('supplier')
    .notEmpty()
    .withMessage('Supplier is required')
    .isMongoId()
    .withMessage('Invalid supplier'),
  body('batchNumber')
    .notEmpty()
    .withMessage('Batch number is required')
    .trim(),
  body('purchasePrice')
    .notEmpty()
    .withMessage('Purchase price is required')
    .isFloat({ gt: 0 })
    .withMessage('Purchase price must be greater than 0'),
  body('sellingPrice')
    .notEmpty()
    .withMessage('Selling price is required')
    .isFloat({ gt: 0 })
    .withMessage('Selling price must be greater than 0'),
  body('expiryDate')
    .notEmpty()
    .withMessage('Expiry date is required')
    .isISO8601()
    .withMessage('Invalid expiry date'),
  body('manufacturingDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid manufacturing date')
    .custom((value, { req }) => {
      if (value && req.body.expiryDate && new Date(value) >= new Date(req.body.expiryDate)) {
        throw new Error('Manufacturing date must be before expiry date');
      }
      return true;
    }),
  body('gst')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('GST must be between 0 and 100'),
  body('currentStock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  body('minStockAlert')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum stock alert must be a non-negative integer'),
];

export const updateMedicineValidator = [
  body('medicineName')
    .optional()
    .notEmpty()
    .withMessage('Medicine name cannot be empty')
    .trim(),
  body('category')
    .optional()
    .isMongoId()
    .withMessage('Invalid category'),
  body('brand')
    .optional()
    .isMongoId()
    .withMessage('Invalid brand'),
  body('supplier')
    .optional()
    .isMongoId()
    .withMessage('Invalid supplier'),
  body('purchasePrice')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Purchase price must be greater than 0'),
  body('sellingPrice')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Selling price must be greater than 0'),
  body('expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid expiry date'),
  body('manufacturingDate')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('Invalid manufacturing date')
    .custom((value, { req }) => {
      if (value && req.body.expiryDate && new Date(value) >= new Date(req.body.expiryDate)) {
        throw new Error('Manufacturing date must be before expiry date');
      }
      return true;
    }),
  body('gst')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('GST must be between 0 and 100'),
  body('unit')
    .optional()
    .isIn(['Tablet', 'Capsule', 'Bottle', 'Syrup', 'Injection', 'Tube', 'Strip', 'Other'])
    .withMessage('Invalid unit'),
];