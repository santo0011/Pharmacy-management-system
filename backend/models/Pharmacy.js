import mongoose from 'mongoose';

const pharmacySchema = mongoose.Schema(
  {
    // --- Business Information ---
    pharmacyName: {
      type: String,
      required: [true, 'Pharmacy name is required'],
      trim: true,
    },
    logo: {
      type: String,
      default: '',
    },
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
    },
    contactPerson: {
      type: String,
      default: '',
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    state: {
      type: String,
      default: '',
      trim: true,
    },
    country: {
      type: String,
      default: 'IN',
      trim: true,
    },
    postalCode: {
      type: String,
      default: '',
      trim: true,
    },

    // --- Business Settings ---
    currency: {
      type: String,
      default: 'INR',
    },
    currencySymbol: {
      type: String,
      default: '₹',
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    dateFormat: {
      type: String,
      default: 'DD/MM/YYYY',
    },
    language: {
      type: String,
      default: 'en',
    },
    financialYearStart: {
      type: String,
      default: 'April',
    },

    // --- License & Compliance ---
    licenseNumber: {
      type: String,
      default: '',
      trim: true,
    },
    gstNumber: {
      type: String,
      default: '',
      trim: true,
    },
    registrationNumber: {
      type: String,
      default: '',
      trim: true,
    },
    licenseExpiryDate: {
      type: Date,
      default: null,
    },
    registrationCertificate: {
      type: String,
      default: '',
    },

    // --- Subscription ---
    subscriptionPlan: {
      type: String,
      default: 'free',
    },
    subscriptionPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      default: null,
    },
    subscriptionStartDate: {
      type: Date,
      default: Date.now,
    },
    subscriptionEndDate: {
      type: Date,
    },

    // --- Store Information ---
    storeOpenTime: {
      type: String,
      default: '09:00',
    },
    storeCloseTime: {
      type: String,
      default: '21:00',
    },
    weeklyOffDay: {
      type: String,
      default: 'Sunday',
    },
    emergencyContact: {
      type: String,
      default: '',
    },

    // --- Invoice & Branding ---
    invoiceSettings: {
      invoiceTemplate: { type: String, enum: ['classic', 'modern', 'minimal'], default: 'classic' },
      printFormat: { type: String, enum: ['a4', '58mm', '80mm'], default: 'a4' },
    },
    invoiceHeaderName: {
      type: String,
      default: '',
    },
    invoiceFooterText: {
      type: String,
      default: '',
    },
    invoiceLogo: {
      type: String,
      default: '',
    },
    invoiceAddress: {
      type: String,
      default: '',
    },
    invoiceContactInfo: {
      type: String,
      default: '',
    },

    // --- Backup & Security ---
    lastBackupDate: {
      type: Date,
      default: null,
    },

    // --- System ---
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isStockUpdated: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

pharmacySchema.methods.toJSON = function () {
  const obj = this.toObject();
  return obj;
};

const Pharmacy = mongoose.model('Pharmacy', pharmacySchema);

export default Pharmacy;