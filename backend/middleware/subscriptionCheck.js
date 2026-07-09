import Pharmacy from '../models/Pharmacy.js';
import SubscriptionHistory from '../models/SubscriptionHistory.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Middleware to check if pharmacy subscription is expired
// @desc    Blocks access to all pharmacy modules if expired
// @desc    Allows: Dashboard (data fetch), Subscription page, and Auth
export const checkSubscription = async (req, res, next) => {
  // Skip for super admin
  if (req.user.role === 'super_admin') {
    return next();
  }

  // Skip for non-pharmacy users
  if (!req.user.pharmacyId) {
    return next();
  }

  try {
    const pharmacy = await Pharmacy.findById(req.user.pharmacyId);
    if (!pharmacy) {
      return next();
    }

    // Auto-transition: Update subscription statuses based on dates
    try {
      const activeRecords = await SubscriptionHistory.find({
        pharmacy: pharmacy._id,
        status: { $in: ['active', 'upcoming'] },
      }).sort({ startDate: 1 });

      const now = new Date();
      for (const record of activeRecords) {
        const recordStart = new Date(record.startDate);
        const recordEnd = new Date(record.endDate);

        if (record.status === 'upcoming' && recordStart <= now) {
          record.status = 'active';
          await record.save();
        }

        if (record.status === 'active' && recordEnd < now) {
          record.status = 'expired';
          await record.save();
        }
      }
    } catch (e) {
      console.error('Auto-transition error in middleware:', e.message);
    }

    // Check if subscription has an end date and is expired
    if (pharmacy.subscriptionEndDate) {
      const now = new Date();
      const endDate = new Date(pharmacy.subscriptionEndDate);

      if (endDate < now) {
        // Subscription is expired - allow only dashboard, subscription-related routes, and profile
        const allowedPaths = ['/api/dashboard', '/api/pharmacies/my', '/api/auth', '/api/subscription'];
        const isAllowed = allowedPaths.some((path) => req.originalUrl.startsWith(path));

        if (!isAllowed) {
          return ApiResponse.error(
            res,
            'Your subscription has expired. Please renew your subscription to access this feature.',
            403
          );
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
