import PlatformSetting from '../models/PlatformSetting.js';
import ApiResponse from '../utils/apiResponse.js';

const DEFAULT_SETTINGS = {
  platformName: 'Pharmacy Management System',
  supportEmail: 'support@pharmacy.com',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD/MM/YYYY',
};

// @desc    Get all platform settings
// @route   GET /api/settings
// @access  Private/SuperAdmin
export const getSettings = async (req, res, next) => {
  try {
    const settings = await PlatformSetting.find();
    const result = { ...DEFAULT_SETTINGS };

    settings.forEach((s) => {
      result[s.key] = s.value;
    });

    return ApiResponse.success(res, result, 'Settings fetched successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Update platform settings
// @route   PUT /api/settings
// @access  Private/SuperAdmin
export const updateSettings = async (req, res, next) => {
  try {
    const updates = req.body;

    const allowedKeys = ['platformName', 'supportEmail', 'currency', 'timezone', 'dateFormat'];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedKeys.includes(key)) {
        await PlatformSetting.findOneAndUpdate(
          { key },
          { key, value },
          { upsert: true, new: true }
        );
      }
    }

    // Fetch updated settings
    const settings = await PlatformSetting.find();
    const result = { ...DEFAULT_SETTINGS };
    settings.forEach((s) => {
      result[s.key] = s.value;
    });

    return ApiResponse.success(res, result, 'Settings updated successfully');
  } catch (error) {
    next(error);
  }
};