import mongoose from 'mongoose';

const activityLogSchema = mongoose.Schema({
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pharmacy',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  userName: {
    type: String,
    default: '',
  },
  userRole: {
    type: String,
    default: '',
  },
  action: {
    type: String,
    required: true,
    enum: [
      'create', 'update', 'delete', 'restore',
      'login', 'logout', 'export', 'print',
      'cancel', 'return', 'payment',
      'status_change', 'subscription_change',
      'backup', 'restore_data',
    ],
  },
  resource: {
    type: String,
    required: true,
    enum: [
      'Medicine', 'Sale', 'Purchase', 'Customer',
      'Supplier', 'Category', 'Brand', 'User',
      'Staff', 'Payment', 'Subscription',
      'Setting', 'Pharmacy', 'Report',
    ],
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  description: {
    type: String,
    required: true,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
  },
  ipAddress: {
    type: String,
    default: '',
  },
  userAgent: {
    type: String,
    default: '',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

activityLogSchema.index({ pharmacyId: 1, createdAt: -1 });
activityLogSchema.index({ pharmacyId: 1, resource: 1, createdAt: -1 });
activityLogSchema.index({ pharmacyId: 1, user: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // Auto-delete after 90 days

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;