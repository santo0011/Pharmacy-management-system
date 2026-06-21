import ApiResponse from '../utils/apiResponse.js';

// Middleware to ensure user can only access their own pharmacy's data
export const pharmacyScope = (req, res, next) => {
  // Super admin can access all pharmacies
  if (req.user.role === 'super_admin') {
    // If super admin specifies a pharmacyId in query/params, use it
    if (req.query.pharmacyId) {
      req.pharmacyId = req.query.pharmacyId;
    } else if (req.params.pharmacyId) {
      req.pharmacyId = req.params.pharmacyId;
    }
    return next();
  }

  // For pharmacy-level users (admin, pharmacist, cashier), use their pharmacyId
  if (!req.user.pharmacyId) {
    return ApiResponse.error(res, 'No pharmacy assigned to your account', 403);
  }

  req.pharmacyId = req.user.pharmacyId;
  next();
};

// Middleware to restrict access to only pharmacy-level roles
export const pharmacyOnly = (req, res, next) => {
  if (req.user.role === 'super_admin') {
    return ApiResponse.error(res, 'Super Admin cannot access pharmacy modules', 403);
  }
  next();
};

// Middleware to restrict access to Super Admin only
export const superAdminOnly = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return ApiResponse.error(res, 'Only Super Admin can access this resource', 403);
  }
  next();
};