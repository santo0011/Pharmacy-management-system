import mongoose from 'mongoose';
import crypto from 'crypto';

const customerSchema = mongoose.Schema({
  customerId: {
    type: String,
    unique: true,
    default: () => `CUST-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    default: '',
    trim: true,
  },
  address: {
    type: String,
    default: '',
  },
  state: {
    type: String,
    default: '',
    trim: true,
  },
  stateCode: {
    type: String,
    default: '',
    trim: true,
    minlength: 2,
    maxlength: 2,
  },
  gstin: {
    type: String,
    default: '',
    trim: true,
    uppercase: true,
  },
  customerType: {
    type: String,
    enum: ['retail', 'business'],
    default: 'retail',
  },
  gstinVerified: {
    type: Boolean,
    default: false,
  },
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pharmacy',
    required: true,
  },
  totalPurchases: {
    type: Number,
    default: 0,
  },
  totalSpent: {
    type: Number,
    default: 0,
  },
  lastPurchaseDate: {
    type: Date,
    default: null,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

customerSchema.index({ pharmacyId: 1, phone: 1 });
customerSchema.index({ pharmacyId: 1, name: 1 });
customerSchema.index({ pharmacyId: 1, customerId: 1 }, { unique: true });

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;