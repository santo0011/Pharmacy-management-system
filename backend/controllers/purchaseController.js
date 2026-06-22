import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import Medicine from '../models/Medicine.js';
import ApiResponse from '../utils/apiResponse.js';

const generateInvoiceNumber = async (pharmacyId) => {
  const count = await Purchase.countDocuments({ pharmacyId });
  const date = new Date();
  const prefix = `PUR-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
};

const updateStockForPurchase = async (items, pharmacyId, session) => {
  for (const item of items) {
    const medicine = await Medicine.findById(item.medicine).session(session);
    if (medicine) {
      medicine.currentStock += item.quantity;
      medicine.purchasePrice = item.purchasePrice;
      if (item.sellingPrice) medicine.sellingPrice = item.sellingPrice;
      await medicine.save({ session });
    }
  }
};

const revertStockForPurchase = async (items, pharmacyId, session) => {
  for (const item of items) {
    const medicine = await Medicine.findById(item.medicine).session(session);
    if (medicine) {
      medicine.currentStock = Math.max(0, medicine.currentStock - item.quantity);
      await medicine.save({ session });
    }
  }
};

export const getPurchases = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { search, startDate, endDate, status, supplier } = req.query;
    const query = { pharmacyId: req.pharmacyId, isDeleted: false };

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
      ];
    }
    if (startDate) query.purchaseDate = { ...query.purchaseDate, $gte: new Date(startDate) };
    if (endDate) query.purchaseDate = { ...query.purchaseDate, $lte: new Date(endDate) };
    if (status) query.status = status;
    if (supplier) query.supplier = supplier;

    const total = await Purchase.countDocuments(query);
    const purchases = await Purchase.find(query)
      .populate('supplier', 'supplierName companyName')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, purchases, total, page, limit);
  } catch (error) {
    next(error);
  }
};

export const getPurchase = async (req, res, next) => {
  try {
    const purchase = await Purchase.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false })
      .populate('supplier', 'supplierName companyName phone email address gstNumber')
      .populate('items.medicine', 'medicineName genericName unit')
      .populate('createdBy', 'name');
    if (!purchase) return ApiResponse.error(res, 'Purchase not found', 404);
    return ApiResponse.success(res, purchase);
  } catch (error) {
    next(error);
  }
};

export const createPurchase = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { purchaseDate, supplier, supplierName, items, discount, discountType, shippingCost, otherCost, paidAmount, paymentMethod, paymentStatus, notes } = req.body;

    if (!items || items.length === 0) return ApiResponse.error(res, 'At least one item is required', 400);

    const invoiceNumber = await generateInvoiceNumber(req.pharmacyId);
    const parsedItems = JSON.parse(typeof items === 'string' ? items : JSON.stringify(items));

    let subtotal = 0;
    let taxAmount = 0;
    const purchaseItems = [];

    for (const item of parsedItems) {
      // Find or create medicine
      let medicine;
      if (item.medicineId) {
        medicine = await Medicine.findById(item.medicineId).session(session);
      } else if (item.barcode) {
        medicine = await Medicine.findOne({ barcode: item.barcode, pharmacyId: req.pharmacyId }).session(session);
      }

      if (!medicine) {
        // Create new medicine
        medicine = await Medicine.create([{
          medicineName: item.medicineName,
          genericName: item.genericName || '',
          category: item.category || req.body.defaultCategory || (await getDefaultCategory(req.pharmacyId)),
          brand: item.brand || req.body.defaultBrand || (await getDefaultBrand(req.pharmacyId)),
          supplier: supplier,
          batchNumber: item.batchNumber,
          barcode: item.barcode || '',
          manufacturingDate: item.manufacturingDate || null,
          expiryDate: item.expiryDate,
          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          gst: item.gst || 0,
          currentStock: item.quantity,
          minStockAlert: 10,
          unit: item.unit || 'Tablet',
          pharmacyId: req.pharmacyId,
          createdBy: req.user._id,
        }], { session });
        medicine = medicine[0];
      }

      const qty = Number(item.quantity);
      const price = Number(item.purchasePrice);
      const gstPct = Number(item.gst) || 0;
      const itemSubtotal = qty * price;
      const gstAmt = itemSubtotal * (gstPct / 100);

      subtotal += itemSubtotal;
      taxAmount += gstAmt;

      purchaseItems.push({
        medicine: medicine._id,
        medicineName: medicine.medicineName,
        batchNumber: item.batchNumber || medicine.batchNumber,
        quantity: qty,
        purchasePrice: price,
        sellingPrice: Number(item.sellingPrice) || medicine.sellingPrice,
        mrp: Number(item.mrp) || 0,
        expiryDate: item.expiryDate,
        manufacturingDate: item.manufacturingDate || null,
        subtotal: itemSubtotal,
        gst: gstPct,
        gstAmount: gstAmt,
      });
    }

    const discountAmount = discountType === 'percentage' ? subtotal * (Number(discount) / 100) : Number(discount) || 0;
    const grandTotal = subtotal + taxAmount + Number(shippingCost || 0) + Number(otherCost || 0) - discountAmount;
    const paid = Number(paidAmount) || grandTotal;
    const due = grandTotal - paid;

    const [purchase] = await Purchase.create([{
      invoiceNumber,
      supplier,
      supplierName: supplierName || '',
      purchaseDate: purchaseDate || new Date(),
      items: purchaseItems,
      subtotal,
      discount: Number(discount) || 0,
      discountType: discountType || 'fixed',
      discountAmount,
      taxAmount,
      shippingCost: Number(shippingCost) || 0,
      otherCost: Number(otherCost) || 0,
      grandTotal,
      paidAmount: paid,
      dueAmount: Math.max(0, due),
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      isStockUpdated: true,
      pharmacyId: req.pharmacyId,
      createdBy: req.user._id,
    }], { session });

    // Update stock
    await updateStockForPurchase(purchaseItems, req.pharmacyId, session);

    await session.commitTransaction();
    return ApiResponse.success(res, purchase, 'Purchase created successfully', 201);
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

const getDefaultCategory = async (pharmacyId) => {
  const Category = (await import('../models/Category.js')).default;
  const cat = await Category.findOne({ pharmacyId, status: true });
  return cat?._id || null;
};

const getDefaultBrand = async (pharmacyId) => {
  const Brand = (await import('../models/Brand.js')).default;
  const br = await Brand.findOne({ pharmacyId, status: true });
  return br?._id || null;
};

export const updatePurchase = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const purchase = await Purchase.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false }).session(session);
    if (!purchase) return ApiResponse.error(res, 'Purchase not found', 404);
    if (purchase.status === 'cancelled' || purchase.status === 'returned') {
      return ApiResponse.error(res, 'Cannot edit a cancelled or returned purchase', 400);
    }

    // Revert old stock
    if (purchase.isStockUpdated) {
      await revertStockForPurchase(purchase.items, req.pharmacyId, session);
    }

    const { purchaseDate, supplier, supplierName, items, discount, discountType, shippingCost, otherCost, paidAmount, paymentMethod, paymentStatus, notes } = req.body;
    const parsedItems = JSON.parse(typeof items === 'string' ? items : JSON.stringify(items));

    let subtotal = 0;
    let taxAmount = 0;
    const purchaseItems = [];

    for (const item of parsedItems) {
      let medicine = await Medicine.findById(item.medicineId).session(session);
      if (!medicine) {
        medicine = await Medicine.create([{
          medicineName: item.medicineName,
          genericName: item.genericName || '',
          batchNumber: item.batchNumber,
          barcode: item.barcode || '',
          expiryDate: item.expiryDate,
          purchasePrice: item.purchasePrice,
          sellingPrice: item.sellingPrice,
          gst: item.gst || 0,
          currentStock: 0,
          pharmacyId: req.pharmacyId,
          createdBy: req.user._id,
        }], { session });
        medicine = medicine[0];
      }

      const qty = Number(item.quantity);
      const price = Number(item.purchasePrice);
      const gstPct = Number(item.gst) || 0;
      const itemSubtotal = qty * price;
      const gstAmt = itemSubtotal * (gstPct / 100);
      subtotal += itemSubtotal;
      taxAmount += gstAmt;

      purchaseItems.push({
        medicine: medicine._id,
        medicineName: medicine.medicineName,
        batchNumber: item.batchNumber || medicine.batchNumber,
        quantity: qty,
        purchasePrice: price,
        sellingPrice: Number(item.sellingPrice) || medicine.sellingPrice,
        mrp: Number(item.mrp) || 0,
        expiryDate: item.expiryDate,
        manufacturingDate: item.manufacturingDate || null,
        subtotal: itemSubtotal,
        gst: gstPct,
        gstAmount: gstAmt,
      });
    }

    const discountAmount = discountType === 'percentage' ? subtotal * (Number(discount) / 100) : Number(discount) || 0;
    const grandTotal = subtotal + taxAmount + Number(shippingCost || 0) + Number(otherCost || 0) - discountAmount;
    const paid = Number(paidAmount) || grandTotal;
    const due = grandTotal - paid;

    purchase.set({
      purchaseDate: purchaseDate || purchase.purchaseDate,
      supplier: supplier || purchase.supplier,
      supplierName: supplierName || purchase.supplierName,
      items: purchaseItems,
      subtotal,
      discount: Number(discount) || 0,
      discountType: discountType || 'fixed',
      discountAmount,
      taxAmount,
      shippingCost: Number(shippingCost) || 0,
      otherCost: Number(otherCost) || 0,
      grandTotal,
      paidAmount: paid,
      dueAmount: Math.max(0, due),
      paymentMethod: paymentMethod || purchase.paymentMethod,
      paymentStatus: due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      notes: notes !== undefined ? notes : purchase.notes,
      isStockUpdated: true,
      updatedBy: req.user._id,
    });

    await purchase.save({ session });
    await updateStockForPurchase(purchaseItems, req.pharmacyId, session);

    await session.commitTransaction();
    return ApiResponse.success(res, purchase, 'Purchase updated successfully');
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

export const deletePurchase = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const purchase = await Purchase.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false }).session(session);
    if (!purchase) return ApiResponse.error(res, 'Purchase not found', 404);

    // Check for sales referencing this purchase's items
    const Sale = (await import('../models/Sale.js')).default;
    const medicineIds = purchase.items.map(i => i.medicine);
    const salesCount = await Sale.countDocuments({ 'items.medicine': { $in: medicineIds }, pharmacyId: req.pharmacyId, isDeleted: false }).session(session);
    if (salesCount > 0) {
      return ApiResponse.error(res, 'Cannot delete purchase. Some medicines have been sold.', 400);
    }

    // Revert stock
    if (purchase.isStockUpdated) {
      await revertStockForPurchase(purchase.items, req.pharmacyId, session);
    }

    purchase.isDeleted = true;
    purchase.deletedAt = new Date();
    await purchase.save({ session });

    await session.commitTransaction();
    return ApiResponse.success(res, null, 'Purchase deleted successfully');
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

export const getPurchaseStats = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [totalPurchase, monthlyPurchase, yearlyPurchase, recentPurchases] = await Promise.all([
      Purchase.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),
      Purchase.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, purchaseDate: { $gte: startOfMonth }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),
      Purchase.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, purchaseDate: { $gte: startOfYear }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),
      Purchase.find({ pharmacyId, isDeleted: false }).sort({ createdAt: -1 }).limit(5).populate('supplier', 'supplierName').select('invoiceNumber supplierName grandTotal purchaseDate status'),
    ]);

    return ApiResponse.success(res, {
      totalAmount: totalPurchase[0]?.total || 0,
      totalPurchases: totalPurchase[0]?.count || 0,
      monthlyAmount: monthlyPurchase[0]?.total || 0,
      monthlyPurchases: monthlyPurchase[0]?.count || 0,
      yearlyAmount: yearlyPurchase[0]?.total || 0,
      yearlyPurchases: yearlyPurchase[0]?.count || 0,
      recentPurchases,
    });
  } catch (error) {
    next(error);
  }
};