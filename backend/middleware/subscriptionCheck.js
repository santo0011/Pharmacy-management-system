import Pharmacy from '../models/Pharmacy.js';
import SubscriptionHistory from '../models/SubscriptionHistory.js';
import ApiResponse from '../utils/apiResponse.js';

/**
 * Calculate the effective subscription end date dynamically from active history records
 */
async function calculateEffectiveEndDate(pharmacyId) {
  const activeRecords = await SubscriptionHistory.find({
    pharmacy: pharmacyId,
    status: { $in: ['active', 'upcoming'] },
  }).sort({ endDate: -1 });

  if (activeRecords.length === 0) {
    return null;
  }

  return activeRecords[0].endDate;
}

/**
 * Calculate remaining days from active subscription records
 */
async function calculateRemainingDays(pharmacyId) {
  const effectiveEndDate = await calculateEffectiveEndDate(pharmacyId);
  if (!effectiveEndDate) return 0;

  const now = new Date();
  const diffTime = new Date(effectiveEndDate) - now;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

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

    // Dynamically calculate remaining days from active history records
    const remainingDays = await calculateRemainingDays(pharmacy._id);

    if (remainingDays <= 0) {
      // Subscription is expired - allow only dashboard, subscription-related routes, and auth
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

    next();
  } catch (error) {
    next(error);
  }
};
