import mongoose from 'mongoose';

const changeDetailSchema = mongoose.Schema({
  field: { type: String, required: true },
  label: { type: String, default: '' },
  previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
  newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  changeType: {
    type: String,
    enum: ['added', 'removed', 'modified', 'quantity_change', 'price_change', 'discount_change', 'total_change'],
    default: 'modified',
  },
}, { _id: false });

const saleEditHistorySchema = mongoose.Schema({
  sale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true,
  },
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pharmacy',
    required: true,
  },
  editedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  editedByName: {
    type: String,
    default: '',
  },
  reason: {
    type: String,
    default: '',
  },
  changes: [changeDetailSchema],
  snapshotBefore: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  snapshotAfter: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

saleEditHistorySchema.index({ sale: 1, pharmacyId: 1, createdAt: -1 });

const SaleEditHistory = mongoose.model('SaleEditHistory', saleEditHistorySchema);
export default SaleEditHistory;