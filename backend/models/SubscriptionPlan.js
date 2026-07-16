import mongoose from 'mongoose';

const subscriptionPlanSchema = mongoose.Schema(
  {
    planName: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
      unique: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    priceCurrency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR'],
    },
    priceInINR: {
      type: Number,
      default: function() {
        return this.price; // Default: price is already in INR
      },
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [1, 'Duration must be at least 1'],
    },
    durationUnit: {
      type: String,
      enum: ['days', 'months', 'years'],
      default: 'months',
    },
    description: {
      type: String,
      default: '',
    },
    features: {
      type: [String],
      default: [],
    },
    maxStaff: {
      type: Number,
      default: null,
    },
    maxBranches: {
      type: Number,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

subscriptionPlanSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.isDeleted;
  return obj;
};

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

export default SubscriptionPlan;