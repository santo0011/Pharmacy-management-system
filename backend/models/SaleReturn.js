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
  sellingPrice: { type: Number, required: true, min: 0 },
  taxableAmount: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  cgstAmount: { type: Number, default: 0 },
  sgstAmount: { type: Number, default: 0 },
  igstAmount: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  returnAmount: { type: Number, required: true, min: 0 },
});

const saleReturnSchema = mongoose.Schema({
  returnNumber: {
    type: String,
    required: true,
    trim: true,
  },
  sale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true,
  },
  saleInvoiceNumber: { type: String, required: true },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null,
  },
  customerName: { type: String, default: 'Walk-in Customer' },
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

saleReturnSchema.index({ sale: 1, pharmacyId: 1 });
saleReturnSchema.index({ pharmacyId: 1, returnDate: -1 });
saleReturnSchema.index({ returnNumber: 1, pharmacyId: 1 }, { unique: true });

const SaleReturn = mongoose.model('SaleReturn', saleReturnSchema);
export default SaleReturn;