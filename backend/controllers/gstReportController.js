/**
 * GST Report Controller
 * Provides comprehensive Indian GST reports:
 * - GST Summary (CGST/SGST/IGST totals)
 * - HSN Summary
 * - Taxable Sales/Purchases
 * - GST Liability (Output - Input)
 * - GST Collection
 */
import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Get GST summary report
// @route   GET /api/reports/gst/summary
// @access  Private
export const getGstSummary = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const { startDate, endDate } = req.query;

    const match = { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } };
    if (startDate) match.saleDate = { ...match.saleDate, $gte: new Date(startDate) };
    if (endDate) match.saleDate = { ...match.saleDate, $lte: new Date(endDate) };

    const purchaseMatch = { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } };
    if (startDate) purchaseMatch.purchaseDate = { ...purchaseMatch.purchaseDate, $gte: new Date(startDate) };
    if (endDate) purchaseMatch.purchaseDate = { ...purchaseMatch.purchaseDate, $lte: new Date(endDate) };

    const [salesSummary, purchaseSummary] = await Promise.all([
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            taxableSales: { $sum: '$taxableAmount' },
            cgst: { $sum: '$cgstAmount' },
            sgst: { $sum: '$sgstAmount' },
            igst: { $sum: '$igstAmount' },
            totalGst: { $sum: '$taxAmount' },
            totalSales: { $sum: '$grandTotal' },
            invoiceCount: { $sum: 1 },
          },
        },
      ]),
      Purchase.aggregate([
        { $match: purchaseMatch },
        {
          $group: {
            _id: null,
            taxablePurchases: { $sum: '$taxableAmount' },
            cgst: { $sum: '$cgstAmount' },
            sgst: { $sum: '$sgstAmount' },
            igst: { $sum: '$igstAmount' },
            totalGst: { $sum: '$taxAmount' },
            totalPurchases: { $sum: '$grandTotal' },
            invoiceCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const sales = salesSummary[0] || { taxableSales: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0, totalSales: 0, invoiceCount: 0 };
    const purchases = purchaseSummary[0] || { taxablePurchases: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0, totalPurchases: 0, invoiceCount: 0 };

    return ApiResponse.success(res, {
      sales: {
        taxableValue: sales.taxableSales,
        cgst: sales.cgst,
        sgst: sales.sgst,
        igst: sales.igst,
        totalGst: sales.totalGst,
        totalValue: sales.totalSales,
        invoiceCount: sales.invoiceCount,
      },
      purchases: {
        taxableValue: purchases.taxablePurchases,
        cgst: purchases.cgst,
        sgst: purchases.sgst,
        igst: purchases.igst,
        totalGst: purchases.totalGst,
        totalValue: purchases.totalPurchases,
        invoiceCount: purchases.invoiceCount,
      },
      liability: {
        // GST Liability = Output GST (Sales) - Input GST (Purchases)
        cgst: Number((sales.cgst - purchases.cgst).toFixed(2)),
        sgst: Number((sales.sgst - purchases.sgst).toFixed(2)),
        igst: Number((sales.igst - purchases.igst).toFixed(2)),
        total: Number((sales.totalGst - purchases.totalGst).toFixed(2)),
      },
      collection: {
        cgst: sales.cgst,
        sgst: sales.sgst,
        igst: sales.igst,
        total: sales.totalGst,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get HSN summary report
// @route   GET /api/reports/gst/hsn
// @access  Private
export const getHsnSummary = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const { startDate, endDate } = req.query;

    const saleMatch = { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } };
    if (startDate) saleMatch.saleDate = { ...saleMatch.saleDate, $gte: new Date(startDate) };
    if (endDate) saleMatch.saleDate = { ...saleMatch.saleDate, $lte: new Date(endDate) };

    const purchaseMatch = { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } };
    if (startDate) purchaseMatch.purchaseDate = { ...purchaseMatch.purchaseDate, $gte: new Date(startDate) };
    if (endDate) purchaseMatch.purchaseDate = { ...purchaseMatch.purchaseDate, $lte: new Date(endDate) };

    const [salesHsn, purchaseHsn] = await Promise.all([
      Sale.aggregate([
        { $match: saleMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: { hsn: '$items.hsnCode', gst: '$items.gst' },
            taxableValue: { $sum: '$items.taxableAmount' },
            cgst: { $sum: '$items.cgstAmount' },
            sgst: { $sum: '$items.sgstAmount' },
            igst: { $sum: '$items.igstAmount' },
            totalGst: { $sum: '$items.gstAmount' },
            quantity: { $sum: '$items.quantity' },
          },
        },
        { $sort: { '_id.hsn': 1 } },
      ]),
      Purchase.aggregate([
        { $match: purchaseMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: { hsn: '$items.hsnCode', gst: '$items.gst' },
            taxableValue: { $sum: '$items.taxableAmount' },
            cgst: { $sum: '$items.cgstAmount' },
            sgst: { $sum: '$items.sgstAmount' },
            igst: { $sum: '$items.igstAmount' },
            totalGst: { $sum: '$items.gstAmount' },
            quantity: { $sum: '$items.quantity' },
          },
        },
        { $sort: { '_id.hsn': 1 } },
      ]),
    ]);

    return ApiResponse.success(res, {
      sales: salesHsn.map(h => ({
        hsnCode: h._id.hsn || 'N/A',
        gstPct: h._id.gst,
        taxableValue: h.taxableValue,
        cgst: h.cgst,
        sgst: h.sgst,
        igst: h.igst,
        totalGst: h.totalGst,
        quantity: h.quantity,
      })),
      purchases: purchaseHsn.map(h => ({
        hsnCode: h._id.hsn || 'N/A',
        gstPct: h._id.gst,
        taxableValue: h.taxableValue,
        cgst: h.cgst,
        sgst: h.sgst,
        igst: h.igst,
        totalGst: h.totalGst,
        quantity: h.quantity,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get GST rate-wise summary
// @route   GET /api/reports/gst/rates
// @access  Private
export const getGstRateSummary = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const { startDate, endDate } = req.query;

    const saleMatch = { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } };
    if (startDate) saleMatch.saleDate = { ...saleMatch.saleDate, $gte: new Date(startDate) };
    if (endDate) saleMatch.saleDate = { ...saleMatch.saleDate, $lte: new Date(endDate) };

    const purchaseMatch = { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } };
    if (startDate) purchaseMatch.purchaseDate = { ...purchaseMatch.purchaseDate, $gte: new Date(startDate) };
    if (endDate) purchaseMatch.purchaseDate = { ...purchaseMatch.purchaseDate, $lte: new Date(endDate) };

    const [salesRates, purchaseRates] = await Promise.all([
      Sale.aggregate([
        { $match: saleMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.gst',
            taxableValue: { $sum: '$items.taxableAmount' },
            cgst: { $sum: '$items.cgstAmount' },
            sgst: { $sum: '$items.sgstAmount' },
            igst: { $sum: '$items.igstAmount' },
            totalGst: { $sum: '$items.gstAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Purchase.aggregate([
        { $match: purchaseMatch },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.gst',
            taxableValue: { $sum: '$items.taxableAmount' },
            cgst: { $sum: '$items.cgstAmount' },
            sgst: { $sum: '$items.sgstAmount' },
            igst: { $sum: '$items.igstAmount' },
            totalGst: { $sum: '$items.gstAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return ApiResponse.success(res, {
      sales: salesRates.map(r => ({
        gstPct: r._id,
        taxableValue: r.taxableValue,
        cgst: r.cgst,
        sgst: r.sgst,
        igst: r.igst,
        totalGst: r.totalGst,
      })),
      purchases: purchaseRates.map(r => ({
        gstPct: r._id,
        taxableValue: r.taxableValue,
        cgst: r.cgst,
        sgst: r.sgst,
        igst: r.igst,
        totalGst: r.totalGst,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get GST transactions (sales + purchases) for the report
// @route   GET /api/reports/gst/transactions
// @access  Private
export const getGstTransactions = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const { startDate, endDate, type } = req.query;

    const saleMatch = { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } };
    if (startDate) saleMatch.saleDate = { ...saleMatch.saleDate, $gte: new Date(startDate) };
    if (endDate) saleMatch.saleDate = { ...saleMatch.saleDate, $lte: new Date(endDate) };

    const purchaseMatch = { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } };
    if (startDate) purchaseMatch.purchaseDate = { ...purchaseMatch.purchaseDate, $gte: new Date(startDate) };
    if (endDate) purchaseMatch.purchaseDate = { ...purchaseMatch.purchaseDate, $lte: new Date(endDate) };

    const result = { sales: [], purchases: [] };

    if (type !== 'purchase') {
      const sales = await Sale.find(saleMatch)
        .select('invoiceNumber saleDate customerName customerGstin taxableAmount taxAmount cgstAmount sgstAmount igstAmount grandTotal items')
        .sort({ saleDate: -1 })
        .lean();
      result.sales = sales.map(s => ({
        invoiceNo: s.invoiceNumber,
        date: s.saleDate,
        customer: s.customerName,
        gstin: s.customerGstin || '',
        taxableAmount: s.taxableAmount,
        gstPct: s.items?.length ? s.items[0].gst : 0,
        cgst: s.cgstAmount,
        sgst: s.sgstAmount,
        igst: s.igstAmount,
        totalGst: s.taxAmount,
        grandTotal: s.grandTotal,
      }));
    }

    if (type !== 'sale') {
      const purchases = await Purchase.find(purchaseMatch)
        .select('invoiceNumber purchaseDate supplierName supplierGstin taxableAmount taxAmount cgstAmount sgstAmount igstAmount grandTotal items')
        .sort({ purchaseDate: -1 })
        .lean();
      result.purchases = purchases.map(p => ({
        invoiceNo: p.invoiceNumber,
        date: p.purchaseDate,
        supplier: p.supplierName,
        gstin: p.supplierGstin || '',
        taxableAmount: p.taxableAmount,
        gstPct: p.items?.length ? p.items[0].gst : 0,
        cgst: p.cgstAmount,
        sgst: p.sgstAmount,
        igst: p.igstAmount,
        totalGst: p.taxAmount,
        grandTotal: p.grandTotal,
      }));
    }

    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

// @desc    Get GST liability report (Output - Input)
// @route   GET /api/reports/gst/liability
// @access  Private
export const getGstLiability = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const { startDate, endDate } = req.query;

    const saleMatch = { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } };
    if (startDate) saleMatch.saleDate = { ...saleMatch.saleDate, $gte: new Date(startDate) };
    if (endDate) saleMatch.saleDate = { ...saleMatch.saleDate, $lte: new Date(endDate) };

    const purchaseMatch = { pharmacyId: new mongoose.Types.ObjectId(pharmacyId), isDeleted: false, status: { $nin: ['cancelled', 'returned'] } };
    if (startDate) purchaseMatch.purchaseDate = { ...purchaseMatch.purchaseDate, $gte: new Date(startDate) };
    if (endDate) purchaseMatch.purchaseDate = { ...purchaseMatch.purchaseDate, $lte: new Date(endDate) };

    const [sales, purchases] = await Promise.all([
      Sale.aggregate([
        { $match: saleMatch },
        {
          $group: {
            _id: null,
            cgst: { $sum: '$cgstAmount' },
            sgst: { $sum: '$sgstAmount' },
            igst: { $sum: '$igstAmount' },
            total: { $sum: '$taxAmount' },
          },
        },
      ]),
      Purchase.aggregate([
        { $match: purchaseMatch },
        {
          $group: {
            _id: null,
            cgst: { $sum: '$cgstAmount' },
            sgst: { $sum: '$sgstAmount' },
            igst: { $sum: '$igstAmount' },
            total: { $sum: '$taxAmount' },
          },
        },
      ]),
    ]);

    const output = sales[0] || { cgst: 0, sgst: 0, igst: 0, total: 0 };
    const input = purchases[0] || { cgst: 0, sgst: 0, igst: 0, total: 0 };

    return ApiResponse.success(res, {
      outputGst: output,
      inputGst: input,
      netLiability: {
        cgst: Number((output.cgst - input.cgst).toFixed(2)),
        sgst: Number((output.sgst - input.sgst).toFixed(2)),
        igst: Number((output.igst - input.igst).toFixed(2)),
        total: Number((output.total - input.total).toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getGstSummary,
  getHsnSummary,
  getGstRateSummary,
  getGstLiability,
  getGstTransactions,
};
