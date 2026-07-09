import ActivityLog from '../models/ActivityLog.js';

/**
 * Centralized activity logging utility
 * @param {Object} params
 * @param {ObjectId} params.pharmacyId
 * @param {ObjectId} params.userId
 * @param {string} params.userName
 * @param {string} params.userRole
 * @param {string} params.action - create|update|delete|restore|login|logout|export|print|cancel|return|payment|status_change|subscription_change|backup|restore_data
 * @param {string} params.resource - Medicine|Sale|Purchase|Customer|Supplier|Category|Brand|User|Staff|Payment|Subscription|Setting|Pharmacy|Report
 * @param {ObjectId} [params.resourceId]
 * @param {string} params.description
 * @param {Object} [params.details]
 * @param {string} [params.ipAddress]
 * @param {string} [params.userAgent]
 */
export const logActivity = async ({
  pharmacyId,
  userId,
  userName,
  userRole,
  action,
  resource,
  resourceId,
  description,
  details,
  ipAddress,
  userAgent,
}) => {
  try {
    await ActivityLog.create({
      pharmacyId,
      user: userId,
      userName: userName || 'Unknown',
      userRole: userRole || 'staff',
      action,
      resource,
      resourceId,
      description,
      details: details || {},
      ipAddress: ipAddress || '',
      userAgent: userAgent || '',
    });
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
};

/**
 * Middleware to capture request info for activity logging
 */
export const captureRequestInfo = (req, res, next) => {
  req.requestInfo = {
    ipAddress: req.ip || req.connection?.remoteAddress || '',
    userAgent: req.headers['user-agent'] || '',
  };
  next();
};