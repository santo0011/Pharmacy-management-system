import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import Customer from '../models/Customer.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Get customer ledger with running balance
// @route   GET /api/customers/:customerId/ledger
// @access  Private
export const getCustomerLedger = async (req, res, next) => {
  try {
    const customerId = req.params.phoneOrId || req.params.customerId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Find customer
    let customer = null;
    if (mongoose.Types.ObjectId.isValid(customerId)) {
      customer = await Customer.findOne({ _id: customerId, pharmacyId: req.pharmacyId, isDeleted: false });
    }
    if (!customer) {
      customer = await Customer.findOne({ customerId, pharmacyId: req.pharmacyId, isDeleted: false });
    }
    if (!customer) {
      customer = await Customer.findOne({ phone: customerId, pharmacyId: req.pharmacyId, isDeleted: false });
    }

    if (!customer) {
      return ApiResponse.error(res, 'Customer not found', 404);
    }

    // Build query to find all sales for this customer
    const orConditions = [{ customer: customer._id }];
    if (customer.phone && customer.phone.trim()) {
      orConditions.push({ customerPhone: customer.phone });
    }
    if (customer.phone && customer.phone.startsWith('CUST-NP-') && customer.name && customer.name.trim()) {
      orConditions.push({ customerName: customer.name.trim() });
    }

    const saleQuery = {
      pharmacyId: req.pharmacyId,
      isDeleted: false,
      status: { $nin: ['cancelled', 'returned'] },
      $or: orConditions,
    };

    // Get total count
    const totalSales = await Sale.countDocuments(saleQuery);

    // Get all sales for ledger ordered by date
    const sales = await Sale.find(saleQuery)
      .select('invoiceNumber saleDate grandTotal paidAmount dueAmount paymentMethod paymentStatus customerName')
      .sort({ saleDate: 1, createdAt: 1 })
      .lean();

    // Get all payment transactions for this customer
    const saleIds = sales.map(s => s._id);
    const payments = await PaymentTransaction.find({
      sale: { $in: saleIds },
      pharmacyId: req.pharmacyId,
      isDeleted: false,
    })
      .populate('createdBy', 'name')
      .sort({ paymentDate: 1, createdAt: 1 })
      .lean();

    // Build payment lookup by sale
    const paymentsBySale = {};
    payments.forEach(p => {
      const saleKey = p.sale ? p.sale.toString() : '';
      if (!paymentsBySale[saleKey]) paymentsBySale[saleKey] = [];
      paymentsBySale[saleKey].push(p);
    });

    // Build ledger entries with running balance
    let runningBalance = 0;
    const ledgerEntries = [];

    for (const sale of sales) {
      runningBalance += sale.grandTotal - sale.paidAmount;

      const salePayments = paymentsBySale[sale._id.toString()] || [];

      ledgerEntries.push({
        date: sale.saleDate,
        invoiceNumber: sale.invoiceNumber,
        type: 'invoice',
        description: `Sale Invoice - ${sale.invoiceNumber}`,
        totalAmount: sale.grandTotal,
        paidAmount: sale.paidAmount,
        dueAmount: sale.dueAmount,
        paymentStatus: sale.paymentStatus,
        runningBalance,
        payments: salePayments.map(p => ({
          _id: p._id,
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          paymentDate: p.paymentDate,
          previousDue: p.previousDue,
          remainingDue: p.remainingDue,
          notes: p.notes,
          collectedBy: p.createdBy?.name || 'Unknown',
          createdAt: p.createdAt,
        })),
      });
    }

    // Calculate totals
    const totalGrandTotal = sales.reduce((sum, s) => sum + s.grandTotal, 0);
    const totalPaid = sales.reduce((sum, s) => sum + s.paidAmount, 0);
    const totalDue = sales.reduce((sum, s) => sum + s.dueAmount, 0);

    // Sort ledger by date desc for display (newest first)
    const sortedLedger = [...ledgerEntries].reverse();

    // Paginate
    const paginatedLedger = sortedLedger.slice(skip, skip + limit);

    return ApiResponse.success(res, {
      customer: {
        _id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
      },
      summary: {
        totalSales: totalSales,
        totalAmount: totalGrandTotal,
        totalPaid: totalPaid,
        totalDue: totalDue,
        currentBalance: totalDue,
      },
      ledger: paginatedLedger,
      pagination: {
        total: totalSales,
        page,
        limit,
        totalPages: Math.ceil(totalSales / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get supplier ledger with running balance
// @route   GET /api/suppliers/:supplierId/ledger
// @access  Private
export const getSupplierLedger = async (req, res, next) => {
  try {
    const supplierId = req.params.id || req.params.supplierId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Import models
    const Supplier = (await import('../models/Supplier.js')).default;
    const Purchase = (await import('../models/Purchase.js')).default;
    const PurchasePayment = (await import('../models/PurchasePayment.js')).default;

    // Find supplier
    let supplier = null;
    if (mongoose.Types.ObjectId.isValid(supplierId)) {
      supplier = await Supplier.findOne({ _id: supplierId, pharmacyId: req.pharmacyId });
    }
    if (!supplier) {
      return ApiResponse.error(res, 'Supplier not found', 404);
    }

    // Get all purchases for this supplier
    const purchaseQuery = {
      pharmacyId: req.pharmacyId,
      supplier: supplier._id,
      isDeleted: false,
      status: { $nin: ['cancelled', 'returned'] },
    };

    const totalPurchases = await Purchase.countDocuments(purchaseQuery);

    const purchases = await Purchase.find(purchaseQuery)
      .select('invoiceNumber purchaseDate grandTotal paidAmount dueAmount paymentMethod paymentStatus supplierName')
      .sort({ purchaseDate: 1, createdAt: 1 })
      .lean();

    // Get all payments for this supplier's purchases
    const purchaseIds = purchases.map(p => p._id);
    const payments = await PurchasePayment.find({
      purchase: { $in: purchaseIds },
      pharmacyId: req.pharmacyId,
    })
      .populate('createdBy', 'name')
      .sort({ paymentDate: 1, createdAt: 1 })
      .lean();

    // Build payment lookup by purchase
    const paymentsByPurchase = {};
    payments.forEach(p => {
      const purchaseKey = p.purchase ? p.purchase.toString() : '';
      if (!paymentsByPurchase[purchaseKey]) paymentsByPurchase[purchaseKey] = [];
      paymentsByPurchase[purchaseKey].push(p);
    });

    // Build ledger entries with running balance
    let runningBalance = 0;
    const ledgerEntries = [];

    for (const purchase of purchases) {
      runningBalance += purchase.grandTotal - purchase.paidAmount;

      const purchasePayments = paymentsByPurchase[purchase._id.toString()] || [];

      ledgerEntries.push({
        date: purchase.purchaseDate,
        invoiceNumber: purchase.invoiceNumber,
        type: 'purchase',
        description: `Purchase Invoice - ${purchase.invoiceNumber}`,
        totalAmount: purchase.grandTotal,
        paidAmount: purchase.paidAmount,
        dueAmount: purchase.dueAmount,
        paymentStatus: purchase.paymentStatus,
        runningBalance,
        payments: purchasePayments.map(p => ({
          _id: p._id,
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          paymentDate: p.paymentDate,
          notes: p.notes,
          collectedBy: p.createdBy?.name || 'Unknown',
          createdAt: p.createdAt,
        })),
      });
    }

    // Calculate totals
    const totalGrandTotal = purchases.reduce((sum, p) => sum + p.grandTotal, 0);
    const totalPaid = purchases.reduce((sum, p) => sum + p.paidAmount, 0);
    const totalDue = purchases.reduce((sum, p) => sum + p.dueAmount, 0);

    // Sort ledger by date desc for display (newest first)
    const sortedLedger = [...ledgerEntries].reverse();

    // Paginate
    const paginatedLedger = sortedLedger.slice(skip, skip + limit);

    return ApiResponse.success(res, {
      supplier: {
        _id: supplier._id,
        supplierName: supplier.supplierName,
        companyName: supplier.companyName,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
      },
      summary: {
        totalPurchases: totalPurchases,
        totalAmount: totalGrandTotal,
        totalPaid: totalPaid,
        totalDue: totalDue,
        currentBalance: totalDue,
      },
      ledger: paginatedLedger,
      pagination: {
        total: totalPurchases,
        page,
        limit,
        totalPages: Math.ceil(totalPurchases / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};