import SubscriptionPlan from '../models/SubscriptionPlan.js';
import Pharmacy from '../models/Pharmacy.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Create a subscription plan
// @route   POST /api/subscription-plans
// @access  Private/SuperAdmin
export const createPlan = async (req, res, next) => {
  try {
    const { planName, price, duration, durationUnit, description, features, maxStaff, maxBranches, priceCurrency, priceInINR } = req.body;

    const existing = await SubscriptionPlan.findOne({ planName: { $regex: `^${planName}$`, $options: 'i' }, isDeleted: false });
    if (existing) {
      return ApiResponse.error(res, 'A plan with this name already exists', 400);
    }

    const plan = await SubscriptionPlan.create({
      planName,
      price,
      duration,
      durationUnit: durationUnit || 'months',
      description: description || '',
      features: features || [],
      maxStaff: maxStaff || null,
      maxBranches: maxBranches || null,
      priceCurrency: priceCurrency || 'INR',
      priceInINR: priceInINR || price,
      createdBy: req.user._id,
    });

    return ApiResponse.success(res, plan, 'Subscription plan created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all subscription plans (paginated, with search)
// @route   GET /api/subscription-plans
// @access  Private/SuperAdmin
export const getPlans = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const activeOnly = req.query.activeOnly === 'true';

    let query = { isDeleted: false };
    if (activeOnly) {
      query.isActive = true;
    }
    if (search) {
      query.$or = [
        { planName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await SubscriptionPlan.countDocuments(query);
    const plans = await SubscriptionPlan.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, plans, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all active plans (for dropdowns - no pagination)
// @route   GET /api/subscription-plans/active
// @access  Private/SuperAdmin
export const getActivePlans = async (req, res, next) => {
  try {
    const plans = await SubscriptionPlan.find({ isDeleted: false, isActive: true })
      .select('planName price duration durationUnit description')
      .sort({ price: 1 });

    return ApiResponse.success(res, plans, 'Active plans retrieved successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get single subscription plan
// @route   GET /api/subscription-plans/:id
// @access  Private/SuperAdmin
export const getPlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findOne({ _id: req.params.id, isDeleted: false });
    if (!plan) {
      return ApiResponse.error(res, 'Subscription plan not found', 404);
    }
    return ApiResponse.success(res, plan);
  } catch (error) {
    next(error);
  }
};

// @desc    Update subscription plan
// @route   PUT /api/subscription-plans/:id
// @access  Private/SuperAdmin
export const updatePlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findOne({ _id: req.params.id, isDeleted: false });
    if (!plan) {
      return ApiResponse.error(res, 'Subscription plan not found', 404);
    }

    const { planName, price, duration, durationUnit, description, features, maxStaff, maxBranches, priceCurrency, priceInINR } = req.body;

    if (planName && planName.toLowerCase() !== plan.planName.toLowerCase()) {
      const existing = await SubscriptionPlan.findOne({
        planName: { $regex: `^${planName}$`, $options: 'i' },
        _id: { $ne: plan._id },
        isDeleted: false,
      });
      if (existing) {
        return ApiResponse.error(res, 'A plan with this name already exists', 400);
      }
      plan.planName = planName;
    }

    if (price !== undefined) plan.price = price;
    if (duration !== undefined) plan.duration = duration;
    if (durationUnit !== undefined) plan.durationUnit = durationUnit;
    if (description !== undefined) plan.description = description;
    if (features !== undefined) plan.features = features;
    if (maxStaff !== undefined) plan.maxStaff = maxStaff;
    if (maxBranches !== undefined) plan.maxBranches = maxBranches;
    if (priceCurrency !== undefined) plan.priceCurrency = priceCurrency;
    if (priceInINR !== undefined) plan.priceInINR = priceInINR;

    const updatedPlan = await plan.save();
    return ApiResponse.success(res, updatedPlan, 'Subscription plan updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle plan active/inactive status
// @route   PATCH /api/subscription-plans/:id/status
// @access  Private/SuperAdmin
export const togglePlanStatus = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findOne({ _id: req.params.id, isDeleted: false });
    if (!plan) {
      return ApiResponse.error(res, 'Subscription plan not found', 404);
    }

    plan.isActive = !plan.isActive;
    await plan.save();

    const status = plan.isActive ? 'activated' : 'deactivated';
    return ApiResponse.success(res, plan, `Plan ${status} successfully`);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete subscription plan (only if never used)
// @route   DELETE /api/subscription-plans/:id
// @access  Private/SuperAdmin
export const deletePlan = async (req, res, next) => {
  try {
    const plan = await SubscriptionPlan.findOne({ _id: req.params.id, isDeleted: false });
    if (!plan) {
      return ApiResponse.error(res, 'Subscription plan not found', 404);
    }

    // Check if any pharmacies (current or historical) reference this plan
    const assignedCount = await Pharmacy.countDocuments({
      $or: [
        { subscriptionPlanId: plan._id },
        { subscriptionPlan: { $regex: `^${plan.planName}$`, $options: 'i' } },
      ],
    });

    if (assignedCount > 0) {
      return ApiResponse.error(
        res,
        'This subscription plan is already in use and cannot be deleted.',
        400
      );
    }

    // Permanently delete since no pharmacy has ever used it
    await SubscriptionPlan.deleteOne({ _id: plan._id });

    return ApiResponse.success(res, null, 'Subscription plan deleted successfully');
  } catch (error) {
    next(error);
  }
};
