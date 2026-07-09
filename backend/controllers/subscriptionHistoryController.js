import SubscriptionHistory from '../models/SubscriptionHistory.js';
import Pharmacy from '../models/Pharmacy.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Get subscription history for a pharmacy
// @route   GET /api/subscription-history/:pharmacyId
// @access  Private/SuperAdmin
export const getSubscriptionHistory = async (req, res, next) => {
  try {
    const { pharmacyId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await SubscriptionHistory.countDocuments({ pharmacy: pharmacyId });
    const records = await SubscriptionHistory.find({ pharmacy: pharmacyId })
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, records, total, page, limit, 'Subscription history fetched');
  } catch (error) {
    next(error);
  }
};

// @desc    Get subscription history for current pharmacy (Admin self-service)
// @route   GET /api/subscription-history/my
// @access  Private/Admin
export const getMySubscriptionHistory = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    if (!pharmacyId) {
      return ApiResponse.error(res, 'Pharmacy not found for this user', 404);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const total = await SubscriptionHistory.countDocuments({ pharmacy: pharmacyId });
    const records = await SubscriptionHistory.find({ pharmacy: pharmacyId })
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, records, total, page, limit, 'Subscription history fetched');
  } catch (error) {
    next(error);
  }
};

// @desc    Get all subscription history (Super Admin overview)
// @route   GET /api/subscription-history
// @access  Private/SuperAdmin
export const getAllSubscriptionHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';

    let query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.pharmacyName = { $regex: search, $options: 'i' };
    }

    const total = await SubscriptionHistory.countDocuments(query);
    const records = await SubscriptionHistory.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, records, total, page, limit, 'Subscription history fetched');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a subscription history record (only upcoming)
// @route   DELETE /api/subscription-history/:id
// @access  Private/SuperAdmin
export const deleteSubscriptionHistory = async (req, res, next) => {
  try {
    const record = await SubscriptionHistory.findById(req.params.id);
    if (!record) {
      return ApiResponse.error(res, 'Subscription history record not found', 404);
    }

    // Only allow deleting "upcoming" records
    if (record.status !== 'upcoming') {
      return ApiResponse.error(res, 'Only upcoming subscription records can be deleted', 400);
    }

    const pharmacyId = record.pharmacy;

    // Delete the upcoming record
    await record.deleteOne();

    // Recalculate the pharmacy's subscription end date based on the most recent
    // non-upcoming subscription history record.
    // This ensures the remaining days are correct after cancelling a renewal.
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (pharmacy) {
      // Find the most recent record that is NOT upcoming (active or expired)
      const lastActiveRecord = await SubscriptionHistory.findOne({
        pharmacy: pharmacyId,
        status: { $ne: 'upcoming' },
        // Exclude the just-deleted record in case the query uses a stale snapshot
        _id: { $ne: record._id },
      }).sort({ endDate: -1 });

      if (lastActiveRecord) {
        // Roll back the pharmacy's subscription to the last non-upcoming record
        pharmacy.subscriptionPlan = lastActiveRecord.planName;
        pharmacy.subscriptionPlanId = lastActiveRecord.planId;
        pharmacy.subscriptionStartDate = lastActiveRecord.startDate;
        pharmacy.subscriptionEndDate = lastActiveRecord.endDate;
      } else {
        // No previous subscription records — check if endDate was set manually on pharmacy
        // and if so, keep it; otherwise reset to free
        if (!pharmacy.subscriptionEndDate) {
          pharmacy.subscriptionPlan = 'free';
          pharmacy.subscriptionPlanId = null;
          pharmacy.subscriptionStartDate = null;
        }
        // If there's no history at all, just leave the current endDate as-is
        // (it might have been set before history tracking was implemented)
      }

      await pharmacy.save();
    }

    return ApiResponse.success(res, null, 'Upcoming subscription cancelled successfully');
  } catch (error) {
    next(error);
  }
};
