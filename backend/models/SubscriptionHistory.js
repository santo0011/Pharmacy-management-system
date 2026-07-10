import mongoose from 'mongoose';

const subscriptionHistorySchema = mongoose.Schema(
  {
    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
    },
    pharmacyName: {
      type: String,
      required: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      default: null,
    },
    planName: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    durationUnit: {
      type: String,
      enum: ['days', 'months', 'years'],
      default: 'months',
    },
    amount: {
      type: Number,
      default: 0,
    },
    // Original payment currency (e.g., USD, EUR)
    originalCurrency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR'],
    },
    // Original amount paid in the user's local currency
    originalAmount: {
      type: Number,
      default: function() {
        return this.amount;
      },
    },
    // Exchange rate used for conversion (1 INR = X foreign currency)
    exchangeRate: {
      type: Number,
      default: 1,
    },
    paymentMethod: {
      type: String,
      default: 'manual',
    },
    renewalDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'upcoming', 'expired'],
      default: 'active',
    },
    transactionId: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdByName: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
subscriptionHistorySchema.index({ pharmacy: 1, startDate: -1 });
subscriptionHistorySchema.index({ status: 1 });

const SubscriptionHistory = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);

export default SubscriptionHistory;