import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiResponse from '../utils/apiResponse.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return ApiResponse.error(res, 'Not authorized, no token', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return ApiResponse.error(res, 'Not authorized, user not found', 401);
    }

    if (!req.user.isActive) {
      return ApiResponse.error(res, 'Account deactivated', 401);
    }

    next();
  } catch (error) {
    return ApiResponse.error(res, 'Not authorized, token failed', 401);
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return ApiResponse.error(
        res,
        'Not authorized for this action',
        403
      );
    }
    next();
  };
};