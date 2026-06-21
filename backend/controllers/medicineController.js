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

    // Check barcode uniqueness if provided
    if (barcode) {
      const existingBarcode = await Medicine.findOne({ barcode, pharmacyId: req.pharmacyId });
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
      barcode,
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

    // Check barcode uniqueness if changed
    if (barcode && barcode !== medicine.barcode) {
      const existingBarcode = await Medicine.findOne({ barcode, pharmacyId: req.pharmacyId, _id: { $ne: medicine._id } });
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
    medicine.barcode = barcode !== undefined ? barcode : medicine.barcode;
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

// @desc    Delete medicine (soft delete)
// @route   DELETE /api/medicines/:id
// @access  Private (Pharmacy Admin)
export const deleteMedicine = async (req, res, next) => {
  try {
    const medicine = await Medicine.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false });
    if (!medicine) {
      return ApiResponse.error(res, 'Medicine not found', 404);
    }

    medicine.isDeleted = true;
    medicine.deletedAt = new Date();
    await medicine.save();

    return ApiResponse.success(res, null, 'Medicine deleted successfully');
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