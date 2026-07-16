import mongoose from 'mongoose';

/**
 * Platform Setting Schema
 * Stores key-value configuration pairs for the platform.
 * All monetary values are stored and calculated in INR (Base Currency).
 * 
 * Available Setting Keys:
 * - platformName: The display name of the platform
 * - supportEmail: Support contact email
 * - timezone: Platform timezone (default: Asia/Kolkata)
 * - dateFormat: Date display format (default: DD/MM/YYYY)
 * - currency: Display currency for non-INR users (INR is base for all calculations)
 * - invoicePrefix: Prefix for invoice numbers
 * - enableGst: Toggle GST calculation in invoices
 * - gstRate: Default GST rate percentage
 */
const platformSettingSchema = mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    label: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    group: {
      type: String,
      enum: ['general', 'localization', 'invoice'],
      default: 'general',
    },
  },
  {
    timestamps: true,
  }
);

const PlatformSetting = mongoose.model('PlatformSetting', platformSettingSchema);

export default PlatformSetting;