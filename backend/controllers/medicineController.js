import Medicine from '../models/Medicine.js';
import ApiResponse from '../utils/apiResponse.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Get all medicines
// @route   GET /api/medicines
// @access  Private
export const getMedicines = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const { category, brand, supplier, status, lowStock, expired, expiringSoon } = req.query;

    let query = { isDeleted: false };

    // Search
    if (search) {
      query.$or = [
        { medicineName: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } },
        { batchNumber: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
      ];
    }

    // Filters
    if (category) query.category = category;
    if (brand) query.brand = brand;
    if (supplier) query.supplier = supplier;
    if (status !== undefined && status !== '') {
      query.status = status === 'true';
    }
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$currentStock', '$minStockAlert'] };
    }
    if (expired === 'true') {
      query.expiryDate = { $lt: new Date() };
    }
    if (expiringSoon === 'true') {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      query.expiryDate = {
        $gte: new Date(),
        $lte: thirtyDaysFromNow,
      };
    }

    const allowedSortFields = ['medicineName', 'expiryDate', 'currentStock', 'createdAt', 'createdAt'];
    const sortKey = allowedSortFields.includes(sortField) ? sortField : 'createdAt';

    const total = await Medicine.countDocuments(query);
    const medicines = await Medicine.find(query)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('supplier', 'supplierName companyName')
      .sort({ [sortKey]: sortOrder })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, medicines, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single medicine
// @route   GET /api/medicines/:id
// @access  Private
export const getMedicine = async (req, res, next) => {
  try {
    const medicine = await Medicine.findById(req.params.id)
      .populate('category', 'name description')
      .populate('brand', 'name description')
      .populate('supplier', 'supplierName companyName phone email');

    if (!medicine || medicine.isDeleted) {
      return ApiResponse.error(res, 'Medicine not found', 404);
    }

    return ApiResponse.success(res, medicine);
  } catch (error) {
    next(error);
  }
};

// @desc    Create medicine
// @route   POST /api/medicines
// @access  Private
export const createMedicine = async (req, res, next) => {
  try {
    const {
      medicineName, genericName, category, brand, supplier,
      batchNumber, barcode, manufacturingDate, expiryDate,
      purchasePrice, sellingPrice, gst, currentStock, minStockAlert,
      unit, rackNumber, description, status,
    } = req.body;

    // Check batch number uniqueness
    const existingBatch = await Medicine.findOne({ batchNumber });
    if (existingBatch) {
      return ApiResponse.error(res, 'Batch number already exists', 400);
    }

    // Check barcode uniqueness if provided
    if (barcode) {
      const existingBarcode = await Medicine.findOne({ barcode });
      if (existingBarcode) {
        return ApiResponse.error(res, 'Barcode already exists', 400);
      }
    }

    const medicine = await Medicine.create({
      medicineName,
      genericName,
      category,
      brand,
      supplier,
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
    });

    const populated = await Medicine.findById(medicine._id)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('supplier', 'supplierName');

    return ApiResponse.success(res, populated, 'Medicine created', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update medicine
// @route   PUT /api/medicines/:id
// @access  Private
export const updateMedicine = async (req, res, next) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine || medicine.isDeleted) {
      return ApiResponse.error(res, 'Medicine not found', 404);
    }

    const {
      medicineName, genericName, category, brand, supplier,
      batchNumber, barcode, manufacturingDate, expiryDate,
      purchasePrice, sellingPrice, gst, currentStock, minStockAlert,
      unit, rackNumber, description, status,
    } = req.body;

    // Check batch number uniqueness if changed
    if (batchNumber && batchNumber !== medicine.batchNumber) {
      const existingBatch = await Medicine.findOne({ batchNumber, _id: { $ne: medicine._id } });
      if (existingBatch) {
        return ApiResponse.error(res, 'Batch number already exists', 400);
      }
    }

    // Check barcode uniqueness if changed
    if (barcode && barcode !== medicine.barcode) {
      const existingBarcode = await Medicine.findOne({ barcode, _id: { $ne: medicine._id } });
      if (existingBarcode) {
        return ApiResponse.error(res, 'Barcode already exists', 400);
      }
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
    medicine.batchNumber = batchNumber || medicine.batchNumber;
    medicine.barcode = barcode !== undefined ? barcode : medicine.barcode;
    medicine.manufacturingDate = manufacturingDate !== undefined ? manufacturingDate : medicine.manufacturingDate;
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

    const updated = await medicine.save();

    const populated = await Medicine.findById(updated._id)
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('supplier', 'supplierName');

    return ApiResponse.success(res, populated, 'Medicine updated');
  } catch (error) {
    next(error);
  }
};

// @desc    Soft delete medicine
// @route   DELETE /api/medicines/:id
// @access  Private
export const deleteMedicine = async (req, res, next) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine || medicine.isDeleted) {
      return ApiResponse.error(res, 'Medicine not found', 404);
    }

    medicine.isDeleted = true;
    medicine.deletedAt = new Date();
    await medicine.save();

    return ApiResponse.success(res, null, 'Medicine deleted');
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle medicine status
// @route   PATCH /api/medicines/:id/status
// @access  Private
export const toggleMedicineStatus = async (req, res, next) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine || medicine.isDeleted) {
      return ApiResponse.error(res, 'Medicine not found', 404);
    }

    medicine.status = !medicine.status;
    await medicine.save();

    return ApiResponse.success(res, medicine, 'Status updated');
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard stats for medicines
// @route   GET /api/medicines/stats
// @access  Private
export const getMedicineStats = async (req, res, next) => {
  try {
    const totalMedicines = await Medicine.countDocuments({ isDeleted: false });
    
    const lowStockCount = await Medicine.countDocuments({
      isDeleted: false,
      $expr: { $lte: ['$currentStock', '$minStockAlert'] },
    });

    const expiredCount = await Medicine.countDocuments({
      isDeleted: false,
      expiryDate: { $lt: new Date() },
    });

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringSoonCount = await Medicine.countDocuments({
      isDeleted: false,
      expiryDate: {
        $gte: new Date(),
        $lte: thirtyDaysFromNow,
      },
    });

    return ApiResponse.success(res, {
      totalMedicines,
      lowStockCount,
      expiredCount,
      expiringSoonCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all medicines (no pagination - for dropdowns/reports)
// @route   GET /api/medicines/all
// @access  Private
export const getAllMedicines = async (req, res, next) => {
  try {
    const medicines = await Medicine.find({ isDeleted: false, status: true })
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('supplier', 'supplierName')
      .sort({ medicineName: 1 });

    return ApiResponse.success(res, medicines);
  } catch (error) {
    next(error);
  }
};