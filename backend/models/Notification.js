import mongoose from 'mongoose';

const notificationSchema = mongoose.Schema({
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pharmacy',
    required: true,
  },
  type: {
    type: String,
    enum: ['low_stock', 'expiry', 'payment_due', 'subscription', 'sale', 'purchase', 'system', 'alert'],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'danger', 'success'],
    default: 'info',
  },
  relatedTo: {
    model: {
      type: String,
      enum: ['Medicine', 'Sale', 'Purchase', 'Customer', 'Supplier', 'Subscription'],
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  isDismissed: {
    type: Boolean,
    default: false,
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    readAt: Date,
  }],
  actionUrl: {
    type: String,
    default: '',
  },
  expiresAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

notificationSchema.index({ pharmacyId: 1, createdAt: -1 });
notificationSchema.index({ pharmacyId: 1, isRead: 1, isDismissed: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;