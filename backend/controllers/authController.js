import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Pharmacy from '../models/Pharmacy.js';
import ApiResponse from '../utils/apiResponse.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// @desc    Create user (by Super Admin only)
// @route   POST /api/auth/users
// @access  Private/SuperAdmin
export const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const validRoles = ['admin', 'pharmacist', 'cashier'];
    if (!validRoles.includes(role)) {
      return ApiResponse.error(res, 'Invalid role. Must be admin, pharmacist, or cashier', 400);
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return ApiResponse.error(res, 'Email already registered', 400);
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      phone,
    });

    return ApiResponse.success(res, user, 'User created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return ApiResponse.error(res, 'Invalid email or password.', 401);
    }

    const isPasswordMatch = await user.matchPassword(password);
    if (!isPasswordMatch) {
      return ApiResponse.error(res, 'Invalid email or password.', 401);
    }

    if (!user.isActive) {
      return ApiResponse.error(res, 'Account is deactivated', 401);
    }

    const token = generateToken(user._id);

    // Populate pharmacy name for pharmacy users
    let userData = user.toObject();
    if (userData.pharmacyId) {
      const pharmacy = await Pharmacy.findById(userData.pharmacyId).select('pharmacyName');
      if (pharmacy) {
        userData.pharmacy = { pharmacyName: pharmacy.pharmacyName };
      }
    }

    return ApiResponse.success(
      res,
      {
        user: userData,
        token,
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    let userData = req.user.toObject();
    if (userData.pharmacyId) {
      const pharmacy = await Pharmacy.findById(userData.pharmacyId).select('pharmacyName');
      if (pharmacy) {
        userData.pharmacy = { pharmacyName: pharmacy.pharmacyName };
      }
    }
    return ApiResponse.success(res, userData, 'Profile fetched');
  } catch (error) {
    next(error);
  }
};

// @desc    Update current user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;

    const updatedUser = await user.save();
    return ApiResponse.success(res, updatedUser, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users
// @route   GET /api/auth/users
// @access  Private/SuperAdmin
export const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const role = req.query.role || '';

    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role && ['admin', 'pharmacist', 'cashier', 'super_admin'].includes(role)) {
      query.role = role;
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, users, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/auth/users/:id
// @access  Private/SuperAdmin
export const updateUser = async (req, res, next) => {
  try {
    const { name, role, phone, isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }

    if (user.role === 'super_admin' && req.user.id !== user._id.toString()) {
      return ApiResponse.error(res, 'Cannot modify Super Admin', 403);
    }

    if (role) {
      const validRoles = ['admin', 'pharmacist', 'cashier'];
      if (!validRoles.includes(role)) {
        return ApiResponse.error(res, 'Invalid role', 400);
      }
      user.role = role;
    }

    user.name = name || user.name;
    user.phone = phone !== undefined ? phone : user.phone;
    user.isActive = isActive !== undefined ? isActive : user.isActive;

    const updatedUser = await user.save();
    return ApiResponse.success(res, updatedUser, 'User updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/auth/users/:id
// @access  Private/SuperAdmin
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }
    if (user.role === 'super_admin') {
      return ApiResponse.error(res, 'Cannot delete Super Admin', 403);
    }
    await user.deleteOne();
    return ApiResponse.success(res, null, 'User deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Reset user password (by Super Admin)
// @route   PUT /api/auth/users/:id/reset-password
// @access  Private/SuperAdmin
export const resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return ApiResponse.error(res, 'User not found', 404);
    }

    if (user.role === 'super_admin') {
      return ApiResponse.error(res, 'Cannot reset password for Super Admin', 403);
    }

    user.password = newPassword;
    await user.save();

    return ApiResponse.success(res, null, 'Password reset successfully');
  } catch (error) {
    next(error);
  }
};
