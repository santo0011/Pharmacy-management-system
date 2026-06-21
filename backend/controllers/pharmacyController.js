import Pharmacy from '../models/Pharmacy.js';
import User from '../models/User.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import ApiResponse from '../utils/apiResponse.js';

// Helper to resolve subscription plan: if it's an ObjectId, look up plan name
const resolveSubscriptionPlan = async (subscriptionPlan) => {
  if (!subscriptionPlan) {
    return { planName: 'free', planId: null };
  }
  // Check if it's a valid ObjectId (24 hex chars)
  if (/^[0-9a-fA-F]{24}$/.test(subscriptionPlan)) {
    const plan = await SubscriptionPlan.findById(subscriptionPlan);
    if (plan) {
      return { planName: plan.planName, planId: plan._id };
    }
  }
  return { planName: subscriptionPlan, planId: null };
};

// @desc    Create a new pharmacy with admin account and subscription
// @route   POST /api/pharmacies
// @access  Private/SuperAdmin
export const createPharmacy = async (req, res, next) => {
  try {
    const {
      pharmacyName, ownerName, email, phone, address, licenseNumber,
      adminName, adminEmail, adminPassword, adminPhone,
      subscriptionPlan, subscriptionStartDate, subscriptionEndDate
    } = req.body;

    const existingPharmacy = await Pharmacy.findOne({ email });
    if (existingPharmacy) {
      return ApiResponse.error(res, 'Pharmacy with this email already exists', 400);
    }

    // Check if admin email is already taken
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      return ApiResponse.error(res, 'Admin email already registered', 400);
    }

    // Resolve subscription plan name from ObjectId if needed
    const resolved = await resolveSubscriptionPlan(subscriptionPlan);

    // 1. Create Pharmacy
    const pharmacy = await Pharmacy.create({
      pharmacyName,
      ownerName,
      email,
      phone,
      address,
      licenseNumber,
      subscriptionPlan: resolved.planName,
      subscriptionPlanId: resolved.planId,
      subscriptionStartDate: subscriptionStartDate || Date.now(),
      subscriptionEndDate: subscriptionEndDate || null,
      createdBy: req.user._id,
    });

    // 2. Create Pharmacy Admin user linked to the pharmacy
    const adminUser = await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      phone: adminPhone || '',
      pharmacyId: pharmacy._id,
      isActive: true,
    });

    return ApiResponse.success(
      res,
      {
        pharmacy,
        admin: adminUser,
      },
      'Pharmacy created with Admin account successfully',
      201
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Get all pharmacies
// @route   GET /api/pharmacies
// @access  Private/SuperAdmin
export const getPharmacies = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    let query = {};
    if (search) {
      query.$or = [
        { pharmacyName: { $regex: search, $options: 'i' } },
        { ownerName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Pharmacy.countDocuments(query);
    const pharmacies = await Pharmacy.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, pharmacies, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single pharmacy
// @route   GET /api/pharmacies/:id
// @access  Private/SuperAdmin
export const getPharmacy = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }
    return ApiResponse.success(res, pharmacy);
  } catch (error) {
    next(error);
  }
};

// @desc    Update pharmacy
// @route   PUT /api/pharmacies/:id
// @access  Private/SuperAdmin
export const updatePharmacy = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }

    const { pharmacyName, ownerName, email, phone, address, licenseNumber, status } = req.body;

    if (email && email !== pharmacy.email) {
      const existingPharmacy = await Pharmacy.findOne({ email });
      if (existingPharmacy) {
        return ApiResponse.error(res, 'Email already in use by another pharmacy', 400);
      }
    }

    pharmacy.pharmacyName = pharmacyName || pharmacy.pharmacyName;
    pharmacy.ownerName = ownerName || pharmacy.ownerName;
    pharmacy.email = email || pharmacy.email;
    pharmacy.phone = phone || pharmacy.phone;
    pharmacy.address = address !== undefined ? address : pharmacy.address;
    pharmacy.licenseNumber = licenseNumber !== undefined ? licenseNumber : pharmacy.licenseNumber;
    pharmacy.status = status || pharmacy.status;

    const updatedPharmacy = await pharmacy.save();
    return ApiResponse.success(res, updatedPharmacy, 'Pharmacy updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete pharmacy
// @route   DELETE /api/pharmacies/:id
// @access  Private/SuperAdmin
export const deletePharmacy = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }

    // Deactivate all users under this pharmacy
    await User.updateMany(
      { pharmacyId: pharmacy._id },
      { isActive: false }
    );

    await pharmacy.deleteOne();
    return ApiResponse.success(res, null, 'Pharmacy deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Assign admin to pharmacy
// @route   POST /api/pharmacies/:id/assign-admin
// @access  Private/SuperAdmin
export const assignPharmacyAdmin = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }

    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }

    if (user.role === 'super_admin') {
      return ApiResponse.error(res, 'Cannot assign Super Admin to a pharmacy', 400);
    }

    user.pharmacyId = pharmacy._id;
    user.role = 'admin';
    await user.save();

    return ApiResponse.success(res, user, 'Pharmacy Admin assigned successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle pharmacy status (activate/suspend)
// @route   PATCH /api/pharmacies/:id/status
// @access  Private/SuperAdmin
export const togglePharmacyStatus = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }

    const { status } = req.body;
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return ApiResponse.error(res, 'Invalid status value', 400);
    }

    pharmacy.status = status;

    // If suspending, deactivate all pharmacy users
    if (status === 'suspended') {
      await User.updateMany(
        { pharmacyId: pharmacy._id },
        { isActive: false }
      );
    }

    // If activating, reactivate pharmacy users
    if (status === 'active') {
      await User.updateMany(
        { pharmacyId: pharmacy._id },
        { isActive: true }
      );
    }

    await pharmacy.save();
    return ApiResponse.success(res, pharmacy, `Pharmacy ${status} successfully`);
  } catch (error) {
    next(error);
  }
};

// @desc    Update pharmacy subscription
// @route   PUT /api/pharmacies/:id/subscription
// @access  Private/SuperAdmin
export const updateSubscription = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }

    const { subscriptionPlan, subscriptionPlanId, subscriptionStartDate, subscriptionEndDate } = req.body;

    if (subscriptionPlanId) {
      const plan = await SubscriptionPlan.findOne({ _id: subscriptionPlanId, isDeleted: false, isActive: true });
      if (!plan) {
        return ApiResponse.error(res, 'Invalid or inactive subscription plan', 400);
      }
      pharmacy.subscriptionPlan = plan.planName;
      pharmacy.subscriptionPlanId = plan._id;
    } else if (subscriptionPlan) {
      // Allow free/basic/premium/enterprise as fallback for existing records
      pharmacy.subscriptionPlan = subscriptionPlan;
      pharmacy.subscriptionPlanId = null;
    }

    pharmacy.subscriptionStartDate = subscriptionStartDate || pharmacy.subscriptionStartDate;
    pharmacy.subscriptionEndDate = subscriptionEndDate || pharmacy.subscriptionEndDate;

    await pharmacy.save();
    return ApiResponse.success(res, pharmacy, 'Subscription updated successfully');
  } catch (error) {
    next(error);
  }
};
