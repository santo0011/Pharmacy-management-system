import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import Medicine from '../models/Medicine.js';
import Customer from '../models/Customer.js';
import Purchase from '../models/Purchase.js';
import SaleEditHistory from '../models/SaleEditHistory.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import ApiResponse from '../utils/apiResponse.js';

const generateInvoiceNumber = async (pharmacyId) => {
  const count = await Sale.countDocuments({ pharmacyId });
  const date = new Date();
  const prefix = `SALE-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
};

const deductStock = async (items, pharmacyId, session) => {
  for (const item of items) {
    const medicine = await Medicine.findById(item.medicine).session(session);
    if (!medicine) throw new Error(`Medicine ${item.medicineName} not found`);
    if (medicine.currentStock < item.quantity) {
      throw new Error(`Insufficient stock for ${medicine.medicineName}. Available: ${medicine.currentStock}, Required: ${item.quantity}`);
    }
    medicine.currentStock -= item.quantity;
    await medicine.save({ session });
  }
};

const revertStock = async (items, pharmacyId, session) => {
  for (const item of items) {
    const medicine = await Medicine.findById(item.medicine).session(session);
    if (medicine) {
      medicine.currentStock += item.quantity;
      await medicine.save({ session });
    }
  }
};

export const getSales = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { search, startDate, endDate, status, paymentMethod } = req.query;
    const query = { pharmacyId: req.pharmacyId, isDeleted: false };

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
      ];
    }
    if (startDate) query.saleDate = { ...query.saleDate, $gte: new Date(startDate) };
    if (endDate) query.saleDate = { ...query.saleDate, $lte: new Date(endDate) };
    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, sales, total, page, limit);
  } catch (error) {
    next(error);
  }
};

export const getSale = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false })
      .populate('items.medicine', 'medicineName genericName unit')
      .populate('pharmacyId', 'pharmacyName phone')
      .populate('createdBy', 'name');
    if (!sale) return ApiResponse.error(res, 'Sale not found', 404);
    return ApiResponse.success(res, sale);
  } catch (error) {
    next(error);
  }
};

// @desc    Get payment history for a specific sale
// @route   GET /api/sales/:id/payments
// @access  Private
export const getSalePayments = async (req, res, next) => {
  try {
    const payments = await PaymentTransaction.find({
      sale: req.params.id,
      pharmacyId: req.pharmacyId,
      isDeleted: false,
    })
      .populate('createdBy', 'name')
      .sort({ paymentDate: 1 });

    return ApiResponse.success(res, payments);
  } catch (error) {
    next(error);
  }
};

// @desc    Update an old invoice's paid/due amounts (used when previous due is included in a new sale)
// @access  Internal helper (not an endpoint)
const applyPaymentToOldInvoice = async (sale, amount, paymentMethod, userId, pharmacyId, session) => {
  sale.paidAmount += Number(amount);
  sale.dueAmount = Math.max(0, sale.grandTotal - sale.paidAmount);
  sale.paymentStatus = sale.dueAmount <= 0 ? 'paid' : 'partial';
  sale.updatedBy = userId;
  await sale.save({ session });

  // Record payment transaction for the old invoice
  await PaymentTransaction.create([{
    sale: sale._id,
    customer: sale.customer || null,
    pharmacyId,
    amount: Number(amount),
    previousDue: sale.dueAmount + Number(amount), // what the due was before this payment
    remainingDue: sale.dueAmount,
    paymentMethod: paymentMethod || 'cash',
    notes: 'Payment via new sale (previous due allocation)',
    createdBy: userId,
  }], { session });
};

export const createSale = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { customer, customerName, customerPhone, customerAddress, saleDate, items, discount, discountType, paidAmount, paymentMethod, notes, previousDuePayments } = req.body;

    if (!items || items.length === 0) return ApiResponse.error(res, 'At least one item is required', 400);
    if (!customerName || customerName.trim() === '' || customerName.trim() === 'Walk-in Customer') {
      return ApiResponse.error(res, 'Customer name is required. Please enter a valid customer name.', 400);
    }

    const invoiceNumber = await generateInvoiceNumber(req.pharmacyId);
    const parsedItems = JSON.parse(typeof items === 'string' ? items : JSON.stringify(items));

    let subtotal = 0;
    let taxAmount = 0;
    const saleItems = [];

    for (const item of parsedItems) {
      const medicine = await Medicine.findById(item.medicineId).session(session);
      if (!medicine) return ApiResponse.error(res, `Medicine not found: ${item.medicineName}`, 400);

      const qty = Number(item.quantity);
      if (qty <= 0) return ApiResponse.error(res, `Invalid quantity for ${medicine.medicineName}`, 400);
      if (medicine.currentStock < qty) {
        return ApiResponse.error(res, `Insufficient stock for ${medicine.medicineName}. Available: ${medicine.currentStock}`, 400);
      }

      const unitPrice = Number(item.sellingPrice) || medicine.sellingPrice;
      const gstPct = Number(item.gst) || medicine.gst || 0;
      const itemDiscount = Number(item.discount) || 0;
      const itemDiscountType = item.discountType || 'fixed';
      const itemSubtotal = qty * unitPrice;
      const itemDiscountAmt = itemDiscountType === 'percentage' ? itemSubtotal * (itemDiscount / 100) : itemDiscount;
      const itemTotal = itemSubtotal - itemDiscountAmt;
      const gstAmt = itemTotal * (gstPct / 100);

      subtotal += itemSubtotal;
      taxAmount += gstAmt;

      saleItems.push({
        medicine: medicine._id,
        medicineName: medicine.medicineName,
        batchNumber: item.batchNumber || medicine.batchNumber || '',
        quantity: qty,
        sellingPrice: unitPrice,
        purchasePrice: medicine.purchasePrice || 0,
        mrp: item.mrp || medicine.sellingPrice || 0,
        discount: itemDiscount,
        discountType: itemDiscountType,
        discountAmount: itemDiscountAmt,
        subtotal: itemSubtotal,
        gst: gstPct,
        gstAmount: gstAmt,
        total: itemTotal + gstAmt,
      });
    }

    const overallDiscount = Number(discount) || 0;
    const overallDiscountType = discountType || 'fixed';
    const discountAmount = overallDiscountType === 'percentage' ? subtotal * (overallDiscount / 100) : overallDiscount;
    const newInvoiceGrandTotal = subtotal + taxAmount - discountAmount;

    // totalPaidFromCustomer = the actual cash/amount the customer gives (this may include payment for previous due + new invoice)
    const totalPaidFromCustomer = Number(paidAmount) || newInvoiceGrandTotal;

    // --- Previous Due Allocation (FIFO) ---
    // previousDuePayments is an array of { saleId, amount } from the frontend
    // These represent payments allocated to old invoices before paying the new invoice
    let oldInvoiceTotalPaid = 0;
    if (previousDuePayments && Array.isArray(previousDuePayments) && previousDuePayments.length > 0) {
      // Validate that total previous due payments don't exceed the total amount paid by customer
      const totalPreviousDuePayment = previousDuePayments.reduce((sum, p) => sum + Number(p.amount), 0);
      if (totalPreviousDuePayment > totalPaidFromCustomer) {
        return ApiResponse.error(res, `Previous due allocation (₹${totalPreviousDuePayment.toFixed(2)}) exceeds total paid amount (₹${totalPaidFromCustomer.toFixed(2)})`, 400);
      }

      // Process each old invoice payment
      for (const prevPay of previousDuePayments) {
        const oldSale = await Sale.findOne({
          _id: prevPay.saleId,
          pharmacyId: req.pharmacyId,
          isDeleted: false,
          status: { $nin: ['cancelled', 'returned'] },
          dueAmount: { $gt: 0 },
        }).session(session);

        if (!oldSale) {
          return ApiResponse.error(res, `Old invoice ${prevPay.saleId} not found or already paid`, 400);
        }

        const payAmount = Number(prevPay.amount);
        if (payAmount <= 0) continue;
        if (payAmount > oldSale.dueAmount) {
          return ApiResponse.error(res, `Payment of ₹${payAmount.toFixed(2)} exceeds due of ₹${oldSale.dueAmount.toFixed(2)} for invoice ${oldSale.invoiceNumber}`, 400);
        }

        // Apply this payment to the old invoice
        await applyPaymentToOldInvoice(oldSale, payAmount, paymentMethod || 'cash', req.user._id, req.pharmacyId, session);
        oldInvoiceTotalPaid += payAmount;
      }
    }

    // Remaining paid amount goes to the new invoice
    const paidForNewInvoice = totalPaidFromCustomer - oldInvoiceTotalPaid;
    // Validate the amount allocated to the new invoice doesn't exceed the new invoice grand total
    // (totalPaidFromCustomer must not exceed newInvoiceGrandTotal + oldInvoiceTotalPaid)
    if (paidForNewInvoice > newInvoiceGrandTotal) {
      return ApiResponse.error(res, `Paid amount for new invoice (₹${paidForNewInvoice.toFixed(2)}) exceeds Grand Total (₹${newInvoiceGrandTotal.toFixed(2)}). The total paid (₹${totalPaidFromCustomer.toFixed(2)}) minus previous due allocation (₹${oldInvoiceTotalPaid.toFixed(2)}) cannot exceed the new invoice amount.`, 400);
    }
    if (paidForNewInvoice < 0) {
      return ApiResponse.error(res, `Paid amount (₹${totalPaidFromCustomer.toFixed(2)}) is less than previous due allocation (₹${oldInvoiceTotalPaid.toFixed(2)}). Increase the paid amount.`, 400);
    }
    const dueForNewInvoice = newInvoiceGrandTotal - paidForNewInvoice;

    // If customer ref is provided, look up the customer
    let customerDoc = null;
    if (customer) {
      customerDoc = await Customer.findOne({ _id: customer, pharmacyId: req.pharmacyId, isDeleted: false }).session(session);
    }

    const [sale] = await Sale.create([{
      invoiceNumber,
      customer: customerDoc?._id || null,
      customerName: customerName || 'Walk-in Customer',
      customerPhone: customerPhone || '',
      customerAddress: customerAddress || '',
      saleDate: saleDate || new Date(),
      items: saleItems,
      subtotal,
      discount: overallDiscount,
      discountType: overallDiscountType,
      discountAmount,
      taxAmount,
      grandTotal: newInvoiceGrandTotal,
      previousDueAmount: oldInvoiceTotalPaid,
      previousDuePaid: oldInvoiceTotalPaid,
      paidAmount: paidForNewInvoice,
      dueAmount: Math.max(0, dueForNewInvoice),
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: dueForNewInvoice <= 0 ? 'paid' : paidForNewInvoice > 0 ? 'partial' : 'unpaid',
      isStockDeducted: true,
      pharmacyId: req.pharmacyId,
      createdBy: req.user._id,
    }], { session });

    // Record initial payment transaction for the new sale (only if amount > 0)
    if (paidForNewInvoice > 0) {
      await PaymentTransaction.create([{
        sale: sale._id,
        customer: customerDoc?._id || null,
        pharmacyId: req.pharmacyId,
        amount: paidForNewInvoice,
        previousDue: newInvoiceGrandTotal,
        remainingDue: dueForNewInvoice,
        paymentMethod: paymentMethod || 'cash',
        notes: oldInvoiceTotalPaid > 0
          ? `Initial payment at sale creation (₹${oldInvoiceTotalPaid.toFixed(2)} allocated to previous due)`
          : 'Initial payment at sale creation',
        createdBy: req.user._id,
      }], { session });
    }

    // Deduct stock
    await deductStock(saleItems, req.pharmacyId, session);

    // Update customer stats if customer ref exists
    if (customerDoc) {
      const customerStats = await Sale.aggregate([
        { $match: { customer: customerDoc._id, pharmacyId: req.pharmacyId, isDeleted: false, status: { $nin: ['cancelled', 'returned'] } } },
        {
          $group: {
            _id: null,
            totalPurchases: { $sum: 1 },
            totalSpent: { $sum: '$grandTotal' },
            lastPurchaseDate: { $max: '$saleDate' },
          },
        },
      ]);
      if (customerStats.length > 0) {
        customerDoc.totalPurchases = customerStats[0].totalPurchases;
        customerDoc.totalSpent = customerStats[0].totalSpent;
        customerDoc.lastPurchaseDate = customerStats[0].lastPurchaseDate;
        await customerDoc.save({ session });
      }
    }

    await session.commitTransaction();

    // Fetch the complete sale with populated data for the response
    const populatedSale = await Sale.findById(sale._id)
      .populate('items.medicine', 'medicineName genericName unit')
      .populate('pharmacyId', 'pharmacyName phone')
      .populate('createdBy', 'name');

    return ApiResponse.success(res, populatedSale, 'Sale created successfully', 201);
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc    Update sale (edit items, prices, etc.)
// @route   PUT /api/sales/:id
// @access  Private
export const updateSale = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sale = await Sale.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false }).session(session);
    if (!sale) return ApiResponse.error(res, 'Sale not found', 404);
    if (sale.status !== 'completed') {
      return ApiResponse.error(res, 'Can only edit completed sales', 400);
    }

    // Snapshot before for edit history
    const snapshotBefore = {
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      items: sale.items.map(i => ({
        medicineName: i.medicineName,
        quantity: i.quantity,
        sellingPrice: i.sellingPrice,
        discount: i.discount,
        discountType: i.discountType,
        discountAmount: i.discountAmount,
        gst: i.gst,
        total: i.total,
      })),
      subtotal: sale.subtotal,
      discount: sale.discount,
      discountType: sale.discountType,
      discountAmount: sale.discountAmount,
      taxAmount: sale.taxAmount,
      grandTotal: sale.grandTotal,
      paidAmount: sale.paidAmount,
      dueAmount: sale.dueAmount,
      paymentMethod: sale.paymentMethod,
      paymentStatus: sale.paymentStatus,
      notes: sale.notes,
    };

    // Revert old stock first
    if (sale.isStockDeducted) {
      await revertStock(sale.items, req.pharmacyId, session);
    }

    const { customerName, customerPhone, items, discount, discountType, paidAmount, paymentMethod, notes, reason } = req.body;

    if (!items || items.length === 0) {
      // Re-deduct since we already reverted
      if (sale.isStockDeducted) await deductStock(sale.items, req.pharmacyId, session);
      return ApiResponse.error(res, 'At least one item is required', 400);
    }

    const parsedItems = JSON.parse(typeof items === 'string' ? items : JSON.stringify(items));

    let subtotal = 0;
    let taxAmount = 0;
    const saleItems = [];

    for (const item of parsedItems) {
      const medicine = await Medicine.findById(item.medicineId).session(session);
      if (!medicine) {
        if (sale.isStockDeducted) await deductStock(sale.items, req.pharmacyId, session);
        return ApiResponse.error(res, `Medicine not found: ${item.medicineName}`, 400);
      }

      const qty = Number(item.quantity);
      if (qty <= 0) {
        if (sale.isStockDeducted) await deductStock(sale.items, req.pharmacyId, session);
        return ApiResponse.error(res, `Invalid quantity for ${medicine.medicineName}`, 400);
      }
      if (medicine.currentStock < qty) {
        if (sale.isStockDeducted) await deductStock(sale.items, req.pharmacyId, session);
        return ApiResponse.error(res, `Insufficient stock for ${medicine.medicineName}. Available: ${medicine.currentStock}`, 400);
      }

      const unitPrice = Number(item.sellingPrice) || medicine.sellingPrice;
      const gstPct = Number(item.gst) || medicine.gst || 0;
      const itemDiscount = Number(item.discount) || 0;
      const itemDiscountType = item.discountType || 'fixed';
      const itemSubtotal = qty * unitPrice;
      const itemDiscountAmt = itemDiscountType === 'percentage' ? itemSubtotal * (itemDiscount / 100) : itemDiscount;
      const itemTotal = itemSubtotal - itemDiscountAmt;
      const gstAmt = itemTotal * (gstPct / 100);

      subtotal += itemSubtotal;
      taxAmount += gstAmt;

      saleItems.push({
        medicine: medicine._id,
        medicineName: medicine.medicineName,
        batchNumber: item.batchNumber || medicine.batchNumber || '',
        quantity: qty,
        sellingPrice: unitPrice,
        purchasePrice: medicine.purchasePrice || 0,
        mrp: item.mrp || medicine.sellingPrice || 0,
        discount: itemDiscount,
        discountType: itemDiscountType,
        discountAmount: itemDiscountAmt,
        subtotal: itemSubtotal,
        gst: gstPct,
        gstAmount: gstAmt,
        total: itemTotal + gstAmt,
      });
    }

    const overallDiscount = Number(discount) || 0;
    const overallDiscountType = discountType || 'fixed';
    const discountAmount = overallDiscountType === 'percentage' ? subtotal * (overallDiscount / 100) : overallDiscount;
    const grandTotal = subtotal + taxAmount - discountAmount;
    const paid = Number(paidAmount) !== undefined ? Number(paidAmount) : grandTotal;
    const due = grandTotal - paid;

    sale.set({
      customerName: customerName || sale.customerName,
      customerPhone: customerPhone !== undefined ? customerPhone : sale.customerPhone,
      items: saleItems,
      subtotal,
      discount: overallDiscount,
      discountType: overallDiscountType,
      discountAmount,
      taxAmount,
      grandTotal,
      paidAmount: paid,
      dueAmount: Math.max(0, due),
      paymentMethod: paymentMethod || sale.paymentMethod,
      paymentStatus: due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      notes: notes !== undefined ? notes : sale.notes,
      isStockDeducted: true,
      updatedBy: req.user._id,
    });

    await sale.save({ session });

    // Snapshot after for edit history
    const snapshotAfter = {
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      items: saleItems.map(i => ({
        medicineName: i.medicineName,
        quantity: i.quantity,
        sellingPrice: i.sellingPrice,
        discount: i.discount,
        discountType: i.discountType,
        discountAmount: i.discountAmount,
        gst: i.gst,
        total: i.total,
      })),
      subtotal,
      discount: overallDiscount,
      discountType: overallDiscountType,
      discountAmount,
      taxAmount,
      grandTotal,
      paidAmount: paid,
      dueAmount: Math.max(0, due),
      paymentMethod: paymentMethod || sale.paymentMethod,
      paymentStatus: due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      notes: notes !== undefined ? notes : sale.notes,
    };

    // Compute changes
    const changes = [];
    
    // Check header fields
    if (snapshotBefore.customerName !== snapshotAfter.customerName) {
      changes.push({ field: 'customerName', label: 'Customer Name', previousValue: snapshotBefore.customerName, newValue: snapshotAfter.customerName, changeType: 'modified' });
    }
    if (snapshotBefore.customerPhone !== snapshotAfter.customerPhone) {
      changes.push({ field: 'customerPhone', label: 'Phone', previousValue: snapshotBefore.customerPhone, newValue: snapshotAfter.customerPhone, changeType: 'modified' });
    }
    if (snapshotBefore.subtotal !== snapshotAfter.subtotal) {
      changes.push({ field: 'subtotal', label: 'Subtotal', previousValue: snapshotBefore.subtotal, newValue: snapshotAfter.subtotal, changeType: 'modified' });
    }
    if (snapshotBefore.taxAmount !== snapshotAfter.taxAmount) {
      changes.push({ field: 'taxAmount', label: 'Tax Amount', previousValue: snapshotBefore.taxAmount, newValue: snapshotAfter.taxAmount, changeType: 'modified' });
    }
    if (snapshotBefore.discountAmount !== snapshotAfter.discountAmount) {
      changes.push({ field: 'discountAmount', label: 'Discount', previousValue: snapshotBefore.discountAmount, newValue: snapshotAfter.discountAmount, changeType: 'discount_change' });
    }
    if (snapshotBefore.grandTotal !== snapshotAfter.grandTotal) {
      changes.push({ field: 'grandTotal', label: 'Grand Total', previousValue: snapshotBefore.grandTotal, newValue: snapshotAfter.grandTotal, changeType: 'total_change' });
    }
    if (snapshotBefore.paidAmount !== snapshotAfter.paidAmount) {
      changes.push({ field: 'paidAmount', label: 'Paid Amount', previousValue: snapshotBefore.paidAmount, newValue: snapshotAfter.paidAmount, changeType: 'modified' });
    }
    if (snapshotBefore.dueAmount !== snapshotAfter.dueAmount) {
      changes.push({ field: 'dueAmount', label: 'Due Amount', previousValue: snapshotBefore.dueAmount, newValue: snapshotAfter.dueAmount, changeType: 'modified' });
    }
    if (snapshotBefore.paymentMethod !== snapshotAfter.paymentMethod) {
      changes.push({ field: 'paymentMethod', label: 'Payment Method', previousValue: snapshotBefore.paymentMethod, newValue: snapshotAfter.paymentMethod, changeType: 'modified' });
    }

    // Check item-level changes
    const beforeItemMap = {};
    snapshotBefore.items.forEach((item, idx) => {
      beforeItemMap[`${item.medicineName}_${idx}`] = item;
    });

    snapshotAfter.items.forEach((afterItem, idx) => {
      const beforeItem = snapshotBefore.items[idx];
      if (!beforeItem) {
        // New item added
        changes.push({ field: `items[${idx}].medicineName`, label: `Added Medicine`, previousValue: null, newValue: afterItem.medicineName, changeType: 'added' });
        changes.push({ field: `items[${idx}].quantity`, label: `${afterItem.medicineName} Qty`, previousValue: 0, newValue: afterItem.quantity, changeType: 'quantity_change' });
      } else if (beforeItem.medicineName === afterItem.medicineName) {
        if (beforeItem.quantity !== afterItem.quantity) {
          changes.push({ field: `items[${idx}].quantity`, label: `${afterItem.medicineName} Qty`, previousValue: beforeItem.quantity, newValue: afterItem.quantity, changeType: 'quantity_change' });
        }
        if (beforeItem.sellingPrice !== afterItem.sellingPrice) {
          changes.push({ field: `items[${idx}].sellingPrice`, label: `${afterItem.medicineName} Price`, previousValue: beforeItem.sellingPrice, newValue: afterItem.sellingPrice, changeType: 'price_change' });
        }
      } else {
        // Item changed to different medicine
        changes.push({ field: `items[${idx}].medicineName`, label: `Medicine Changed`, previousValue: beforeItem.medicineName, newValue: afterItem.medicineName, changeType: 'modified' });
      }
    });

    // Check removed items
    if (snapshotAfter.items.length < snapshotBefore.items.length) {
      for (let i = snapshotAfter.items.length; i < snapshotBefore.items.length; i++) {
        changes.push({ field: `items[${i}].medicineName`, label: `Removed Medicine`, previousValue: snapshotBefore.items[i]?.medicineName, newValue: null, changeType: 'removed' });
      }
    }

    // Save edit history
    await SaleEditHistory.create([{
      sale: sale._id,
      pharmacyId: req.pharmacyId,
      editedBy: req.user._id,
      editedByName: req.user.name || 'Unknown',
      reason: reason || '',
      changes,
      snapshotBefore: snapshotBefore,
      snapshotAfter: snapshotAfter,
    }], { session });

    // Deduct new stock
    await deductStock(saleItems, req.pharmacyId, session);

    await session.commitTransaction();
    return ApiResponse.success(res, sale, 'Sale updated successfully');
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

export const deleteSale = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sale = await Sale.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false }).session(session);
    if (!sale) return ApiResponse.error(res, 'Sale not found', 404);
    if (sale.status === 'returned') return ApiResponse.error(res, 'Sale already returned', 400);

    // Revert stock on cancellation
    if (sale.isStockDeducted) {
      await revertStock(sale.items, req.pharmacyId, session);
    }

    // Clear financials since the sale is being reversed
    sale.paidAmount = 0;
    sale.dueAmount = 0;
    sale.paymentStatus = 'paid';
    sale.status = 'cancelled';
    sale.isStockDeducted = false;
    sale.notes = (sale.notes ? sale.notes + ' | ' : '') + 'Cancelled on ' + new Date().toISOString().split('T')[0];
    sale.updatedBy = req.user._id;
    await sale.save({ session });

    await session.commitTransaction();
    return ApiResponse.success(res, sale, 'Sale cancelled successfully');
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

export const returnSale = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sale = await Sale.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false }).session(session);
    if (!sale) return ApiResponse.error(res, 'Sale not found', 404);
    if (sale.status === 'returned') return ApiResponse.error(res, 'Sale already returned', 400);

    // Revert stock
    await revertStock(sale.items, req.pharmacyId, session);

    // Clear financials since the sale is being reversed
    sale.paidAmount = 0;
    sale.dueAmount = 0;
    sale.paymentStatus = 'paid';
    sale.status = 'returned';
    sale.isStockDeducted = false;
    sale.notes = (sale.notes ? sale.notes + ' | ' : '') + 'Returned on ' + new Date().toISOString();
    sale.updatedBy = req.user._id;
    await sale.save({ session });

    await session.commitTransaction();
    return ApiResponse.success(res, sale, 'Sale returned successfully');
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc    Get sale edit history
// @route   GET /api/sales/:id/history
// @access  Private
export const getSaleEditHistory = async (req, res, next) => {
  try {
    const history = await SaleEditHistory.find({
      sale: req.params.id,
      pharmacyId: req.pharmacyId,
    })
      .populate('editedBy', 'name')
      .sort({ createdAt: -1 });
    
    return ApiResponse.success(res, history);
  } catch (error) {
    next(error);
  }
};

export const getSaleStats = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const activeStatus = { $nin: ['cancelled', 'returned'] };
    const pipeline = (matchDate) => [
      { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, saleDate: { $gte: matchDate }, status: activeStatus } },
      { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 }, profit: { $sum: { $subtract: ['$grandTotal', { $sum: '$items.purchasePrice' }] } } } },
    ];

    const [totalSale, monthlySale, todaySale, weeklySale, yearlySale, dailySales, monthlyRevenue, monthlyPurchaseVsSale, paymentMethodStats] = await Promise.all([
      Sale.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: activeStatus } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 }, totalPaid: { $sum: '$paidAmount' }, totalDue: { $sum: '$dueAmount' } } },
      ]),
      Sale.aggregate(pipeline(startOfMonth)),
      Sale.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, saleDate: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }, status: activeStatus } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),
      Sale.aggregate(pipeline(last7Days)),
      Sale.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, saleDate: { $gte: startOfYear }, status: activeStatus } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),
      // Daily sales trend (last 30 days)
      Sale.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, saleDate: { $gte: last30Days }, status: activeStatus } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } }, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      // Monthly revenue (current year)
      Sale.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, saleDate: { $gte: startOfYear }, status: activeStatus } },
        { $group: { _id: { $month: '$saleDate' }, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      // Monthly purchase vs sale
      (async () => {
        const purchases = await Purchase.aggregate([
          { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, purchaseDate: { $gte: startOfYear }, status: { $ne: 'cancelled' } } },
          { $group: { _id: { $month: '$purchaseDate' }, total: { $sum: '$grandTotal' } } },
          { $sort: { _id: 1 } },
        ]);
        const sales = await Sale.aggregate([
          { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, saleDate: { $gte: startOfYear }, status: activeStatus } },
          { $group: { _id: { $month: '$saleDate' }, total: { $sum: '$grandTotal' } } },
          { $sort: { _id: 1 } },
        ]);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months.map((m, i) => {
          const monthNum = i + 1;
          const p = purchases.find(p => p._id === monthNum);
          const s = sales.find(s => s._id === monthNum);
          return { month: m, purchaseTotal: p?.total || 0, saleTotal: s?.total || 0 };
        });
      })(),
      // Payment method stats
      Sale.aggregate([
        { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: activeStatus } },
        { $group: { _id: '$paymentMethod', total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),
    ]);

    // Top selling medicines
    const topMedicines = await Sale.aggregate([
      { $match: { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: activeStatus } },
      { $unwind: '$items' },
      { $group: { _id: '$items.medicineName', totalQty: { $sum: '$items.quantity' }, totalRevenue: { $sum: '$items.total' } } },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
    ]);

    // Recent sales
    const recentSales = await Sale.find({ pharmacyId, isDeleted: false, status: activeStatus })
      .sort({ createdAt: -1 }).limit(5)
      .select('invoiceNumber customerName grandTotal paidAmount dueAmount paymentMethod saleDate');

    return ApiResponse.success(res, {
      totalAmount: totalSale[0]?.total || 0,
      totalSales: totalSale[0]?.count || 0,
      totalPaid: totalSale[0]?.totalPaid || 0,
      totalDue: totalSale[0]?.totalDue || 0,
      monthlyAmount: monthlySale[0]?.total || 0,
      monthlySales: monthlySale[0]?.count || 0,
      monthlyProfit: monthlySale[0]?.profit || 0,
      todayAmount: todaySale[0]?.total || 0,
      todaySales: todaySale[0]?.count || 0,
      weeklyAmount: weeklySale[0]?.total || 0,
      weeklySales: weeklySale[0]?.count || 0,
      weeklyProfit: weeklySale[0]?.profit || 0,
      yearlyAmount: yearlySale[0]?.total || 0,
      yearlySales: yearlySale[0]?.count || 0,
      dailySales: dailySales.map(d => ({ date: d._id, amount: d.total, count: d.count })),
      monthlyRevenue: monthlyRevenue.map(m => ({ month: m._id, amount: m.total, count: m.count })),
      monthlyPurchaseVsSale,
      topMedicines,
      paymentMethodStats: paymentMethodStats.map(p => ({ method: p._id, total: p.total, count: p.count })),
      recentSales,
    });
  } catch (error) {
    next(error);
  }
};