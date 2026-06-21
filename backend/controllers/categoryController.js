import Category from '../models/Category.js';
import ApiResponse from '../utils/apiResponse.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Get all categories
// @route   GET /api/categories
// @access  Private (Pharmacy Admin, Pharmacist, Cashier)
export const getCategories = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = { pharmacyId: req.pharmacyId };
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const total = await Category.countDocuments(query);
    const categories = await Category.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, categories, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Private
export const getCategory = async (req, res, next) => {
  try {
    const category = await Category.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!category) {
      return ApiResponse.error(res, 'Category not found', 404);
    }
    return ApiResponse.success(res, category);
  } catch (error) {
    next(error);
  }
};

// @desc    Create category
// @route   POST /api/categories
// @access  Private
export const createCategory = async (req, res, next) => {
  try {
    const { name, description, status } = req.body;

    const existingCategory = await Category.findOne({ name, pharmacyId: req.pharmacyId });
    if (existingCategory) {
      return ApiResponse.error(res, 'Category name already exists in this pharmacy', 400);
    }

    const category = await Category.create({
      name,
      description,
      pharmacyId: req.pharmacyId,
      status: status !== undefined ? status : true,
      image: req.file ? `/uploads/categories/${req.file.filename}` : '',
    });

    return ApiResponse.success(res, category, 'Category created', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private
export const updateCategory = async (req, res, next) => {
  try {
    const { name, description, status } = req.body;

    const category = await Category.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!category) {
      return ApiResponse.error(res, 'Category not found', 404);
    }

    // Check if name is taken by another category in same pharmacy
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name, pharmacyId: req.pharmacyId });
      if (existingCategory) {
        return ApiResponse.error(res, 'Category name already exists', 400);
      }
    }

    // Delete old image if new one uploaded
    if (req.file && category.image) {
      const oldImagePath = path.join(__dirname, '..', category.image);
      try {
        fs.unlinkSync(oldImagePath);
      } catch (err) {
        // File may not exist
      }
    }

    category.name = name || category.name;
    category.description = description !== undefined ? description : category.description;
    category.status = status !== undefined ? status : category.status;
    category.image = req.file ? `/uploads/categories/${req.file.filename}` : category.image;

    const updatedCategory = await category.save();

    return ApiResponse.success(res, updatedCategory, 'Category updated');
  } catch (error) {
    next(error);
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private
export const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!category) {
      return ApiResponse.error(res, 'Category not found', 404);
    }

    // Delete image file
    if (category.image) {
      const imagePath = path.join(__dirname, '..', category.image);
      try {
        fs.unlinkSync(imagePath);
      } catch (err) {
        // File may not exist
      }
    }

    await category.deleteOne();

    return ApiResponse.success(res, null, 'Category deleted');
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle category status
// @route   PATCH /api/categories/:id/status
// @access  Private
export const toggleCategoryStatus = async (req, res, next) => {
  try {
    const category = await Category.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId });
    if (!category) {
      return ApiResponse.error(res, 'Category not found', 404);
    }

    category.status = !category.status;
    await category.save();

    return ApiResponse.success(res, category, 'Status updated');
  } catch (error) {
    next(error);
  }
};