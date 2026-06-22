import mongoose from 'mongoose';
import Pharmacy from '../models/Pharmacy.js';
import User from '../models/User.js';
import Medicine from '../models/Medicine.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import ApiResponse from '../utils/apiResponse.js';

// Helper to check subscription status for a pharmacy
export const getSubscriptionStatus = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.user.pharmacyId);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }

    const now = new Date();
    const endDate = pharmacy.subscriptionEndDate ? new Date(pharmacy.subscriptionEndDate) : null;
    let status = 'active';
    let daysRemaining = null;

    if (endDate) {
      const diffTime = endDate - now;
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 0) {
        status = 'expired';
      } else if (daysRemaining <= 3) {
        status = 'expiring_soon';
      }
    }

    return ApiResponse.success(res, {
      status,
      daysRemaining,
      endDate: pharmacy.subscriptionEndDate,
      plan: pharmacy.subscriptionPlan,
      hasSubscription: !!pharmacy.subscriptionPlanId,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pharmacy user dashboard statistics
// @route   GET /api/dashboard/pharmacy
// @access  Private/Admin
export const getPharmacyDashboard = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;

    // Medicine stats
    const totalMedicines = await Medicine.countDocuments({ pharmacyId, isDeleted: false });
    const lowStockMedicines = await Medicine.countDocuments({
      pharmacyId, isDeleted: false,
      $expr: { $lte: ['$currentStock', '$minStockAlert'] },
    });

    // Low stock medicines (detailed)
    const lowStockItems = await Medicine.find({
      pharmacyId, isDeleted: false,
      $expr: { $lte: ['$currentStock', '$minStockAlert'] },
    }).sort({ currentStock: 1 }).limit(10)
      .populate('category', 'name')
      .select('medicineName currentStock minStockAlert unit sellingPrice category');

    // Stock distribution by category
    const stockDistribution = await Medicine.aggregate([
      { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalStock: { $sum: '$currentStock' },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    // Top selling medicines (placeholder from stock data - will be real when sales exist)
    const topMedicines = await Medicine.find({ pharmacyId, isDeleted: false })
      .sort({ currentStock: -1 })
      .limit(5)
      .populate('category', 'name')
      .select('medicineName sellingPrice currentStock category');

    return ApiResponse.success(res, {
      totalMedicines,
      lowStockMedicines,
      lowStockItems,
      stockDistribution: stockDistribution.map((s) => ({
        name: s.category?.name || 'Uncategorized',
        count: s.count,
        totalStock: s.totalStock,
      })),
      topMedicines,
      // Placeholder for sales data (will be real when sales module is built)
      dailySales: [],
      monthlyRevenue: [],
      weeklySales: [],
      topCategories: stockDistribution.slice(0, 5).map((s) => ({
        name: s.category?.name || 'Uncategorized',
        count: s.count,
      })),
      recentSales: [],
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Super Admin dashboard statistics
// @route   GET /api/dashboard/super-admin
// @access  Private/SuperAdmin
export const getSuperAdminDashboard = async (req, res, next) => {
  try {
    const totalPharmacies = await Pharmacy.countDocuments();
    const activePharmacies = await Pharmacy.countDocuments({ status: 'active' });
    const suspendedPharmacies = await Pharmacy.countDocuments({ status: 'suspended' });
    const totalUsers = await User.countDocuments({ role: { $ne: 'super_admin' } });

    // Subscription breakdown
    const subscriptionStats = await Pharmacy.aggregate([
      {
        $group: {
          _id: '$subscriptionPlan',
          count: { $sum: 1 },
        },
      },
    ]);

    // Recent pharmacies (last 5)
    const recentPharmacies = await Pharmacy.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('pharmacyName ownerName email status subscriptionPlan createdAt');

    // Monthly pharmacy registrations (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRegistrations = await Pharmacy.aggregate([
      {
        $match: { createdAt: { $gte: sixMonthsAgo } },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Status distribution
    const statusDistribution = await Pharmacy.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    return ApiResponse.success(res, {
      totalPharmacies,
      activePharmacies,
      suspendedPharmacies,
      totalUsers,
      subscriptionStats: subscriptionStats.map((s) => ({
        plan: s._id,
        count: s.count,
      })),
      recentPharmacies,
      monthlyRegistrations: monthlyRegistrations.map((m) => ({
        month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
        count: m.count,
      })),
      statusDistribution: statusDistribution.map((s) => ({
        status: s._id,
        count: s.count,
      })),
    });
  } catch (error) {
    next(error);
  }
};