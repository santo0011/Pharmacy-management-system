import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import Medicine from '../models/Medicine.js';
import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Get notifications for pharmacy
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { type, isRead, severity } = req.query;

    const query = { pharmacyId: req.pharmacyId, isDismissed: false };
    if (type) query.type = type;
    if (isRead !== undefined) query.isRead = isRead === 'true';
    if (severity) query.severity = severity;

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const unreadCount = await Notification.countDocuments({
      pharmacyId: req.pharmacyId,
      isRead: false,
      isDismissed: false,
    });

    return ApiResponse.paginated(res, notifications, total, page, limit, { unreadCount });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      pharmacyId: req.pharmacyId,
    });

    if (!notification) return ApiResponse.error(res, 'Notification not found', 404);

    notification.isRead = true;
    notification.readBy.push({
      user: req.user._id,
      readAt: new Date(),
    });
    await notification.save();

    return ApiResponse.success(res, notification, 'Marked as read');
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { pharmacyId: req.pharmacyId, isRead: false, isDismissed: false },
      { $set: { isRead: true } }
    );

    return ApiResponse.success(res, null, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};

// @desc    Dismiss notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const dismissNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, pharmacyId: req.pharmacyId },
      { $set: { isDismissed: true } },
      { new: true }
    );

    if (!notification) return ApiResponse.error(res, 'Notification not found', 404);

    return ApiResponse.success(res, notification, 'Notification dismissed');
  } catch (error) {
    next(error);
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      pharmacyId: req.pharmacyId,
      isRead: false,
      isDismissed: false,
    });

    return ApiResponse.success(res, { count });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate system notifications (low stock, expiry, etc.)
// @route   POST /api/notifications/generate
// @access  Private/Admin
export const generateNotifications = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let created = 0;

    // 1. Low stock notifications
    const lowStockMedicines = await Medicine.find({
      pharmacyId,
      isDeleted: false,
      $expr: { $lte: ['$currentStock', '$minStockAlert'] },
    });

    for (const med of lowStockMedicines) {
      const existing = await Notification.findOne({
        pharmacyId,
        type: 'low_stock',
        'relatedTo.id': med._id,
        isDismissed: false,
        createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      });
      if (!existing) {
        await Notification.create({
          pharmacyId,
          type: 'low_stock',
          title: 'Low Stock Alert',
          message: `${med.medicineName} has only ${med.currentStock} ${med.unit || 'units'} remaining (min: ${med.minStockAlert})`,
          severity: 'warning',
          relatedTo: { model: 'Medicine', id: med._id },
          actionUrl: `/medicines/${med._id}`,
          expiresAt: thirtyDaysLater,
        });
        created++;
      }
    }

    // 2. Expiry notifications
    const expiringMedicines = await Medicine.find({
      pharmacyId,
      isDeleted: false,
      expiryDate: { $gte: now, $lte: thirtyDaysLater },
    });

    for (const med of expiringMedicines) {
      const daysToExpiry = Math.ceil((new Date(med.expiryDate) - now) / (1000 * 60 * 60 * 24));
      const existing = await Notification.findOne({
        pharmacyId,
        type: 'expiry',
        'relatedTo.id': med._id,
        isDismissed: false,
        createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      });
      if (!existing) {
        await Notification.create({
          pharmacyId,
          type: 'expiry',
          title: `${daysToExpiry <= 0 ? 'Expired' : 'Expiring Soon'}: ${med.medicineName}`,
          message: `${med.medicineName} (${med.batchNumber}) expires ${new Date(med.expiryDate).toLocaleDateString()} (${daysToExpiry <= 0 ? 'EXPIRED' : `${daysToExpiry} days remaining`})`,
          severity: daysToExpiry <= 0 ? 'danger' : 'warning',
          relatedTo: { model: 'Medicine', id: med._id },
          actionUrl: `/medicines/${med._id}`,
          expiresAt: daysToExpiry <= 0 ? now : med.expiryDate,
        });
        created++;
      }
    }

    // 3. Due payment notifications
    const dueSales = await Sale.find({
      pharmacyId,
      isDeleted: false,
      dueAmount: { $gt: 0 },
      status: { $nin: ['cancelled', 'returned'] },
    }).populate('customerName');

    for (const sale of dueSales) {
      const existing = await Notification.findOne({
        pharmacyId,
        type: 'payment_due',
        'relatedTo.id': sale._id,
        isDismissed: false,
      });
      if (!existing && sale.dueAmount > 0) {
        await Notification.create({
          pharmacyId,
          type: 'payment_due',
          title: 'Payment Due Reminder',
          message: `Invoice ${sale.invoiceNumber} (${sale.customerName}) has ₹${sale.dueAmount.toFixed(2)} due`,
          severity: 'info',
          relatedTo: { model: 'Sale', id: sale._id },
          actionUrl: `/sales/${sale._id}`,
          expiresAt: thirtyDaysLater,
        });
        created++;
      }
    }

    return ApiResponse.success(res, { generatedCount: created }, `${created} notifications generated`);
  } catch (error) {
    next(error);
  }
};