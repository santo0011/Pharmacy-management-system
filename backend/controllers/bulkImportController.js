import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import Supplier from '../models/Supplier.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Bulk import medicines from JSON array
// @route   POST /api/medicines/bulk-import
// @access  Private (Admin, Pharmacist)
export const bulkImportMedicines = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { medicines, defaultCategory, defaultBrand, defaultSupplier } = req.body;
    const pharmacyId = req.pharmacyId;

    if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
      return ApiResponse.error(res, 'No medicines data provided', 400);
    }

    if (medicines.length > 500) {
      return ApiResponse.error(res, 'Maximum 500 medicines per import', 400);
    }

    const results = {
      success: [],
      errors: [],
      totalProcessed: medicines.length,
      successCount: 0,
      errorCount: 0,
    };

    // Validate default selections exist
    if (defaultCategory) {
      const cat = await Category.findById(defaultCategory);
      if (!cat) return ApiResponse.error(res, 'Default category not found', 400);
    }
    if (defaultBrand) {
      const br = await Brand.findById(defaultBrand);
      if (!br) return ApiResponse.error(res, 'Default brand not found', 400);
    }
    if (defaultSupplier) {
      const sup = await Supplier.findById(defaultSupplier);
      if (!sup) return ApiResponse.error(res, 'Default supplier not found', 400);
    }

    for (let i = 0; i < medicines.length; i++) {
      const row = medicines[i];
      const rowNum = i + 1;

      try {
        // Validate required fields
        if (!row.medicineName || !row.medicineName.trim()) {
          results.errors.push({ row: rowNum, reason: 'Medicine name is required', data: row });
          continue;
        }

        if (!row.batchNumber || !row.batchNumber.trim()) {
          results.errors.push({ row: rowNum, reason: 'Batch number is required', data: row });
          continue;
        }

        if (!row.purchasePrice || isNaN(Number(row.purchasePrice)) || Number(row.purchasePrice) <= 0) {
          results.errors.push({ row: rowNum, reason: 'Valid purchase price is required', data: row });
          continue;
        }

        if (!row.sellingPrice || isNaN(Number(row.sellingPrice)) || Number(row.sellingPrice) <= 0) {
          results.errors.push({ row: rowNum, reason: 'Valid selling price is required', data: row });
          continue;
        }

        if (!row.expiryDate) {
          results.errors.push({ row: rowNum, reason: 'Expiry date is required', data: row });
          continue;
        }

        // Resolve category
        let categoryId = row.category || defaultCategory;
        if (!categoryId) {
          results.errors.push({ row: rowNum, reason: 'Category is required (select default or specify per row)', data: row });
          continue;
        }

        // Resolve brand
        let brandId = row.brand || defaultBrand;
        if (!brandId) {
          results.errors.push({ row: rowNum, reason: 'Brand is required (select default or specify per row)', data: row });
          continue;
        }

        // Resolve supplier
        let supplierId = row.supplier || defaultSupplier;
        if (!supplierId) {
          results.errors.push({ row: rowNum, reason: 'Supplier is required (select default or specify per row)', data: row });
          continue;
        }

        // Check batch uniqueness
        const existingBatch = await Medicine.findOne({
          batchNumber: row.batchNumber.trim(),
          pharmacyId,
        }).session(session);

        if (existingBatch) {
          results.errors.push({ row: rowNum, reason: `Batch number "${row.batchNumber}" already exists`, data: row });
          continue;
        }

        // Validate manufacturing date < expiry date
        const mfgDate = row.manufacturingDate ? new Date(row.manufacturingDate) : null;
        const expDate = new Date(row.expiryDate);

        if (mfgDate && mfgDate >= expDate) {
          results.errors.push({ row: rowNum, reason: 'Manufacturing date must be before expiry date', data: row });
          continue;
        }

        // Normalize barcode
        const normalizedBarcode = (row.barcode && row.barcode.trim()) ? row.barcode.trim() : null;

        // Check barcode uniqueness if provided
        if (normalizedBarcode) {
          const existingBarcode = await Medicine.findOne({
            barcode: normalizedBarcode,
            pharmacyId,
          }).session(session);

          if (existingBarcode) {
            results.errors.push({ row: rowNum, reason: `Barcode "${normalizedBarcode}" already exists`, data: row });
            continue;
          }
        }

        // Create the medicine
        const gst = row.gst && !isNaN(Number(row.gst)) ? Number(row.gst) : 0;
        const currentStock = row.currentStock && !isNaN(Number(row.currentStock)) ? Number(row.currentStock) : 0;
        const minStockAlert = row.minStockAlert && !isNaN(Number(row.minStockAlert)) ? Number(row.minStockAlert) : 10;

        await Medicine.create([{
          medicineName: row.medicineName.trim(),
          genericName: row.genericName || '',
          category: categoryId,
          brand: brandId,
          supplier: supplierId,
          hsnCode: row.hsnCode || '',
          batchNumber: row.batchNumber.trim(),
          barcode: normalizedBarcode,
          manufacturingDate: mfgDate,
          expiryDate: expDate,
          purchasePrice: Number(row.purchasePrice),
          sellingPrice: Number(row.sellingPrice),
          gst,
          currentStock,
          minStockAlert,
          unit: row.unit || 'Tablet',
          rackNumber: row.rackNumber || '',
          description: row.description || '',
          status: true,
          pharmacyId,
          createdBy: req.user._id,
        }], { session });

        results.success.push({ row: rowNum, medicineName: row.medicineName });
      } catch (err) {
        results.errors.push({ row: rowNum, reason: err.message || 'Unknown error', data: row });
      }
    }

    results.successCount = results.success.length;
    results.errorCount = results.errors.length;

    await session.commitTransaction();

    return ApiResponse.success(res, results,
      `Import completed: ${results.successCount} succeeded, ${results.errorCount} failed`
    );
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};