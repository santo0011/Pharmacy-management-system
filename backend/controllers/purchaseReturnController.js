import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import PurchaseReturn from '../models/PurchaseReturn.js';
import Medicine from '../models/Medicine.js';
import Supplier from '../models/Supplier.js';
import PurchasePayment from '../models/PurchasePayment.js';
import ApiResponse from '../utils/apiResponse.js';

const generateReturnNumber = async (pharmacyId) => {
  const count = await PurchaseReturn.countDocuments({ pharmacyId });
  const date = new Date();
  const prefix = `PRET-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
};

const updateSupplierFinancials = async (supplierId, pharmacyId, session) => {
  if (!supplierId) return;
  const stats = await Purchase.aggregate([
    { $match: { supplier: new mongoose.Types.ObjectId(supplierId), pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } } },
    {
      $group: {
        _id: null,
        totalPurchases: { $sum: 1 },
        totalSpent: { $sum: '$grandTotal' },
        totalPaid: { $sum: '$paidAmount' },
        totalDue: { $sum: '$dueAmount' },
        lastPurchaseDate: { $max: '$purchaseDate' },
      },
    },
  ]);
  const data = stats[0] || { totalPurchases: 0, totalSpent: 0, totalPaid: 0, totalDue: 0, lastPurchaseDate: null };
  await Supplier.findByIdAndUpdate(supplierId, {
    totalPurchases: data.totalPurchases,
    totalSpent: data.totalSpent,
    totalPaid: data.totalPaid,
    totalDue: data.totalDue,
    lastPurchaseDate: data.lastPurchaseDate,
  }).session(session);
};

// @desc    Return items from a purchase
// @route   POST /api/purchases/:id/return
// @access  Private
export const returnPurchase = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { items, reason } = req.body;

    if (!items || items.length === 0) {
      return ApiResponse.error(res, 'At least one item to return is required', 400);
    }

    const purchase = await Purchase.findOne({
      _id: req.params.id,
      pharmacyId: req.pharmacyId,
      isDeleted: false,
      status: { $nin: ['cancelled', 'returned'] },
    }).session(session);

    if (!purchase) {
      return ApiResponse.error(res, 'Purchase not found or already cancelled/returned', 404);
    }

    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

    // Validate return items against purchase items
    const returnItems = [];
    let subtotal = 0;

    for (const returnItem of parsedItems) {
      const purchaseItem = purchase.items.find(
        pi => pi.medicine.toString() === returnItem.medicineId
      );

      if (!purchaseItem) {
        return ApiResponse.error(res, `Medicine "${returnItem.medicineName}" not found in this purchase`, 400);
      }

      const returnQty = Number(returnItem.returnedQuantity);
      if (returnQty <= 0) {
        return ApiResponse.error(res, `Invalid return quantity for ${purchaseItem.medicineName}`, 400);
      }

      // Respect previously returned quantity (partial returns)
      const alreadyReturned = Number(purchaseItem.returnedQuantity) || 0;
      const remainingReturnable = purchaseItem.quantity - alreadyReturned;
      if (returnQty > remainingReturnable) {
        return ApiResponse.error(res, `Return quantity (${returnQty}) exceeds remaining returnable quantity (${remainingReturnable}) for ${purchaseItem.medicineName}`, 400);
      }

      // === CRITICAL: Use the HISTORICAL transaction value, never the current Product Master price ===
      // `netUnitPrice` is the item's effective per-unit cost AFTER GST, invoice-level
      // discount, round-off, shipping and other cost allocation. This is the true
      // historical cost that must be used for returns.
      const itemNetUnitPrice = Number(purchaseItem.netUnitPrice) || 0;

      // If historical fields are missing (legacy invoice), fall back to a
      // proportional allocation of the purchase grand total based on the item's
      // original (subtotal + GST) value. This preserves backward compatibility.
      let effectiveUnitPrice;
      if (itemNetUnitPrice > 0) {
        effectiveUnitPrice = itemNetUnitPrice;
      } else {
        const sumItemTotals = purchase.items.reduce((s, i) => s + ((i.subtotal || 0) + (i.gstAmount || 0)), 0);
        const itemTotal = (purchaseItem.subtotal || 0) + (purchaseItem.gstAmount || 0);
        const ratio = sumItemTotals > 0 ? itemTotal / sumItemTotals : 0;
        effectiveUnitPrice = Number((itemTotal - ratio * (sumItemTotals - purchase.grandTotal)) / purchaseItem.quantity).toFixed(2);
      }

      const returnAmt = Number((returnQty * effectiveUnitPrice).toFixed(2));
      subtotal += returnAmt;

      returnItems.push({
        medicine: purchaseItem.medicine,
        medicineName: purchaseItem.medicineName,
        batchNumber: purchaseItem.batchNumber || '',
        returnedQuantity: returnQty,
        purchasePrice: Number(effectiveUnitPrice),
        returnAmount: returnAmt,
      });
    }

    const returnNumber = await generateReturnNumber(req.pharmacyId);

    // Create the return record
    const [purchaseReturn] = await PurchaseReturn.create([{
      returnNumber,
      purchase: purchase._id,
      purchaseInvoiceNumber: purchase.invoiceNumber,
      supplier: purchase.supplier,
      supplierName: purchase.supplierName,
      returnDate: new Date(),
      items: returnItems,
      subtotal,
      totalReturnAmount: subtotal,
      reason: reason || '',
      pharmacyId: req.pharmacyId,
      createdBy: req.user._id,
    }], { session });

    // Reduce stock for returned items
    for (const returnItem of returnItems) {
      const medicine = await Medicine.findById(returnItem.medicine).session(session);
      if (medicine) {
        medicine.currentStock = Math.max(0, medicine.currentStock - returnItem.returnedQuantity);
        await medicine.save({ session });
      }
    }

    // Update purchase financials
    // Reduce paid amount proportionally if the purchase was paid
    const returnRatio = subtotal / purchase.grandTotal;
    const paidReduction = purchase.paidAmount * returnRatio;
    const grandTotalReduction = subtotal;

    purchase.grandTotal = Math.max(0, purchase.grandTotal - grandTotalReduction);
    purchase.paidAmount = Math.max(0, purchase.paidAmount - paidReduction);
    purchase.dueAmount = Math.max(0, purchase.grandTotal - purchase.paidAmount);
    purchase.paymentStatus = purchase.dueAmount <= 0 ? 'paid' : purchase.paidAmount > 0 ? 'partial' : 'unpaid';
    // Update status to 'returned' only if ALL items are fully returned
    const allFullyReturned = purchase.items.every(item => {
      const alreadyReturned = Number(item.returnedQuantity) || 0;
      const thisReturnQty = returnItems.find(ri => ri.medicine.toString() === item.medicine.toString())?.returnedQuantity || 0;
      return (alreadyReturned + thisReturnQty) >= item.quantity;
    });
    purchase.status = allFullyReturned ? 'returned' : 'completed';

    // Track returned quantity on each purchase item
    for (const returnItem of returnItems) {
      const purchaseItem = purchase.items.find(
        pi => pi.medicine.toString() === returnItem.medicine.toString()
      );
      if (purchaseItem) {
        purchaseItem.returnedQuantity = (Number(purchaseItem.returnedQuantity) || 0) + returnItem.returnedQuantity;
      }
    }
    purchase.notes = (purchase.notes ? purchase.notes + ' | ' : '') + `Returned on ${new Date().toISOString().split('T')[0]}: ${returnNumber}`;
    purchase.updatedBy = req.user._id;
    await purchase.save({ session });

    // Update supplier financials
    if (purchase.supplier) {
      await updateSupplierFinancials(purchase.supplier, req.pharmacyId, session);
    }

    await session.commitTransaction();

    // Fetch the complete return record for response
    const populatedReturn = await PurchaseReturn.findById(purchaseReturn._id)
      .populate('items.medicine', 'medicineName genericName unit')
      .populate('createdBy', 'name');

    return ApiResponse.success(res, populatedReturn, 'Purchase return processed successfully', 201);
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc    Get return history for a purchase
// @route   GET /api/purchases/:id/returns
// @access  Private
export const getPurchaseReturns = async (req, res, next) => {
  try {
    const returns = await PurchaseReturn.find({
      purchase: req.params.id,
      pharmacyId: req.pharmacyId,
    })
      .populate('items.medicine', 'medicineName genericName unit')
      .populate('createdBy', 'name')
      .sort({ returnDate: -1 });

    return ApiResponse.success(res, returns);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all return history for a pharmacy
// @route   GET /api/purchases/returns
// @access  Private
export const getAllReturns = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { search, startDate, endDate } = req.query;

    const query = { pharmacyId: req.pharmacyId };

    if (search) {
      query.$or = [
        { returnNumber: { $regex: search, $options: 'i' } },
        { purchaseInvoiceNumber: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
      ];
    }
    if (startDate) query.returnDate = { ...query.returnDate, $gte: new Date(startDate) };
    if (endDate) query.returnDate = { ...query.returnDate, $lte: new Date(endDate) };

    const total = await PurchaseReturn.countDocuments(query);
    const returns = await PurchaseReturn.find(query)
      .populate('items.medicine', 'medicineName genericName unit')
      .populate('createdBy', 'name')
      .sort({ returnDate: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, returns, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Get return history for a supplier
// @route   GET /api/purchases/supplier/:supplierId/returns
// @access  Private
export const getSupplierReturns = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {
      supplier: supplierId,
      pharmacyId: req.pharmacyId,
    };

    const total = await PurchaseReturn.countDocuments(query);
    const returns = await PurchaseReturn.find(query)
      .populate('items.medicine', 'medicineName genericName unit')
      .populate('createdBy', 'name')
      .sort({ returnDate: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, returns, total, page, limit);
  } catch (error) {
    next(error);
  }
};