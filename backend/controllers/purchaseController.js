import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import Medicine from '../models/Medicine.js';
import Supplier from '../models/Supplier.js';
import Pharmacy from '../models/Pharmacy.js';
import PurchasePayment from '../models/PurchasePayment.js';
import ApiResponse from '../utils/apiResponse.js';
import {
  calculateItemGST,
  getStateCode,
  getStateCodeFromGSTIN,
  isIntraState,
  resolveGstRate,
} from '../utils/gstHelper.js';

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

// Record payment and update due invoices if included
const recordPaymentWithInvoices = async ({ purchase, amount, paymentMethod, paymentDate, notes, selectedDueInvoices, pharmacyId, userId, session }) => {
  // Record main payment for this purchase
  const payment = await PurchasePayment.create([{
    purchase: purchase._id,
    supplier: purchase.supplier,
    supplierName: purchase.supplierName,
    pharmacyId,
    amount: Number(amount),
    paymentMethod: paymentMethod || 'cash',
    paymentDate: paymentDate || new Date(),
    notes: notes || '',
    createdBy: userId,
  }], { session });

  // Update current purchase
  purchase.paidAmount += Number(amount);
  purchase.dueAmount = Math.max(0, purchase.grandTotal - purchase.paidAmount);
  purchase.paymentStatus = purchase.dueAmount <= 0 ? 'paid' : 'partial';
  await purchase.save({ session });

  // If there's remaining amount after paying current purchase, apply to selected due invoices
  let remaining = Number(amount);
  const purchaseDue = Math.max(0, purchase.grandTotal - (purchase.paidAmount - Number(amount)));
  remaining -= purchaseDue;

  if (remaining > 0 && selectedDueInvoices && selectedDueInvoices.length > 0) {
    // Sort due invoices by date (oldest first)
    const dueInvoices = await Purchase.find({
      _id: { $in: selectedDueInvoices.map(id => new mongoose.Types.ObjectId(id)) },
      pharmacyId,
      isDeleted: false,
      status: { $nin: ['cancelled', 'returned'] },
      dueAmount: { $gt: 0 },
    }).sort({ purchaseDate: 1 }).session(session);

    for (const dueInvoice of dueInvoices) {
      if (remaining <= 0) break;
      const payAmount = Math.min(remaining, dueInvoice.dueAmount);
      if (payAmount > 0) {
        // Record payment for due invoice
        await PurchasePayment.create([{
          purchase: dueInvoice._id,
          supplier: dueInvoice.supplier,
          supplierName: dueInvoice.supplierName,
          pharmacyId,
          amount: payAmount,
          paymentMethod: paymentMethod || 'cash',
          paymentDate: paymentDate || new Date(),
          notes: `Auto-payment from purchase ${purchase.invoiceNumber}`,
          createdBy: userId,
        }], { session });

        dueInvoice.paidAmount += payAmount;
        dueInvoice.dueAmount = Math.max(0, dueInvoice.grandTotal - dueInvoice.paidAmount);
        dueInvoice.paymentStatus = dueInvoice.dueAmount <= 0 ? 'paid' : 'partial';
        await dueInvoice.save({ session });
        remaining -= payAmount;
      }
    }
  }

  return payment[0];
};

export const getPurchases = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { search, startDate, endDate, status, supplier, paymentStatus } = req.query;
    const query = { pharmacyId: req.pharmacyId, isDeleted: false };

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
      ];

      // Also find suppliers matching the search term and include purchases from those suppliers
      const matchingSuppliers = await Supplier.find({
        pharmacyId: req.pharmacyId,
        $or: [
          { supplierName: { $regex: search, $options: 'i' } },
          { companyName: { $regex: search, $options: 'i' } },
        ],
      }).select('_id').lean();

      if (matchingSuppliers.length > 0) {
        const supplierIds = matchingSuppliers.map(s => s._id);
        query.$or.push({ supplier: { $in: supplierIds } });
      }
    }
    if (startDate) query.purchaseDate = { ...query.purchaseDate, $gte: new Date(startDate) };
    if (endDate) query.purchaseDate = { ...query.purchaseDate, $lte: new Date(endDate) };
    if (status) query.status = status;
    if (supplier) query.supplier = supplier;
    if (paymentStatus) query.paymentStatus = paymentStatus;

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

    const payments = await PurchasePayment.find({ purchase: purchase._id, pharmacyId: req.pharmacyId })
      .populate('createdBy', 'name')
      .sort({ paymentDate: -1 });

    return ApiResponse.success(res, { purchase, payments });
  } catch (error) {
    next(error);
  }
};

export const createPurchase = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { purchaseDate, supplier, supplierName, items, discount, discountType, shippingCost, otherCost, paidAmount, paymentMethod, notes, selectedDueInvoices } = req.body;
    const invoiceAttachment = req.file ? `/uploads/purchases/${req.file.filename}` : '';

    if (!items || items.length === 0) return ApiResponse.error(res, 'At least one item is required', 400);

    const invoiceNumber = await generateInvoiceNumber(req.pharmacyId);
    const parsedItems = JSON.parse(typeof items === 'string' ? items : JSON.stringify(items));
    // When using multipart/form-data, selectedDueInvoices arrives as a JSON string
    let parsedSelectedDueInvoices = selectedDueInvoices;
    if (typeof selectedDueInvoices === 'string' && selectedDueInvoices) {
      try { parsedSelectedDueInvoices = JSON.parse(selectedDueInvoices); } catch { parsedSelectedDueInvoices = undefined; }
    }

    // Get pharmacy state code for GST calculation
    const pharmacy = await Pharmacy.findById(req.pharmacyId).session(session);
    const pharmacyStateCode = pharmacy?.stateCode || getStateCode(pharmacy?.state) || '';
    const defaultGstRate = Number(pharmacy?.defaultGstRate) || 0;

    // Get supplier state code
    let supplierStateCode = '';
    let supplierGstin = '';
    if (supplier) {
      const supplierDoc = await Supplier.findById(supplier).session(session);
      if (supplierDoc) {
        supplierStateCode = supplierDoc.stateCode || getStateCode(supplierDoc.state) || getStateCodeFromGSTIN(supplierDoc.gstin) || '';
        supplierGstin = supplierDoc.gstin || '';
      }
    }
    if (!supplierStateCode) {
      supplierStateCode = req.body.supplierStateCode || getStateCode(req.body.supplierState) || '';
    }

    const intraState = isIntraState(pharmacyStateCode, supplierStateCode);

    let subtotal = 0;
    let taxAmount = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let taxableTotal = 0;
    const purchaseItems = [];

    for (const item of parsedItems) {
      let medicine;
      if (item.medicineId) {
        medicine = await Medicine.findById(item.medicineId).session(session);
      } else if (item.barcode) {
        medicine = await Medicine.findOne({ barcode: item.barcode, pharmacyId: req.pharmacyId }).session(session);
      }

      if (!medicine) {
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
          hsnCode: item.hsnCode || '',
          taxInclusive: item.taxInclusive || false,
          medicineType: item.medicineType || 'Allopathic',
          manufacturer: item.manufacturer || '',
          mrp: item.mrp || 0,
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
      // GST Priority: Product GST > 0 → use product GST; Product GST = 0 → use pharmacy Default GST
      const gstPct = resolveGstRate(Number(item.gst) || 0, defaultGstRate);
      const isTaxInclusive = medicine.taxInclusive || false;

      // Use centralized GST helper
      const calc = calculateItemGST({
        quantity: qty,
        price,
        gstPct,
        discount: 0,
        discountType: 'fixed',
        isTaxInclusive,
        pharmacyStateCode,
        otherPartyStateCode: supplierStateCode,
      });

      subtotal += calc.rawSubtotal;
      taxAmount += calc.gstAmount;
      cgstTotal += calc.cgst;
      sgstTotal += calc.sgst;
      igstTotal += calc.igst;
      taxableTotal += calc.taxableAmount;

      purchaseItems.push({
        medicine: medicine._id,
        medicineName: medicine.medicineName,
        batchNumber: item.batchNumber || medicine.batchNumber,
        hsnCode: medicine.hsnCode || '',
        quantity: qty,
        purchasePrice: calc.unitPrice,
        sellingPrice: Number(item.sellingPrice) || medicine.sellingPrice,
        mrp: Number(item.mrp) || 0,
        expiryDate: item.expiryDate,
        manufacturingDate: item.manufacturingDate || null,
        subtotal: calc.rawSubtotal,
        taxableAmount: calc.taxableAmount,
        gst: gstPct,
        cgstAmount: calc.cgst,
        sgstAmount: calc.sgst,
        igstAmount: calc.igst,
        gstAmount: calc.gstAmount,
      });
    }

    const discountAmount = discountType === 'percentage' ? taxableTotal * (Number(discount) / 100) : Number(discount) || 0;

    // Recalculate GST after overall discount
    const finalTaxable = Math.max(0, taxableTotal - discountAmount);
    const gstRateUsed = taxableTotal > 0 ? (taxAmount / Math.max(taxableTotal, 0.01)) * 100 : 0;
    const finalGst = Number((finalTaxable * (gstRateUsed / 100)).toFixed(2));

    let finalCgst = 0, finalSgst = 0, finalIgst = 0;
    if (intraState) {
      finalCgst = Number((finalGst / 2).toFixed(2));
      finalSgst = Number((finalGst - finalCgst).toFixed(2));
    } else {
      finalIgst = finalGst;
    }

    const grandTotal = Number((finalTaxable + finalGst + Number(shippingCost || 0) + Number(otherCost || 0)).toFixed(2));
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
      taxableAmount: finalTaxable,
      taxAmount: finalGst,
      cgstAmount: finalCgst,
      sgstAmount: finalSgst,
      igstAmount: finalIgst,
      isIntraState: intraState,
      supplierStateCode,
      supplierGstin,
      shippingCost: Number(shippingCost) || 0,
      otherCost: Number(otherCost) || 0,
      grandTotal,
      paidAmount: paid,
      dueAmount: Math.max(0, due),
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      invoiceAttachment,
      isStockUpdated: true,
      pharmacyId: req.pharmacyId,
      createdBy: req.user._id,
    }], { session });

    // Update stock
    await updateStockForPurchase(purchaseItems, req.pharmacyId, session);

    // Record payment with potential due invoice payments
    if (paid > 0) {
      await recordPaymentWithInvoices({
        purchase,
        amount: paid,
        paymentMethod: paymentMethod || 'cash',
        paymentDate: new Date(),
        notes: notes || 'Initial payment',
        selectedDueInvoices: parsedSelectedDueInvoices,
        pharmacyId: req.pharmacyId,
        userId: req.user._id,
        session,
      });
    }

    // Update supplier financials
    if (supplier) {
      await updateSupplierFinancials(supplier, req.pharmacyId, session);
    }

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

    if (purchase.isStockUpdated) {
      await revertStockForPurchase(purchase.items, req.pharmacyId, session);
    }

    const { purchaseDate, supplier, supplierName, items, discount, discountType, shippingCost, otherCost, paidAmount, paymentMethod, notes, selectedDueInvoices } = req.body;
    const invoiceAttachment = req.file ? `/uploads/purchases/${req.file.filename}` : purchase.invoiceAttachment || '';
    const parsedItems = JSON.parse(typeof items === 'string' ? items : JSON.stringify(items));
    // When using multipart/form-data, selectedDueInvoices arrives as a JSON string
    let parsedSelectedDueInvoices = selectedDueInvoices;
    if (typeof selectedDueInvoices === 'string' && selectedDueInvoices) {
      try { parsedSelectedDueInvoices = JSON.parse(selectedDueInvoices); } catch { parsedSelectedDueInvoices = undefined; }
    }

    // Get pharmacy state code for GST calculation
    const pharmacy = await Pharmacy.findById(req.pharmacyId).session(session);
    const pharmacyStateCode = pharmacy?.stateCode || getStateCode(pharmacy?.state) || '';
    const defaultGstRate = Number(pharmacy?.defaultGstRate) || 0;
    const supplierStateCode = purchase.supplierStateCode || '';

    const intraState = isIntraState(pharmacyStateCode, supplierStateCode);

    let subtotal = 0;
    let taxAmount = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let taxableTotal = 0;
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
          hsnCode: item.hsnCode || '',
          currentStock: 0,
          pharmacyId: req.pharmacyId,
          createdBy: req.user._id,
        }], { session });
        medicine = medicine[0];
      }

      const qty = Number(item.quantity);
      const price = Number(item.purchasePrice);
      // GST Priority: Product GST > 0 → use product GST; Product GST = 0 → use pharmacy Default GST
      const gstPct = resolveGstRate(Number(item.gst) || 0, defaultGstRate);
      const isTaxInclusive = medicine.taxInclusive || false;

      // Use centralized GST helper
      const calc = calculateItemGST({
        quantity: qty,
        price,
        gstPct,
        discount: 0,
        discountType: 'fixed',
        isTaxInclusive,
        pharmacyStateCode,
        otherPartyStateCode: supplierStateCode,
      });

      subtotal += calc.rawSubtotal;
      taxAmount += calc.gstAmount;
      cgstTotal += calc.cgst;
      sgstTotal += calc.sgst;
      igstTotal += calc.igst;
      taxableTotal += calc.taxableAmount;

      purchaseItems.push({
        medicine: medicine._id,
        medicineName: medicine.medicineName,
        batchNumber: item.batchNumber || medicine.batchNumber,
        hsnCode: medicine.hsnCode || '',
        quantity: qty,
        purchasePrice: calc.unitPrice,
        sellingPrice: Number(item.sellingPrice) || medicine.sellingPrice,
        mrp: Number(item.mrp) || 0,
        expiryDate: item.expiryDate,
        manufacturingDate: item.manufacturingDate || null,
        subtotal: calc.rawSubtotal,
        taxableAmount: calc.taxableAmount,
        gst: gstPct,
        cgstAmount: calc.cgst,
        sgstAmount: calc.sgst,
        igstAmount: calc.igst,
        gstAmount: calc.gstAmount,
      });
    }

    const discountAmount = discountType === 'percentage' ? taxableTotal * (Number(discount) / 100) : Number(discount) || 0;

    // Recalculate GST after overall discount
    const finalTaxable = Math.max(0, taxableTotal - discountAmount);
    const gstRateUsed = taxableTotal > 0 ? (taxAmount / Math.max(taxableTotal, 0.01)) * 100 : 0;
    const finalGst = Number((finalTaxable * (gstRateUsed / 100)).toFixed(2));

    let finalCgst = 0, finalSgst = 0, finalIgst = 0;
    if (intraState) {
      finalCgst = Number((finalGst / 2).toFixed(2));
      finalSgst = Number((finalGst - finalCgst).toFixed(2));
    } else {
      finalIgst = finalGst;
    }

    const grandTotal = Number((finalTaxable + finalGst + Number(shippingCost || 0) + Number(otherCost || 0)).toFixed(2));
    const paid = Number(paidAmount) || grandTotal;
    const due = grandTotal - paid;

    const oldSupplier = purchase.supplier;

    purchase.set({
      purchaseDate: purchaseDate || purchase.purchaseDate,
      supplier: supplier || purchase.supplier,
      supplierName: supplierName || purchase.supplierName,
      items: purchaseItems,
      subtotal,
      discount: Number(discount) || 0,
      discountType: discountType || 'fixed',
      discountAmount,
      taxableAmount: finalTaxable,
      taxAmount: finalGst,
      cgstAmount: finalCgst,
      sgstAmount: finalSgst,
      igstAmount: finalIgst,
      isIntraState: intraState,
      shippingCost: Number(shippingCost) || 0,
      otherCost: Number(otherCost) || 0,
      grandTotal,
      paidAmount: paid,
      dueAmount: Math.max(0, due),
      paymentMethod: paymentMethod || purchase.paymentMethod,
      paymentStatus: due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      notes: notes !== undefined ? notes : purchase.notes,
      invoiceAttachment,
      isStockUpdated: true,
      updatedBy: req.user._id,
    });

    await purchase.save({ session });
    await updateStockForPurchase(purchaseItems, req.pharmacyId, session);

    // Record payment with potential due invoice payments
    if (paid > 0) {
      await recordPaymentWithInvoices({
        purchase,
        amount: paid,
        paymentMethod: paymentMethod || 'cash',
        paymentDate: new Date(),
        notes: notes || '',
        selectedDueInvoices: parsedSelectedDueInvoices,
        pharmacyId: req.pharmacyId,
        userId: req.user._id,
        session,
      });
    }

    if (oldSupplier) await updateSupplierFinancials(oldSupplier, req.pharmacyId, session);
    if (supplier && supplier !== oldSupplier) await updateSupplierFinancials(supplier, req.pharmacyId, session);

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

    const Sale = (await import('../models/Sale.js')).default;
    const medicineIds = purchase.items.map(i => i.medicine);
    const salesCount = await Sale.countDocuments({ 'items.medicine': { $in: medicineIds }, pharmacyId: req.pharmacyId, isDeleted: false }).session(session);
    if (salesCount > 0) {
      return ApiResponse.error(res, 'Cannot delete purchase. Some medicines have been sold.', 400);
    }

    if (purchase.isStockUpdated) {
      await revertStockForPurchase(purchase.items, req.pharmacyId, session);
    }

    purchase.isDeleted = true;
    purchase.deletedAt = new Date();
    await purchase.save({ session });

    if (purchase.supplier) {
      await updateSupplierFinancials(purchase.supplier, req.pharmacyId, session);
    }

    await session.commitTransaction();
    return ApiResponse.success(res, null, 'Purchase deleted successfully');
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// ===== New Endpoints =====

export const addPurchasePayment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { amount, paymentMethod, paymentDate, notes, selectedDueInvoices } = req.body;
    if (!amount || amount <= 0) return ApiResponse.error(res, 'Valid payment amount is required', 400);

    const purchase = await Purchase.findOne({ _id: req.params.id, pharmacyId: req.pharmacyId, isDeleted: false }).session(session);
    if (!purchase) return ApiResponse.error(res, 'Purchase not found', 404);
    if (purchase.status === 'cancelled' || purchase.status === 'returned') {
      return ApiResponse.error(res, 'Cannot add payment to cancelled/returned purchase', 400);
    }
    if (purchase.dueAmount <= 0) return ApiResponse.error(res, 'Purchase already fully paid', 400);

    const payment = await recordPaymentWithInvoices({
      purchase,
      amount: Number(amount),
      paymentMethod: paymentMethod || 'cash',
      paymentDate: paymentDate || new Date(),
      notes: notes || '',
      selectedDueInvoices,
      pharmacyId: req.pharmacyId,
      userId: req.user._id,
      session,
    });

    if (purchase.supplier) {
      await updateSupplierFinancials(purchase.supplier, req.pharmacyId, session);
    }

    await session.commitTransaction();
    return ApiResponse.success(res, payment, 'Payment recorded successfully', 201);
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

export const getPurchasePayments = async (req, res, next) => {
  try {
    const payments = await PurchasePayment.find({ purchase: req.params.id, pharmacyId: req.pharmacyId })
      .populate('createdBy', 'name')
      .sort({ paymentDate: -1 });
    return ApiResponse.success(res, payments);
  } catch (error) {
    next(error);
  }
};

export const getSupplierLedger = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const purchases = await Purchase.find({
      supplier: supplierId,
      pharmacyId: req.pharmacyId,
      isDeleted: false,
      status: { $nin: ['cancelled', 'returned'] },
    })
      .select('invoiceNumber purchaseDate grandTotal paidAmount dueAmount paymentStatus status')
      .sort({ purchaseDate: -1 })
      .skip(skip)
      .limit(limit);

    const payments = await PurchasePayment.aggregate([
      {
        $match: {
          supplier: new mongoose.Types.ObjectId(supplierId),
          pharmacyId: new mongoose.Types.ObjectId(req.pharmacyId),
        },
      },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await Purchase.countDocuments({
      supplier: supplierId,
      pharmacyId: req.pharmacyId,
      isDeleted: false,
      status: { $nin: ['cancelled', 'returned'] },
    });

    const totals = await Purchase.aggregate([
      {
        $match: {
          supplier: new mongoose.Types.ObjectId(supplierId),
          pharmacyId: new mongoose.Types.ObjectId(req.pharmacyId),
          isDeleted: false,
          status: { $nin: ['cancelled', 'returned'] },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$grandTotal' },
          totalDue: { $sum: '$dueAmount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = totals[0] || { totalAmount: 0, totalDue: 0, count: 0 };
    const totalPayments = payments[0]?.totalPaid || 0;

    return ApiResponse.paginated(res, {
      purchases,
      summary: {
        totalPurchases: summary.count,
        totalAmount: summary.totalAmount,
        totalPaid: totalPayments,
        totalDue: summary.totalDue,
      },
    }, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Get due invoices for a supplier (for purchase form)
// @route   GET /api/purchases/supplier/:supplierId/due-invoices
export const getSupplierDueInvoices = async (req, res, next) => {
  try {
    const { supplierId } = req.params;

    const dueInvoices = await Purchase.find({
      supplier: supplierId,
      pharmacyId: req.pharmacyId,
      isDeleted: false,
      status: { $nin: ['cancelled', 'returned'] },
      dueAmount: { $gt: 0 },
    })
      .select('invoiceNumber purchaseDate grandTotal paidAmount dueAmount paymentStatus')
      .sort({ purchaseDate: -1 })
      .limit(50);

    // Get last payment date for this supplier
    const lastPayment = await PurchasePayment.findOne({
      supplier: supplierId,
      pharmacyId: req.pharmacyId,
    })
      .sort({ paymentDate: -1 })
      .select('paymentDate amount');

    // Get summary totals
    const totals = await Purchase.aggregate([
      {
        $match: {
          supplier: new mongoose.Types.ObjectId(supplierId),
          pharmacyId: new mongoose.Types.ObjectId(req.pharmacyId),
          isDeleted: false,
          status: { $nin: ['cancelled', 'returned'] },
        },
      },
      {
        $group: {
          _id: null,
          totalDue: { $sum: '$dueAmount' },
          totalAmount: { $sum: '$grandTotal' },
          count: { $sum: 1 },
        },
      },
    ]);

    const allPayments = await PurchasePayment.aggregate([
      {
        $match: {
          supplier: new mongoose.Types.ObjectId(supplierId),
          pharmacyId: new mongoose.Types.ObjectId(req.pharmacyId),
        },
      },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$amount' },
        },
      },
    ]);

    const summary = totals[0] || { totalDue: 0, totalAmount: 0, count: 0 };
    const totalPaid = allPayments[0]?.totalPaid || 0;

    return ApiResponse.success(res, {
      dueInvoices,
      summary: {
        totalPurchases: summary.count,
        totalAmount: summary.totalAmount,
        totalPaid: totalPaid,
        totalDue: summary.totalDue,
        unpaidInvoices: dueInvoices.length,
      },
      lastPayment: lastPayment || null,
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchaseStats = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTodayEnd = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    const pharmacyObjId = new mongoose.Types.ObjectId(pharmacyId);

    const [totalPurchase, monthlyPurchase, yearlyPurchase, dueStats, todayPurchase, suppliersDue, recentPurchases] = await Promise.all([
      Purchase.aggregate([
        { $match: { pharmacyId: pharmacyObjId, isDeleted: false, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 }, totalPaid: { $sum: '$paidAmount' }, totalDue: { $sum: '$dueAmount' } } },
      ]),
      Purchase.aggregate([
        { $match: { pharmacyId: pharmacyObjId, isDeleted: false, purchaseDate: { $gte: startOfMonth }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),
      Purchase.aggregate([
        { $match: { pharmacyId: pharmacyObjId, isDeleted: false, purchaseDate: { $gte: startOfYear }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),
      Purchase.aggregate([
        { $match: { pharmacyId: pharmacyObjId, isDeleted: false, status: { $nin: ['cancelled', 'returned'] } } },
        { $group: { _id: null, totalDue: { $sum: '$dueAmount' }, totalOutstanding: { $sum: '$grandTotal' } } },
      ]),
      Purchase.aggregate([
        { $match: { pharmacyId: pharmacyObjId, isDeleted: false, purchaseDate: { $gte: startOfToday, $lt: startOfTodayEnd }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),
      Purchase.aggregate([
        { $match: { pharmacyId: pharmacyObjId, isDeleted: false, status: { $nin: ['cancelled', 'returned'] }, dueAmount: { $gt: 0 } } },
        { $group: { _id: '$supplier' } },
        { $count: 'count' },
      ]),
      Purchase.find({ pharmacyId, isDeleted: false }).sort({ createdAt: -1 }).limit(5).populate('supplier', 'supplierName').select('invoiceNumber supplierName grandTotal paidAmount dueAmount purchaseDate status paymentStatus'),
    ]);

    const totalCount = totalPurchase[0]?.count || 0;
    const totalAmount = totalPurchase[0]?.total || 0;
    const avgPurchaseValue = totalCount > 0 ? totalAmount / totalCount : 0;

    return ApiResponse.success(res, {
      totalAmount,
      totalPurchases: totalCount,
      totalPaid: totalPurchase[0]?.totalPaid || 0,
      totalDue: totalPurchase[0]?.totalDue || 0,
      monthlyAmount: monthlyPurchase[0]?.total || 0,
      monthlyPurchases: monthlyPurchase[0]?.count || 0,
      yearlyAmount: yearlyPurchase[0]?.total || 0,
      yearlyPurchases: yearlyPurchase[0]?.count || 0,
      outstandingDue: dueStats[0]?.totalDue || 0,
      outstandingTotal: dueStats[0]?.totalOutstanding || 0,
      todayAmount: todayPurchase[0]?.total || 0,
      todayPurchases: todayPurchase[0]?.count || 0,
      suppliersDue: suppliersDue[0]?.count || 0,
      avgPurchaseValue,
      recentPurchases,
    });
  } catch (error) {
    next(error);
  }
};
