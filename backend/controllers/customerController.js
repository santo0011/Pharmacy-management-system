import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Get all unique customers (from sale records)
// @route   GET /api/customers
// @access  Private
export const getCustomers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const matchStage = {
      pharmacyId: req.pharmacyId,
      isDeleted: false,
      customerName: { $ne: 'Walk-in Customer' },
      status: { $nin: ['cancelled', 'returned'] },
    };

    if (search) {
      matchStage.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
      ];
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: { name: '$customerName', phone: '$customerPhone' },
          totalPurchases: { $sum: 1 },
          totalSpent: { $sum: '$grandTotal' },
          lastPurchaseDate: { $max: '$saleDate' },
          firstPurchaseDate: { $min: '$saleDate' },
        },
      },
      {
        $project: {
          _id: 0,
          customerName: '$_id.name',
          customerPhone: '$_id.phone',
          totalPurchases: 1,
          totalSpent: 1,
          lastPurchaseDate: 1,
          firstPurchaseDate: 1,
        },
      },
      { $sort: { totalSpent: -1 } },
    ];

    const totalPipeline = [...pipeline];
    const totalResult = await Sale.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { name: '$customerName', phone: '$customerPhone' },
        },
      },
      { $count: 'total' },
    ]);
    const total = totalResult[0]?.total || 0;

    pipeline.push({ $skip: skip }, { $limit: limit });

    const customers = await Sale.aggregate(pipeline);

    return ApiResponse.paginated(res, customers, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single customer details with purchase history
// @route   GET /api/customers/:phone
// @access  Private
export const getCustomer = async (req, res, next) => {
  try {
    const { phone } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {
      pharmacyId: req.pharmacyId,
      isDeleted: false,
      customerPhone: phone,
      status: { $nin: ['cancelled', 'returned'] },
    };

    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .sort({ saleDate: -1 })
      .skip(skip)
      .limit(limit)
      .select('invoiceNumber saleDate grandTotal paidAmount dueAmount paymentMethod items');

    // Build customer summary
    const summary = await Sale.aggregate([
      { $match: { pharmacyId: req.pharmacyId, isDeleted: false, customerPhone: phone, status: { $nin: ['cancelled', 'returned'] } } },
      {
        $group: {
          _id: '$customerPhone',
          customerName: { $first: '$customerName' },
          customerPhone: { $first: '$customerPhone' },
          totalPurchases: { $sum: 1 },
          totalSpent: { $sum: '$grandTotal' },
          lastPurchaseDate: { $max: '$saleDate' },
          firstPurchaseDate: { $min: '$saleDate' },
        },
      },
    ]);

    return ApiResponse.success(res, {
      customer: summary[0] || { customerName: 'Unknown', customerPhone: phone, totalPurchases: 0, totalSpent: 0 },
      sales,
      total,
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all customers with outstanding dues
// @route   GET /api/customers/dues
// @access  Private
export const getCustomerDues = async (req, res, next) => {
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
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
      ];
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: { name: '$customerName', phone: '$customerPhone' },
          totalPurchases: { $sum: 1 },
          totalAmount: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$paidAmount' },
          totalDue: { $sum: '$dueAmount' },
          lastPurchaseDate: { $max: '$saleDate' },
          invoices: { $push: { invoiceNumber: '$invoiceNumber', dueAmount: '$dueAmount', grandTotal: '$grandTotal', _id: '$_id' } },
        },
      },
      {
        $project: {
          _id: 0,
          customerName: '$_id.name',
          customerPhone: '$_id.phone',
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

    const countResult = await Sale.aggregate([...pipeline, { $count: 'total' }]);
    const total = countResult[0]?.total || 0;

    pipeline.push({ $skip: skip }, { $limit: limit });
    const customers = await Sale.aggregate(pipeline);

    // Grand totals
    const totalsResult = await Sale.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalDueAmount: { $sum: '$dueAmount' },
          totalOutstanding: { $sum: '$grandTotal' },
          totalCustomers: { $addToSet: { name: '$customerName', phone: '$customerPhone' } },
        },
      },
    ]);

    const totals = totalsResult[0] || { totalDueAmount: 0, totalOutstanding: 0, totalCustomers: 0 };

    return ApiResponse.paginated(res, {
      customers,
      totals: {
        totalDueAmount: totals.totalDueAmount || 0,
        totalOutstanding: totals.totalOutstanding || 0,
        totalCustomers: totals.totalCustomers?.length || 0,
      },
    }, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Pay due amount for a sale
// @route   POST /api/customers/pay-due
// @access  Private
export const payDue = async (req, res, next) => {
  try {
    const { saleId, amount, paymentMethod } = req.body;

    if (!saleId || !amount || amount <= 0) {
      return ApiResponse.error(res, 'Sale ID and valid amount are required', 400);
    }

    const sale = await Sale.findOne({ _id: saleId, pharmacyId: req.pharmacyId, isDeleted: false });
    if (!sale) {
      return ApiResponse.error(res, 'Sale not found', 404);
    }

    if (sale.dueAmount <= 0) {
      return ApiResponse.error(res, 'No due amount for this sale', 400);
    }

    if (amount > sale.dueAmount) {
      return ApiResponse.error(res, `Amount exceeds due. Max payable: ₹${sale.dueAmount.toFixed(2)}`, 400);
    }

    sale.paidAmount += Number(amount);
    sale.dueAmount = Math.max(0, sale.grandTotal - sale.paidAmount);
    sale.paymentStatus = sale.dueAmount <= 0 ? 'paid' : 'partial';
    sale.updatedBy = req.user._id;

    await sale.save();

    return ApiResponse.success(res, sale, 'Payment received successfully');
  } catch (error) {
    next(error);
  }
};
