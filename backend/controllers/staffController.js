import User from '../models/User.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Get all staff under this pharmacy
// @route   GET /api/staff
// @access  Private/PharmacyAdmin
export const getStaff = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = {
      pharmacyId: req.pharmacyId,
      role: { $in: ['pharmacist', 'cashier'] },
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(query);
    const staff = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, staff, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Create staff (pharmacist or cashier)
// @route   POST /api/staff
// @access  Private/PharmacyAdmin
export const createStaff = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const validRoles = ['pharmacist', 'cashier'];
    if (!validRoles.includes(role)) {
      return ApiResponse.error(res, 'Invalid role. Must be pharmacist or cashier', 400);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return ApiResponse.error(res, 'Email already registered', 400);
    }

    const staff = await User.create({
      name,
      email,
      password,
      role,
      phone: phone || '',
      pharmacyId: req.pharmacyId,
      isActive: true,
    });

    // Remove password from response
    const staffResponse = staff.toJSON();

    return ApiResponse.success(res, staffResponse, 'Staff created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update staff
// @route   PUT /api/staff/:id
// @access  Private/PharmacyAdmin
export const updateStaff = async (req, res, next) => {
  try {
    const staff = await User.findOne({
      _id: req.params.id,
      pharmacyId: req.pharmacyId,
      role: { $in: ['pharmacist', 'cashier'] },
    });

    if (!staff) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    const { name, phone, isActive, role } = req.body;

    if (role) {
      const validRoles = ['pharmacist', 'cashier'];
      if (!validRoles.includes(role)) {
        return ApiResponse.error(res, 'Invalid role', 400);
      }
      staff.role = role;
    }

    staff.name = name || staff.name;
    staff.phone = phone !== undefined ? phone : staff.phone;
    staff.isActive = isActive !== undefined ? isActive : staff.isActive;

    await staff.save();

    return ApiResponse.success(res, staff.toJSON(), 'Staff updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete staff
// @route   DELETE /api/staff/:id
// @access  Private/PharmacyAdmin
export const deleteStaff = async (req, res, next) => {
  try {
    const staff = await User.findOne({
      _id: req.params.id,
      pharmacyId: req.pharmacyId,
      role: { $in: ['pharmacist', 'cashier'] },
    });

    if (!staff) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    await staff.deleteOne();
    return ApiResponse.success(res, null, 'Staff deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle staff active status
// @route   PATCH /api/staff/:id/status
// @access  Private/PharmacyAdmin
export const toggleStaffStatus = async (req, res, next) => {
  try {
    const staff = await User.findOne({
      _id: req.params.id,
      pharmacyId: req.pharmacyId,
      role: { $in: ['pharmacist', 'cashier'] },
    });

    if (!staff) {
      return ApiResponse.error(res, 'Staff not found', 404);
    }

    staff.isActive = !staff.isActive;
    await staff.save();

    return ApiResponse.success(res, staff.toJSON(), 'Staff status updated');
  } catch (error) {
    next(error);
  }
};