import mongoose from 'mongoose';
import Supplier from '../models/Supplier.js';
import ApiResponse from '../utils/apiResponse.js';

export const bulkImportSuppliers = async (req, res, next) => {
  try {
    const { suppliers } = req.body;
    const pharmacyId = req.pharmacyId;

    if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
      return ApiResponse.error(res, 'No suppliers data provided', 400);
    }
    if (suppliers.length > 200) {
      return ApiResponse.error(res, 'Maximum 200 suppliers per import', 400);
    }

    const results = { success: [], errors: [], successCount: 0, errorCount: 0 };

    for (let i = 0; i < suppliers.length; i++) {
      const row = suppliers[i];
      const rowNum = i + 1;
      try {
        const name = (row.supplierName || row.name || '').trim();
        if (!name) {
          results.errors.push({ row: rowNum, reason: 'Supplier name is required', data: row });
          continue;
        }
        const existing = await Supplier.findOne({ supplierName: name, pharmacyId });
        if (existing) {
          results.errors.push({ row: rowNum, reason: `Supplier "${name}" already exists`, data: row });
          continue;
        }
        await Supplier.create({
          supplierName: name,
          companyName: row.companyName || '',
          phone: row.phone || '',
          email: row.email || '',
          address: row.address || '',
          gstNumber: row.gstNumber || '',
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