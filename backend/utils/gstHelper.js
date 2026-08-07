/**
 * Centralized Indian GST Helper
 * 
 * Single source of truth for all GST calculations across the system.
 * Every module (Sales, Purchases, Returns, Reports, Invoices) MUST use
 * these functions. Do NOT duplicate GST logic anywhere else.
 * 
 * GST Structure:
 * - Same State sale/purchase: CGST + SGST (split 50/50)
 * - Different State sale/purchase: IGST (full)
 */

// GST state codes (Indian State Codes as per GST)
export const GST_STATE_CODES = {
  'JAMMU AND KASHMIR': '01', 'HIMACHAL PRADESH': '02', 'PUNJAB': '03', 'CHANDIGARH': '04',
  'UTTARAKHAND': '05', 'HARYANA': '06', 'DELHI': '07', 'RAJASTHAN': '08',
  'UTTAR PRADESH': '09', 'BIHAR': '10', 'SIKKIM': '11', 'ARUNACHAL PRADESH': '12',
  'NAGALAND': '13', 'MANIPUR': '14', 'MIZORAM': '15', 'TRIPURA': '16',
  'MEGHALAYA': '17', 'ASSAM': '18', 'WEST BENGAL': '19', 'JHARKHAND': '20',
  'ODISHA': '21', 'CHHATTISGARH': '22', 'MADHYA PRADESH': '23', 'GUJARAT': '24',
  'DAMAN AND DIU': '25', 'DADRA AND NAGAR HAVELI': '26', 'MAHARASHTRA': '27',
  'ANDHRA PRADESH': '28', 'KARNATAKA': '29', 'GOA': '30', 'LAKSHADWEEP': '31',
  'KERALA': '32', 'TAMIL NADU': '33', 'PUDUCHERRY': '34', 'ANDAMAN AND NICOBAR ISLANDS': '35',
  'TELANGANA': '36', 'ANDHRA PRADESH (NEW)': '37', 'LADAKH': '38',
  'OTHER TERRITORY': '97', 'CENTRE JURISDICTION': '99',
};

// Reverse lookup: state code -> state name
export const GST_STATE_NAMES = Object.fromEntries(
  Object.entries(GST_STATE_CODES).map(([name, code]) => [code, name])
);

// Valid GST percentage rates
export const VALID_GST_RATES = [0, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28];

// Standard HSN sections (first 2 digits) for medicines/pharma
const PHARMA_HSN_PREFIXES = ['30', '29', '33', '34', '38', '39', '40', '48', '52', '90'];

/**
 * Validate GSTIN (Goods and Services Tax Identification Number)
 * Format: 2 digits state code + 10 chars PAN + 1 entity code + 1 Z + 1 check digit
 * Total 15 characters. Example: 27AAPFU0939F1ZV
 */
export const validateGSTIN = (gstin) => {
  if (!gstin) return false;
  const clean = String(gstin).trim().toUpperCase();
  if (clean.length !== 15) return { valid: false, message: 'GSTIN must be exactly 15 characters' };
  
  // Regex: 2 digits state code + 10 alphanumeric PAN + 1 alphanumeric + Z + 1 alphanumeric
  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!pattern.test(clean)) {
    return { valid: false, message: 'Invalid GSTIN format. Expected: XXAAAAA0000X1Z5' };
  }
  
  const stateCode = clean.substring(0, 2);
  if (!GST_STATE_NAMES[stateCode]) {
    return { valid: false, message: `Unknown state code '${stateCode}'` };
  }
  
  return { valid: true, message: 'Valid GSTIN', stateCode, stateName: GST_STATE_NAMES[stateCode] };
};

/**
 * Validate HSN Code (Harmonized System of Nomenclature)
 * Valid lengths: 4, 6, or 8 digits
 */
export const validateHSN = (hsn) => {
  if (!hsn) return { valid: false, message: 'HSN code is required' };
  const clean = String(hsn).trim();
  if (!/^\d+$/.test(clean)) return { valid: false, message: 'HSN code must be numeric' };
  if (![4, 6, 8].includes(clean.length)) {
    return { valid: false, message: 'HSN code must be 4, 6, or 8 digits' };
  }
  return { valid: true, message: 'Valid HSN code' };
};

/**
 * Validate GST percentage against standard rates
 */
export const validateGstRate = (rate) => {
  const num = Number(rate);
  if (isNaN(num) || num < 0 || num > 40) return { valid: false, message: 'GST rate must be between 0 and 40' };
  // Allow any numeric GST rate (some states have special rates)
  return { valid: true, message: 'Valid GST rate' };
};

/**
 * Determine whether a transaction is intra-state (same state) or inter-state (different state)
 * 
 * @param {string} supplierStateCode - State code of the pharmacy (business place of supply)
 * @param {string} customerStateCode - State code of the customer/supplier (place of supply)
 * @returns {boolean} true if same state (intra-state), false if different state (inter-state)
 */
export const isIntraState = (pharmacyStateCode, otherPartyStateCode) => {
  // If either state code is missing, default to same state (CGST+SGST)
  if (!pharmacyStateCode || !otherPartyStateCode) return true;
  return String(pharmacyStateCode).padStart(2, '0') === String(otherPartyStateCode).padStart(2, '0');
};

/**
 * Calculate GST breakdown for a taxable amount.
 * 
 * @param {number} taxableAmount - The taxable value (before GST)
 * @param {number} gstPct - Total GST percentage (e.g., 18 for 18%)
 * @param {string} pharmacyStateCode - Pharmacy's state code
 * @param {string} otherPartyStateCode - Customer/Supplier's state code
 * @returns {Object} { cgst, sgst, igst, totalGst }
 */
export const calculateGST = (taxableAmount, gstPct, pharmacyStateCode, otherPartyStateCode) => {
  const amount = Number(taxableAmount) || 0;
  const pct = Number(gstPct) || 0;
  const totalTax = amount * (pct / 100);
  const rounded = (n) => Number(n.toFixed(2));
  
  if (isIntraState(pharmacyStateCode, otherPartyStateCode)) {
    // Intra-state: CGST + SGST split 50/50
    const half = rounded(totalTax / 2);
    const cgst = rounded(totalTax - half); // Handle odd rounding
    return {
      cgst: rounded(totalTax / 2),
      sgst: rounded(totalTax / 2),
      igst: 0,
      totalGst: rounded(totalTax),
    };
  } else {
    // Inter-state: full IGST
    return {
      cgst: 0,
      sgst: 0,
      igst: rounded(totalTax),
      totalGst: rounded(totalTax),
    };
  }
};

/**
 * Convert a state name to its GST state code.
 * @param {string} stateName - e.g., 'Maharashtra', 'DELHI'
 * @returns {string|null} state code or null if not found
 */
export const getStateCode = (stateName) => {
  if (!stateName) return null;
  const clean = String(stateName).trim().toUpperCase();
  
  // Direct lookup
  if (GST_STATE_CODES[clean]) return GST_STATE_CODES[clean];
  
  // Try to find by fuzzy match (contains)
  for (const [name, code] of Object.entries(GST_STATE_CODES)) {
    if (clean.includes(name) || name.includes(clean)) {
      return code;
    }
  }
  
  return null;
};

/**
 * Get the state code from a GSTIN
 * @param {string} gstin - 15-character GSTIN
 * @returns {string|null} 2-digit state code
 */
export const getStateCodeFromGSTIN = (gstin) => {
  if (!gstin) return null;
  return String(gstin).trim().substring(0, 2);
};

/**
 * Calculate the taxable value from a price that may be tax-inclusive or tax-exclusive.
 * 
 * @param {number} price - The unit price
 * @param {boolean} isTaxInclusive - Whether the price includes GST
 * @param {number} gstPct - GST percentage
 * @returns {number} taxable value (net of tax)
 */
export const getTaxableValue = (price, isTaxInclusive, gstPct) => {
  const p = Number(price) || 0;
  const pct = Number(gstPct) || 0;
  if (isTaxInclusive && pct > 0) {
    // Price includes GST: taxable = price / (1 + rate/100)
    return Number((p / (1 + pct / 100)).toFixed(2));
  }
  return Number(p.toFixed(2));
};

/**
 * Calculate full item-level GST breakdown.
 * 
 * @param {Object} params
 * @param {number} params.quantity - Item quantity
 * @param {number} params.price - Unit price (before discount)
 * @param {number} params.gstPct - GST percentage
 * @param {number} params.discount - Discount amount or percentage
 * @param {string} params.discountType - 'fixed' or 'percentage'
 * @param {boolean} params.isTaxInclusive - Whether price includes GST
 * @param {string} params.pharmacyStateCode - Pharmacy state code
 * @param {string} params.otherPartyStateCode - Customer/Supplier state code
 * @returns {Object} Complete item calculation
 */
export const calculateItemGST = ({
  quantity,
  price,
  gstPct,
  discount = 0,
  discountType = 'fixed',
  isTaxInclusive = false,
  pharmacyStateCode,
  otherPartyStateCode,
}) => {
  const qty = Number(quantity) || 0;
  const unitPrice = Number(price) || 0;
  const pct = Number(gstPct) || 0;
  const disc = Number(discount) || 0;

  // Step 1: Subtotal (before discount and tax)
  const rawSubtotal = qty * unitPrice;

  // Step 2: Determine taxable value based on tax inclusive/exclusive
  let taxableBase;
  let gstInclusiveAmount = 0;
  
  if (isTaxInclusive) {
    // Price includes GST - extract the taxable component
    const taxableUnitPrice = getTaxableValue(unitPrice, true, pct);
    taxableBase = qty * taxableUnitPrice;
    gstInclusiveAmount = rawSubtotal - taxableBase;
  } else {
    taxableBase = rawSubtotal;
  }

  // Step 3: Apply discount BEFORE GST
  const discountAmount = discountType === 'percentage'
    ? taxableBase * (disc / 100)
    : Math.min(disc, taxableBase);

  // Step 4: Taxable amount (after discount, before GST)
  const taxableAmount = Math.max(0, taxableBase - discountAmount);

  // Step 5: Calculate GST on taxable amount
  const gstBreakdown = calculateGST(taxableAmount, pct, pharmacyStateCode, otherPartyStateCode);
  const { cgst, sgst, igst, totalGst } = gstBreakdown;

  // Step 6: Final total (taxable + GST)
  const total = Number((taxableAmount + totalGst).toFixed(2));

  return {
    quantity: qty,
    unitPrice: Number(unitPrice.toFixed(2)),
    rawSubtotal: Number(rawSubtotal.toFixed(2)),
    taxableBase: Number(taxableBase.toFixed(2)),
    gstInclusiveAmount: Number(gstInclusiveAmount.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    gstPct: pct,
    cgst,
    sgst,
    igst,
    gstAmount: totalGst,
    total: Number(total.toFixed(2)),
  };
};

/**
 * Calculate full invoice-level GST totals from items.
 * 
 * @param {Array} items - Array of item objects with GST breakdowns
 * @param {Object} options
 * @param {number} options.discount - Overall invoice discount
 * @param {string} options.discountType - 'fixed' or 'percentage'
 * @param {string} options.pharmacyStateCode - Pharmacy state code
 * @param {string} options.otherPartyStateCode - Customer/Supplier state code
 * @param {boolean} options.isTaxInclusive - Whether item prices include GST
 * @param {Array} options.itemCalculations - Pre-calculated item GST breakdowns
 * @returns {Object} Invoice-level totals
 */
export const calculateInvoiceGST = ({
  items,
  discount = 0,
  discountType = 'fixed',
  pharmacyStateCode,
  otherPartyStateCode,
  isTaxInclusive = false,
  itemCalculations = null,
}) => {
  // If item calculations are not provided, calculate them
  const calcs = itemCalculations || items.map(item =>
    calculateItemGST({
      quantity: item.quantity,
      price: item.sellingPrice !== undefined ? item.sellingPrice : (item.purchasePrice !== undefined ? item.purchasePrice : 0),
      gstPct: item.gst || 0,
      discount: item.discount || 0,
      discountType: item.discountType || 'fixed',
      isTaxInclusive,
      pharmacyStateCode,
      otherPartyStateCode,
    })
  );

  // Sum up item-level totals
  const subtotal = calcs.reduce((s, c) => s + c.rawSubtotal, 0);
  const taxableBase = calcs.reduce((s, c) => s + c.taxableBase, 0);
  const itemDiscounts = calcs.reduce((s, c) => s + c.discountAmount, 0);
  const cgst = calcs.reduce((s, c) => s + c.cgst, 0);
  const sgst = calcs.reduce((s, c) => s + c.sgst, 0);
  const igst = calcs.reduce((s, c) => s + c.igst, 0);
  const totalGst = calcs.reduce((s, c) => s + c.gstAmount, 0);
  const itemsTotal = calcs.reduce((s, c) => s + c.total, 0);

  // Overall invoice-level discount (applied to subtotal)
  const overallDiscountAmt = discountType === 'percentage'
    ? taxableBase * (Number(discount) / 100)
    : Math.min(Number(discount) || 0, taxableBase);

  // Taxable amount after all discounts
  const totalTaxableAmount = Math.max(0, taxableBase - itemDiscounts - (overallDiscountAmt > 0 ? overallDiscountAmt : 0));

  // Recalculate GST if there's an overall discount that wasn't already applied
  let finalCgst = cgst;
  let finalSgst = sgst;
  let finalIgst = igst;
  let finalGst = totalGst;

  if (overallDiscountAmt > 0) {
    // Recalculate GST proportionally after overall discount
    // The GST on the discounted portion is removed
    const gstRateUsed = totalTaxableAmount > 0 && taxableBase > 0
      ? (totalGst / Math.max(taxableBase - itemDiscounts, 0.01)) * 100
      : 0;
    
    finalGst = Number((totalTaxableAmount * (gstRateUsed / 100)).toFixed(2));
    
    if (isIntraState(pharmacyStateCode, otherPartyStateCode)) {
      finalCgst = Number((finalGst / 2).toFixed(2));
      finalSgst = Number((finalGst - finalCgst).toFixed(2));
      finalIgst = 0;
    } else {
      finalCgst = 0;
      finalSgst = 0;
      finalIgst = finalGst;
    }
  }

  const grandTotal = Number((totalTaxableAmount + finalGst).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    taxableBase: Number(taxableBase.toFixed(2)),
    itemDiscounts: Number(itemDiscounts.toFixed(2)),
    overallDiscount: Number(overallDiscountAmt.toFixed(2)),
    totalDiscount: Number((itemDiscounts + overallDiscountAmt).toFixed(2)),
    taxableAmount: Number(totalTaxableAmount.toFixed(2)),
    cgst: Number(finalCgst.toFixed(2)),
    sgst: Number(finalSgst.toFixed(2)),
    igst: Number(finalIgst.toFixed(2)),
    totalGst: Number(finalGst.toFixed(2)),
    grandTotal: Number(grandTotal.toFixed(2)),
    isIntraState: isIntraState(pharmacyStateCode, otherPartyStateCode),
  };
};

/**
 * Calculate round-off amount.
 * @param {number} amount - Amount to round
 * @param {string} roundTo - '0.00' (exact), '1' (rupee), '5', '10'
 * @returns {Object} { original, rounded, diff }
 */
export const calculateRoundOff = (amount, roundTo = '0.00') => {
  const original = Number(amount) || 0;
  let rounded;
  
  if (roundTo === '1') {
    rounded = Math.round(original);
  } else if (roundTo === '5') {
    rounded = Math.round(original / 5) * 5;
  } else if (roundTo === '10') {
    rounded = Math.round(original / 10) * 10;
  } else {
    rounded = Number(original.toFixed(2));
  }
  
  return {
    original: Number(original.toFixed(2)),
    rounded: Number(rounded.toFixed(2)),
    diff: Number((rounded - original).toFixed(2)),
  };
};

/**
 * Generate a GST summary entry for reports.
 * @param {Object} item - Sale or Purchase item with GST fields
 * @returns {Object} GST summary entry
 */
export const createGstSummaryEntry = (item) => {
  const gstPct = Number(item.gst) || 0;
  const taxable = Number(item.taxableAmount !== undefined ? item.taxableAmount : item.subtotal) || 0;
  const cgst = Number(item.cgstAmount) || 0;
  const sgst = Number(item.sgstAmount) || 0;
  const igst = Number(item.igstAmount) || 0;
  const total = Number(cgst + sgst + igst).toFixed(2);
  
  return {
    hsnCode: item.hsnCode || item.medicine?.hsnCode || '',
    gstPct,
    taxableValue: Number(taxable.toFixed(2)),
    cgst: Number(cgst.toFixed(2)),
    sgst: Number(sgst.toFixed(2)),
    igst: Number(igst.toFixed(2)),
    totalGst: Number(total),
  };
};

/**
 * Get the GST display label for a rate.
 * E.g., 18 -> '18%', 12 -> '12% (CGST 6% + SGST 6%)'
 */
export const getGstRateLabel = (gstPct) => {
  const pct = Number(gstPct);
  return `${pct}%`;
};

/**
 * Split a GST percentage into CGST + SGST portions.
 * @returns {Object} { cgstPct, sgstPct }
 */
export const splitGstRate = (gstPct) => {
  const pct = Number(gstPct) || 0;
  return {
    cgstPct: Number((pct / 2).toFixed(2)),
    sgstPct: Number((pct / 2).toFixed(2)),
  };
};

export default {
  GST_STATE_CODES,
  GST_STATE_NAMES,
  VALID_GST_RATES,
  validateGSTIN,
  validateHSN,
  validateGstRate,
  isIntraState,
  calculateGST,
  getStateCode,
  getStateCodeFromGSTIN,
  getTaxableValue,
  calculateItemGST,
  calculateInvoiceGST,
  calculateRoundOff,
  createGstSummaryEntry,
  getGstRateLabel,
  splitGstRate,
};