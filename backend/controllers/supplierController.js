import mongoose from 'mongoose';
import Supplier from '../models/Supplier.js';
import Purchase from '../models/Purchase.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Get all suppliers
// @route   GET /api/suppliers
// @access  Private (Pharmacy Admin)
export const getSuppliers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = { pharmacyId: req.pharmacyId };
    if (search) {
      query.$or = [
        { supplierName: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Supplier.countDocuments(query);
    const suppliers = await Supplier.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, suppliers, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single supplier
// @route   GET /api/suppliers/:id
// @access  Private
export const getSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!supplier) {
      return ApiResponse.error(res, 'Supplier not found', 404);
    }
    return ApiResponse.success(res, supplier);
  } catch (error) {
    next(error);
  }
};

// @desc    Create supplier
// @route   POST /api/suppliers
// @access  Private
export const createSupplier = async (req, res, next) => {
  try {
    const { supplierName, companyName, phone, email, address, gstNumber, status } = req.body;

    const existingSupplier = await Supplier.findOne({ email, pharmacyId: req.pharmacyId });
    if (existingSupplier) {
      return ApiResponse.error(res, 'Supplier with this email already exists in this pharmacy', 400);
    }

    const supplier = await Supplier.create({
      supplierName,
      companyName,
      phone,
      email,
      address,
      gstNumber,
      pharmacyId: req.pharmacyId,
      status: status !== undefined ? status : true,
    });

    return ApiResponse.success(res, supplier, 'Supplier created', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update supplier
// @route   PUT /api/suppliers/:id
// @access  Private
export const updateSupplier = async (req, res, next) => {
  try {
    const { supplierName, companyName, phone, email, address, gstNumber, status } = req.body;

    const supplier = await Supplier.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!supplier) {
      return ApiResponse.error(res, 'Supplier not found', 404);
    }

    if (email && email !== supplier.email) {
      const existingSupplier = await Supplier.findOne({ email, pharmacyId: req.pharmacyId });
      if (existingSupplier) {
        return ApiResponse.error(res, 'Email already in use by another supplier', 400);
      }
    }

    supplier.supplierName = supplierName || supplier.supplierName;
    supplier.companyName = companyName || supplier.companyName;
    supplier.phone = phone || supplier.phone;
    supplier.email = email || supplier.email;
    supplier.address = address !== undefined ? address : supplier.address;
    supplier.gstNumber = gstNumber !== undefined ? gstNumber : supplier.gstNumber;
    supplier.status = status !== undefined ? status : supplier.status;

    const updatedSupplier = await supplier.save();

    return ApiResponse.success(res, updatedSupplier, 'Supplier updated');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete supplier
// @route   DELETE /api/suppliers/:id
// @access  Private
export const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!supplier) {
      return ApiResponse.error(res, 'Supplier not found', 404);
    }

    // Check if any medicines are linked to this supplier
    const Medicine = (await import('../models/Medicine.js')).default;
    const medicineCount = await Medicine.countDocuments({
      supplier: supplier._id,
      pharmacyId: req.pharmacyId,
      isDeleted: false,
    });

    if (medicineCount > 0) {
      return ApiResponse.error(
        res,
        `This supplier is associated with ${medicineCount} medicine(s) and cannot be deleted. Remove or reassign the medicines first.`,
        400
      );
    }

    await supplier.deleteOne();

    return ApiResponse.success(res, null, 'Supplier deleted');
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle supplier status
// @route   PATCH /api/suppliers/:id/status
// @access  Private
// @desc    Get all suppliers with outstanding dues (from purchase records)
// @route   GET /api/suppliers/dues
// @access  Private
export const getSupplierDues = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const matchStage = {
      pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
      isDeleted: false,
      dueAmount: { $gt: 0 },
      status: { $nin: ['cancelled', 'returned'] },
    };

    if (search) {
      matchStage.$or = [
        { supplierName: { $regex: search, $options: 'i' } },
      ];
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: { supplier: '$supplier', name: '$supplierName' },
          totalPurchases: { $sum: 1 },
          totalAmount: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$paidAmount' },
          totalDue: { $sum: '$dueAmount' },
          lastPurchaseDate: { $max: '$purchaseDate' },
          invoices: { $push: { invoiceNumber: '$invoiceNumber', dueAmount: '$dueAmount', grandTotal: '$grandTotal', _id: '$_id' } },
        },
      },
      {
        $project: {
          _id: 0,
          supplierId: '$_id.supplier',
          supplierName: '$_id.name',
          totalPurchases: 1,
          totalAmount: { $round: ['$totalAmount', 2] },
          totalPaid: { $round: ['$totalPaid', 2] },
          totalDue: { $round: ['$totalDue', 2] },
          lastPurchaseDate: 1,
          invoices: 1,
        },
      },
      { $sort: { totalDue: -1 } },
    ];

    const countResult = await Purchase.aggregate([...pipeline, { $count: 'total' }]);
    const total = countResult[0]?.total || 0;

    pipeline.push({ $skip: skip }, { $limit: limit });
    const suppliers = await Purchase.aggregate(pipeline);

    // Grand totals
    const totalsResult = await Purchase.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalDueAmount: { $sum: '$dueAmount' },
          totalOutstanding: { $sum: '$grandTotal' },
          totalSuppliers: { $addToSet: { name: '$supplierName', id: '$supplier' } },
        },
      },
    ]);

    const totals = totalsResult[0] || { totalDueAmount: 0, totalOutstanding: 0, totalSuppliers: 0 };

    return ApiResponse.paginated(res, {
      suppliers,
      totals: {
        totalDueAmount: totals.totalDueAmount || 0,
        totalOutstanding: totals.totalOutstanding || 0,
        totalSuppliers: totals.totalSuppliers?.length || 0,
      },
    }, total, page, limit);
  } catch (error) {
    next(error);
  }
};

export const toggleSupplierStatus = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!supplier) {
      return ApiResponse.error(res, 'Supplier not found', 404);
    }

    supplier.status = !supplier.status;
    await supplier.save();

    return ApiResponse.success(res, supplier, 'Status updated');
  } catch (error) {
    next(error);
  }
};