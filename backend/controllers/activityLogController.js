import ActivityLog from '../models/ActivityLog.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Get activity logs for pharmacy
// @route   GET /api/activity-logs
// @access  Private/Admin
export const getActivityLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { action, resource, startDate, endDate, userId, search } = req.query;

    const query = { pharmacyId: req.pharmacyId };

    if (action) query.action = action;
    if (resource) query.resource = resource;
    if (userId) query.user = userId;
    if (startDate) query.createdAt = { ...query.createdAt, $gte: new Date(startDate) };
    if (endDate) query.createdAt = { ...query.createdAt, $lte: new Date(endDate) };
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { resource: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await ActivityLog.countDocuments(query);
    const logs = await ActivityLog.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get distinct actions and resources for filter dropdowns
    const actions = await ActivityLog.distinct('action', { pharmacyId: req.pharmacyId });
    const resources = await ActivityLog.distinct('resource', { pharmacyId: req.pharmacyId });

    return ApiResponse.paginated(res, logs, total, page, limit, { actions, resources });
  } catch (error) {
    next(error);
  }
};

// @desc    Get activity log summary
// @route   GET /api/activity-logs/summary
// @access  Private/Admin
export const getActivitySummary = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalLogs, recentLogs, actionBreakdown, dailyActivity] = await Promise.all([
      ActivityLog.countDocuments({ pharmacyId }),
      ActivityLog.find({ pharmacyId })
        .populate('user', 'name')
        .sort({ createdAt: -1 })
        .limit(10),
      ActivityLog.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId) } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      ActivityLog.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), createdAt: { $gte: last7Days } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return ApiResponse.success(res, {
      totalLogs,
      recentLogs,
      actionBreakdown,
      dailyActivity,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete old activity logs (cleanup)
// @route   DELETE /api/activity-logs/cleanup
// @access  Private/SuperAdmin
export const cleanupActivityLogs = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await ActivityLog.deleteMany({
      pharmacyId: req.pharmacyId,
      createdAt: { $lt: cutoffDate },
    });

    return ApiResponse.success(res, { deletedCount: result.deletedCount }, `Cleaned up ${result.deletedCount} old logs`);
  } catch (error) {
    next(error);
  }
};