import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import Customer from '../models/Customer.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import ApiResponse from '../utils/apiResponse.js';

// @desc    Search customers by name or phone (autocomplete)
// @route   GET /api/customers/search
// @access  Private
export const searchCustomers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1) {
      return ApiResponse.success(res, []);
    }

    const regex = new RegExp(q, 'i');
    const customers = await Customer.find({
      pharmacyId: req.pharmacyId,
      isDeleted: false,
      $or: [
        { name: regex },
        { phone: regex },
      ],
    })
      .select('customerId name phone address totalPurchases totalSpent lastPurchaseDate')
      .limit(10)
      .sort({ totalPurchases: -1 });

    return ApiResponse.success(res, customers);
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new customer
// @route   POST /api/customers/create
// @access  Private
export const createCustomer = async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;

    if (!name || !name.trim()) {
      return ApiResponse.error(res, 'Customer name is required', 400);
    }

    const cleanPhone = (phone || '').trim();

    // If a real phone is provided, check for existing customer with this phone
    if (cleanPhone && !cleanPhone.startsWith('CUST-NP-')) {
      const existing = await Customer.findOne({
        pharmacyId: req.pharmacyId,
        phone: cleanPhone,
        isDeleted: false,
      });

      if (existing) {
        return ApiResponse.success(res, existing, 'Customer already exists');
      }
    }

    // If no phone provided, generate a unique sequential placeholder
    let finalPhone = cleanPhone;
    if (!finalPhone) {
      // Count existing customers with generated placeholders to create sequential IDs
      const count = await Customer.countDocuments({
        pharmacyId: req.pharmacyId,
        phone: { $regex: '^CUST-NP-' },
      });
      finalPhone = `CUST-NP-${count + 1}`;
    }

    const customer = await Customer.create({
      name: name.trim(),
      phone: finalPhone,
      address: address || '',
      pharmacyId: req.pharmacyId,
    });

    return ApiResponse.success(res, customer, 'Customer created successfully', 201);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all unique customers (from Customer collection) with real sales stats
// @route   GET /api/customers
// @access  Private
export const getCustomers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const query = {
      pharmacyId: req.pharmacyId,
      isDeleted: false,
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];

      // Also search by invoice number in Sales collection
      const salesByInvoice = await Sale.find({
        pharmacyId: req.pharmacyId,
        isDeleted: false,
        invoiceNumber: { $regex: search, $options: 'i' },
        customer: { $ne: null },
      }).select('customer').lean();

      const customerIdsFromInvoice = [...new Set(salesByInvoice.map(s => s.customer?.toString()).filter(Boolean))];

      if (customerIdsFromInvoice.length > 0) {
        query.$or.push({ _id: { $in: customerIdsFromInvoice } });
      }
    }

    const total = await Customer.countDocuments(query);
    const customerDocs = await Customer.find(query)
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get aggregated sales stats for all customers in this page
    const customerIds = customerDocs.map(c => c._id);
    
    // First try to get stats by customer ref (newer sales)
    const salesStatsByRef = await Sale.aggregate([
      {
        $match: {
          pharmacyId: req.pharmacyId,
          isDeleted: false,
          customer: { $in: customerIds },
          status: { $nin: ['cancelled', 'returned'] },
        },
      },
      {
        $group: {
          _id: '$customer',
          totalPurchases: { $sum: 1 },
          totalSpent: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$paidAmount' },
          totalDue: { $sum: '$dueAmount' },
          lastPurchaseDate: { $max: '$saleDate' },
        },
      },
    ]);

    // Build stats map from ref-based results
    const statsMap = {};
    salesStatsByRef.forEach(stat => {
      statsMap[stat._id.toString()] = stat;
    });

    // For customers with 0 stats from ref-based queries, check by phone for older sales
    const customersMissingStats = customerDocs.filter(c => !statsMap[c._id.toString()]);

    if (customersMissingStats.length > 0) {
      // Build legacy match conditions for each missing customer
      const legacyConditions = [];
      customersMissingStats.forEach(c => {
        if (c.phone && c.phone.trim()) {
          legacyConditions.push({ customerPhone: c.phone });
        }
        // For auto-generated phone customers, also match by name (they're unique)
        if (c.phone && c.phone.startsWith('CUST-NP-') && c.name && c.name.trim()) {
          legacyConditions.push({ customerName: c.name.trim() });
        }
      });

      if (legacyConditions.length > 0) {
        const legacyAggQuery = [
          {
            $match: {
              pharmacyId: req.pharmacyId,
              isDeleted: false,
              $or: legacyConditions,
              status: { $nin: ['cancelled', 'returned'] },
            },
          },
          {
            $group: {
              _id: '$customerPhone',
              totalPurchases: { $sum: 1 },
              totalSpent: { $sum: '$grandTotal' },
              totalPaid: { $sum: '$paidAmount' },
              totalDue: { $sum: '$dueAmount' },
              lastPurchaseDate: { $max: '$saleDate' },
            },
          },
        ];

        const legacyStats = await Sale.aggregate(legacyAggQuery);
        
        // Map legacy stats by phone
        const legacyStatsByPhone = {};
        legacyStats.forEach(stat => {
          legacyStatsByPhone[stat._id] = stat;
        });

        // Merge legacy stats into statsMap
        customersMissingStats.forEach(c => {
          if (!statsMap[c._id.toString()]) {
            const legacyStat = legacyStatsByPhone[c.phone];
            if (legacyStat) {
              statsMap[c._id.toString()] = legacyStat;
            }
          }
        });
      }
    }

    // Map to backward-compatible format with real aggregated data
    const customers = customerDocs.map(c => {
      const stats = statsMap[c._id.toString()] || {};
      return {
        customerName: c.name,
        customerPhone: c.phone || '',
        customerId: c.customerId,
        totalPurchases: stats.totalPurchases || 0,
        totalSpent: stats.totalSpent || 0,
        totalPaid: stats.totalPaid || 0,
        totalDue: stats.totalDue || 0,
        lastPurchaseDate: stats.lastPurchaseDate || null,
        firstPurchaseDate: c.createdAt,
        _id: c._id,
      };
    });

    return ApiResponse.paginated(res, customers, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single customer details with purchase history
// @route   GET /api/customers/:phoneOrId
// @access  Private
export const getCustomer = async (req, res, next) => {
  try {
    const { phoneOrId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Find customer by MongoDB _id, customerId, or phone
    let customer = null;
    let customerFound = false;

    if (mongoose.Types.ObjectId.isValid(phoneOrId)) {
      customer = await Customer.findOne({ _id: phoneOrId, pharmacyId: req.pharmacyId, isDeleted: false });
      if (customer) customerFound = true;
    }
    if (!customer) {
      customer = await Customer.findOne({ customerId: phoneOrId, pharmacyId: req.pharmacyId, isDeleted: false });
      if (customer) customerFound = true;
    }
    if (!customer) {
      customer = await Customer.findOne({ phone: phoneOrId, pharmacyId: req.pharmacyId, isDeleted: false });
      if (customer) customerFound = true;
    }

    // Calculate totals for the customer
    const calcTotals = async (matchQuery) => {
      const totalsAgg = await Sale.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalSpent: { $sum: '$grandTotal' },
            totalPaid: { $sum: '$paidAmount' },
            totalDue: { $sum: '$dueAmount' },
          },
        },
      ]);
      return totalsAgg[0] || { totalSpent: 0, totalPaid: 0, totalDue: 0 };
    };

    if (customerFound) {
      // Build query to match sales for this customer
      // Use BOTH customer._id (newer sales with ref) AND customerPhone (older sales that store phone as string)
      // NEVER use customerName alone as it can match wrong customers
      const orConditions = [{ customer: customer._id }];
      
      // Add phone-based matching for older sales (both real phones and auto-generated placeholders)
      if (customer.phone && customer.phone.trim()) {
        orConditions.push({ customerPhone: customer.phone });
      }

      // For legacy customers with auto-generated phones (no real phone), older sales may
      // have stored empty customerPhone field, so also match by customerName as fallback.
      // This is safe because CUST-NP- customers have unique names in practice.
      if (customer.phone && customer.phone.startsWith('CUST-NP-') && customer.name && customer.name.trim()) {
        orConditions.push({ customerName: customer.name.trim() });
      }

      const query = {
        pharmacyId: req.pharmacyId,
        isDeleted: false,
        $or: orConditions,
        status: { $nin: ['cancelled', 'returned'] },
      };

      const total = await Sale.countDocuments(query);
      const sales = await Sale.find(query)
        .sort({ saleDate: -1 })
        .skip(skip)
        .limit(limit)
        .select('invoiceNumber saleDate grandTotal paidAmount dueAmount paymentMethod paymentStatus items');

      const totals = await calcTotals(query);

      // Get payment history for customer - ONLY for this customer's sales
      const saleIds = sales.map(s => s._id);
      const paymentHistory = await PaymentTransaction.find({
        sale: { $in: saleIds },
        pharmacyId: req.pharmacyId,
        isDeleted: false,
      })
        .populate('createdBy', 'name')
        .sort({ paymentDate: -1 });

      return ApiResponse.success(res, {
        customer: {
          _id: customer._id,
          customerId: customer.customerId,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerAddress: customer.address,
          totalPurchases: total,
          totalSpent: totals.totalSpent,
          totalPaid: totals.totalPaid,
          totalDue: totals.totalDue,
          lastPurchaseDate: sales.length > 0 ? sales[0].saleDate : null,
          firstPurchaseDate: sales.length > 0 ? sales[sales.length - 1]?.saleDate : customer.createdAt,
        },
        sales,
        paymentHistory,
        total,
        page,
        limit,
      });
    }

    // Legacy mode: no Customer document found - search Sale collection directly by phone or invoice
    // IMPORTANT: NEVER search by customerName alone as it can match wrong customers
    const legacyQuery = {
      pharmacyId: req.pharmacyId,
      isDeleted: false,
      status: { $nin: ['cancelled', 'returned'] },
    };

    // Only match by phone or invoice number, NOT by customer name
    if (phoneOrId) {
      legacyQuery.$or = [
        { customerPhone: phoneOrId },
        { invoiceNumber: phoneOrId },
      ];
    }

    const total = await Sale.countDocuments(legacyQuery);
    const sales = await Sale.find(legacyQuery)
      .sort({ saleDate: -1 })
      .skip(skip)
      .limit(limit)
      .select('invoiceNumber saleDate grandTotal paidAmount dueAmount paymentMethod paymentStatus items');

    if (sales.length === 0) {
      return ApiResponse.error(res, 'Customer not found', 404);
    }

    const totals = await calcTotals(legacyQuery);

    // Build customer summary from sales
    const summary = {
      customerName: sales[0].customerName,
      customerPhone: sales[0].customerPhone,
      totalPurchases: total,
      totalSpent: totals.totalSpent,
      totalPaid: totals.totalPaid,
      totalDue: totals.totalDue,
      lastPurchaseDate: sales[0].saleDate,
      firstPurchaseDate: sales[sales.length - 1]?.saleDate || sales[0].saleDate,
    };

    // Get payment history
    const saleIds = sales.map(s => s._id);
    const paymentHistory = await PaymentTransaction.find({
      sale: { $in: saleIds },
      pharmacyId: req.pharmacyId,
      isDeleted: false,
    })
      .populate('createdBy', 'name')
      .sort({ paymentDate: -1 });

    return ApiResponse.success(res, {
      customer: {
        _id: null,
        customerId: '',
        customerName: summary.customerName,
        customerPhone: summary.customerPhone,
        customerAddress: '',
        totalPurchases: summary.totalPurchases,
        totalSpent: summary.totalSpent,
        totalPaid: summary.totalPaid,
        totalDue: summary.totalDue,
        lastPurchaseDate: summary.lastPurchaseDate,
        firstPurchaseDate: summary.firstPurchaseDate,
      },
      sales,
      paymentHistory,
      total,
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
};
// @desc    Get customer-specific payment history
// @route   GET /api/customers/:customerId/payments
// @access  Private
export const getCustomerPaymentHistory = async (req, res, next) => {
  try {
    const { phoneOrId: customerId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Find customer
    let customer = null;
    let customerPhone = '';
    let customerName = '';

    if (mongoose.Types.ObjectId.isValid(customerId)) {
      customer = await Customer.findOne({ _id: customerId, pharmacyId: req.pharmacyId, isDeleted: false });
    }
    if (!customer) {
      customer = await Customer.findOne({ phone: customerId, pharmacyId: req.pharmacyId, isDeleted: false });
    }

    if (customer) {
      customerPhone = customer.phone;
      customerName = customer.name;
    }

    // Build match conditions
    const matchQuery = { pharmacyId: req.pharmacyId, isDeleted: false };
    const orConditions = [];

    if (customer && customer._id) {
      orConditions.push({ customer: customer._id });
    }
    if (customerPhone) {
      // Find sales for this customer to get sale IDs
      const customerSales = await Sale.find({
        pharmacyId: req.pharmacyId,
        isDeleted: false,
        $or: [
          { customer: customer?._id || null },
          { customerPhone: customerPhone },
          { customerName: customerName },
        ],
      }).select('_id');
      const saleIds = customerSales.map(s => s._id);
      matchQuery.sale = { $in: saleIds };
    }

    const total = await PaymentTransaction.countDocuments(matchQuery);
    const payments = await PaymentTransaction.find(matchQuery)
      .populate({
        path: 'sale',
        select: 'invoiceNumber customerName',
      })
      .populate('createdBy', 'name')
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, payments, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all customers with outstanding dues
// @route   GET /api/customers/dues
// @access  Private
export const getCustomerDues = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    // First find all customers with dues via Sale aggregation
    const matchStage = {
      pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
      isDeleted: false,
      dueAmount: { $gt: 0 },
      status: { $nin: ['cancelled', 'returned'] },
    };

    // If searching by invoice number, do a direct lookup
    if (search) {
      const invoiceRegex = new RegExp(search, 'i');
      matchStage.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { invoiceNumber: invoiceRegex },
      ];
    }

    // If we have customer refs, use them; otherwise fall back to name/phone grouping
    const hasCustomerRefs = await Sale.findOne({ ...matchStage, customer: { $ne: null } });

    let pipeline;
    // Build legacy lookup map to resolve customer identifiers for entries without customer ref
    // This map will allow us to include _id for Payment/View buttons
    const allCustomerPhones = [];
    let customerPhoneToIdMap = {};
    
    if (hasCustomerRefs) {
      // Use customer references
      pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: '$customer',
            totalPurchases: { $sum: 1 },
            totalAmount: { $sum: '$grandTotal' },
            totalPaid: { $sum: '$paidAmount' },
            totalDue: { $sum: '$dueAmount' },
            lastPurchaseDate: { $max: '$saleDate' },
          },
        },
        {
          $lookup: {
            from: 'customers',
            localField: '_id',
            foreignField: '_id',
            as: 'customerInfo',
          },
        },
        { $unwind: { path: '$customerInfo', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            customerId: { $ifNull: ['$customerInfo.customerId', ''] },
            customerName: { $ifNull: ['$customerInfo.name', 'Unknown'] },
            customerPhone: { $ifNull: ['$customerInfo.phone', ''] },
            customerRef: '$_id',
            totalPurchases: 1,
            totalAmount: { $round: ['$totalAmount', 2] },
            totalPaid: { $round: ['$totalPaid', 2] },
            totalDue: { $round: ['$totalDue', 2] },
            lastPurchaseDate: 1,
          },
        },
        { $sort: { totalDue: -1 } },
      ];
    } else {
      // Fall back to name/phone grouping (legacy)
      // Do NOT overwrite matchStage.$or here — it was already set with invoice search above
      // Only set it if not already set
      if (search && !matchStage.$or) {
        matchStage.$or = [
          { customerName: { $regex: search, $options: 'i' } },
          { customerPhone: { $regex: search, $options: 'i' } },
        ];
      }

      // Collect unique phones from match stage to look up customer _id later
      // We need to get all unique customerPhone values from the matched sales
      const phoneAgg = await Sale.aggregate([
        { $match: matchStage },
        { $group: { _id: '$customerPhone' } },
      ]);
      phoneAgg.forEach(p => {
        if (p._id && p._id.trim()) {
          allCustomerPhones.push(p._id);
        }
      });
      
      // Look up customer documents by phone or name to get _id
      if (allCustomerPhones.length > 0) {
        const customerDocs = await Customer.find({
          pharmacyId: req.pharmacyId,
          isDeleted: false,
          $or: [
            { phone: { $in: allCustomerPhones } },
            { name: { $in: allCustomerPhones } },
          ],
        }).select('_id phone name').lean();
        
        customerDocs.forEach(cd => {
          customerPhoneToIdMap[cd.phone] = cd._id;
          customerPhoneToIdMap[cd.name] = cd._id;
        });
      }

      pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: { name: '$customerName', phone: '$customerPhone' },
            totalPurchases: { $sum: 1 },
            totalAmount: { $sum: '$grandTotal' },
            totalPaid: { $sum: '$paidAmount' },
            totalDue: { $sum: '$dueAmount' },
            lastPurchaseDate: { $max: '$saleDate' },
          },
        },
        { $sort: { totalDue: -1 } },
      ];
    }

    // Add search filter for customerRef path
    if (search && hasCustomerRefs) {
      pipeline.splice(4, 0, {
        $match: {
          $or: [
            { 'customerInfo.name': { $regex: search, $options: 'i' } },
            { 'customerInfo.phone': { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    const countResult = await Sale.aggregate([...pipeline, { $count: 'total' }]);
    const total = countResult[0]?.total || 0;

    pipeline.push({ $skip: skip }, { $limit: limit });
    const aggResults = await Sale.aggregate(pipeline);

    // Map results to include _id for legacy entries (where no customer ref exists)
    let customers;
    if (hasCustomerRefs) {
      customers = aggResults;
    } else {
      // Legacy path: add _id from the phone-to-id map we built earlier
      customers = aggResults.map(r => ({
        customerId: '',
        customerName: r._id.name,
        customerPhone: r._id.phone,
        customerRef: customerPhoneToIdMap[r._id.phone] || customerPhoneToIdMap[r._id.name] || null,
        totalPurchases: r.totalPurchases,
        totalAmount: r.totalAmount,
        totalPaid: r.totalPaid,
        totalDue: r.totalDue,
        lastPurchaseDate: r.lastPurchaseDate,
        _id: customerPhoneToIdMap[r._id.phone] || customerPhoneToIdMap[r._id.name] || null,
      }));
    }

    // Grand totals
    const totalsResult = await Sale.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalDueAmount: { $sum: '$dueAmount' },
          totalOutstanding: { $sum: '$grandTotal' },
          totalCustomers: hasCustomerRefs
            ? { $addToSet: '$customer' }
            : { $addToSet: { name: '$customerName', phone: '$customerPhone' } },
        },
      },
    ]);

    const totals = totalsResult[0] || { totalDueAmount: 0, totalOutstanding: 0, totalCustomers: 0 };

    return ApiResponse.paginated(res, {
      customers,
      totals: {
        totalDueAmount: totals.totalDueAmount || 0,
        totalOutstanding: totals.totalOutstanding || 0,
        totalCustomers: totals.totalCustomers?.length || 0,
      },
    }, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @desc    Get due invoices for a specific customer (for payment drawer)
// @route   GET /api/customers/:customerId/due-invoices
// @access  Private
export const getCustomerDueInvoices = async (req, res, next) => {
  try {
    const { phoneOrId: customerId } = req.params;

    // Try to find a Customer document
    let customer = null;
    let customerPhone = '';
    let customerName = '';

    if (mongoose.Types.ObjectId.isValid(customerId)) {
      customer = await Customer.findOne({ _id: customerId, pharmacyId: req.pharmacyId, isDeleted: false });
    }
    if (!customer) {
      customer = await Customer.findOne({ customerId, pharmacyId: req.pharmacyId, isDeleted: false });
    }
    if (!customer && customerId && !mongoose.Types.ObjectId.isValid(customerId)) {
      customer = await Customer.findOne({ phone: customerId, pharmacyId: req.pharmacyId, isDeleted: false });
    }

    if (customer) {
      customerPhone = customer.phone;
      customerName = customer.name;
    }

    // Build match query for due invoices
    const matchQuery = {
      pharmacyId: req.pharmacyId,
      isDeleted: false,
      dueAmount: { $gt: 0 },
      status: { $nin: ['cancelled', 'returned'] },
    };

    // Build $or conditions to match invoices for this specific customer
    // We use BOTH customer._id (for newer sales with ref) AND customerPhone (for older sales that store phone as string)
    const orConditions = [];

    if (customer && customer._id) {
      orConditions.push({ customer: customer._id });
    }

    // Match by phone for older sales that may not have customer ref
    // This works for both real phones and auto-generated CUST-NP-* placeholders
    if (customerPhone && customerPhone.trim()) {
      orConditions.push({ customerPhone: customerPhone });
    }

    // For legacy sales with auto-generated phones (CUST-NP-*) that may have empty customerPhone field in Sale,
    // also match by customerName as a last resort. This is safe because customers with
    // auto-generated phones (no real phone) almost never have name collisions.
    if (customerPhone && customerPhone.startsWith('CUST-NP-') && customerName && customerName.trim()) {
      orConditions.push({ customerName: customerName.trim() });
    }

    if (orConditions.length > 0) {
      matchQuery.$or = orConditions;
    } else if (customerId) {
      matchQuery.customerPhone = customerId;
    } else {
      return ApiResponse.error(res, 'Customer identifier not found', 400);
    }

    const invoices = await Sale.find(matchQuery)
      .sort({ saleDate: -1 })
      .select('invoiceNumber saleDate grandTotal paidAmount dueAmount paymentStatus customerName customerPhone');

    // Get payment history for these invoices
    const saleIds = invoices.map(inv => inv._id);
    const payments = await PaymentTransaction.find({
      sale: { $in: saleIds },
      pharmacyId: req.pharmacyId,
      isDeleted: false,
    }).sort({ paymentDate: -1 }).select('amount paymentMethod paymentDate previousDue remainingDue');

    // Attach payment history to each invoice
    const invoicesWithPayments = invoices.map(inv => {
      const invPayments = payments.filter(p => p.sale && p.sale.toString() === inv._id.toString());
      return {
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        saleDate: inv.saleDate,
        grandTotal: inv.grandTotal,
        paidAmount: inv.paidAmount,
        dueAmount: inv.dueAmount,
        paymentStatus: inv.paymentStatus,
        payments: invPayments,
      };
    });

    return ApiResponse.success(res, {
      customer: {
        _id: customer?._id || null,
        customerId: customer?.customerId || '',
        name: customerName || (invoices.length > 0 ? invoices[0].customerName : 'Unknown'),
        phone: customerPhone,
        totalDue: invoices.reduce((sum, inv) => sum + inv.dueAmount, 0),
      },
      invoices: invoicesWithPayments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Pay due amount for a specific invoice
// @route   POST /api/customers/pay-due
// @access  Private
export const payDue = async (req, res, next) => {
  try {
    const { saleId, amount, paymentMethod, notes } = req.body;

    if (!saleId || !amount || amount <= 0) {
      return ApiResponse.error(res, 'Sale ID and valid amount are required', 400);
    }

    const sale = await Sale.findOne({ _id: saleId, pharmacyId: req.pharmacyId, isDeleted: false });
    if (!sale) {
      return ApiResponse.error(res, 'Sale not found', 404);
    }

    if (sale.dueAmount <= 0) {
      return ApiResponse.error(res, 'No due amount for this sale', 400);
    }

    if (amount > sale.dueAmount) {
      return ApiResponse.error(res, `Amount exceeds due. Max payable: ₹${sale.dueAmount.toFixed(2)}`, 400);
    }

    const previousDue = sale.dueAmount;

    sale.paidAmount += Number(amount);
    sale.dueAmount = Math.max(0, sale.grandTotal - sale.paidAmount);
    sale.paymentStatus = sale.dueAmount <= 0 ? 'paid' : 'partial';
    sale.updatedBy = req.user._id;

    await sale.save();

    // Record payment transaction
    await PaymentTransaction.create({
      sale: sale._id,
      customer: sale.customer || null,
      pharmacyId: req.pharmacyId,
      amount: Number(amount),
      previousDue,
      remainingDue: sale.dueAmount,
      paymentMethod: paymentMethod || 'cash',
      notes: notes || '',
      createdBy: req.user._id,
    });

    // Update customer stats
    if (sale.customer) {
      const customer = await Customer.findById(sale.customer);
      if (customer) {
        const customerSales = await Sale.aggregate([
          { $match: { customer: customer._id, pharmacyId: req.pharmacyId, isDeleted: false, status: { $nin: ['cancelled', 'returned'] } } },
          {
            $group: {
              _id: null,
              totalPurchases: { $sum: 1 },
              totalSpent: { $sum: '$grandTotal' },
              lastPurchaseDate: { $max: '$saleDate' },
            },
          },
        ]);
        if (customerSales.length > 0) {
          customer.totalPurchases = customerSales[0].totalPurchases;
          customer.totalSpent = customerSales[0].totalSpent;
          customer.lastPurchaseDate = customerSales[0].lastPurchaseDate;
          await customer.save();
        }
      }
    }

    return ApiResponse.success(res, {
      sale: {
        _id: sale._id,
        invoiceNumber: sale.invoiceNumber,
        grandTotal: sale.grandTotal,
        paidAmount: sale.paidAmount,
        dueAmount: sale.dueAmount,
        paymentStatus: sale.paymentStatus,
      },
      amount: Number(amount),
      paymentMethod: paymentMethod || 'cash',
    }, 'Payment received successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Update customer details (name, phone)
// @route   PUT /api/customers/:id
// @access  Private
export const updateCustomer = async (req, res, next) => {
  try {
    const { phoneOrId } = req.params;
    const id = phoneOrId;
    const { name, phone } = req.body;

    const customer = await Customer.findOne({ _id: id, pharmacyId: req.pharmacyId, isDeleted: false });
    if (!customer) {
      return ApiResponse.error(res, 'Customer not found', 404);
    }

    const cleanPhone = (phone || '').trim();

    // If phone is changing, validate no duplicate
    if (cleanPhone && cleanPhone !== customer.phone && !cleanPhone.startsWith('CUST-NP-')) {
      const existing = await Customer.findOne({
        pharmacyId: req.pharmacyId,
        phone: cleanPhone,
        isDeleted: false,
        _id: { $ne: id },
      });
      if (existing) {
        return ApiResponse.error(res, 'This mobile number already exists for another customer', 400);
      }
    }

    // Build update object
    const updateData = {};
    if (name && name.trim()) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = cleanPhone;

    const updated = await Customer.findByIdAndUpdate(id, updateData, { new: true });

    return ApiResponse.success(res, updated, 'Customer updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get payment history
// @route   GET /api/customers/payment-history
// @access  Private
export const getPaymentHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { startDate, endDate } = req.query;

    const matchQuery = { pharmacyId: req.pharmacyId, isDeleted: false };

    if (startDate || endDate) {
      matchQuery.paymentDate = {};
      if (startDate) matchQuery.paymentDate.$gte = new Date(startDate);
      if (endDate) matchQuery.paymentDate.$lte = new Date(endDate);
    }

    const total = await PaymentTransaction.countDocuments(matchQuery);
    const payments = await PaymentTransaction.find(matchQuery)
      .populate({
        path: 'sale',
        select: 'invoiceNumber customerName customerPhone grandTotal',
      })
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.paginated(res, payments, total, page, limit);
  } catch (error) {
    next(error);
  }
};