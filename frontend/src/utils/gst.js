/**
 * Centralized Indian GST Helper (Frontend)
 *
 * Mirrors the backend's `backend/utils/gstHelper.js` so the frontend
 * and backend always use the same GST calculation logic.
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

/**
 * Resolve the applicable GST rate for an item.
 *
 * Priority:
 * 1. If the product's own GST % is greater than 0, use it.
 * 2. If the product's GST % is 0 (or missing), use the pharmacy's
 *    Default GST % configured in Settings (defaultGstRate).
 *
 * NOTE: Product GST = 0 means "use the default", NOT "GST-free".
 *
 * @param {number} productGst - The product's configured GST %
 * @param {number} defaultGstRate - The pharmacy's Default GST % from Settings
 * @returns {number} The applicable GST percentage
 */
export const resolveGstRate = (productGst, defaultGstRate) => {
  const productRate = Number(productGst);
  // If product GST > 0, use the product's own rate
  if (productRate > 0) return productRate;
  // Otherwise fall back to the pharmacy's Default GST rate
  const defaultRate = Number(defaultGstRate);
  if (defaultRate > 0) return defaultRate;
  // Last resort: truly GST-free (both are 0/missing)
  return 0;
};

/**
 * Determine whether a transaction is intra-state (same state) or inter-state (different state)
 *
 * @param {string} pharmacyStateCode - State code of the pharmacy (business place of supply)
 * @param {string} otherPartyStateCode - State code of the customer/supplier (place of supply)
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
 * Calculate full item-level GST breakdown.
 *
 * @param {Object} params
 * @param {number} params.quantity - Item quantity
 * @param {number} params.price - Unit price (before discount)
 * @param {number} params.gstPct - GST percentage
 * @param {number} params.discount - Discount amount or percentage
 * @param {string} params.discountType - 'fixed' or 'percentage'
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
  pharmacyStateCode,
  otherPartyStateCode,
}) => {
  const qty = Number(quantity) || 0;
  const unitPrice = Number(price) || 0;
  const pct = Number(gstPct) || 0;
  const disc = Number(discount) || 0;

  // Step 1: Subtotal (before discount and tax)
  const rawSubtotal = qty * unitPrice;

  // Step 2: Taxable base (before discount)
  const taxableBase = rawSubtotal;

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
 * @param {Array} items - Array of item objects with quantity, sellingPrice, gst, discount, discountType
 * @param {Object} options
 * @param {number} options.discount - Overall invoice discount
 * @param {string} options.discountType - 'fixed' or 'percentage'
 * @param {string} options.pharmacyStateCode - Pharmacy state code
 * @param {string} options.otherPartyStateCode - Customer/Supplier state code
 * @returns {Object} Invoice-level totals
 */
export const calculateInvoiceGST = ({
  items,
  discount = 0,
  discountType = 'fixed',
  pharmacyStateCode,
  otherPartyStateCode,
}) => {
  // Calculate item-level GST breakdowns
  const calcs = items.map(item =>
    calculateItemGST({
      quantity: item.quantity,
      price: item.sellingPrice !== undefined ? item.sellingPrice : 0,
      gstPct: item.gst || 0,
      discount: item.discount || 0,
      discountType: item.discountType || 'fixed',
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
  isIntraState,
  resolveGstRate,
  calculateGST,
  getStateCode,
  calculateItemGST,
  calculateInvoiceGST,
  splitGstRate,
};
