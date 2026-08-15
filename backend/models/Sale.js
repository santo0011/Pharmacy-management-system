import mongoose from 'mongoose';

const saleItemSchema = mongoose.Schema({
  medicine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true,
  },
  medicineName: { type: String, required: true },
  batchNumber: { type: String, default: '' },
  hsnCode: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1 },
  sellingPrice: { type: Number, required: true, min: 0 },
  purchasePrice: { type: Number, default: 0 },
  mrp: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  discountType: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
  discountAmount: { type: Number, default: 0 },
  subtotal: { type: Number, required: true },
  taxableAmount: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  cgstAmount: { type: Number, default: 0 },
  sgstAmount: { type: Number, default: 0 },
  igstAmount: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  // === Historical transaction pricing (for accurate returns) ===
  // Effective per-unit price AFTER item-level discount (GST-inclusive basis).
  // This is the actual price the customer paid per unit for this item.
  netUnitPrice: { type: Number, default: 0 },
  // The item's contribution to the FINAL invoice total after invoice-level
  // discount and round-off allocation. This is the true historical value
  // that must be used for returns — NOT the current Product Master price.
  finalItemAmount: { type: Number, default: 0 },
  // Quantity already returned for this item (for partial-return tracking).
  returnedQuantity: { type: Number, default: 0 },
});

const saleSchema = mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    trim: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null,
  },
  customerId: { type: String, default: '' },
  customerName: { type: String, default: 'Walk-in Customer' },
  customerPhone: { type: String, default: '' },
  customerAddress: { type: String, default: '' },
  saleDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  items: [saleItemSchema],
  subtotal: { type: Number, required: true, default: 0 },
  discount: { type: Number, default: 0 },
  discountType: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
  discountAmount: { type: Number, default: 0 },
  taxableAmount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  cgstAmount: { type: Number, default: 0 },
  sgstAmount: { type: Number, default: 0 },
  igstAmount: { type: Number, default: 0 },
  isIntraState: { type: Boolean, default: true },
  roundOffAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true, default: 0 },
  customerStateCode: { type: String, default: '' },
  customerGstin: { type: String, default: '' },
  customerType: { type: String, enum: ['retail', 'business'], default: 'retail' },
  previousDueAmount: { type: Number, default: 0 },
  previousDuePaid: { type: Number, default: 0 },
  previousDueRemaining: { type: Number, default: 0 },
  currentInvoicePaid: { type: Number, default: 0 },
  currentInvoiceDue: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'mobile_banking', 'cheque', 'other'],
    default: 'cash',
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'partial', 'unpaid'],
    default: 'paid',
  },
  status: {
    type: String,
    enum: ['completed', 'returned', 'cancelled'],
    default: 'completed',
  },
  notes: { type: String, default: '' },
  isStockDeducted: { type: Boolean, default: false },
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

saleSchema.index({ invoiceNumber: 1, pharmacyId: 1 }, { unique: true });
saleSchema.index({ pharmacyId: 1, saleDate: -1 });

const Sale = mongoose.model('Sale', saleSchema);
export default Sale;