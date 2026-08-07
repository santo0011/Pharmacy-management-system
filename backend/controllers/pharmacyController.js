import Pharmacy from '../models/Pharmacy.js';
import User from '../models/User.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import SubscriptionHistory from '../models/SubscriptionHistory.js';
import Medicine from '../models/Medicine.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import Supplier from '../models/Supplier.js';
import ApiResponse from '../utils/apiResponse.js';
import { getCountryByCode, getAllCountries, getCountryOptions } from '../utils/countryData.js';

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
      subscriptionPlan, subscriptionStartDate, subscriptionEndDate,
      country
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

    // Determine country - default to 'IN' if not provided
    const pharmacyCountry = country || 'IN';
    const countryData = getCountryByCode(pharmacyCountry);
    if (!countryData) {
      return ApiResponse.error(res, `Invalid country code: ${pharmacyCountry}`, 400);
    }

    // 1. Create Pharmacy with auto-populated currency and localization
    const pharmacy = await Pharmacy.create({
      pharmacyName,
      ownerName,
      email,
      phone,
      address,
      licenseNumber,
      country: pharmacyCountry,
      currency: countryData.currency || 'INR',
      currencySymbol: countryData.currencySymbol || '₹',
      timezone: countryData.timezone || 'Asia/Kolkata',
      dateFormat: countryData.dateFormat || 'DD/MM/YYYY',
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

// @desc    Get single pharmacy with admin details
// @route   GET /api/pharmacies/:id
// @access  Private/SuperAdmin
export const getPharmacy = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }

    // Find the admin user for this pharmacy
    const adminUser = await User.findOne({ pharmacyId: pharmacy._id, role: 'admin' }).select('name email phone');

    const pharmacyData = pharmacy.toObject();
    pharmacyData.pharmacyAdmin = adminUser || null;

    return ApiResponse.success(res, pharmacyData);
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

    const { pharmacyName, ownerName, email, phone, address, licenseNumber, status, country, currency, currencySymbol, timezone, dateFormat } = req.body;

    if (email && email !== pharmacy.email) {
      const existingPharmacy = await Pharmacy.findOne({ email });
      if (existingPharmacy) {
        return ApiResponse.error(res, 'Email already in use by another pharmacy', 400);
      }
    }

    // Validate country if provided
    if (country) {
      const countryData = getCountryByCode(country);
      if (!countryData) {
        return ApiResponse.error(res, `Invalid country code: ${country}`, 400);
      }
    }

    pharmacy.pharmacyName = pharmacyName || pharmacy.pharmacyName;
    pharmacy.ownerName = ownerName || pharmacy.ownerName;
    pharmacy.email = email || pharmacy.email;
    pharmacy.phone = phone || pharmacy.phone;
    pharmacy.address = address !== undefined ? address : pharmacy.address;
    pharmacy.licenseNumber = licenseNumber !== undefined ? licenseNumber : pharmacy.licenseNumber;
    pharmacy.country = country || pharmacy.country;
    pharmacy.status = status || pharmacy.status;
    pharmacy.currency = currency || pharmacy.currency;
    pharmacy.currencySymbol = currencySymbol || pharmacy.currencySymbol;
    pharmacy.timezone = timezone || pharmacy.timezone;
    pharmacy.dateFormat = dateFormat || pharmacy.dateFormat;

    const updatedPharmacy = await pharmacy.save();
    return ApiResponse.success(res, updatedPharmacy, 'Pharmacy updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete pharmacy with related data check
// @route   DELETE /api/pharmacies/:id
// @access  Private/SuperAdmin
export const deletePharmacy = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }

    // Check for related data before allowing deletion
    const relatedChecks = await Promise.all([
      User.countDocuments({ pharmacyId: pharmacy._id }),
      Medicine.countDocuments({ pharmacyId: pharmacy._id, isDeleted: false }),
      Category.countDocuments({ pharmacyId: pharmacy._id }),
      Brand.countDocuments({ pharmacyId: pharmacy._id }),
      Supplier.countDocuments({ pharmacyId: pharmacy._id }),
    ]);

    const [userCount, medicineCount, categoryCount, brandCount, supplierCount] = relatedChecks;
    const totalRelated = userCount + medicineCount + categoryCount + brandCount + supplierCount;

    if (totalRelated > 0) {
      return ApiResponse.error(
        res,
        'Cannot delete this pharmacy because it contains related data. Please deactivate it instead.',
        400
      );
    }

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

    // If deactivating or suspending, deactivate all pharmacy users
    if (status === 'inactive' || status === 'suspended') {
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

// @desc    Get my pharmacy profile (for admin users)
// @route   GET /api/pharmacies/my/profile
// @access  Private/Admin
export const getMyPharmacyProfile = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.pharmacyId);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }
    return ApiResponse.success(res, pharmacy);
  } catch (error) {
    next(error);
  }
};

// @desc    Update my pharmacy profile (for admin users)
// @route   PUT /api/pharmacies/my/profile
// @access  Private/Admin
export const updateMyPharmacyProfile = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.pharmacyId);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }

    const allowedFields = [
      'pharmacyName', 'logo', 'ownerName', 'contactPerson', 'phone', 'email',
      'address', 'city', 'state', 'country', 'postalCode',
      'currency', 'currencySymbol', 'timezone', 'dateFormat', 'language', 'financialYearStart',
      'licenseNumber', 'gstNumber', 'gstin', 'stateCode', 'registrationNumber', 'licenseExpiryDate', 'registrationCertificate',
      'storeOpenTime', 'storeCloseTime', 'weeklyOffDay', 'emergencyContact',
      'invoiceHeaderName', 'invoiceFooterText', 'invoiceLogo', 'invoiceAddress', 'invoiceContactInfo',
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        pharmacy[field] = req.body[field];
      }
    });

    const updatedPharmacy = await pharmacy.save();
    return ApiResponse.success(res, updatedPharmacy, 'Pharmacy profile updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get pharmacy invoice settings (for admin users)
// @route   GET /api/pharmacies/my/invoice-settings
// @access  Private/Admin
export const getMyInvoiceSettings = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.pharmacyId).select('invoiceSettings');
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }
    return ApiResponse.success(res, {
      invoiceTemplate: pharmacy.invoiceSettings?.invoiceTemplate || 'classic',
      printFormat: pharmacy.invoiceSettings?.printFormat || 'a4',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update pharmacy invoice settings (for admin users)
// @route   PUT /api/pharmacies/my/invoice-settings
// @access  Private/Admin
export const updateMyInvoiceSettings = async (req, res, next) => {
  try {
    const { invoiceTemplate, printFormat } = req.body;

    const pharmacy = await Pharmacy.findById(req.pharmacyId);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }

    if (invoiceTemplate && !['classic', 'modern', 'minimal'].includes(invoiceTemplate)) {
      return ApiResponse.error(res, 'Invalid invoice template', 400);
    }
    if (printFormat && !['a4', '58mm', '80mm'].includes(printFormat)) {
      return ApiResponse.error(res, 'Invalid print format', 400);
    }

    pharmacy.invoiceSettings = {
      invoiceTemplate: invoiceTemplate || pharmacy.invoiceSettings?.invoiceTemplate || 'classic',
      printFormat: printFormat || pharmacy.invoiceSettings?.printFormat || 'a4',
    };

    await pharmacy.save();
    return ApiResponse.success(res, pharmacy.invoiceSettings, 'Invoice settings updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Update pharmacy subscription (delegates to new subscription controller)
// @route   PUT /api/pharmacies/:id/subscription
// @access  Private/SuperAdmin
export const updateSubscription = async (req, res, next) => {
  try {
    const pharmacy = await Pharmacy.findById(req.params.id);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }

    const { subscriptionPlanId, subscriptionStartDate, subscriptionEndDate, notes } = req.body;

    if (!subscriptionPlanId) {
      return ApiResponse.error(res, 'A valid subscription plan ID is required', 400);
    }

    const plan = await SubscriptionPlan.findOne({ _id: subscriptionPlanId, isDeleted: false, isActive: true });
    if (!plan) {
      return ApiResponse.error(res, 'Invalid or inactive subscription plan', 400);
    }

    const currentEndDate = pharmacy.subscriptionEndDate ? new Date(pharmacy.subscriptionEndDate) : null;
    const now = new Date();
    let newStartDate;

    if (subscriptionStartDate) {
      newStartDate = new Date(subscriptionStartDate);
    } else if (currentEndDate && currentEndDate > now) {
      newStartDate = new Date(currentEndDate);
      newStartDate.setDate(newStartDate.getDate() + 1);
    } else {
      newStartDate = new Date();
    }

    let newEndDate;
    if (subscriptionEndDate) {
      newEndDate = new Date(subscriptionEndDate);
    } else {
      newEndDate = new Date(newStartDate);
      if (plan.durationUnit === 'days') {
        newEndDate.setDate(newEndDate.getDate() + plan.duration);
      } else if (plan.durationUnit === 'months') {
        newEndDate.setMonth(newEndDate.getMonth() + plan.duration);
      } else if (plan.durationUnit === 'years') {
        newEndDate.setFullYear(newEndDate.getFullYear() + plan.duration);
      }
    }

    const isUpcoming = currentEndDate && currentEndDate > now && newStartDate > now;
    const historyStatus = isUpcoming ? 'upcoming' : 'active';
    const hasActiveSubscription = currentEndDate && currentEndDate > now;
    const actionType = hasActiveSubscription ? 'extended' : 'created';

    // Create subscription history record
    const historyRecord = await SubscriptionHistory.create({
      pharmacy: pharmacy._id,
      pharmacyName: pharmacy.pharmacyName,
      planId: plan._id,
      planName: plan.planName,
      startDate: newStartDate,
      endDate: newEndDate,
      duration: plan.duration,
      durationUnit: plan.durationUnit,
      amount: plan.priceInINR || plan.price,
      originalCurrency: plan.priceCurrency || 'INR',
      originalAmount: plan.price,
      exchangeRate: plan.priceInINR && plan.price ? (plan.priceInINR / plan.price).toFixed(4) : 1,
      paymentMethod: 'manual',
      renewalDate: new Date(),
      status: historyStatus,
      action: actionType,
      notes: notes || '',
      createdBy: req.user._id,
      createdByName: req.user.name || '',
    });

    // Sync the pharmacy document with calculated values from ALL active records
    // This uses the same dynamic calculation approach as the new subscription controller
    const activeRecords = await SubscriptionHistory.find({
      pharmacy: pharmacy._id,
      status: { $in: ['active', 'upcoming'] },
    }).sort({ endDate: -1 });

    if (activeRecords.length > 0) {
      const furthestRecord = activeRecords[0];
      pharmacy.subscriptionPlan = furthestRecord.planName;
      pharmacy.subscriptionPlanId = furthestRecord.planId;
      pharmacy.subscriptionStartDate = furthestRecord.startDate;
      pharmacy.subscriptionEndDate = furthestRecord.endDate;
    } else {
      pharmacy.subscriptionPlan = 'free';
      pharmacy.subscriptionPlanId = null;
      pharmacy.subscriptionStartDate = null;
      pharmacy.subscriptionEndDate = null;
    }

    await pharmacy.save();

    // Log activity
    try {
      const ActivityLog = (await import('../models/ActivityLog.js')).default;
      await ActivityLog.create({
        pharmacyId: pharmacy._id,
        user: req.user._id,
        userName: req.user.name || '',
        userRole: req.user.role || '',
        action: 'subscription_change',
        resource: 'Subscription',
        description: `${actionType === 'extended' ? 'Extended' : 'Added'} ${plan.planName} subscription for ${pharmacy.pharmacyName} (${plan.duration} ${plan.durationUnit})`,
        details: {
          subscriptionAction: actionType,
          planName: plan.planName,
          duration: plan.duration,
          durationUnit: plan.durationUnit,
          startDate: newStartDate,
          endDate: newEndDate,
          status: historyStatus,
        },
      });
    } catch (logError) {
      console.error('Failed to log subscription activity:', logError.message);
    }

    return ApiResponse.success(
      res,
      {
        pharmacy,
        history: historyRecord,
      },
      isUpcoming
        ? `Subscription renewed successfully! New plan starts on ${newStartDate.toLocaleDateString()} after current subscription ends.`
        : 'Subscription renewed successfully!'
    );
  } catch (error) {
    next(error);
  }
};
