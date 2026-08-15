import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import SaleReturn from '../models/SaleReturn.js';
import Medicine from '../models/Medicine.js';
import Customer from '../models/Customer.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import ApiResponse from '../utils/apiResponse.js';

const generateReturnNumber = async (pharmacyId) => {
  const count = await SaleReturn.countDocuments({ pharmacyId });
  const date = new Date();
  const prefix = `SRET-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
};

const updateCustomerStats = async (customerId, pharmacyId, session) => {
  if (!customerId) return;
  const stats = await Sale.aggregate([
    { $match: { customer: new mongoose.Types.ObjectId(customerId), pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } } },
    {
      $group: {
        _id: null,
        totalPurchases: { $sum: 1 },
        totalSpent: { $sum: '$grandTotal' },
        lastPurchaseDate: { $max: '$saleDate' },
      },
    },
  ]);
  const data = stats[0] || { totalPurchases: 0, totalSpent: 0, lastPurchaseDate: null };
  await Customer.findByIdAndUpdate(customerId, {
    totalPurchases: data.totalPurchases,
    totalSpent: data.totalSpent,
    lastPurchaseDate: data.lastPurchaseDate,
  }).session(session);
};

// @desc    Return items from a sale
// @route   POST /api/sales/:id/return-items
// @access  Private
export const returnSaleItems = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { items, reason } = req.body;

    if (!items || items.length === 0) {
      return ApiResponse.error(res, 'At least one item to return is required', 400);
    }

    const sale = await Sale.findOne({
      _id: req.params.id,
      pharmacyId: req.pharmacyId,
      isDeleted: false,
      status: { $nin: ['cancelled', 'returned'] },
    }).session(session);

    if (!sale) {
      return ApiResponse.error(res, 'Sale not found or already cancelled/returned', 404);
    }

    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

    // Validate return items against sale items
    const returnItems = [];
    let subtotal = 0;
    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let gstTotal = 0;

    for (const returnItem of parsedItems) {
      const saleItem = sale.items.find(
        si => si.medicine.toString() === returnItem.medicineId
      );

      if (!saleItem) {
        return ApiResponse.error(res, `Medicine "${returnItem.medicineName}" not found in this sale`, 400);
      }

      const returnQty = Number(returnItem.returnedQuantity);
      if (returnQty <= 0) {
        return ApiResponse.error(res, `Invalid return quantity for ${saleItem.medicineName}`, 400);
      }

      // Respect previously returned quantity (partial returns)
      const alreadyReturned = Number(saleItem.returnedQuantity) || 0;
      const remainingReturnable = saleItem.quantity - alreadyReturned;
      if (returnQty > remainingReturnable) {
        return ApiResponse.error(res, `Return quantity (${returnQty}) exceeds remaining returnable quantity (${remainingReturnable}) for ${saleItem.medicineName}`, 400);
      }

      // === CRITICAL: Use the HISTORICAL transaction value, never the current Product Master price ===
      // `finalItemAmount` is the item's contribution to the FINAL invoice total
      // after GST, item discount, invoice-level discount, and round-off allocation.
      // This is the true amount the customer paid for this item.
      const itemFinalAmount = Number(saleItem.finalItemAmount) || 0;
      const itemNetUnitPrice = Number(saleItem.netUnitPrice) || 0;

      // If historical fields are missing (legacy invoice), fall back to a
      // proportional allocation of the invoice grand total based on the item's
      // original `total` value. This preserves backward compatibility.
      let effectiveUnitPrice;
      if (itemNetUnitPrice > 0) {
        effectiveUnitPrice = itemNetUnitPrice;
      } else {
        const sumItemTotals = sale.items.reduce((s, i) => s + (i.total || 0), 0);
        const ratio = sumItemTotals > 0 ? (saleItem.total || 0) / sumItemTotals : 0;
        effectiveUnitPrice = Number(((saleItem.total || 0) - ratio * (sumItemTotals - sale.grandTotal)) / saleItem.quantity).toFixed(2);
      }

      // Return amount = returned qty × historical effective unit price
      const returnAmt = Number((returnQty * effectiveUnitPrice).toFixed(2));

      // Proportional GST/taxable amounts based on the item's original values
      const qtyRatio = returnQty / saleItem.quantity;
      const returnTaxable = Number(((saleItem.taxableAmount || saleItem.subtotal || 0) * qtyRatio).toFixed(2));
      const returnCgst = Number(((saleItem.cgstAmount || 0) * qtyRatio).toFixed(2));
      const returnSgst = Number(((saleItem.sgstAmount || 0) * qtyRatio).toFixed(2));
      const returnIgst = Number(((saleItem.igstAmount || 0) * qtyRatio).toFixed(2));
      const returnGst = Number(((saleItem.gstAmount || 0) * qtyRatio).toFixed(2));

      subtotal += returnAmt;
      taxableTotal += returnTaxable;
      cgstTotal += returnCgst;
      sgstTotal += returnSgst;
      igstTotal += returnIgst;
      gstTotal += returnGst;

      returnItems.push({
        medicine: saleItem.medicine,
        medicineName: saleItem.medicineName,
        batchNumber: saleItem.batchNumber || '',
        hsnCode: saleItem.hsnCode || '',
        returnedQuantity: returnQty,
        sellingPrice: Number(effectiveUnitPrice),
        taxableAmount: returnTaxable,
        gst: saleItem.gst || 0,
        cgstAmount: returnCgst,
        sgstAmount: returnSgst,
        igstAmount: returnIgst,
        gstAmount: returnGst,
        returnAmount: returnAmt,
      });
    }

    const returnNumber = await generateReturnNumber(req.pharmacyId);

    // Create the return record (with full GST reversal data)
    const [saleReturn] = await SaleReturn.create([{
      returnNumber,
      sale: sale._id,
      saleInvoiceNumber: sale.invoiceNumber,
      customer: sale.customer || null,
      customerName: sale.customerName,
      returnDate: new Date(),
      items: returnItems,
      subtotal,
      taxableAmount: Number(taxableTotal.toFixed(2)),
      cgstAmount: Number(cgstTotal.toFixed(2)),
      sgstAmount: Number(sgstTotal.toFixed(2)),
      igstAmount: Number(igstTotal.toFixed(2)),
      totalGst: Number(gstTotal.toFixed(2)),
      totalReturnAmount: Number(subtotal.toFixed(2)),
      reason: reason || '',
      pharmacyId: req.pharmacyId,
      createdBy: req.user._id,
    }], { session });

    // Increase stock for returned items
    for (const returnItem of returnItems) {
      const medicine = await Medicine.findById(returnItem.medicine).session(session);
      if (medicine) {
        medicine.currentStock += returnItem.returnedQuantity;
        await medicine.save({ session });
      }
    }

    // Update sale financials
    // Reduce paid amount proportionally
    const returnRatio = subtotal / sale.grandTotal;
    const paidReduction = sale.paidAmount * returnRatio;

    sale.grandTotal = Math.max(0, sale.grandTotal - subtotal);
    sale.paidAmount = Math.max(0, sale.paidAmount - paidReduction);
    sale.dueAmount = Math.max(0, sale.grandTotal - sale.paidAmount);
    sale.paymentStatus = sale.dueAmount <= 0 ? 'paid' : sale.paidAmount > 0 ? 'partial' : 'unpaid';
    // Update status to 'returned' only if ALL items are fully returned
    const allFullyReturned = sale.items.every(item => {
      const alreadyReturned = Number(item.returnedQuantity) || 0;
      const thisReturnQty = returnItems.find(ri => ri.medicine.toString() === item.medicine.toString())?.returnedQuantity || 0;
      return (alreadyReturned + thisReturnQty) >= item.quantity;
    });
    sale.status = allFullyReturned ? 'returned' : 'completed';

    // Track returned quantity on each sale item
    for (const returnItem of returnItems) {
      const saleItem = sale.items.find(
        si => si.medicine.toString() === returnItem.medicine.toString()
      );
      if (saleItem) {
        saleItem.returnedQuantity = (Number(saleItem.returnedQuantity) || 0) + returnItem.returnedQuantity;
      }
    }
    sale.notes = (sale.notes ? sale.notes + ' | ' : '') + `Returned on ${new Date().toISOString().split('T')[0]}: ${returnNumber}`;
    sale.updatedBy = req.user._id;
    await sale.save({ session });

    // Record a negative payment transaction for the return
    if (paidReduction > 0) {
      await PaymentTransaction.create([{
        sale: sale._id,
        customer: sale.customer || null,
        pharmacyId: req.pharmacyId,
        amount: -paidReduction,
        previousDue: sale.dueAmount + paidReduction,
        remainingDue: sale.dueAmount,
        paymentMethod: 'cash',
        notes: `Return adjustment: ${returnNumber} - ${reason || 'Items returned'}`,
        createdBy: req.user._id,
      }], { session });
    }

    // Update customer stats
    if (sale.customer) {
      await updateCustomerStats(sale.customer, req.pharmacyId, session);
    }

    await session.commitTransaction();

    // Fetch the complete return record for response
    const populatedReturn = await SaleReturn.findById(saleReturn._id)
      .populate('items.medicine', 'medicineName genericName unit')
      .populate('createdBy', 'name');

    return ApiResponse.success(res, populatedReturn, 'Sale return processed successfully', 201);
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc    Get return history for a sale
// @route   GET /api/sales/:id/returns
// @access  Private
export const getSaleReturns = async (req, res, next) => {
  try {
    const returns = await SaleReturn.find({
      sale: req.params.id,
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
// @route   GET /api/sales/returns/all
// @access  Private
export const getAllSaleReturns = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { search, startDate, endDate } = req.query;

    const query = { pharmacyId: req.pharmacyId };

    if (search) {
      query.$or = [
        { returnNumber: { $regex: search, $options: 'i' } },
        { saleInvoiceNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
      ];
    }
    if (startDate) query.returnDate = { ...query.returnDate, $gte: new Date(startDate) };
    if (endDate) query.returnDate = { ...query.returnDate, $lte: new Date(endDate) };

    const total = await SaleReturn.countDocuments(query);
    const returns = await SaleReturn.find(query)
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

// @desc    Get return history for a customer
// @route   GET /api/sales/customer/:customerId/returns
// @access  Private
export const getCustomerSaleReturns = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {
      customer: customerId,
      pharmacyId: req.pharmacyId,
    };

    const total = await SaleReturn.countDocuments(query);
    const returns = await SaleReturn.find(query)
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