import Medicine from '../models/Medicine.js';
import ApiResponse from '../utils/apiResponse.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Get all medicines for a pharmacy
// @route   GET /api/medicines
// @access  Private (Pharmacy Admin, Pharmacist, Cashier)
export const getMedicines = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const { category, brand, supplier, status, expired, lowStock, expiringSoon, sort } = req.query;

    const query = { pharmacyId: req.pharmacyId, isDeleted: false };

    // Search
    if (search) {
      query.$or = [
        { medicineName: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { batchNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Filters
    if (category) query.category = category;
    if (brand) query.brand = brand;
    if (supplier) query.supplier = supplier;
    if (status !== undefined && status !== '') query.status = status === 'true';

    // Expired filter
    if (expired === 'true') {
      query.expiryDate = { $lt: new Date() };
    }

    // Low stock filter
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$currentStock', '$minStockAlert'] };
    }

    // Expiring within 30 days
    if (expiringSoon === 'true') {
      const now = new Date();
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      query.expiryDate = { $gte: now, $lte: thirtyDaysLater };
    }

    // Sorting
    let sortOption = { createdAt: -1 };
    if (sort === 'name_asc') sortOption = { medicineName: 1 };
    else if (sort === 'name_desc') sortOption = { medicineName: -1 };
    else if (sort === 'expiry_asc') sortOption = { expiryDate: 1 };
    else if (sort === 'expiry_desc') sortOption = { expiryDate: -1 };
    else if (sort === 'stock_asc') sortOption = { currentStock: 1 };
    else if (sort === 'stock_desc') sortOption = { currentStock: -1 };
    else if (sort === 'oldest') sortOption = { createdAt: 1 };
    else if (sort === 'newest') sortOption = { createdAt: -1 };

    const total = await Medicine.countDocuments(query);
    const medicines = await Medicine.find(query)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('supplier', 'supplierName')
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, medicines, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard statistics for medicines
// @route   GET /api/medicines/stats
// @access  Private
export const getMedicineStats = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const now = new Date();

    const totalMedicines = await Medicine.countDocuments({ pharmacyId, isDeleted: false });
    const activeMedicines = await Medicine.countDocuments({ pharmacyId, isDeleted: false, status: true });

    const lowStockMedicines = await Medicine.countDocuments({
      pharmacyId,
      isDeleted: false,
      $expr: { $lte: ['$currentStock', '$minStockAlert'] },
    });

    const expiredMedicines = await Medicine.countDocuments({
      pharmacyId,
      isDeleted: false,
      expiryDate: { $lt: now },
    });

    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nearExpiryMedicines = await Medicine.countDocuments({
      pharmacyId,
      isDeleted: false,
      expiryDate: { $gte: now, $lte: thirtyDaysLater },
    });

    return ApiResponse.success(res, {
      totalMedicines,
      activeMedicines,
      lowStockMedicines,
      expiredMedicines,
      nearExpiryMedicines,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single medicine
// @route   GET /api/medicines/:id
// @access  Private
export const getMedicine = async (req, res, next) => {
  try {
    const medicine = await Medicine.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false })
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('supplier', 'supplierName companyName phone email address gstNumber')
      .populate('substituteMedicines', 'medicineName genericName sellingPrice currentStock unit barcode status')
      .populate('createdBy', 'name email');

    if (!medicine) {
      return ApiResponse.error(res, 'Medicine not found', 404);
    }
    return ApiResponse.success(res, medicine);
  } catch (error) {
    next(error);
  }
};

// @desc    Create medicine
// @route   POST /api/medicines
// @access  Private (Pharmacy Admin, Pharmacist)
export const createMedicine = async (req, res, next) => {
  try {
    const {
      medicineName, genericName, category, brand, supplier, hsnCode,
      batchNumber, barcode, manufacturingDate, expiryDate,
      purchasePrice, sellingPrice, gst, currentStock, minStockAlert,
      unit, rackNumber, description, status
    } = req.body;

    // Check batch number uniqueness within this pharmacy
    const existingBatch = await Medicine.findOne({ batchNumber, pharmacyId: req.pharmacyId });
    if (existingBatch) {
      return ApiResponse.error(res, 'Batch number already exists in this pharmacy', 400);
    }

    // Normalize barcode: null or undefined → null (skips partial unique index)
    const normalizedBarcode = (barcode && barcode.trim()) ? barcode.trim() : null;

    // Check barcode uniqueness if provided
    if (normalizedBarcode) {
      const existingBarcode = await Medicine.findOne({ barcode: normalizedBarcode, pharmacyId: req.pharmacyId });
      if (existingBarcode) {
        return ApiResponse.error(res, 'Barcode already exists in this pharmacy', 400);
      }
    }

    // Validate manufacturing date < expiry date
    if (manufacturingDate && expiryDate && new Date(manufacturingDate) >= new Date(expiryDate)) {
      return ApiResponse.error(res, 'Manufacturing date must be before expiry date', 400);
    }

    const medicine = await Medicine.create({
      medicineName,
      genericName,
      category,
      brand,
      supplier,
      hsnCode,
      batchNumber,
      barcode: normalizedBarcode,
      manufacturingDate,
      expiryDate,
      purchasePrice,
      sellingPrice,
      gst: gst || 0,
      currentStock: currentStock || 0,
      minStockAlert: minStockAlert || 10,
      unit: unit || 'Tablet',
      rackNumber,
      description,
      medicineImage: req.file ? `/uploads/medicines/${req.file.filename}` : '',
      status: status !== undefined ? status : true,
      pharmacyId: req.pharmacyId,
      createdBy: req.user._id,
    });

    return ApiResponse.success(res, medicine, 'Medicine created successfully', 201);
  } catch (error) {

     console.log("errorrrrr",error.message)

    next(error);
  }
};

// @desc    Update medicine
// @route   PUT /api/medicines/:id
// @access  Private (Pharmacy Admin, Pharmacist)
export const updateMedicine = async (req, res, next) => {
  try {
    const medicine = await Medicine.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false });
    if (!medicine) {
      return ApiResponse.error(res, 'Medicine not found', 404);
    }

    const {
      medicineName, genericName, category, brand, supplier, hsnCode,
      batchNumber, barcode, manufacturingDate, expiryDate,
      purchasePrice, sellingPrice, gst, currentStock, minStockAlert,
      unit, rackNumber, description, status
    } = req.body;

    // Check batch number uniqueness if changed
    if (batchNumber && batchNumber !== medicine.batchNumber) {
      const existingBatch = await Medicine.findOne({ batchNumber, pharmacyId: req.pharmacyId, _id: { $ne: medicine._id } });
      if (existingBatch) {
        return ApiResponse.error(res, 'Batch number already exists in this pharmacy', 400);
      }
    }

    // Normalize barcode: null or undefined → null (skips partial unique index)
    const normalizedBarcode = (barcode !== undefined && barcode && barcode.trim()) ? barcode.trim() :
      (barcode !== undefined ? null : medicine.barcode);

    // Check barcode uniqueness if changed
    if (normalizedBarcode && normalizedBarcode !== medicine.barcode) {
      const existingBarcode = await Medicine.findOne({ barcode: normalizedBarcode, pharmacyId: req.pharmacyId, _id: { $ne: medicine._id } });
      if (existingBarcode) {
        return ApiResponse.error(res, 'Barcode already exists in this pharmacy', 400);
      }
    }

    const newExpiryDate = expiryDate || medicine.expiryDate;
    const newMfgDate = manufacturingDate || medicine.manufacturingDate;
    if (newMfgDate && new Date(newMfgDate) >= new Date(newExpiryDate)) {
      return ApiResponse.error(res, 'Manufacturing date must be before expiry date', 400);
    }

    // Delete old image if new one uploaded
    if (req.file && medicine.medicineImage) {
      const oldImagePath = path.join(__dirname, '..', medicine.medicineImage);
      try { fs.unlinkSync(oldImagePath); } catch (err) { /* file may not exist */ }
    }

    medicine.medicineName = medicineName || medicine.medicineName;
    medicine.genericName = genericName !== undefined ? genericName : medicine.genericName;
    medicine.category = category || medicine.category;
    medicine.brand = brand || medicine.brand;
    medicine.supplier = supplier || medicine.supplier;
    medicine.hsnCode = hsnCode !== undefined ? hsnCode : medicine.hsnCode;
    medicine.batchNumber = batchNumber || medicine.batchNumber;
    medicine.barcode = normalizedBarcode;
    medicine.manufacturingDate = manufacturingDate || medicine.manufacturingDate;
    medicine.expiryDate = expiryDate || medicine.expiryDate;
    medicine.purchasePrice = purchasePrice || medicine.purchasePrice;
    medicine.sellingPrice = sellingPrice || medicine.sellingPrice;
    medicine.gst = gst !== undefined ? gst : medicine.gst;
    medicine.currentStock = currentStock !== undefined ? currentStock : medicine.currentStock;
    medicine.minStockAlert = minStockAlert !== undefined ? minStockAlert : medicine.minStockAlert;
    medicine.unit = unit || medicine.unit;
    medicine.rackNumber = rackNumber !== undefined ? rackNumber : medicine.rackNumber;
    medicine.description = description !== undefined ? description : medicine.description;
    medicine.status = status !== undefined ? status : medicine.status;
    medicine.medicineImage = req.file ? `/uploads/medicines/${req.file.filename}` : medicine.medicineImage;
    medicine.updatedBy = req.user._id;

    const updatedMedicine = await medicine.save();

    return ApiResponse.success(res, updatedMedicine, 'Medicine updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete medicine (hard delete with dependency check)
// @route   DELETE /api/medicines/:id
// @access  Private (Pharmacy Admin)
export const deleteMedicine = async (req, res, next) => {
  try {
    const medicine = await Medicine.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false });
    if (!medicine) {
      return ApiResponse.error(res, 'Medicine not found', 404);
    }

    // Check if this medicine is referenced by other records (Sales, Purchases, Stock History)
    // Placeholder for future reference checks when those modules exist:
    // const salesCount = await Sale.countDocuments({ medicineId: medicine._id });
    // const purchaseCount = await Purchase.countDocuments({ medicineId: medicine._id });
    // const stockHistoryCount = await StockHistory.countDocuments({ medicineId: medicine._id });
    // if (salesCount > 0 || purchaseCount > 0 || stockHistoryCount > 0) {
    //   return ApiResponse.error(res, 'Cannot delete medicine. It is referenced by sales, purchases, or stock history records.', 400);
    // }

    // Delete the medicine image if it exists
    if (medicine.medicineImage) {
      const imagePath = path.join(__dirname, '..', medicine.medicineImage);
      try { fs.unlinkSync(imagePath); } catch (err) { /* file may not exist */ }
    }

    // Permanently delete the medicine
    await Medicine.deleteOne({ _id: medicine._id });

    return ApiResponse.success(res, null, 'Medicine deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Check if barcode exists in this pharmacy
// @route   POST /api/medicines/check-barcode
// @access  Private
export const checkBarcode = async (req, res, next) => {
  try {
    const { barcode, excludeId } = req.body;

    if (!barcode || !barcode.trim()) {
      return ApiResponse.success(res, { exists: false });
    }

    const query = {
      barcode: barcode.trim(),
      pharmacyId: req.pharmacyId,
      isDeleted: false,
    };

    // If editing, exclude the current medicine
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await Medicine.findOne(query);
    return ApiResponse.success(res, { exists: !!existing });
  } catch (error) {
    next(error);
  }
};

// @desc    Lookup barcode from external API / auto-fill medicine info
// @route   POST /api/medicines/lookup-barcode
// @access  Private
export const lookupBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.body;

    if (!barcode || !barcode.trim()) {
      return ApiResponse.error(res, 'Barcode is required', 400);
    }

    // First check if barcode exists in our database
    const existing = await Medicine.findOne({
      barcode: barcode.trim(),
      pharmacyId: req.pharmacyId,
      isDeleted: false,
    }).populate('category', 'name')
      .populate('brand', 'name')
      .populate('supplier', 'supplierName');

    if (existing) {
      return ApiResponse.success(res, {
        found: true,
        inDatabase: true,
        medicine: existing,
      });
    }

    // Try to fetch from Open Food Facts or similar public database
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode.trim()}.json`);
      const data = await response.json();

      if (data.status === 1 && data.product) {
        const product = data.product;
        const autoFill = {
          medicineName: product.product_name || '',
          genericName: product.generic_name || '',
          brand: product.brands || '',
          manufacturer: product.manufacturer || '',
          category: product.categories || '',
          strength: product.quantity || '',
          dosageForm: product.product_quantity || '',
          packSize: product.packaging || '',
          barcode: barcode.trim(),
        };

        return ApiResponse.success(res, {
          found: true,
          inDatabase: false,
          autoFill,
        });
      }
    } catch (fetchError) {
      // External API failed, that's ok - just return not found
    }

    // Barcode not found anywhere
    return ApiResponse.success(res, {
      found: false,
      inDatabase: false,
      barcode: barcode.trim(),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle medicine status
// @route   PATCH /api/medicines/:id/status
// @access  Private (Pharmacy Admin, Pharmacist)
export const toggleMedicineStatus = async (req, res, next) => {
  try {
    const medicine = await Medicine.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false });
    if (!medicine) {
      return ApiResponse.error(res, 'Medicine not found', 404);
    }

    medicine.status = !medicine.status;
    medicine.updatedBy = req.user._id;
    await medicine.save();

    return ApiResponse.success(res, medicine, 'Status updated');
  } catch (error) {
    next(error);
  }
};

// @desc    Manage substitute medicines for a medicine
// @route   PUT /api/medicines/:id/substitutes
// @access  Private (Pharmacy Admin, Pharmacist)
export const updateSubstitutes = async (req, res, next) => {
  try {
    const { substituteIds } = req.body;
    const medicine = await Medicine.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false });
    if (!medicine) {
      return ApiResponse.error(res, 'Medicine not found', 404);
    }

    // Validate that all substitute IDs exist and belong to the same pharmacy
    if (substituteIds && Array.isArray(substituteIds) && substituteIds.length > 0) {
      const validSubstitutes = await Medicine.find({
        _id: { $in: substituteIds },
        pharmacyId: req.pharmacyId,
        isDeleted: false,
        status: true,
      }).select('_id');

      const validIds = validSubstitutes.map(s => s._id.toString());
      const invalidIds = substituteIds.filter(id => !validIds.includes(id));

      if (invalidIds.length > 0) {
        return ApiResponse.error(res, `Some substitute medicines are invalid or not found: ${invalidIds.join(', ')}`, 400);
      }

      // Prevent self-reference
      if (validIds.includes(req.params.id)) {
        return ApiResponse.error(res, 'A medicine cannot be a substitute for itself', 400);
      }

      medicine.substituteMedicines = validIds;
    } else {
      medicine.substituteMedicines = [];
    }

    medicine.updatedBy = req.user._id;
    await medicine.save();

    // Populate and return
    const updated = await Medicine.findById(medicine._id)
      .populate('substituteMedicines', 'medicineName genericName sellingPrice currentStock unit barcode status');

    return ApiResponse.success(res, updated, 'Substitutes updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get substitute suggestions for a medicine (stock-aware)
// @route   GET /api/medicines/:id/substitutes
// @access  Private
export const getSubstitutes = async (req, res, next) => {
  try {
    const medicine = await Medicine.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false })
      .populate({
        path: 'substituteMedicines',
        match: { status: true, isDeleted: false },
        select: 'medicineName genericName sellingPrice currentStock unit barcode status',
      });

    if (!medicine) {
      return ApiResponse.error(res, 'Medicine not found', 404);
    }

    // Filter substitutes that are in stock and not expired
    const now = new Date();
    const availableSubstitutes = (medicine.substituteMedicines || []).filter(sub => {
      return sub && sub.status && sub.currentStock > 0;
    });

    // Also find potential substitutes by same generic name if no explicit substitutes set
    let genericSubstitutes = [];
    if ((!availableSubstitutes || availableSubstitutes.length === 0) && medicine.genericName) {
      genericSubstitutes = await Medicine.find({
        _id: { $ne: medicine._id },
        genericName: medicine.genericName,
        pharmacyId: req.pharmacyId,
        isDeleted: false,
        status: true,
        currentStock: { $gt: 0 },
        expiryDate: { $gt: now },
      })
        .select('medicineName genericName sellingPrice currentStock unit barcode')
        .limit(10);
    }

    return ApiResponse.success(res, {
      medicine: {
        _id: medicine._id,
        medicineName: medicine.medicineName,
        genericName: medicine.genericName,
      },
      explicitSubstitutes: availableSubstitutes,
      genericSubstitutes: genericSubstitutes,
      hasSubstitutes: availableSubstitutes.length > 0 || genericSubstitutes.length > 0,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get substitute suggestions for insufficient stock during billing
// @route   GET /api/medicines/substitute-suggestions/:medicineId
// @access  Private
export const getSubstituteSuggestions = async (req, res, next) => {
  try {
    const { medicineId } = req.params;
    const { requiredQty } = req.query;

    const medicine = await Medicine.findOne({ _id: medicineId, pharmacyId: req.pharmacyId, isDeleted: false });
    if (!medicine) {
      return ApiResponse.error(res, 'Medicine not found', 404);
    }

    const neededQty = parseInt(requiredQty) || 1;
    const now = new Date();

    // 1. First check explicit substitutes
    const explicitSubs = await Medicine.find({
      _id: { $in: medicine.substituteMedicines || [] },
      pharmacyId: req.pharmacyId,
      isDeleted: false,
      status: true,
      currentStock: { $gte: neededQty },
      expiryDate: { $gt: now },
    })
      .populate('category', 'name')
      .populate('brand', 'name')
      .select('medicineName genericName sellingPrice currentStock unit barcode purchasePrice gst category brand')
      .limit(10);

    // 2. Then find by same generic name (auto-suggest)
    let genericSubs = [];
    if (medicine.genericName) {
      genericSubs = await Medicine.find({
        _id: { $ne: medicine._id, $nin: medicine.substituteMedicines || [] },
        genericName: medicine.genericName,
        pharmacyId: req.pharmacyId,
        isDeleted: false,
        status: true,
        currentStock: { $gte: neededQty },
        expiryDate: { $gt: now },
      })
        .populate('category', 'name')
        .populate('brand', 'name')
        .select('medicineName genericName sellingPrice currentStock unit barcode purchasePrice gst category brand')
        .limit(10);
    }

    // 3. Finally find by same category (fallback)
    let categorySubs = [];
    if (explicitSubs.length === 0 && genericSubs.length === 0) {
      categorySubs = await Medicine.find({
        _id: { $ne: medicine._id },
        category: medicine.category,
        pharmacyId: req.pharmacyId,
        isDeleted: false,
        status: true,
        currentStock: { $gte: neededQty },
        expiryDate: { $gt: now },
      })
        .populate('category', 'name')
        .populate('brand', 'name')
        .select('medicineName genericName sellingPrice currentStock unit barcode purchasePrice gst category brand')
        .limit(10);
    }

    const allSuggestions = [...explicitSubs, ...genericSubs, ...categorySubs];

    return ApiResponse.success(res, {
      originalMedicine: {
        _id: medicine._id,
        medicineName: medicine.medicineName,
        genericName: medicine.genericName,
        currentStock: medicine.currentStock,
        requiredQty: neededQty,
      },
      suggestions: allSuggestions,
      suggestionCount: allSuggestions.length,
    });
  } catch (error) {
    next(error);
  }
};
