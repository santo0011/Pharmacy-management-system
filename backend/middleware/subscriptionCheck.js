import Pharmacy from '../models/Pharmacy.js';
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

    // Check if subscription has an end date and is expired
    if (pharmacy.subscriptionEndDate) {
      const now = new Date();
      const endDate = new Date(pharmacy.subscriptionEndDate);

      if (endDate < now) {
        // Subscription is expired - allow only dashboard and subscription-related routes
        const allowedPaths = ['/api/dashboard', '/api/pharmacies/my', '/api/auth'];
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