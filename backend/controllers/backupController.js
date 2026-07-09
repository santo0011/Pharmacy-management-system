import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';
import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import User from '../models/User.js';
import Pharmacy from '../models/Pharmacy.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Export all pharmacy data as JSON backup
// @route   GET /api/backup/export
// @access  Private/Admin
export const exportBackup = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;

    const [
      medicines,
      sales,
      purchases,
      customers,
      suppliers,
      categories,
      brands,
      users,
    ] = await Promise.all([
      Medicine.find({ pharmacyId, isDeleted: false }).lean(),
      Sale.find({ pharmacyId, isDeleted: false }).lean(),
      Purchase.find({ pharmacyId, isDeleted: false }).lean(),
      Customer.find({ pharmacyId, isDeleted: false }).lean(),
      Supplier.find({ pharmacyId, isDeleted: false }).lean(),
      Category.find({ pharmacyId, isDeleted: false }).lean(),
      Brand.find({ pharmacyId, isDeleted: false }).lean(),
      User.find({ pharmacyId, isDeleted: false }).select('-password').lean(),
    ]);

    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      pharmacyId: pharmacyId.toString(),
      stats: {
        medicines: medicines.length,
        sales: sales.length,
        purchases: purchases.length,
        customers: customers.length,
        suppliers: suppliers.length,
        categories: categories.length,
        brands: brands.length,
        users: users.length,
      },
      data: {
        medicines,
        sales,
        purchases,
        customers,
        suppliers,
        categories,
        brands,
        users,
      },
    };

    return ApiResponse.success(res, backup, 'Backup exported successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Import backup data (restore)
// @route   POST /api/backup/import
// @access  Private/SuperAdmin
export const importBackup = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { backup } = req.body;
    if (!backup || !backup.data) {
      return ApiResponse.error(res, 'Invalid backup data', 400);
    }

    const pharmacyId = req.pharmacyId;
    const { data } = backup;
    const results = {};

    // Import in order: categories, brands, suppliers, customers, medicines, purchases, sales, users
    if (data.categories?.length) {
      const categories = await Category.insertMany(
        data.categories.map(c => ({ ...c, _id: c._id, pharmacyId })),
        { session }
      );
      results.categories = categories.length;
    }

    if (data.brands?.length) {
      const brands = await Brand.insertMany(
        data.brands.map(b => ({ ...b, _id: b._id, pharmacyId })),
        { session }
      );
      results.brands = brands.length;
    }

    if (data.suppliers?.length) {
      const suppliers = await Supplier.insertMany(
        data.suppliers.map(s => ({ ...s, _id: s._id, pharmacyId })),
        { session }
      );
      results.suppliers = suppliers.length;
    }

    if (data.customers?.length) {
      const customers = await Customer.insertMany(
        data.customers.map(c => ({ ...c, _id: c._id, pharmacyId })),
        { session }
      );
      results.customers = customers.length;
    }

    if (data.medicines?.length) {
      const medicines = await Medicine.insertMany(
        data.medicines.map(m => ({ ...m, _id: m._id, pharmacyId })),
        { session }
      );
      results.medicines = medicines.length;
    }

    if (data.purchases?.length) {
      const purchases = await Purchase.insertMany(
        data.purchases.map(p => ({ ...p, _id: p._id, pharmacyId })),
        { session }
      );
      results.purchases = purchases.length;
    }

    if (data.sales?.length) {
      const sales = await Sale.insertMany(
        data.sales.map(s => ({ ...s, _id: s._id, pharmacyId })),
        { session }
      );
      results.sales = sales.length;
    }

    await session.commitTransaction();

    return ApiResponse.success(res, results, 'Backup restored successfully');
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc    Get backup info/stats
// @route   GET /api/backup/info
// @access  Private/Admin
export const getBackupInfo = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;

    const counts = await Promise.all([
      Medicine.countDocuments({ pharmacyId, isDeleted: false }),
      Sale.countDocuments({ pharmacyId, isDeleted: false }),
      Purchase.countDocuments({ pharmacyId, isDeleted: false }),
      Customer.countDocuments({ pharmacyId, isDeleted: false }),
      Supplier.countDocuments({ pharmacyId, isDeleted: false }),
      Category.countDocuments({ pharmacyId, isDeleted: false }),
      Brand.countDocuments({ pharmacyId, isDeleted: false }),
      User.countDocuments({ pharmacyId, isDeleted: false }),
    ]);

    return ApiResponse.success(res, {
      medicines: counts[0],
      sales: counts[1],
      purchases: counts[2],
      customers: counts[3],
      suppliers: counts[4],
      categories: counts[5],
      brands: counts[6],
      users: counts[7],
      totalRecords: counts.reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    next(error);
  }
};