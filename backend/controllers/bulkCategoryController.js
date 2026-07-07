import mongoose from 'mongoose';
import Category from '../models/Category.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Bulk import categories
// @route   POST /api/categories/bulk-import
// @access  Private (Admin)
export const bulkImportCategories = async (req, res, next) => {
  try {
    const { categories } = req.body;
    const pharmacyId = req.pharmacyId;

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return ApiResponse.error(res, 'No categories data provided', 400);
    }

    if (categories.length > 200) {
      return ApiResponse.error(res, 'Maximum 200 categories per import', 400);
    }

    const results = { success: [], errors: [], successCount: 0, errorCount: 0 };

    for (let i = 0; i < categories.length; i++) {
      const row = categories[i];
      const rowNum = i + 1;

      try {
        const name = (row.name || row.categoryName || '').trim();
        if (!name) {
          results.errors.push({ row: rowNum, reason: 'Category name is required', data: row });
          continue;
        }

        const existing = await Category.findOne({ name, pharmacyId });
        if (existing) {
          results.errors.push({ row: rowNum, reason: `Category "${name}" already exists`, data: row });
          continue;
        }

        await Category.create({
          name,
          description: row.description || '',
          status: row.status !== undefined ? row.status : true,
          pharmacyId,
        });

        results.success.push({ row: rowNum, name });
      } catch (err) {
        results.errors.push({ row: rowNum, reason: err.message || 'Unknown error', data: row });
      }
    }

    results.successCount = results.success.length;
    results.errorCount = results.errors.length;

    return ApiResponse.success(res, results,
      `Import completed: ${results.successCount} succeeded, ${results.errorCount} failed`
    );
  } catch (error) {
    next(error);
  }
};