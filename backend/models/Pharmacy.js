import mongoose from 'mongoose';

const pharmacySchema = mongoose.Schema(
  {
    pharmacyName: {
      type: String,
      required: [true, 'Pharmacy name is required'],
      trim: true,
    },
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone is required'],
      trim: true,
    },
    address: {
      type: String,
      default: '',
    },
    logo: {
      type: String,
      default: '',
    },
    licenseNumber: {
      type: String,
      default: '',
      trim: true,
    },
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