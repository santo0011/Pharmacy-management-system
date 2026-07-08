import mongoose from 'mongoose';

const purchasePaymentSchema = mongoose.Schema({
  purchase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true,
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
  },
  supplierName: { type: String, default: '' },
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pharmacy',
    required: true,
  },
  amount: { type: Number, required: true, min: 0 },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'credit', 'other'],
    default: 'cash',
  },
  paymentDate: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

purchasePaymentSchema.index({ purchase: 1, pharmacyId: 1 });
purchasePaymentSchema.index({ supplier: 1, pharmacyId: 1 });
purchasePaymentSchema.index({ pharmacyId: 1, paymentDate: -1 });

const PurchasePayment = mongoose.model('PurchasePayment', purchasePaymentSchema);
export default PurchasePayment;