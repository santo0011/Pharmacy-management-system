import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import Customer from '../models/Customer.js';
import CustomerEditHistory from '../models/CustomerEditHistory.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import Pharmacy from '../models/Pharmacy.js';
import ApiResponse from '../utils/apiResponse.js';
import { getStateCode } from '../utils/gstHelper.js';

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
        { gstin: regex },
      ],
    })
      .select('customerId name phone address state stateCode gstin customerType totalPurchases totalSpent lastPurchaseDate')
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
    const { name, phone, address, state, stateCode, gstin, customerType } = req.body;

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

    // If state is not provided, use Default Business State from pharmacy settings
    let finalState = state || '';
    let finalStateCode = stateCode || '';

    if (!finalState) {
      const pharmacy = await Pharmacy.findById(req.pharmacyId);
      if (pharmacy?.state) {
        finalState = pharmacy.state;
        finalStateCode = pharmacy.stateCode || getStateCode(pharmacy.state) || '';
      }
    }

    const customer = await Customer.create({
      name: name.trim(),
      phone: finalPhone,
      address: address || '',
      state: finalState,
      stateCode: finalStateCode || getStateCode(finalState) || '',
      gstin: gstin || '',
      customerType: customerType || 'retail',
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
        { gstin: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } },
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
    let customerDocs = await Customer.find(query)
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // --- DEDUPLICATE customers by phone number ---
    // If multiple customer records share the same real phone number,
    // merge them into a single entry to avoid duplicate rows in the listing.
    const phoneGroups = new Map(); // phone -> { customers: [], merged: {} }
    const noPhoneCustomers = [];

    customerDocs.forEach(c => {
      const phone = (c.phone || '').trim();
      // Only group real phone numbers. Skip empty and auto-generated CUST-NP-* placeholders.
      if (phone && !phone.startsWith('CUST-NP-')) {
        if (!phoneGroups.has(phone)) {
          phoneGroups.set(phone, { customers: [] });
        }
        phoneGroups.get(phone).customers.push(c);
      } else {
        // No real phone - keep each record separate (but also group CUST-NP- by name if they match)
        noPhoneCustomers.push(c);
      }
    });

    // Also group CUST-NP- customers by name to catch duplicates without phone
    const nameGroups = new Map(); // name -> { customers: [] }
    noPhoneCustomers.forEach(c => {
      const nameKey = (c.name || '').trim().toLowerCase();
      if (nameKey) {
        if (!nameGroups.has(nameKey)) {
          nameGroups.set(nameKey, { customers: [] });
        }
        nameGroups.get(nameKey).customers.push(c);
      }
    });

    // Build final deduplicated list
    const deduplicatedCustomers = [];

    // 1. Merge phone-grouped customers (keep the most recently created one, merge all)
    for (const [phone, group] of phoneGroups) {
      const customersInGroup = group.customers;
      // Sort by createdAt descending to keep the latest one as primary
      customersInGroup.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const primary = customersInGroup[0];
      const allIds = customersInGroup.map(c => c._id);
      
      deduplicatedCustomers.push({
        _id: primary._id,
        mergedIds: allIds,
        customerId: primary.customerId,
        customerName: primary.name,
        customerPhone: primary.phone,
        state: primary.state || '',
        stateCode: primary.stateCode || '',
        mergedCount: customersInGroup.length,
      });
    }

    // 2. Add name-grouped CUST-NP- customers (merge by name)
    for (const [nameKey, group] of nameGroups) {
      const customersInGroup = group.customers;
      // Sort by createdAt descending
      customersInGroup.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const primary = customersInGroup[0];
      const allIds = customersInGroup.map(c => c._id);
      
      deduplicatedCustomers.push({
        _id: primary._id,
        mergedIds: allIds,
        customerId: primary.customerId,
        customerName: primary.name,
        customerPhone: primary.phone,
        state: primary.state || '',
        stateCode: primary.stateCode || '',
        mergedCount: customersInGroup.length > 1 ? customersInGroup.length : 1,
      });
    }

    // Recalculate pagination based on deduplicated count
    // Sort deduplicated list by createdAt of primary
    deduplicatedCustomers.sort((a, b) => {
      const aDoc = customerDocs.find(c => c._id.toString() === a._id.toString());
      const bDoc = customerDocs.find(c => c._id.toString() === b._id.toString());
      return (new Date(bDoc?.createdAt || 0)) - (new Date(aDoc?.createdAt || 0));
    });

    const dedupTotal = deduplicatedCustomers.length;
    // Apply pagination on deduplicated list
    const pagedDedup = deduplicatedCustomers.slice(0, limit);

    // Collect all customer IDs from deduplicated entries for stats calculation
    const allMergedIds = [];
    pagedDedup.forEach(d => {
      d.mergedIds.forEach(id => allMergedIds.push(id));
    });

    // Get aggregated sales stats for all customer IDs (merged or not)
    const salesStatsByRef = await Sale.aggregate([
      {
        $match: {
          pharmacyId: req.pharmacyId,
          isDeleted: false,
          customer: { $in: allMergedIds },
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

    // Build stats map from ref-based results (by customer _id)
    const statsMap = {};
    salesStatsByRef.forEach(stat => {
      statsMap[stat._id.toString()] = stat;
    });

    // Also get stats by phone for older sales that may not have customer ref
    const phonesToCheck = pagedDedup
      .filter(d => d.customerPhone && !d.customerPhone.startsWith('CUST-NP-'))
      .map(d => d.customerPhone);

    const phoneStatsMap = {};
    if (phonesToCheck.length > 0) {
      const phoneStats = await Sale.aggregate([
        {
          $match: {
            pharmacyId: req.pharmacyId,
            isDeleted: false,
            customerPhone: { $in: phonesToCheck },
            status: { $nin: ['cancelled', 'returned'] },
            $or: [
              { customer: null },
              { customer: { $exists: false } },
            ],
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
      ]);

      phoneStats.forEach(stat => {
        phoneStatsMap[stat._id] = stat;
      });
    }

    // Map to backward-compatible format with real aggregated data
    const customers = pagedDedup.map(d => {
      // Aggregate stats across all merged customer IDs
      let mergedStats = {
        totalPurchases: 0,
        totalSpent: 0,
        totalPaid: 0,
        totalDue: 0,
        lastPurchaseDate: null,
      };

      // 1. Sum stats from all merged customer refs
      d.mergedIds.forEach(id => {
        const stats = statsMap[id.toString()];
        if (stats) {
          mergedStats.totalPurchases += stats.totalPurchases || 0;
          mergedStats.totalSpent += stats.totalSpent || 0;
          mergedStats.totalPaid += stats.totalPaid || 0;
          mergedStats.totalDue += stats.totalDue || 0;
          if (stats.lastPurchaseDate && (!mergedStats.lastPurchaseDate || new Date(stats.lastPurchaseDate) > new Date(mergedStats.lastPurchaseDate))) {
            mergedStats.lastPurchaseDate = stats.lastPurchaseDate;
          }
        }
      });

      // 2. Also merge legacy phone-based stats (older sales without customer ref)
      if (d.customerPhone && !d.customerPhone.startsWith('CUST-NP-')) {
        const phoneStat = phoneStatsMap[d.customerPhone];
        if (phoneStat) {
          mergedStats.totalPurchases += phoneStat.totalPurchases || 0;
          mergedStats.totalSpent += phoneStat.totalSpent || 0;
          mergedStats.totalPaid += phoneStat.totalPaid || 0;
          mergedStats.totalDue += phoneStat.totalDue || 0;
          if (phoneStat.lastPurchaseDate && (!mergedStats.lastPurchaseDate || new Date(phoneStat.lastPurchaseDate) > new Date(mergedStats.lastPurchaseDate))) {
            mergedStats.lastPurchaseDate = phoneStat.lastPurchaseDate;
          }
        }
      }

      const primaryDoc = customerDocs.find(c => c._id.toString() === d._id.toString());

      return {
        customerName: d.customerName,
        customerPhone: d.customerPhone || '',
        customerId: d.customerId,
        state: d.state || '',
        stateCode: d.stateCode || '',
        totalPurchases: mergedStats.totalPurchases || 0,
        totalSpent: mergedStats.totalSpent || 0,
        totalPaid: mergedStats.totalPaid || 0,
        totalDue: mergedStats.totalDue || 0,
        lastPurchaseDate: mergedStats.lastPurchaseDate || null,
        firstPurchaseDate: primaryDoc?.createdAt || null,
        _id: d._id,
        mergedCount: d.mergedCount,
      };
    });

    return ApiResponse.paginated(res, customers, dedupTotal, page, limit);
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

    // Add search filter for customerRef path - only for name/phone search when NOT searching by invoice number
    if (search && hasCustomerRefs) {
      // Check if the search term could match an invoice number pattern.
      // Invoice formats include: INV-XXXX, SALE-XXXX, PUR-XXXX, or any search containing a hyphen/digit pattern
      const hasInvoiceInMatch = matchStage.$or &&
        matchStage.$or.some(cond => cond.invoiceNumber !== undefined);
      
      // Only add name/phone post-group filter when NOT matching by invoice number.
      // The initial $match stage already handles invoiceNumber search correctly.
      if (!hasInvoiceInMatch) {
        pipeline.splice(4, 0, {
          $match: {
            $or: [
              { 'customerInfo.name': { $regex: search, $options: 'i' } },
              { 'customerInfo.phone': { $regex: search, $options: 'i' } },
            ],
          },
        });
      }
      // If it's an invoice search, the $match at the top of the pipeline already handles it via matchStage.$or
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
    const { name, phone, state, stateCode } = req.body;

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

    // Build update object and track changes
    const updateData = {};
    const changes = [];

    if (name && name.trim() && name.trim() !== customer.name) {
      updateData.name = name.trim();
      changes.push({
        field: 'name',
        label: 'Customer Name',
        previousValue: customer.name,
        newValue: name.trim(),
      });
    }
    if (phone !== undefined && cleanPhone !== customer.phone) {
      updateData.phone = cleanPhone;
      changes.push({
        field: 'phone',
        label: 'Phone Number',
        previousValue: customer.phone,
        newValue: cleanPhone,
      });
    }
    if (state !== undefined && state !== customer.state) {
      updateData.state = state;
      updateData.stateCode = stateCode || getStateCode(state) || '';
      changes.push({
        field: 'state',
        label: 'State',
        previousValue: customer.state || '',
        newValue: state,
      });
    }

    if (changes.length === 0) {
      return ApiResponse.success(res, customer, 'No changes made');
    }

    const snapshotBefore = {
      name: customer.name,
      phone: customer.phone,
    };

    const updated = await Customer.findByIdAndUpdate(id, updateData, { new: true });

    // Save edit history
    const editedByName = req.user?.name || req.user?.username || 'Unknown';
    await CustomerEditHistory.create({
      customer: customer._id,
      pharmacyId: req.pharmacyId,
      editedBy: req.user._id,
      editedByName,
      changes,
      snapshotBefore,
      snapshotAfter: {
        name: updated.name,
        phone: updated.phone,
      },
    });

    return ApiResponse.success(res, updated, 'Customer updated successfully');
  } catch (error) {
    next(error);
  }
};

// @desc    Get customer edit history
// @route   GET /api/customers/:phoneOrId/edit-history
// @access  Private
export const getCustomerEditHistory = async (req, res, next) => {
  try {
    const { phoneOrId } = req.params;

    // Find customer by _id, customerId, or phone
    let customer = null;
    if (mongoose.Types.ObjectId.isValid(phoneOrId)) {
      customer = await Customer.findOne({ _id: phoneOrId, pharmacyId: req.pharmacyId, isDeleted: false });
    }
    if (!customer) {
      customer = await Customer.findOne({ customerId: phoneOrId, pharmacyId: req.pharmacyId, isDeleted: false });
    }
    if (!customer) {
      customer = await Customer.findOne({ phone: phoneOrId, pharmacyId: req.pharmacyId, isDeleted: false });
    }

    if (!customer) {
      return ApiResponse.error(res, 'Customer not found', 404);
    }

    const history = await CustomerEditHistory.find({
      customer: customer._id,
      pharmacyId: req.pharmacyId,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return ApiResponse.success(res, history);
  } catch (error) {
    next(error);
  }
};

// @desc    Get payment history
// @route   GET /api/customers/payment-history
// @access  Private
// @desc    Get customer dashboard statistics (total customers, total receivable, total collected)
// @route   GET /api/customers/stats
// @access  Private
export const getCustomerStats = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;

    // Total unique customers count
    const totalCustomers = await Customer.countDocuments({
      pharmacyId,
      isDeleted: false,
    });

    // Aggregate sales stats for all customers belonging to this pharmacy
    const salesStats = await Sale.aggregate([
      {
        $match: {
          pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
          isDeleted: false,
          status: { $nin: ['cancelled', 'returned'] },
        },
      },
      {
        $group: {
          _id: null,
          totalReceivable: { $sum: '$dueAmount' },
          totalCollected: { $sum: '$paidAmount' },
          totalSalesAmount: { $sum: '$grandTotal' },
        },
      },
    ]);

    const stats = salesStats[0] || { totalReceivable: 0, totalCollected: 0, totalSalesAmount: 0 };

    return ApiResponse.success(res, {
      totalCustomers,
      totalReceivable: stats.totalReceivable || 0,
      totalCollected: stats.totalCollected || 0,
      totalSalesAmount: stats.totalSalesAmount || 0,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get top selling customers ranked by total sales amount
// @route   GET /api/customers/top-selling
// @access  Private
export const getTopSellingCustomers = async (req, res, next) => {
  try {
    const pharmacyId = req.pharmacyId;
    const limit = parseInt(req.query.limit) || 5;

    // Aggregate sales by customer reference (newer sales with customer ref)
    const topCustomers = await Sale.aggregate([
      {
        $match: {
          pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
          isDeleted: false,
          status: { $nin: ['cancelled', 'returned'] },
          customer: { $ne: null },
        },
      },
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
          customerName: { $ifNull: ['$customerInfo.name', 'Unknown'] },
          customerPhone: { $ifNull: ['$customerInfo.phone', ''] },
          totalPurchases: 1,
          totalAmount: { $round: ['$totalAmount', 2] },
          totalPaid: { $round: ['$totalPaid', 2] },
          totalDue: { $round: ['$totalDue', 2] },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: limit },
    ]);

    return ApiResponse.success(res, topCustomers);
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