import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import Medicine from '../models/Medicine.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Get sales report with filters
// @route   GET /api/reports/sales
// @access  Private
export const getSalesReport = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const { startDate, endDate, paymentMethod, period } = req.query;

    const match = { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } };

    if (startDate) match.saleDate = { ...match.saleDate, $gte: new Date(startDate) };
    if (endDate) match.saleDate = { ...match.saleDate, $lte: new Date(endDate) };
    if (paymentMethod) match.paymentMethod = paymentMethod;

    // Overall summary
    const summary = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$grandTotal' },
          totalDiscount: { $sum: '$discountAmount' },
          totalTax: { $sum: '$taxAmount' },
          totalPaid: { $sum: '$paidAmount' },
          totalDue: { $sum: '$dueAmount' },
          avgOrderValue: { $avg: '$grandTotal' },
        },
      },
    ]);

    // Daily/Monthly breakdown
    let dateFormat = '%Y-%m-%d';
    if (period === 'monthly') dateFormat = '%Y-%m';
    if (period === 'yearly') dateFormat = '%Y';

    const trend = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$saleDate' } },
          sales: { $sum: 1 },
          revenue: { $sum: '$grandTotal' },
          discount: { $sum: '$discountAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Payment method breakdown
    const paymentBreakdown = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          total: { $sum: '$grandTotal' },
        },
      },
    ]);

    // Top selling medicines
    const topProducts = await Sale.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.medicineName',
          totalQty: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 10 },
    ]);

    return ApiResponse.success(res, {
      summary: summary[0] || { totalSales: 0, totalRevenue: 0, totalDiscount: 0, totalTax: 0, totalPaid: 0, totalDue: 0, avgOrderValue: 0 },
      trend,
      paymentBreakdown,
      topProducts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get purchase report with filters
// @route   GET /api/reports/purchases
// @access  Private
export const getPurchaseReport = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const { startDate, endDate, period } = req.query;

    const match = { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } };

    if (startDate) match.purchaseDate = { ...match.purchaseDate, $gte: new Date(startDate) };
    if (endDate) match.purchaseDate = { ...match.purchaseDate, $lte: new Date(endDate) };

    const summary = await Purchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          totalCost: { $sum: '$grandTotal' },
          totalDiscount: { $sum: '$discountAmount' },
          totalPaid: { $sum: '$paidAmount' },
          totalDue: { $sum: '$dueAmount' },
        },
      },
    ]);

    let dateFormat = '%Y-%m-%d';
    if (period === 'monthly') dateFormat = '%Y-%m';
    if (period === 'yearly') dateFormat = '%Y';

    const trend = await Purchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$purchaseDate' } },
          purchases: { $sum: 1 },
          cost: { $sum: '$grandTotal' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return ApiResponse.success(res, {
      summary: summary[0] || { totalPurchases: 0, totalCost: 0, totalDiscount: 0, totalPaid: 0, totalDue: 0 },
      trend,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get profit & loss report
// @route   GET /api/reports/profit-loss
// @access  Private
export const getProfitLossReport = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const { startDate, endDate, period } = req.query;

    const match = { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } };

    if (startDate) match.saleDate = { ...match.saleDate, $gte: new Date(startDate) };
    if (endDate) match.saleDate = { ...match.saleDate, $lte: new Date(endDate) };

    let dateFormat = '%Y-%m-%d';
    if (period === 'monthly') dateFormat = '%Y-%m';
    if (period === 'yearly') dateFormat = '%Y';

    const profitLoss = await Sale.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$saleDate' } },
          totalRevenue: { $sum: '$items.total' },
          totalCost: { $sum: { $multiply: ['$items.quantity', '$items.purchasePrice'] } },
          totalDiscount: { $sum: '$items.discountAmount' },
          totalGst: { $sum: '$items.gstAmount' },
          itemCount: { $sum: '$items.quantity' },
        },
      },
      {
        $project: {
          _id: 0,
          period: '$_id',
          revenue: { $round: ['$totalRevenue', 2] },
          cost: { $round: ['$totalCost', 2] },
          profit: { $round: [{ $subtract: ['$totalRevenue', '$totalCost'] }, 2] },
          margin: {
            $round: [
              {
                $multiply: [
                  { $divide: [{ $subtract: ['$totalRevenue', '$totalCost'] }, { $cond: [{ $eq: ['$totalRevenue', 0] }, 1, '$totalRevenue'] }] },
                  100,
                ],
              },
              1,
            ],
          },
          discount: { $round: ['$totalDiscount', 2] },
          gst: { $round: ['$totalGst', 2] },
          quantity: '$itemCount',
        },
      },
      { $sort: { period: 1 } },
    ]);

    // Overall totals
    const totals = profitLoss.reduce(
      (acc, curr) => ({
        totalRevenue: acc.totalRevenue + curr.revenue,
        totalCost: acc.totalCost + curr.cost,
        totalProfit: acc.totalProfit + curr.profit,
        totalDiscount: acc.totalDiscount + curr.discount,
        totalGst: acc.totalGst + curr.gst,
      }),
      { totalRevenue: 0, totalCost: 0, totalProfit: 0, totalDiscount: 0, totalGst: 0 }
    );

    return ApiResponse.success(res, {
      profitLoss,
      totals,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get stock report
// @route   GET /api/reports/stock
// @access  Private
export const getStockReport = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const { lowStock } = req.query;

    const query = { pharmacyId, isDeleted: false };

    if (lowStock === 'true') {
      query.$expr = { $lte: ['$currentStock', '$minStockAlert'] };
    }

    const medicines = await Medicine.find(query)
      .populate('category', 'name')
      .populate('supplier', 'supplierName')
      .sort({ currentStock: 1 })
      .select('medicineName currentStock minStockAlert unit purchasePrice sellingPrice category supplier');

    const summary = {
      totalItems: medicines.length,
      totalStockValue: medicines.reduce((sum, m) => sum + m.currentStock * m.purchasePrice, 0),
      lowStockItems: medicines.filter((m) => m.currentStock <= m.minStockAlert).length,
    };

    return ApiResponse.success(res, {
      summary,
      medicines,
    });
  } catch (error) {
    next(error);
  }
};