import Brand from '../models/Brand.js';
import ApiResponse from '../utils/apiResponse.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Get all brands
// @route   GET /api/brands
// @access  Private (Pharmacy Admin)
export const getBrands = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = { pharmacyId: req.pharmacyId };
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const total = await Brand.countDocuments(query);
    const brands = await Brand.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, brands, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single brand
// @route   GET /api/brands/:id
// @access  Private
export const getBrand = async (req, res, next) => {
  try {
    const brand = await Brand.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!brand) {
      return ApiResponse.error(res, 'Brand not found', 404);
    }
    return ApiResponse.success(res, brand);
  } catch (error) {
    next(error);
  }
};

// @desc    Create brand
// @route   POST /api/brands
// @access  Private
export const createBrand = async (req, res, next) => {
  try {
    const { name, description, status } = req.body;

    const existingBrand = await Brand.findOne({ name, pharmacyId: req.pharmacyId });
    if (existingBrand) {
      return ApiResponse.error(res, 'Brand name already exists in this pharmacy', 400);
    }

    const brand = await Brand.create({
      name,
      description,
      pharmacyId: req.pharmacyId,
      status: status !== undefined ? status : true,
      logo: req.file ? `/uploads/brands/${req.file.filename}` : '',
    });

    return ApiResponse.success(res, brand, 'Brand created', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update brand
// @route   PUT /api/brands/:id
// @access  Private
export const updateBrand = async (req, res, next) => {
  try {
    const { name, description, status } = req.body;

    const brand = await Brand.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!brand) {
      return ApiResponse.error(res, 'Brand not found', 404);
    }

    if (name && name !== brand.name) {
      const existingBrand = await Brand.findOne({ name, pharmacyId: req.pharmacyId });
      if (existingBrand) {
        return ApiResponse.error(res, 'Brand name already exists', 400);
      }
    }

    if (req.file && brand.logo) {
      const oldLogoPath = path.join(__dirname, '..', brand.logo);
      try {
        fs.unlinkSync(oldLogoPath);
      } catch (err) {
        // File may not exist
      }
    }

    brand.name = name || brand.name;
    brand.description = description !== undefined ? description : brand.description;
    brand.status = status !== undefined ? status : brand.status;
    brand.logo = req.file ? `/uploads/brands/${req.file.filename}` : brand.logo;

    const updatedBrand = await brand.save();

    return ApiResponse.success(res, updatedBrand, 'Brand updated');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete brand
// @route   DELETE /api/brands/:id
// @access  Private
export const deleteBrand = async (req, res, next) => {
  try {
    const brand = await Brand.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!brand) {
      return ApiResponse.error(res, 'Brand not found', 404);
    }

    // Check if any medicines are linked to this brand
    const Medicine = (await import('../models/Medicine.js')).default;
    const medicineCount = await Medicine.countDocuments({
      brand: brand._id,
      pharmacyId: req.pharmacyId,
      isDeleted: false,
    });

    if (medicineCount > 0) {
      return ApiResponse.error(
        res,
        `This brand is associated with ${medicineCount} medicine(s) and cannot be deleted. Remove or reassign the medicines first.`,
        400
      );
    }

    if (brand.logo) {
      const logoPath = path.join(__dirname, '..', brand.logo);
      try {
        fs.unlinkSync(logoPath);
      } catch (err) {
        // File may not exist
      }
    }

    await brand.deleteOne();

    return ApiResponse.success(res, null, 'Brand deleted');
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle brand status
// @route   PATCH /api/brands/:id/status
// @access  Private
export const toggleBrandStatus = async (req, res, next) => {
  try {
    const brand = await Brand.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!brand) {
      return ApiResponse.error(res, 'Brand not found', 404);
    }

    brand.status = !brand.status;
    await brand.save();

    return ApiResponse.success(res, brand, 'Status updated');
  } catch (error) {
    next(error);
  }
};