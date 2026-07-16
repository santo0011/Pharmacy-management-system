import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';
import Sale from '../models/Sale.js';
import Purchase from '../models/Purchase.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Global search across all entities
// @route   GET /api/search?q=...
// @access  Private
export const globalSearch = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) {
      return ApiResponse.success(res, {
        medicines: [],
        customers: [],
        suppliers: [],
        sales: [],
        purchases: [],
      });
    }

    const searchTerm = q.trim();
    const regex = new RegExp(searchTerm, 'i');
    const pharmacyId = req.pharmacyId;
    const limit = 5; // Show top 5 results per category

    // Run all searches in parallel
    const [medicines, customers, suppliers, sales, purchases] = await Promise.all([
      // Search medicines
      Medicine.find({
        pharmacyId,
        isDeleted: false,
        $or: [
          { medicineName: regex },
          { genericName: regex },
          { categoryName: regex },
          { brandName: regex },
          { batchNumber: regex },
        ],
      })
        .select('medicineName genericName categoryName brandName batchNumber currentStock sellingPrice')
        .limit(limit)
        .lean(),

      // Search customers
      Customer.find({
        pharmacyId,
        isDeleted: false,
        $or: [
          { name: regex },
          { phone: regex },
          { customerId: regex },
        ],
      })
        .select('name phone customerId totalSpent totalDue')
        .limit(limit)
        .lean(),

      // Search suppliers
      Supplier.find({
        pharmacyId,
        $or: [
          { supplierName: regex },
          { companyName: regex },
          { phone: regex },
          { email: regex },
        ],
      })
        .select('supplierName companyName phone email totalDue')
        .limit(limit)
        .lean(),

      // Search sales
      Sale.find({
        pharmacyId,
        isDeleted: false,
        $or: [
          { invoiceNumber: regex },
          { customerName: regex },
          { customerPhone: regex },
        ],
      })
        .select('invoiceNumber saleDate customerName customerPhone grandTotal paidAmount dueAmount paymentStatus')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),

      // Search purchases
      Purchase.find({
        pharmacyId,
        isDeleted: false,
        $or: [
          { invoiceNumber: regex },
          { supplierName: regex },
        ],
      })
        .select('invoiceNumber purchaseDate supplierName grandTotal paidAmount dueAmount paymentStatus')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);

    return ApiResponse.success(res, {
      medicines: medicines.map(m => ({
        _id: m._id,
        name: m.medicineName,
        genericName: m.genericName,
        categoryName: m.categoryName,
        brandName: m.brandName,
        batchNumber: m.batchNumber,
        currentStock: m.currentStock,
        sellingPrice: m.sellingPrice,
        type: 'medicine',
        link: `/medicines/${m._id}`,
      })),
      customers: customers.map(c => ({
        _id: c._id,
        name: c.name,
        phone: c.phone,
        customerId: c.customerId,
        totalSpent: c.totalSpent,
        type: 'customer',
        link: `/customers`,
        detailParams: { customerId: c._id },
      })),
      suppliers: suppliers.map(s => ({
        _id: s._id,
        supplierName: s.supplierName,
        companyName: s.companyName,
        phone: s.phone,
        email: s.email,
        totalDue: s.totalDue,
        type: 'supplier',
        link: `/suppliers`,
      })),
      sales: sales.map(s => ({
        _id: s._id,
        invoiceNumber: s.invoiceNumber,
        saleDate: s.saleDate,
        customerName: s.customerName,
        customerPhone: s.customerPhone,
        grandTotal: s.grandTotal,
        paidAmount: s.paidAmount,
        dueAmount: s.dueAmount,
        paymentStatus: s.paymentStatus,
        type: 'sale',
        link: `/sales/${s._id}`,
      })),
      purchases: purchases.map(p => ({
        _id: p._id,
        invoiceNumber: p.invoiceNumber,
        purchaseDate: p.purchaseDate,
        supplierName: p.supplierName,
        grandTotal: p.grandTotal,
        paidAmount: p.paidAmount,
        dueAmount: p.dueAmount,
        paymentStatus: p.paymentStatus,
        type: 'purchase',
        link: `/purchases/${p._id}`,
      })),
    });
  } catch (error) {
    next(error);
  }
};