/**
 * Invoice Templates for printing
 * Each template returns HTML string given sale data and settings
 * All currency values use the pharmacy's configured currency symbol dynamically.
 */

import { getCurrentSymbol } from './currency';

// Recompute GST-first values from stored item data so Print Invoice matches
// the Invoice/Edit page and Sales Details (GST calculated FIRST on the full
// subtotal, discount applied AFTER GST on the GST-inclusive total).
// Format a percentage to at most 2 decimals, removing unnecessary trailing zeros.
// e.g. 19.54545 → "19.55", 2.5 → "2.5", 5 → "5"
function fmtPct(n) {
  const val = Number(n) || 0;
  const rounded = Math.round(val * 100) / 100;
  return String(rounded);
}

// Recompute GST-first values from stored item data so Print Invoice matches
// the Invoice/Edit page and Sales Details (GST calculated FIRST on the full
// subtotal, discount applied AFTER GST on the GST-inclusive total).
function gstFirstFromItems(sale) {
  const items = (sale.items || []).map(item => {
    const base = Number(item.subtotal) > 0
      ? Number(item.subtotal)
      : Number(item.quantity) * Number(item.sellingPrice);
    const gstPct = Number(item.gst) || 0;
    const gstAmt = Number((base * (gstPct / 100)).toFixed(2));
    return { base, gstAmt };
  });
  const subtotal = items.reduce((s, i) => s + i.base, 0);
  const totalGst = items.reduce((s, i) => s + i.gstAmt, 0);
  const gstInclusive = Number((subtotal + totalGst).toFixed(2));
  const totalDiscount = Math.max(0, Number((gstInclusive - Number(sale.grandTotal || 0)).toFixed(2)));
  const cgst = Number((totalGst / 2).toFixed(2));
  const sgst = Number((totalGst - cgst).toFixed(2));
  const igst = totalGst;
  // Dynamic percentage labels (calculated from actual Subtotal / Total Discount / GST values)
  const baseAmt = subtotal > 0 ? subtotal : 1;
  const totalDiscountPct = fmtPct((totalDiscount / baseAmt) * 100);
  const cgstPct = fmtPct((cgst / baseAmt) * 100);
  const sgstPct = fmtPct((sgst / baseAmt) * 100);
  const totalGstPct = fmtPct((totalGst / baseAmt) * 100);
  const igstPct = totalGstPct;
  return { subtotal, totalGst, gstInclusive, totalDiscount, cgst, sgst, igst, totalDiscountPct, cgstPct, sgstPct, totalGstPct, igstPct };
}

// Template 1: Classic - Clean blue-themed professional layout
const templateClassic = (sale, pharmacy, currencySymbol) => {
  const sym = currencySymbol || getCurrentSymbol() || '₹';
  const gstin = pharmacy.gstin || pharmacy.gstNumber || '';
  const stateCode = pharmacy.stateCode || '';
  const isIntra = sale.isIntraState !== false;
  const g = gstFirstFromItems(sale);
  const cgstAmt = g.cgst.toFixed(2);
  const sgstAmt = g.sgst.toFixed(2);
  const igstAmt = g.igst.toFixed(2);
  const taxableAmt = Number(sale.taxableAmount || 0).toFixed(2);
  const subtotalAmt = g.subtotal.toFixed(2);
  const totalGstAmt = g.totalGst.toFixed(2);
  const totalDiscountAmt = g.totalDiscount.toFixed(2);
  const totalDiscountPct = g.totalDiscountPct;
  const cgstPct = g.cgstPct;
  const sgstPct = g.sgstPct;
  const totalGstPct = g.totalGstPct;
  const igstPct = g.igstPct;
  return `
<style>
  @page { size: ${pharmacy.printFormat === 'a4' ? 'A4' : pharmacy.printFormat === '58mm' ? '58mm 297mm' : '80mm 297mm'}; margin: ${pharmacy.printFormat === 'a4' ? '15mm' : '5mm 3mm'}; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; font-size: ${pharmacy.printFormat === 'a4' ? '12px' : '10px'}; line-height: 1.5; margin: 0; padding: 0; }
  .invoice-box { max-width: ${pharmacy.printFormat === 'a4' ? '800px' : '100%'}; margin: auto; padding: ${pharmacy.printFormat === 'a4' ? '20px' : '8px'}; }
  .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #0ea5e9; }
  .header .title { font-size: ${pharmacy.printFormat === 'a4' ? '28px' : '18px'}; font-weight: 700; color: #0ea5e9; }
  .header .details { text-align: right; font-size: ${pharmacy.printFormat === 'a4' ? 'inherit' : '9px'}; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: ${pharmacy.printFormat === 'a4' ? 'inherit' : '8px'}; }
  th { background: #f1f5f9; padding: ${pharmacy.printFormat === 'a4' ? '10px 12px' : '4px 6px'}; text-align: left; font-size: ${pharmacy.printFormat === 'a4' ? '11px' : '7px'}; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  td { padding: ${pharmacy.printFormat === 'a4' ? '10px 12px' : '4px 6px'}; border-bottom: 1px solid #e2e8f0; }
  .summary { margin-top: 15px; margin-left: auto; width: ${pharmacy.printFormat === 'a4' ? '350px' : '100%'}; }
  .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
  .summary-row.total { font-size: ${pharmacy.printFormat === 'a4' ? '18px' : '12px'}; font-weight: 700; color: #0ea5e9; border-top: 2px solid #0ea5e9; padding-top: 8px; margin-top: 4px; }
  .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: ${pharmacy.printFormat === 'a4' ? '11px' : '8px'}; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: ${pharmacy.printFormat === 'a4' ? '11px' : '8px'}; }
  .badge-success { background: #dcfce7; color: #16a34a; }
  .customer-info { margin-bottom: 15px; font-size: ${pharmacy.printFormat === 'a4' ? 'inherit' : '9px'}; }
  .gst-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; }
  .gst-intra { background: #dcfce7; color: #16a34a; }
  .gst-inter { background: #e0f2fe; color: #0284c7; }
  @media print { .no-print { display: none; } }
</style>
<div class="invoice-box">
  <div class="header">
    <div>
      <div class="title">${pharmacy.pharmacyName || 'PHARMACY'}</div>
      <div style="color:#64748b;margin-top:4px;">${pharmacy.phone ? `Phone: ${pharmacy.phone}` : 'Medical Store'}</div>
      ${gstin ? `<div style="color:#64748b;font-size:11px;font-weight:600;">GSTIN: ${gstin}</div>` : ''}
      ${stateCode ? `<div style="color:#94a3b8;font-size:11px;">State Code: ${stateCode}</div>` : ''}
      ${pharmacy.address ? `<div style="color:#94a3b8;font-size:11px;">${pharmacy.address}</div>` : ''}
    </div>
    <div class="details">
      <div style="font-weight:600;font-size:${pharmacy.printFormat === 'a4' ? '16px' : '12px'};">${sale.invoiceNumber}</div>
      <div>${new Date(sale.saleDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      <div style="margin-top:4px;"><span class="gst-badge ${isIntra ? 'gst-intra' : 'gst-inter'}">${isIntra ? 'Intra-State (CGST+SGST)' : 'Inter-State (IGST)'}</span></div>
    </div>
  </div>
  <div class="customer-info">
    <div style="font-weight:600;">Customer: ${sale.customerName}</div>
    ${sale.customerPhone ? `<div>Phone: ${sale.customerPhone}</div>` : ''}
    ${sale.customerGstin ? `<div>GSTIN: ${sale.customerGstin}</div>` : ''}
    ${sale.customerStateCode ? `<div>State Code: ${sale.customerStateCode}</div>` : ''}
  </div>
  <table>
    <thead><tr><th>#</th><th>Medicine</th><th>HSN</th><th>Qty</th><th>Price</th><th>Taxable</th><th>GST%</th><th>Total</th></tr></thead>
    <tbody>
      ${sale.items?.map((item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td style="font-weight:500;">${item.medicineName}</td>
          <td style="font-size:10px;">${item.hsnCode || '-'}</td>
          <td>${item.quantity}</td>
          <td>${sym} ${Number(item.sellingPrice).toFixed(2)}</td>
          <td>${sym} ${Number(item.taxableAmount || item.subtotal || 0).toFixed(2)}</td>
          <td>${item.gst}%</td>
          <td style="font-weight:600;">${sym} ${Number(item.total).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="summary">
    <div class="summary-row"><span>Subtotal:</span><span>${sym} ${subtotalAmt}</span></div>
    <div class="summary-row" style="color:#ef4444;font-weight:600;"><span>Total Discount (${totalDiscountPct}%):</span><span>− ${sym} ${totalDiscountAmt}</span></div>
    ${isIntra ? `
    <div class="summary-row"><span>CGST (${cgstPct}%):</span><span>${sym} ${cgstAmt}</span></div>
    <div class="summary-row"><span>SGST (${sgstPct}%):</span><span>${sym} ${sgstAmt}</span></div>
    ` : `
    <div class="summary-row"><span>IGST (${igstPct}%):</span><span>${sym} ${igstAmt}</span></div>
    `}
    <div class="summary-row"><span>Total GST (${totalGstPct}%):</span><span>${sym} ${totalGstAmt}</span></div>
    ${sale.previousDueAmount > 0 ? `
    <div class="summary-row" style="color:#c2410c;"><span>Previous Due Paid:</span><span>${sym} ${Number(sale.previousDuePaid || 0).toFixed(2)}</span></div>
    ` : ''}
    <div class="summary-row total"><span>Grand Total:</span><span>${sym} ${(Number(sale.grandTotal || 0) + Number(sale.previousDueAmount || 0)).toFixed(2)}</span></div>
    <div class="summary-row"><span>Paid:</span><span>${sym} ${Number(sale.paidAmount || 0).toFixed(2)}</span></div>
    ${sale.previousDueAmount > 0 ? `
    <div class="summary-row" style="color:#16a34a;font-size:10px;"><span>Including Previous Due Paid:</span><span>${sym} ${Number(sale.previousDuePaid || 0).toFixed(2)}</span></div>
    ` : ''}
    <div class="summary-row"><span>Due:</span><span style="color:${sale.dueAmount > 0 ? '#ef4444' : '#22c55e'};font-weight:600;">${sym} ${Number(sale.dueAmount || 0).toFixed(2)}</span></div>
    <div class="summary-row"><span>Payment:</span><span style="text-transform:capitalize;">${sale.paymentMethod} <span class="badge badge-success">${sale.paymentStatus}</span></span></div>
  </div>
  <div class="footer">
    <div>Thank you for your business!</div>
    <div style="margin-top:4px;">Invoice generated on ${new Date().toLocaleString()}</div>
  </div>
</div>
`;
};

// Template 2: Modern - Dark header, green accent, clean
const templateModern = (sale, pharmacy, currencySymbol) => {
  const sym = currencySymbol || getCurrentSymbol() || '₹';
  const g = gstFirstFromItems(sale);
  const subtotalAmt = g.subtotal.toFixed(2);
  const totalGstAmt = g.totalGst.toFixed(2);
  const totalDiscountAmt = g.totalDiscount.toFixed(2);
  const totalDiscountPct = g.totalDiscountPct;
  const totalGstPct = g.totalGstPct;
  const cgstPct = g.cgstPct;
  const sgstPct = g.sgstPct;
  const igstPct = g.igstPct;
  return `
<style>
  @page { size: ${pharmacy.printFormat === 'a4' ? 'A4' : pharmacy.printFormat === '58mm' ? '58mm 297mm' : '80mm 297mm'}; margin: ${pharmacy.printFormat === 'a4' ? '15mm' : '5mm 3mm'}; }
  body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: ${pharmacy.printFormat === 'a4' ? '12px' : '10px'}; line-height: 1.5; margin: 0; padding: 0; background: #f8fafc; }
  .invoice-box { max-width: ${pharmacy.printFormat === 'a4' ? '800px' : '100%'}; margin: auto; background: #fff; border-radius: ${pharmacy.printFormat === 'a4' ? '12px' : '0'}; overflow: hidden; box-shadow: ${pharmacy.printFormat === 'a4' ? '0 4px 20px rgba(0,0,0,0.08)' : 'none'}; }
  .header { background: linear-gradient(135deg, #1e293b, #334155); color: #fff; padding: ${pharmacy.printFormat === 'a4' ? '30px' : '12px'}; }
  .header-content { display: flex; justify-content: space-between; align-items: start; }
  .header .title { font-size: ${pharmacy.printFormat === 'a4' ? '26px' : '18px'}; font-weight: 800; letter-spacing: -0.5px; }
  .header .sub { font-size: ${pharmacy.printFormat === 'a4' ? '13px' : '9px'}; color: #94a3b8; margin-top: 4px; }
  .header .details { text-align: right; }
  .header .details .inv { font-size: ${pharmacy.printFormat === 'a4' ? '18px' : '12px'}; font-weight: 700; color: #22c55e; }
  .header .details .date { font-size: ${pharmacy.printFormat === 'a4' ? '12px' : '9px'}; color: #94a3b8; margin-top: 2px; }
  .body-content { padding: ${pharmacy.printFormat === 'a4' ? '30px' : '10px'}; }
  .customer-section { background: #f1f5f9; border-radius: 8px; padding: ${pharmacy.printFormat === 'a4' ? '16px' : '8px'}; margin-bottom: 20px; display: flex; justify-content: space-between; }
  .customer-section .label { font-size: ${pharmacy.printFormat === 'a4' ? '11px' : '8px'}; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .customer-section .value { font-weight: 600; color: #1e293b; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: ${pharmacy.printFormat === 'a4' ? 'inherit' : '8px'}; }
  th { background: #f0fdf4; padding: ${pharmacy.printFormat === 'a4' ? '12px' : '4px 6px'}; text-align: left; font-size: ${pharmacy.printFormat === 'a4' ? '11px' : '7px'}; text-transform: uppercase; color: #16a34a; border-bottom: 2px solid #22c55e; font-weight: 700; }
  td { padding: ${pharmacy.printFormat === 'a4' ? '10px 12px' : '4px 6px'}; border-bottom: 1px solid #e2e8f0; }
  tr:last-child td { border-bottom: none; }
  .summary { margin-top: 15px; margin-left: auto; width: ${pharmacy.printFormat === 'a4' ? '350px' : '100%'}; }
  .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
  .summary-row.total { font-size: ${pharmacy.printFormat === 'a4' ? '20px' : '13px'}; font-weight: 800; color: #16a34a; border-top: 2px solid #22c55e; padding-top: 10px; margin-top: 6px; }
  .footer { background: #f8fafc; padding: ${pharmacy.printFormat === 'a4' ? '20px' : '10px'}; text-align: center; color: #94a3b8; font-size: ${pharmacy.printFormat === 'a4' ? '11px' : '8px'}; border-top: 1px solid #e2e8f0; }
  .badge-success { background: #dcfce7; color: #16a34a; padding: 2px 8px; border-radius: 4px; font-size: ${pharmacy.printFormat === 'a4' ? '11px' : '8px'}; }
  @media print { .no-print { display: none; } }
</style>
<div class="invoice-box">
  <div class="header">
    <div class="header-content">
      <div>
        <div class="title">${pharmacy.pharmacyName || 'PHARMACY'}</div>
        <div class="sub">${pharmacy.phone ? `Phone: ${pharmacy.phone}` : 'Medical Store'}${pharmacy.address ? ` &bull; ${pharmacy.address}` : ''}</div>
      </div>
      <div class="details">
        <div class="inv">${sale.invoiceNumber}</div>
        <div class="date">${new Date(sale.saleDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>
  </div>
  <div class="body-content">
    <div class="customer-section">
      <div>
        <div class="label">Customer</div>
        <div class="value">${sale.customerName}</div>
        ${sale.customerPhone ? `<div style="color:#64748b;font-size:12px;margin-top:2px;">${sale.customerPhone}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div class="label">Payment</div>
        <div><span class="badge-success">${sale.paymentStatus}</span></div>
      </div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>Price</th><th>GST</th><th>Total</th></tr></thead>
      <tbody>
        ${sale.items?.map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td style="font-weight:500;">${item.medicineName}</td>
            <td>${item.quantity}</td>
            <td>${sym} ${Number(item.sellingPrice).toFixed(2)}</td>
            <td>${item.gst}%</td>
            <td style="font-weight:600;">${sym} ${Number(item.total).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="summary">
      <div class="summary-row"><span>Subtotal:</span><span>${sym} ${subtotalAmt}</span></div>
      <div class="summary-row"><span>GST (${totalGstPct}%):</span><span>${sym} ${totalGstAmt}</span></div>
      <div class="summary-row" style="color:#ef4444;font-weight:600;"><span>Total Discount (${totalDiscountPct}%):</span><span>− ${sym} ${totalDiscountAmt}</span></div>
      <div class="summary-row" style="font-weight:600;"><span>Current Bill Total:</span><span>${sym} ${(Number(sale.grandTotal || 0) - Number(sale.roundOffAmount || 0)).toFixed(2)}</span></div>
      ${sale.previousDueAmount > 0 ? `
      <div class="summary-row" style="color:#c2410c;"><span>Previous Due Paid:</span><span>${sym} ${Number(sale.previousDuePaid || 0).toFixed(2)}</span></div>
      ` : ''}
      <div class="summary-row total"><span>Grand Total:</span><span>${sym} ${(Number(sale.grandTotal || 0) + Number(sale.previousDueAmount || 0)).toFixed(2)}</span></div>
      <div class="summary-row"><span>Paid:</span><span>${sym} ${Number(sale.paidAmount || 0).toFixed(2)}</span></div>
      <div class="summary-row"><span>Due:</span><span style="color:${sale.dueAmount > 0 ? '#ef4444' : '#22c55e'};font-weight:600;">${sym} ${Number(sale.dueAmount || 0).toFixed(2)}</span></div>
      <div class="summary-row"><span>Method:</span><span style="text-transform:capitalize;">${sale.paymentMethod}</span></div>
    </div>
  </div>
  <div class="footer">
    <div>Thank you for your business!</div>
    <div style="margin-top:4px;">Invoice generated on ${new Date().toLocaleString()}</div>
  </div>
</div>
`;
};

// Template 3: Minimal - Clean, borderless, minimal design with serif
const templateMinimal = (sale, pharmacy, currencySymbol) => {
  const sym = currencySymbol || getCurrentSymbol() || '₹';
  const g = gstFirstFromItems(sale);
  const subtotalAmt = g.subtotal.toFixed(2);
  const totalGstAmt = g.totalGst.toFixed(2);
  const totalDiscountAmt = g.totalDiscount.toFixed(2);
  const totalDiscountPct = g.totalDiscountPct;
  const totalGstPct = g.totalGstPct;
  const cgstPct = g.cgstPct;
  const sgstPct = g.sgstPct;
  const igstPct = g.igstPct;
  return `
<style>
  @page { size: ${pharmacy.printFormat === 'a4' ? 'A4' : pharmacy.printFormat === '58mm' ? '58mm 297mm' : '80mm 297mm'}; margin: ${pharmacy.printFormat === 'a4' ? '15mm' : '5mm 3mm'}; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #2d2d2d; font-size: ${pharmacy.printFormat === 'a4' ? '12px' : '10px'}; line-height: 1.6; margin: 0; padding: 0; }
  .invoice-box { max-width: ${pharmacy.printFormat === 'a4' ? '700px' : '100%'}; margin: auto; padding: ${pharmacy.printFormat === 'a4' ? '40px' : '10px'}; }
  .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #ddd; }
  .header .title { font-size: ${pharmacy.printFormat === 'a4' ? '32px' : '20px'}; font-weight: 400; letter-spacing: 2px; text-transform: uppercase; color: #1a1a1a; }
  .header .sub { color: #888; font-size: ${pharmacy.printFormat === 'a4' ? '13px' : '9px'}; margin-top: 4px; font-family: 'Segoe UI', Arial, sans-serif; }
  .header .inv-number { margin-top: 8px; font-size: ${pharmacy.printFormat === 'a4' ? '16px' : '11px'}; letter-spacing: 1px; color: #666; font-family: 'Segoe UI', Arial, sans-serif; }
  .info-row { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px 0; border-bottom: 1px dashed #ddd; }
  .info-row .label { font-size: ${pharmacy.printFormat === 'a4' ? '10px' : '8px'}; text-transform: uppercase; letter-spacing: 1px; color: #999; font-family: 'Segoe UI', Arial, sans-serif; }
  .info-row .value { font-size: ${pharmacy.printFormat === 'a4' ? '14px' : '10px'}; font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: ${pharmacy.printFormat === 'a4' ? 'inherit' : '8px'}; }
  th { padding: ${pharmacy.printFormat === 'a4' ? '10px 8px' : '4px 4px'}; text-align: left; font-size: ${pharmacy.printFormat === 'a4' ? '10px' : '7px'}; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 400; border-bottom: 1px solid #ddd; font-family: 'Segoe UI', Arial, sans-serif; }
  td { padding: ${pharmacy.printFormat === 'a4' ? '10px 8px' : '4px 4px'}; border-bottom: 1px solid #eee; }
  .summary { margin-top: 20px; border-top: 2px solid #333; padding-top: 10px; }
  .summary-row { display: flex; justify-content: space-between; padding: 3px 0; font-family: 'Segoe UI', Arial, sans-serif; }
  .summary-row.total { font-size: ${pharmacy.printFormat === 'a4' ? '20px' : '13px'}; font-weight: 700; padding-top: 8px; margin-top: 4px; border-top: 1px solid #ddd; }
  .footer { margin-top: 40px; text-align: center; color: #aaa; font-size: ${pharmacy.printFormat === 'a4' ? '11px' : '8px'}; font-family: 'Segoe UI', Arial, sans-serif; padding-top: 20px; border-top: 1px solid #eee; }
  .badge-success { color: #16a34a; font-weight: 600; }
  @media print { .no-print { display: none; } }
</style>
<div class="invoice-box">
  <div class="header">
    <div class="title">${pharmacy.pharmacyName || 'PHARMACY'}</div>
    <div class="sub">${pharmacy.phone ? `Phone: ${pharmacy.phone}` : 'Medical Store'}${pharmacy.address ? ` &bull; ${pharmacy.address}` : ''}</div>
    <div class="inv-number">${sale.invoiceNumber}</div>
  </div>
  <div class="info-row">
    <div>
      <div class="label">Date</div>
      <div class="value">${new Date(sale.saleDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
    </div>
    <div style="text-align:right;">
      <div class="label">Customer</div>
      <div class="value">${sale.customerName}</div>
      ${sale.customerPhone ? `<div style="color:#888;font-size:12px;">${sale.customerPhone}</div>` : ''}
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>Price</th><th>GST</th><th>Total</th></tr></thead>
    <tbody>
      ${sale.items?.map((item, idx) => `
        <tr>
          <td style="color:#999;">${idx + 1}</td>
          <td style="font-weight:500;">${item.medicineName}</td>
          <td>${item.quantity}</td>
          <td>${sym} ${Number(item.sellingPrice).toFixed(2)}</td>
          <td>${item.gst}%</td>
          <td style="font-weight:600;">${sym} ${Number(item.total).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="summary">
    <div class="summary-row"><span>Subtotal</span><span>${sym} ${subtotalAmt}</span></div>
    <div class="summary-row"><span>GST (${totalGstPct}%)</span><span>${sym} ${totalGstAmt}</span></div>
    <div class="summary-row" style="color:#ef4444;font-weight:600;"><span>Total Discount (${totalDiscountPct}%)</span><span>− ${sym} ${totalDiscountAmt}</span></div>
    <div class="summary-row" style="font-weight:600;"><span>Current Bill Total</span><span>${sym} ${(Number(sale.grandTotal || 0) - Number(sale.roundOffAmount || 0)).toFixed(2)}</span></div>
    ${sale.previousDueAmount > 0 ? `
    <div class="summary-row" style="color:#c2410c;"><span>Previous Due Paid</span><span>${sym} ${Number(sale.previousDuePaid || 0).toFixed(2)}</span></div>
    ` : ''}
    <div class="summary-row total"><span>Grand Total</span><span>${sym} ${(Number(sale.grandTotal || 0) + Number(sale.previousDueAmount || 0)).toFixed(2)}</span></div>
    <div class="summary-row"><span>Paid</span><span>${sym} ${Number(sale.paidAmount || 0).toFixed(2)}</span></div>
    <div class="summary-row"><span>Due</span><span style="color:${sale.dueAmount > 0 ? '#ef4444' : '#22c55e'};font-weight:600;">${sym} ${Number(sale.dueAmount || 0).toFixed(2)}</span></div>
    <div class="summary-row"><span>Payment</span><span style="text-transform:capitalize;">${sale.paymentMethod} <span class="badge-success">${sale.paymentStatus}</span></span></div>
  </div>
  <div class="footer">
    <div>Thank you for your business!</div>
    <div style="margin-top:4px;">Invoice generated on ${new Date().toLocaleString()}</div>
  </div>
</div>
`;
};

/**
 * Get invoice HTML for printing based on selected template
 * @param {Object} sale - Sale data
 * @param {Object} pharmacy - Pharmacy info (from sale.pharmacyId)
 * @param {string} templateName - 'classic' | 'modern' | 'minimal'
 * @param {string} printFormat - 'a4' | '58mm' | '80mm'
 * @returns {string} Full HTML page for print
 */
export function getInvoiceHTML(sale, pharmacy, templateName = 'classic', printFormat = 'a4') {
  const pharmacyInfo = {
    pharmacyName: pharmacy?.pharmacyName || 'PHARMACY',
    phone: pharmacy?.phone || '',
    address: pharmacy?.address || '',
    gstin: pharmacy?.gstin || pharmacy?.gstNumber || '',
    stateCode: pharmacy?.stateCode || '',
    printFormat,
  };

  // Use the pharmacy's configured currency symbol as the single source of truth
  const currencySymbol = getCurrentSymbol();

  let templateFn;
  switch (templateName) {
    case 'modern':
      templateFn = templateModern;
      break;
    case 'minimal':
      templateFn = templateMinimal;
      break;
    case 'classic':
    default:
      templateFn = templateClassic;
      break;
  }

  const bodyContent = templateFn(sale, pharmacyInfo, currencySymbol);

  return `
    <html>
      <head>
        <title>Invoice ${sale?.invoiceNumber}</title>
      </head>
      <body>
        ${bodyContent}
        <script>
          window.print();
          window.onafterprint = function() { window.close(); };
        <\/script>
      </body>
    </html>
  `;
}

/**
 * Available templates metadata for UI display
 */
export const INVOICE_TEMPLATES = [
  { id: 'classic', name: 'Classic Blue', description: 'Clean blue-themed professional layout', preview: '📘' },
  { id: 'modern', name: 'Modern Dark', description: 'Dark header with green accents', preview: '🌙' },
  { id: 'minimal', name: 'Minimal Serif', description: 'Elegant minimal design with serif font', preview: '📄' },
];

/**
 * Available print formats metadata
 */
export const PRINT_FORMATS = [
  { id: 'a4', name: 'A4', description: 'Standard A4 paper (297×210mm)', preview: '📄' },
  { id: '58mm', name: '58mm Thermal', description: 'Small thermal receipt (58mm width)', preview: '🧾' },
  { id: '80mm', name: '80mm Thermal', description: 'Standard thermal receipt (80mm width)', preview: '📃' },
];