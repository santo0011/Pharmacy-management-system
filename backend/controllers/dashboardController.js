import Pharmacy from '../models/Pharmacy.js';
import User from '../models/User.js';
import Medicine from '../models/Medicine.js';
import ApiResponse from '../utils/apiResponse.js';

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