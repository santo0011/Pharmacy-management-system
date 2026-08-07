import mongoose from 'mongoose';

const returnItemSchema = mongoose.Schema({
  medicine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true,
  },
  medicineName: { type: String, required: true },
  batchNumber: { type: String, default: '' },
  hsnCode: { type: String, default: '' },
  returnedQuantity: { type: Number, required: true, min: 1 },
  purchasePrice: { type: Number, required: true, min: 0 },
  taxableAmount: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  cgstAmount: { type: Number, default: 0 },
  sgstAmount: { type: Number, default: 0 },
  igstAmount: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  returnAmount: { type: Number, required: true, min: 0 },
});

const purchaseReturnSchema = mongoose.Schema({
  returnNumber: {
    type: String,
    required: true,
    trim: true,
  },
  purchase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Purchase',
    required: true,
  },
  purchaseInvoiceNumber: { type: String, required: true },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true,
  },
  supplierName: { type: String, default: '' },
  returnDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  items: [returnItemSchema],
  subtotal: { type: Number, required: true, default: 0 },
  taxableAmount: { type: Number, default: 0 },
  cgstAmount: { type: Number, default: 0 },
  sgstAmount: { type: Number, default: 0 },
  igstAmount: { type: Number, default: 0 },
  totalGst: { type: Number, default: 0 },
  totalReturnAmount: { type: Number, required: true, default: 0 },
  reason: { type: String, default: '' },
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
}, { timestamps: true });

purchaseReturnSchema.index({ purchase: 1, pharmacyId: 1 });
purchaseReturnSchema.index({ pharmacyId: 1, returnDate: -1 });
purchaseReturnSchema.index({ returnNumber: 1, pharmacyId: 1 }, { unique: true });

const PurchaseReturn = mongoose.model('PurchaseReturn', purchaseReturnSchema);
export default PurchaseReturn;