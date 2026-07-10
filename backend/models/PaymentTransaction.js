import mongoose from 'mongoose';

const paymentTransactionSchema = mongoose.Schema({
  sale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null,
  },
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pharmacy',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
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
  previousDue: {
    type: Number,
    default: 0,
  },
  remainingDue: {
    type: Number,
    default: 0,
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'credit', 'other'],
    default: 'cash',
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
    default: '',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

paymentTransactionSchema.index({ sale: 1, pharmacyId: 1 });
paymentTransactionSchema.index({ customer: 1, pharmacyId: 1 });
paymentTransactionSchema.index({ pharmacyId: 1, paymentDate: -1 });

const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);
export default PaymentTransaction;