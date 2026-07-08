import mongoose from 'mongoose';

const supplierSchema = mongoose.Schema(
  {
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      default: '',
    },
    gstNumber: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
    // Financial tracking fields
    totalPurchases: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
    },
    totalDue: {
      type: Number,
      default: 0,
    },
    lastPurchaseDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

supplierSchema.index({ pharmacyId: 1, supplierName: 1 });
supplierSchema.index({ pharmacyId: 1, email: 1 });
supplierSchema.index({ pharmacyId: 1, phone: 1 });

const Supplier = mongoose.model('Supplier', supplierSchema);

export default Supplier;