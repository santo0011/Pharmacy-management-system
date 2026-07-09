import mongoose from 'mongoose';
import Brand from '../models/Brand.js';
import ApiResponse from '../utils/apiResponse.js';

export const bulkImportBrands = async (req, res, next) => {
  try {
    const { brands } = req.body;
    const pharmacyId = req.pharmacyId;

    if (!brands || !Array.isArray(brands) || brands.length === 0) {
      return ApiResponse.error(res, 'No brands data provided', 400);
    }
    if (brands.length > 200) {
      return ApiResponse.error(res, 'Maximum 200 brands per import', 400);
    }

    const results = { success: [], errors: [], successCount: 0, errorCount: 0 };

    for (let i = 0; i < brands.length; i++) {
      const row = brands[i];
      const rowNum = i + 1;
      try {
        const name = (row.name || row.brandName || '').trim();
        if (!name) {
          results.errors.push({ row: rowNum, reason: 'Brand name is required', data: row });
          continue;
        }
        const existing = await Brand.findOne({ name, pharmacyId });
        if (existing) {
          results.errors.push({ row: rowNum, reason: `Brand "${name}" already exists`, data: row });
          continue;
        }
        await Brand.create({
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