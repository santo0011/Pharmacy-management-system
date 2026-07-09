import mongoose from 'mongoose';

const purchaseItemSchema = mongoose.Schema({
  medicine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true,
  },
  medicineName: { type: String, required: true },
  batchNumber: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  purchasePrice: { type: Number, required: true, min: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
  mrp: { type: Number, default: 0 },
  expiryDate: { type: Date, required: true },
  manufacturingDate: { type: Date },
  subtotal: { type: Number, required: true },
  gst: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
});

const purchaseSchema = mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    trim: true,
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true,
  },
  supplierName: { type: String, default: '' },
  purchaseDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  items: [purchaseItemSchema],
  subtotal: { type: Number, required: true, default: 0 },
  discount: { type: Number, default: 0 },
  discountType: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
  discountAmount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  shippingCost: { type: Number, default: 0 },
  otherCost: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true, default: 0 },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'credit', 'other'],
    default: 'cash',
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'partial', 'unpaid'],
    default: 'unpaid',
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'returned'],
    default: 'completed',
  },
  notes: { type: String, default: '' },
  isStockUpdated: { type: Boolean, default: false },
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
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

purchaseSchema.index({ invoiceNumber: 1, pharmacyId: 1 }, { unique: true });
purchaseSchema.index({ pharmacyId: 1, purchaseDate: -1 });

const Purchase = mongoose.model('Purchase', purchaseSchema);
export default Purchase;