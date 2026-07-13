import Pharmacy from '../models/Pharmacy.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import SubscriptionHistory from '../models/SubscriptionHistory.js';
import ActivityLog from '../models/ActivityLog.js';
import ApiResponse from '../utils/apiResponse.js';

/**
 * Calculate the effective subscription end date for a pharmacy
 * based on ALL active (non-cancelled, non-expired) history records.
 * 
 * Logic:
 * - Find all records with status 'active' or 'upcoming'
 * - The effective end date is the MAXIMUM endDate among those records
 * - This ensures that cancelling any single record correctly rolls back
 *   the end date to the next furthest record
 */
async function calculateEffectiveEndDate(pharmacyId) {
  const activeRecords = await SubscriptionHistory.find({
    pharmacy: pharmacyId,
    status: { $in: ['active', 'upcoming'] },
  }).sort({ endDate: -1 });

  if (activeRecords.length === 0) {
    return null; // No active subscription
  }

  // The effective end date is the furthest end date among active records
  const furthestEndDate = activeRecords[0].endDate;
  return furthestEndDate;
}

/**
 * Calculate remaining days from active subscription records.
 * Uses inclusive day counting: today through endDate counts as (remaining + 1) days.
 * 
 * Example: 
 *   Sub ends Jan 14, today is Jan 1 → 14 days (Jan 1-14 inclusive)
 *   Sub ends Jan 7, today is Jan 1 → 7 days (Jan 1-7 inclusive)
 *   Sub ends today → 1 day (today is the last day)
 *   Sub ended yesterday → 0 days
 */
async function calculateRemainingDays(pharmacyId) {
  const effectiveEndDate = await calculateEffectiveEndDate(pharmacyId);
  if (!effectiveEndDate) return 0;

  const now = new Date();
  // Normalize both dates to start of day (midnight) for accurate day calculation
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endStart = new Date(
    effectiveEndDate.getFullYear(),
    effectiveEndDate.getMonth(),
    effectiveEndDate.getDate()
  );
  const diffTime = endStart - nowStart;
  // Add 1 to convert from "difference between dates" to "inclusive count of days"
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * Get the best plan info from active records
 */
async function getActivePlanInfo(pharmacyId) {
  const activeRecord = await SubscriptionHistory.findOne({
    pharmacy: pharmacyId,
    status: { $in: ['active', 'upcoming'] },
  }).sort({ endDate: -1 });

  if (!activeRecord) {
    return { plan: 'free', planId: null, startDate: null, endDate: null };
  }

  return {
    plan: activeRecord.planName,
    planId: activeRecord.planId,
    startDate: activeRecord.startDate,
    endDate: activeRecord.endDate,
  };
}

/**
 * Sync the pharmacy document's subscription fields with the calculated values
 * from history records. This keeps the Pharmacy collection in sync for
 * quick lookups while maintaining history as the source of truth.
 */
async function syncPharmacySubscription(pharmacyId) {
  const pharmacy = await Pharmacy.findById(pharmacyId);
  if (!pharmacy) return;

  const planInfo = await getActivePlanInfo(pharmacyId);
  const effectiveEndDate = await calculateEffectiveEndDate(pharmacyId);

  pharmacy.subscriptionPlan = planInfo.plan;
  pharmacy.subscriptionPlanId = planInfo.planId;
  pharmacy.subscriptionStartDate = planInfo.startDate;
  pharmacy.subscriptionEndDate = effectiveEndDate;

  await pharmacy.save();
  return pharmacy;
}

/**
 * Calculate end date from a start date and plan.
 * The end date is INCLUSIVE - the subscription is active through this date.
 * 
 * Example: 7-day plan starting Jan 1 -> ends Jan 7 (7 days total: 1,2,3,4,5,6,7)
 * Without the -1 day adjustment: Jan 1 + 7 = Jan 8 (8 days total, which is wrong)
 */
function calculateEndDateFromPlan(startDate, plan) {
  const start = new Date(startDate);
  // Normalize to start of day to avoid timezone issues
  const normalizedStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const end = new Date(normalizedStart);
  
  if (plan.durationUnit === 'days') {
    end.setDate(end.getDate() + plan.duration);
  } else if (plan.durationUnit === 'months') {
    end.setMonth(end.getMonth() + plan.duration);
  } else if (plan.durationUnit === 'years') {
    end.setFullYear(end.getFullYear() + plan.duration);
  }
  // Subtract 1 day for inclusive end date
  end.setDate(end.getDate() - 1);
  return end;
}

/**
 * Log subscription activity
 */
async function logSubscriptionActivity({
  pharmacyId,
  userId,
  userName,
  userRole,
  action,
  description,
  details = {},
}) {
  try {
    await ActivityLog.create({
      pharmacyId,
      user: userId,
      userName: userName || '',
      userRole: userRole || '',
      action: 'subscription_change',
      resource: 'Subscription',
      description,
      details: {
        subscriptionAction: action,
        ...details,
      },
    });
  } catch (error) {
    console.error('Failed to log subscription activity:', error.message);
  }
}

// @desc    Add a new subscription to a pharmacy
// @route   POST /api/subscriptions
// @access  Private/SuperAdmin
export const addSubscription = async (req, res, next) => {
  try {
    const { pharmacyId, planId, startDate, endDate, notes } = req.body;

    if (!pharmacyId || !planId) {
      return ApiResponse.error(res, 'Pharmacy ID and Plan ID are required', 400);
    }

    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }

    const plan = await SubscriptionPlan.findOne({ _id: planId, isDeleted: false, isActive: true });
    if (!plan) {
      return ApiResponse.error(res, 'Invalid or inactive subscription plan', 400);
    }

    // Calculate current remaining days BEFORE adding
    const currentRemainingDays = await calculateRemainingDays(pharmacyId);
    const currentEndDate = await calculateEffectiveEndDate(pharmacyId);

    // Determine the actual start date for the new subscription
    const now = new Date();
    let newStartDate;

    if (startDate) {
      newStartDate = new Date(startDate);
    } else if (currentEndDate && new Date(currentEndDate) > now) {
      // Current subscription is still active — new subscription starts the day after
      // the current one ends to avoid overlapping days
      newStartDate = new Date(currentEndDate);
      newStartDate.setDate(newStartDate.getDate() + 1);
    } else {
      // Current subscription is expired or doesn't exist — start today
      newStartDate = new Date();
    }

    // ALWAYS calculate end date from the plan's duration and the backend's start date.
    // This is the SINGLE SOURCE OF TRUTH for end date calculation.
    // We NEVER accept the frontend's endDate to prevent incorrect cumulative calculations.
    const newEndDate = calculateEndDateFromPlan(newStartDate, plan);

    // Determine status for the new history record
    const isUpcoming = currentEndDate && new Date(currentEndDate) > now && newStartDate > now;
    const historyStatus = isUpcoming ? 'upcoming' : 'active';

    // Determine action type
    const hasActiveSubscription = currentEndDate && new Date(currentEndDate) > now;
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
    await syncPharmacySubscription(pharmacyId);

    // Calculate final remaining days after adding
    const finalRemainingDays = await calculateRemainingDays(pharmacyId);

    // Log activity
    await logSubscriptionActivity({
      pharmacyId: pharmacy._id,
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: actionType,
      description: `${actionType === 'extended' ? 'Extended' : 'Added'} ${plan.planName} subscription for ${pharmacy.pharmacyName} (${plan.duration} ${plan.durationUnit})`,
      details: {
        planName: plan.planName,
        duration: plan.duration,
        durationUnit: plan.durationUnit,
        startDate: newStartDate,
        endDate: newEndDate,
        previousRemainingDays: currentRemainingDays,
        finalRemainingDays,
        status: historyStatus,
      },
    });

    return ApiResponse.success(
      res,
      {
        pharmacy: await Pharmacy.findById(pharmacyId),
        history: historyRecord,
        remainingDays: finalRemainingDays,
        previousRemainingDays: currentRemainingDays,
      },
      isUpcoming
        ? `Subscription renewed successfully! New plan starts on ${newStartDate.toLocaleDateString()} after current subscription ends.`
        : 'Subscription added successfully!',
      201
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel a subscription record
// @route   POST /api/subscriptions/:id/cancel
// @access  Private/SuperAdmin
export const cancelSubscription = async (req, res, next) => {
  try {
    const { cancellationReason } = req.body;
    const record = await SubscriptionHistory.findById(req.params.id);

    if (!record) {
      return ApiResponse.error(res, 'Subscription record not found', 404);
    }

    if (record.status === 'cancelled') {
      return ApiResponse.error(res, 'This subscription is already cancelled', 400);
    }

    if (record.status === 'expired') {
      return ApiResponse.error(res, 'Cannot cancel an already expired subscription', 400);
    }

    const pharmacyId = record.pharmacy;

    // Get remaining days BEFORE cancellation for logging
    const beforeRemainingDays = await calculateRemainingDays(pharmacyId);

    // Mark the record as cancelled
    record.status = 'cancelled';
    record.action = 'cancelled';
    record.cancelledDate = new Date();
    record.cancelledBy = req.user._id;
    record.cancelledByName = req.user.name || '';
    record.cancellationReason = cancellationReason || 'Cancelled by administrator';
    await record.save();

    // Recalculate pharmacy subscription from remaining active records
    await syncPharmacySubscription(pharmacyId);

    // Calculate remaining days AFTER cancellation
    const afterRemainingDays = await calculateRemainingDays(pharmacyId);

    // Log activity
    await logSubscriptionActivity({
      pharmacyId,
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'cancelled',
      description: `Cancelled ${record.planName} subscription for ${record.pharmacyName}`,
      details: {
        planName: record.planName,
        cancelledDate: record.cancelledDate,
        cancellationReason: record.cancellationReason,
        beforeRemainingDays,
        afterRemainingDays,
        recordId: record._id,
      },
    });

    return ApiResponse.success(
      res,
      {
        cancelledRecord: record,
        remainingDays: afterRemainingDays,
        beforeRemainingDays,
      },
      `Subscription cancelled successfully. Remaining days: ${afterRemainingDays}`
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Get subscription preview (for confirmation alert)
// @route   POST /api/subscriptions/preview
// @access  Private/SuperAdmin
export const previewSubscription = async (req, res, next) => {
  try {
    const { pharmacyId, planId, startDate, endDate } = req.body;

    if (!pharmacyId || !planId) {
      return ApiResponse.error(res, 'Pharmacy ID and Plan ID are required', 400);
    }

    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }

    const plan = await SubscriptionPlan.findOne({ _id: planId, isDeleted: false, isActive: true });
    if (!plan) {
      return ApiResponse.error(res, 'Invalid or inactive subscription plan', 400);
    }

    // Current remaining days
    const currentRemainingDays = await calculateRemainingDays(pharmacyId);
    const currentEndDate = await calculateEffectiveEndDate(pharmacyId);

    // Calculate new end date (same logic as addSubscription)
    const now = new Date();
    let newStartDate;

    if (startDate) {
      newStartDate = new Date(startDate);
    } else if (currentEndDate && new Date(currentEndDate) > now) {
      newStartDate = new Date(currentEndDate);
      newStartDate.setDate(newStartDate.getDate() + 1);
    } else {
      newStartDate = new Date();
    }

    // ALWAYS calculate from plan - same as addSubscription
    const newEndDate = calculateEndDateFromPlan(newStartDate, plan);

    // Simulate what the effective end date would be after adding this record
    // The effective end date is the MAX of current end date and new end date
    // This EXACTLY matches the logic in calculateEffectiveEndDate
    let simulatedEffectiveEndDate;
    if (currentEndDate && new Date(currentEndDate) > new Date(newEndDate)) {
      simulatedEffectiveEndDate = new Date(currentEndDate);
    } else {
      simulatedEffectiveEndDate = new Date(newEndDate);
    }

    // Calculate remaining days using the same logic as calculateRemainingDays
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endStart = new Date(
      simulatedEffectiveEndDate.getFullYear(),
      simulatedEffectiveEndDate.getMonth(),
      simulatedEffectiveEndDate.getDate()
    );
    const diffTime = endStart - nowStart;
    const finalRemainingDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);

    return ApiResponse.success(res, {
      pharmacyName: pharmacy.pharmacyName,
      currentPlan: pharmacy.subscriptionPlan,
      newPlan: plan.planName,
      currentRemainingDays,
      newDuration: plan.duration,
      newDurationUnit: plan.durationUnit,
      newStartDate,
      newEndDate,
      finalRemainingDays,
      amount: plan.price,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get subscription status for a pharmacy (dynamic calculation)
// @route   GET /api/subscriptions/status/:pharmacyId
// @access  Private/SuperAdmin
export const getSubscriptionStatus = async (req, res, next) => {
  try {
    const { pharmacyId } = req.params;
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return ApiResponse.error(res, 'Pharmacy not found', 404);
    }

    const effectiveEndDate = await calculateEffectiveEndDate(pharmacyId);
    const remainingDays = await calculateRemainingDays(pharmacyId);
    const planInfo = await getActivePlanInfo(pharmacyId);

    const now = new Date();
    let status = 'active';
    if (!effectiveEndDate) {
      status = 'no_subscription';
    } else if (remainingDays <= 0) {
      status = 'expired';
    } else if (remainingDays <= 3) {
      status = 'expiring_soon';
    }

    return ApiResponse.success(res, {
      status,
      daysRemaining: remainingDays,
      startDate: planInfo.startDate,
      endDate: effectiveEndDate,
      plan: planInfo.plan,
      hasSubscription: !!planInfo.planId,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my subscription status (for admin users)
// @route   GET /api/subscriptions/my-status
// @access  Private/Admin
export const getMySubscriptionStatus = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    if (!pharmacyId) {
      return ApiResponse.error(res, 'Pharmacy not found for this user', 404);
    }

    const effectiveEndDate = await calculateEffectiveEndDate(pharmacyId);
    const remainingDays = await calculateRemainingDays(pharmacyId);
    const planInfo = await getActivePlanInfo(pharmacyId);

    const now = new Date();
    let status = 'active';
    if (!effectiveEndDate) {
      status = 'no_subscription';
    } else if (remainingDays <= 0) {
      status = 'expired';
    } else if (remainingDays <= 3) {
      status = 'expiring_soon';
    }

    return ApiResponse.success(res, {
      status,
      daysRemaining: remainingDays,
      startDate: planInfo.startDate,
      endDate: effectiveEndDate,
      plan: planInfo.plan,
      hasSubscription: !!planInfo.planId,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all subscriptions overview (Super Admin)
// @route   GET /api/subscriptions
// @access  Private/SuperAdmin
export const getAllSubscriptions = async (req, res, next) => {
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

    // Enrich with dynamically calculated subscription data
    const enrichedPharmacies = await Promise.all(
      pharmacies.map(async (p) => {
        const remainingDays = await calculateRemainingDays(p._id);
        const effectiveEndDate = await calculateEffectiveEndDate(p._id);
        return {
          ...p.toObject(),
          _remainingDays: remainingDays,
          _effectiveEndDate: effectiveEndDate,
        };
      })
    );

    return ApiResponse.paginated(res, enrichedPharmacies, total, page, limit, 'Subscriptions fetched');
  } catch (error) {
    next(error);
  }
};

// @desc    Reactivate a cancelled subscription
// @route   POST /api/subscriptions/:id/reactivate
// @access  Private/SuperAdmin
export const reactivateSubscription = async (req, res, next) => {
  try {
    const record = await SubscriptionHistory.findById(req.params.id);
    if (!record) {
      return ApiResponse.error(res, 'Subscription record not found', 404);
    }

    if (record.status !== 'cancelled') {
      return ApiResponse.error(res, 'Only cancelled subscriptions can be reactivated', 400);
    }

    const pharmacyId = record.pharmacy;

    // Reactivate the record - ONLY change the status back to active
    // The endDate remains the ORIGINAL end date from when it was first created
    // This ensures reactivation restores ONLY the original duration, never duplicates it
    record.status = 'active';
    record.action = 'reactivated';
    record.cancelledDate = null;
    record.cancelledBy = null;
    record.cancelledByName = '';
    record.cancellationReason = '';
    await record.save();

    // Recalculate pharmacy subscription from ALL active records
    // This picks the MAX endDate among all active records
    await syncPharmacySubscription(pharmacyId);

    const remainingDays = await calculateRemainingDays(pharmacyId);

    // Log activity
    await logSubscriptionActivity({
      pharmacyId,
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'reactivated',
      description: `Reactivated ${record.planName} subscription for ${record.pharmacyName}`,
      details: {
        planName: record.planName,
        recordId: record._id,
        remainingDays,
      },
    });

    return ApiResponse.success(
      res,
      { record, remainingDays },
      'Subscription reactivated successfully'
    );
  } catch (error) {
    next(error);
  }
};