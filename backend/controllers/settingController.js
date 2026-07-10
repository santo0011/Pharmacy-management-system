import PlatformSetting from '../models/PlatformSetting.js';
import ApiResponse from '../utils/apiResponse.js';

/**
 * Default platform settings with labels, descriptions, and groups.
 * All monetary values are stored and calculated in INR (Base Currency).
 * 
 * Only functional, meaningful settings are included:
 * - General: Platform branding and support contact
 * - Localization: Timezone, date format, display currency
 * - Invoice: Prefix, GST toggle, GST rate
 */
const DEFAULT_SETTINGS = {
  // General
  platformName: {
    value: 'Pharmacy Management System',
    label: 'Platform Name',
    description: 'The name of your pharmacy management platform displayed in the header and emails.',
    group: 'general',
  },
  supportEmail: {
    value: 'support@pharmacy.com',
    label: 'Support Email',
    description: 'Primary support email address displayed to pharmacy owners for help requests.',
    group: 'general',
  },

  // Localization
  timezone: {
    value: 'Asia/Kolkata',
    label: 'Timezone',
    description: 'Default timezone for all date/time displays.',
    group: 'localization',
  },
  dateFormat: {
    value: 'DD/MM/YYYY',
    label: 'Date Format',
    description: 'Format for displaying dates throughout the platform (e.g., DD/MM/YYYY, MM/DD/YYYY).',
    group: 'localization',
  },
  currency: {
    value: 'INR',
    label: 'Display Currency',
    description: 'Base currency for all financial calculations and reports. All revenue, profit, and analytics use this currency.',
    group: 'localization',
  },

  // Invoice
  invoicePrefix: {
    value: 'INV-',
    label: 'Invoice Number Prefix',
    description: 'Prefix added to all invoice numbers (e.g., INV-0001, PHARM-0001).',
    group: 'invoice',
  },
  enableGst: {
    value: true,
    label: 'Enable GST Calculation',
    description: 'Toggle GST (Goods & Services Tax) calculation on invoices. Disable if your region does not require GST.',
    group: 'invoice',
  },
  gstRate: {
    value: 18,
    label: 'Default GST Rate (%)',
    description: 'Default GST percentage applied to invoice items when GST is enabled.',
    group: 'invoice',
  },
};

// @desc    Initialize default settings (called on first run)
// @route   POST /api/settings/init
// @access  Private/SuperAdmin
export const initializeDefaults = async (req, res, next) => {
  try {
    const existingCount = await PlatformSetting.countDocuments();
    if (existingCount > 0) {
      return ApiResponse.success(res, null, 'Settings already initialized');
    }

    const settingsToCreate = Object.entries(DEFAULT_SETTINGS).map(([key, config]) => ({
      key,
      value: config.value,
      label: config.label,
      description: config.description,
      group: config.group,
    }));

    await PlatformSetting.insertMany(settingsToCreate);
    return ApiResponse.success(res, null, 'Default settings initialized successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get all platform settings with metadata
// @route   GET /api/settings
// @access  Private/SuperAdmin
export const getSettings = async (req, res, next) => {
  try {
    const settings = await PlatformSetting.find().sort({ group: 1, key: 1 });

    // Build result with defaults as fallback
    const result = {};
    const defaults = {};
    Object.entries(DEFAULT_SETTINGS).forEach(([key, config]) => {
      defaults[key] = config.value;
    });

    settings.forEach((s) => {
      result[s.key] = s.value;
    });

    // Merge with defaults (settings in DB override defaults)
    const merged = { ...defaults, ...result };

    // Also return metadata for the settings page
    const metadata = {};
    settings.forEach((s) => {
      metadata[s.key] = {
        label: s.label || DEFAULT_SETTINGS[s.key]?.label || s.key,
        description: s.description || DEFAULT_SETTINGS[s.key]?.description || '',
        group: s.group || DEFAULT_SETTINGS[s.key]?.group || 'general',
      };
    });

    // Add metadata for any defaults not yet in DB
    Object.entries(DEFAULT_SETTINGS).forEach(([key, config]) => {
      if (!metadata[key]) {
        metadata[key] = {
          label: config.label,
          description: config.description,
          group: config.group,
        };
      }
    });

    return ApiResponse.success(res, {
      values: merged,
      metadata,
    }, 'Settings fetched successfully');
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

    // Allowed keys with validation rules - only functional settings
    const allowedKeys = {
      platformName: { type: 'string', required: true, minLength: 2, maxLength: 100 },
      supportEmail: { type: 'string', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      timezone: { type: 'string', required: true },
      dateFormat: { type: 'string', required: true, enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] },
      currency: { type: 'string', required: true, enum: ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'PKR', 'BDT', 'LKR', 'NPR', 'PHP', 'MYR', 'SGD', 'AUD', 'CAD'] },
      invoicePrefix: { type: 'string', required: false, maxLength: 20 },
      enableGst: { type: 'boolean', required: false },
      gstRate: { type: 'number', required: false, min: 0, max: 100 },
    };

    const errors = [];

    for (const [key, value] of Object.entries(updates)) {
      if (!allowedKeys[key]) {
        errors.push(`Unknown setting: ${key}`);
        continue;
      }

      const rule = allowedKeys[key];

      // Type validation
      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(`${key} must be a string`);
        continue;
      }
      if (rule.type === 'number' && typeof value !== 'number') {
        errors.push(`${key} must be a number`);
        continue;
      }
      if (rule.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${key} must be true or false`);
        continue;
      }

      // Required validation
      if (rule.required && !value && value !== false && value !== 0) {
        errors.push(`${key} is required`);
        continue;
      }

      // String validations
      if (rule.type === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${key} must be at least ${rule.minLength} characters`);
          continue;
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${key} must be at most ${rule.maxLength} characters`);
          continue;
        }
        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(`${key} must be one of: ${rule.enum.join(', ')}`);
          continue;
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${key} has an invalid format`);
          continue;
        }
      }

      // Number validations
      if (rule.type === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${key} must be at least ${rule.min}`);
          continue;
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${key} must be at most ${rule.max}`);
          continue;
        }
      }

      // Save to database
      const config = DEFAULT_SETTINGS[key] || {};
      await PlatformSetting.findOneAndUpdate(
        { key },
        {
          key,
          value,
          label: config.label || key,
          description: config.description || '',
          group: config.group || 'general',
        },
        { upsert: true, new: true }
      );
    }

    if (errors.length > 0) {
      return ApiResponse.error(res, `Validation errors: ${errors.join('; ')}`, 400);
    }

    // Fetch updated settings
    const settings = await PlatformSetting.find().sort({ group: 1, key: 1 });
    const result = {};
    const defaults = {};
    Object.entries(DEFAULT_SETTINGS).forEach(([key, config]) => {
      defaults[key] = config.value;
    });
    settings.forEach((s) => {
      result[s.key] = s.value;
    });
    const merged = { ...defaults, ...result };

    return ApiResponse.success(res, {
      values: merged,
      metadata: settings.reduce((acc, s) => {
        acc[s.key] = {
          label: s.label || DEFAULT_SETTINGS[s.key]?.label || s.key,
          description: s.description || DEFAULT_SETTINGS[s.key]?.description || '',
          group: s.group || DEFAULT_SETTINGS[s.key]?.group || 'general',
        };
        return acc;
      }, {}),
    }, 'Settings updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single setting by key
// @route   GET /api/settings/:key
// @access  Private
export const getSettingByKey = async (req, res, next) => {
  try {
    const { key } = req.params;
    const setting = await PlatformSetting.findOne({ key });

    if (!setting) {
      // Return default if exists
      if (DEFAULT_SETTINGS[key]) {
        return ApiResponse.success(res, {
          key,
          value: DEFAULT_SETTINGS[key].value,
          label: DEFAULT_SETTINGS[key].label,
          description: DEFAULT_SETTINGS[key].description,
          group: DEFAULT_SETTINGS[key].group,
        }, 'Default setting value returned');
      }
      return ApiResponse.error(res, 'Setting not found', 404);
    }

    return ApiResponse.success(res, setting, 'Setting fetched successfully');
  } catch (error) {
    next(error);
  }
};