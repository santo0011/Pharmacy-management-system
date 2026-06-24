import mongoose from 'mongoose';

const changeDetailSchema = mongoose.Schema({
  field: { type: String, required: true },
  label: { type: String, default: '' },
  previousValue: { type: String, default: '' },
  newValue: { type: String, default: '' },
}, { _id: false });

const customerEditHistorySchema = mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
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

customerEditHistorySchema.index({ customer: 1, pharmacyId: 1, createdAt: -1 });

const CustomerEditHistory = mongoose.model('CustomerEditHistory', customerEditHistorySchema);
export default CustomerEditHistory;