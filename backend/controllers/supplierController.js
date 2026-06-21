import Supplier from '../models/Supplier.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Get all suppliers
// @route   GET /api/suppliers
// @access  Private (Pharmacy Admin)
export const getSuppliers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = { pharmacyId: req.pharmacyId };
    if (search) {
      query.$or = [
        { supplierName: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Supplier.countDocuments(query);
    const suppliers = await Supplier.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, suppliers, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single supplier
// @route   GET /api/suppliers/:id
// @access  Private
export const getSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!supplier) {
      return ApiResponse.error(res, 'Supplier not found', 404);
    }
    return ApiResponse.success(res, supplier);
  } catch (error) {
    next(error);
  }
};

// @desc    Create supplier
// @route   POST /api/suppliers
// @access  Private
export const createSupplier = async (req, res, next) => {
  try {
    const { supplierName, companyName, phone, email, address, gstNumber, status } = req.body;

    const existingSupplier = await Supplier.findOne({ email, pharmacyId: req.pharmacyId });
    if (existingSupplier) {
      return ApiResponse.error(res, 'Supplier with this email already exists in this pharmacy', 400);
    }

    const supplier = await Supplier.create({
      supplierName,
      companyName,
      phone,
      email,
      address,
      gstNumber,
      pharmacyId: req.pharmacyId,
      status: status !== undefined ? status : true,
    });

    return ApiResponse.success(res, supplier, 'Supplier created', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update supplier
// @route   PUT /api/suppliers/:id
// @access  Private
export const updateSupplier = async (req, res, next) => {
  try {
    const { supplierName, companyName, phone, email, address, gstNumber, status } = req.body;

    const supplier = await Supplier.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!supplier) {
      return ApiResponse.error(res, 'Supplier not found', 404);
    }

    if (email && email !== supplier.email) {
      const existingSupplier = await Supplier.findOne({ email, pharmacyId: req.pharmacyId });
      if (existingSupplier) {
        return ApiResponse.error(res, 'Email already in use by another supplier', 400);
      }
    }

    supplier.supplierName = supplierName || supplier.supplierName;
    supplier.companyName = companyName || supplier.companyName;
    supplier.phone = phone || supplier.phone;
    supplier.email = email || supplier.email;
    supplier.address = address !== undefined ? address : supplier.address;
    supplier.gstNumber = gstNumber !== undefined ? gstNumber : supplier.gstNumber;
    supplier.status = status !== undefined ? status : supplier.status;

    const updatedSupplier = await supplier.save();

    return ApiResponse.success(res, updatedSupplier, 'Supplier updated');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete supplier
// @route   DELETE /api/suppliers/:id
// @access  Private
export const deleteSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!supplier) {
      return ApiResponse.error(res, 'Supplier not found', 404);
    }

    await supplier.deleteOne();

    return ApiResponse.success(res, null, 'Supplier deleted');
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle supplier status
// @route   PATCH /api/suppliers/:id/status
// @access  Private
export const toggleSupplierStatus = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!supplier) {
      return ApiResponse.error(res, 'Supplier not found', 404);
    }

    supplier.status = !supplier.status;
    await supplier.save();

    return ApiResponse.success(res, supplier, 'Status updated');
  } catch (error) {
    next(error);
  }
};