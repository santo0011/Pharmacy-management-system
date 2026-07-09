import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';
import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import Notification from '../models/Notification.js';
import ActivityLog from '../models/ActivityLog.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Get comprehensive pharmacy dashboard data
// @route   GET /api/dashboard/comprehensive
// @access  Private
export const getComprehensiveDashboard = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const activeStatus = { $nin: ['cancelled', 'returned'] };

    const [
      medicineStats,
      todaySales,
      monthlySales,
      totalSales,
      weeklySales,
      dailySalesTrend,
      monthlyRevenue,
      purchaseVsSale,
      paymentMethodStats,
      topMedicines,
      recentSales,
      lowStockItems,
      expiringItems,
      customerStats,
      supplierStats,
      notificationStats,
      recentActivity,
    ] = await Promise.all([
      // Medicine stats
      Medicine.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalStock: { $sum: '$currentStock' },
            totalStockValue: { $sum: { $multiply: ['$currentStock', '$purchasePrice'] } },
            totalSellingValue: { $sum: { $multiply: ['$currentStock', '$sellingPrice'] } },
            lowStock: { $sum: { $cond: [{ $lte: ['$currentStock', '$minStockAlert'] }, 1, 0] } },
            expired: { $sum: { $cond: [{ $lt: ['$expiryDate', now] }, 1, 0] } },
            expiringSoon: { $sum: { $cond: [{ $and: [{ $gte: ['$expiryDate', now] }, { $lte: ['$expiryDate', last30Days] }] }, 1, 0] } },
          },
        },
      ]),

      // Today's sales
      Sale.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, saleDate: { $gte: startOfDay }, status: activeStatus } },
        { $unwind: '$items' },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 }, profit: { $sum: { $subtract: ['$items.total', { $multiply: ['$items.quantity', '$items.purchasePrice'] }] } } } },
      ]),

      // Monthly sales
      Sale.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, saleDate: { $gte: startOfMonth }, status: activeStatus } },
        { $unwind: '$items' },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 }, profit: { $sum: { $subtract: ['$items.total', { $multiply: ['$items.quantity', '$items.purchasePrice'] }] } } } },
      ]),

      // Total sales
      Sale.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: activeStatus } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 }, totalDue: { $sum: '$dueAmount' }, totalPaid: { $sum: '$paidAmount' } } },
      ]),

      // Weekly sales
      Sale.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, saleDate: { $gte: last7Days }, status: activeStatus } },
        { $unwind: '$items' },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 }, profit: { $sum: { $subtract: ['$items.total', { $multiply: ['$items.quantity', '$items.purchasePrice'] }] } } } },
      ]),

      // Daily sales trend (last 30 days)
      Sale.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, saleDate: { $gte: last30Days }, status: activeStatus } },
        { $unwind: '$items' },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } }, total: { $sum: '$grandTotal' }, count: { $sum: 1 }, profit: { $sum: { $subtract: ['$items.total', { $multiply: ['$items.quantity', '$items.purchasePrice'] }] } } } },
        { $sort: { _id: 1 } },
      ]),

      // Monthly revenue (current year)
      Sale.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, saleDate: { $gte: startOfYear }, status: activeStatus } },
        { $unwind: '$items' },
        { $group: { _id: { $month: '$saleDate' }, total: { $sum: '$grandTotal' }, count: { $sum: 1 }, profit: { $sum: { $subtract: ['$items.total', { $multiply: ['$items.quantity', '$items.purchasePrice'] }] } } } },
        { $sort: { _id: 1 } },
      ]),

      // Monthly purchase vs sale
      (async () => {
        const purchases = await Purchase.aggregate([
          { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, purchaseDate: { $gte: startOfYear }, status: { $ne: 'cancelled' } } },
          { $group: { _id: { $month: '$purchaseDate' }, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]);
        const sales = await Sale.aggregate([
          { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, saleDate: { $gte: startOfYear }, status: activeStatus } },
          { $group: { _id: { $month: '$saleDate' }, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months.map((m, i) => {
          const monthNum = i + 1;
          const p = purchases.find(p => p._id === monthNum);
          const s = sales.find(s => s._id === monthNum);
          return { month: m, purchaseTotal: p?.total || 0, purchaseCount: p?.count || 0, saleTotal: s?.total || 0, saleCount: s?.count || 0 };
        });
      })(),

      // Payment method stats
      Sale.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: activeStatus } },
        { $group: { _id: '$paymentMethod', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),

      // Top selling medicines
      Sale.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: activeStatus } },
        { $unwind: '$items' },
        { $group: { _id: '$items.medicineName', totalQty: { $sum: '$items.quantity' }, totalRevenue: { $sum: '$items.total' }, totalProfit: { $sum: { $subtract: ['$items.total', { $multiply: ['$items.quantity', '$items.purchasePrice'] }] } } } },
        { $sort: { totalQty: -1 } },
        { $limit: 10 },
      ]),

      // Recent sales
      Sale.find({ pharmacyId, isDeleted: false, status: activeStatus })
        .sort({ createdAt: -1 }).limit(5)
        .select('invoiceNumber customerName grandTotal paidAmount dueAmount paymentMethod paymentStatus saleDate'),

      // Low stock items
      Medicine.find({
        pharmacyId, isDeleted: false,
        $expr: { $lte: ['$currentStock', '$minStockAlert'] },
      }).sort({ currentStock: 1 }).limit(10)
        .populate('category', 'name')
        .select('medicineName currentStock minStockAlert unit sellingPrice category'),

      // Expiring items
      Medicine.find({
        pharmacyId, isDeleted: false,
        expiryDate: { $gte: now, $lte: last30Days },
      }).sort({ expiryDate: 1 }).limit(10)
        .select('medicineName batchNumber expiryDate currentStock unit sellingPrice'),

      // Customer stats
      Customer.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false } },
        { $group: { _id: null, total: { $sum: 1 }, totalDue: { $sum: '$totalDue' }, totalSpent: { $sum: '$totalSpent' } } },
      ]),

      // Supplier stats
      Supplier.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false } },
        { $group: { _id: null, total: { $sum: 1 }, totalDue: { $sum: '$totalDue' } } },
      ]),

      // Notification stats
      Notification.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDismissed: false } },
        { $group: { _id: '$type', count: { $sum: 1 }, unread: { $sum: { $cond: ['$isRead', 0, 1] } } } },
      ]),

      // Recent activity
      ActivityLog.find({ pharmacyId })
        .populate('user', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .select('action resource description userName createdAt'),
    ]);

    return ApiResponse.success(res, {
      // Medicine overview
      medicineStats: medicineStats[0] || { total: 0, totalStock: 0, totalStockValue: 0, totalSellingValue: 0, lowStock: 0, expired: 0, expiringSoon: 0 },
      
      // Sales overview
      todaySales: todaySales[0] || { total: 0, count: 0, profit: 0 },
      monthlySales: monthlySales[0] || { total: 0, count: 0, profit: 0 },
      totalSales: totalSales[0] || { total: 0, count: 0, totalDue: 0, totalPaid: 0 },
      weeklySales: weeklySales[0] || { total: 0, count: 0, profit: 0 },
      
      // Trends
      dailySalesTrend: dailySalesTrend.map(d => ({ date: d._id, amount: d.total, count: d.count, profit: d.profit })),
      monthlyRevenue: monthlyRevenue.map(m => ({ month: m._id, amount: m.total, count: m.count, profit: m.profit })),
      monthlyPurchaseVsSale,
      
      // Breakdowns
      paymentMethodStats: paymentMethodStats.map(p => ({ method: p._id, total: p.total, count: p.count })),
      topMedicines,
      
      // Recent data
      recentSales,
      lowStockItems,
      expiringItems,
      
      // Business stats
      customerStats: customerStats[0] || { total: 0, totalDue: 0, totalSpent: 0 },
      supplierStats: supplierStats[0] || { total: 0, totalDue: 0 },
      
      // Notifications & Activity
      notificationStats,
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get profit & loss summary
// @route   GET /api/dashboard/profit-loss
// @access  Private
export const getProfitLossSummary = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const { period = 'monthly', startDate, endDate } = req.query;

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
          revenue: { $sum: '$items.total' },
          cost: { $sum: { $multiply: ['$items.quantity', '$items.purchasePrice'] } },
          discount: { $sum: '$items.discountAmount' },
          gst: { $sum: '$items.gstAmount' },
          quantity: { $sum: '$items.quantity' },
        },
      },
      {
        $project: {
          _id: 0,
          period: '$_id',
          revenue: { $round: ['$revenue', 2] },
          cost: { $round: ['$cost', 2] },
          profit: { $round: [{ $subtract: ['$revenue', '$cost'] }, 2] },
          margin: {
            $round: [{
              $multiply: [
                { $divide: [{ $subtract: ['$revenue', '$cost'] }, { $cond: [{ $eq: ['$revenue', 0] }, 1, '$revenue'] }] },
                100,
              ],
            }, 1],
          },
          discount: { $round: ['$discount', 2] },
          gst: { $round: ['$gst', 2] },
          quantity: '$quantity',
        },
      },
      { $sort: { period: 1 } },
    ]);

    const totals = profitLoss.reduce(
      (acc, curr) => ({
        revenue: acc.revenue + curr.revenue,
        cost: acc.cost + curr.cost,
        profit: acc.profit + curr.profit,
        discount: acc.discount + curr.discount,
        gst: acc.gst + curr.gst,
        quantity: acc.quantity + curr.quantity,
      }),
      { revenue: 0, cost: 0, profit: 0, discount: 0, gst: 0, quantity: 0 }
    );

    const overallMargin = totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : 0;

    return ApiResponse.success(res, {
      profitLoss,
      totals: { ...totals, margin: overallMargin },
    });
  } catch (error) {
    next(error);
  }
};