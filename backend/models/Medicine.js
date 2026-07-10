import mongoose from 'mongoose';

const medicineSchema = mongoose.Schema(
  {
    medicineName: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true,
    },
    genericName: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      required: [true, 'Brand is required'],
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier is required'],
    },
    hsnCode: {
      type: String,
      default: '',
      trim: true,
    },
    batchNumber: {
      type: String,
      required: true,
      trim: true,
    },
    barcode: {
      type: String,
      default: null,
      trim: true,
    },
    manufacturingDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0.01, 'Purchase price must be greater than 0'],
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0.01, 'Selling price must be greater than 0'],
    },
    gst: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    currentStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    minStockAlert: {
      type: Number,
      default: 10,
      min: 0,
    },
    unit: {
      type: String,
      enum: ['Tablet', 'Capsule', 'Bottle', 'Syrup', 'Injection', 'Tube', 'Strip', 'Other'],
      default: 'Tablet',
    },
    rackNumber: {
      type: String,
      default: '',
      trim: true,
    },
    substituteMedicines: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
    }],
    description: {
      type: String,
      default: '',
    },
    medicineImage: {
      type: String,
      default: '',
    },
    status: {
      type: Boolean,
      default: true,
    },
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique indexes for pharmacy-level uniqueness
medicineSchema.index({ batchNumber: 1, pharmacyId: 1 }, { unique: true });
// Partial unique index: only enforce uniqueness when barcode is a non-empty string
medicineSchema.index(
  { barcode: 1, pharmacyId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      barcode: { $gt: '' },
    },
  }
);
medicineSchema.index({ medicineName: 'text', genericName: 'text', batchNumber: 'text', barcode: 'text' });

medicineSchema.statics.isLowStock = function (stock, minAlert) {
  return stock <= minAlert;
};

medicineSchema.statics.isExpired = function (expiryDate) {
  return new Date(expiryDate) < new Date();
};

medicineSchema.statics.isExpiringSoon = function (expiryDate, days = 30) {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= days;
};

medicineSchema.methods.toJSON = function () {
  const obj = this.toObject();
  return obj;
};

const Medicine = mongoose.model('Medicine', medicineSchema);

export default Medicine;