import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchSale, clearSelectedSale } from '../../redux/slices/saleSlice';

export default function Invoice() {
  const dispatch = useDispatch();
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef();
  const { selectedSale: sale, loading } = useSelector((state) => state.sales);

  useEffect(() => {
    dispatch(fetchSale(id));
    return () => dispatch(clearSelectedSale());
  }, [dispatch, id]);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head>
          <title>Invoice ${sale?.invoiceNumber}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; font-size: 12px; line-height: 1.5; }
            .invoice-box { max-width: 800px; margin: auto; padding: 20px; }
            .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #0ea5e9; }
            .header .title { font-size: 28px; font-weight: 700; color: #0ea5e9; }
            .header .details { text-align: right; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
            td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
            .summary { margin-top: 20px; margin-left: auto; width: 350px; }
            .summary-row { display: flex; justify-content: space-between; padding: 6px 0; }
            .summary-row.total { font-size: 18px; font-weight: 700; color: #0ea5e9; border-top: 2px solid #0ea5e9; padding-top: 10px; margin-top: 6px; }
            .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
            .badge-success { background: #dcfce7; color: #16a34a; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <div class="header">
              <div>
                <div class="title">PHARMACY</div>
                <div style="color:#64748b;margin-top:4px;">Medical Store</div>
              </div>
              <div class="details">
                <div style="font-weight:600;font-size:16px;">${sale?.invoiceNumber}</div>
                <div>${new Date(sale?.saleDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
            <div style="margin-bottom:20px;">
              <div style="font-weight:600;">Customer: ${sale?.customerName}</div>
              ${sale?.customerPhone ? `<div>Phone: ${sale.customerPhone}</div>` : ''}
            </div>
            <table>
              <thead><tr><th>#</th><th>Medicine</th><th>Qty</th><th>Price</th><th>GST</th><th>Total</th></tr></thead>
              <tbody>
                ${sale?.items?.map((item, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td style="font-weight:500;">${item.medicineName}</td>
                    <td>${item.quantity}</td>
                    <td>₹${Number(item.sellingPrice).toFixed(2)}</td>
                    <td>${item.gst}%</td>
                    <td style="font-weight:600;">₹${Number(item.total).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="summary">
              <div class="summary-row"><span>Subtotal:</span><span>₹${Number(sale?.subtotal || 0).toFixed(2)}</span></div>
              <div class="summary-row"><span>GST:</span><span>₹${Number(sale?.taxAmount || 0).toFixed(2)}</span></div>
              <div class="summary-row"><span>Discount:</span><span>₹${Number(sale?.discountAmount || 0).toFixed(2)}</span></div>
              <div class="summary-row total"><span>Grand Total:</span><span>₹${Number(sale?.grandTotal || 0).toFixed(2)}</span></div>
              <div class="summary-row"><span>Paid:</span><span>₹${Number(sale?.paidAmount || 0).toFixed(2)}</span></div>
              <div class="summary-row"><span>Due:</span><span style="color:${sale?.dueAmount > 0 ? '#ef4444' : '#22c55e'};font-weight:600;">₹${Number(sale?.dueAmount || 0).toFixed(2)}</span></div>
              <div class="summary-row"><span>Payment:</span><span style="text-transform:capitalize;">${sale?.paymentMethod} <span class="badge badge-success">${sale?.paymentStatus}</span></span></div>
            </div>
            <div class="footer">
              <div>Thank you for your business!</div>
              <div style="margin-top:4px;">Invoice generated on ${new Date().toLocaleString()}</div>
            </div>
          </div>
          <script>window.print();window.onafterprint=function(){window.close();};</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  if (loading || !sale) {
    return <div className="loading-spinner" style={{ marginTop: '40px' }}><i className="fa-solid fa-spinner fa-spin"></i></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Invoice: {sale.invoiceNumber}</h2>
          <p>{sale.customerName}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={handlePrint}>
            <i className="fa-solid fa-print"></i> Print / Download
          </button>
          <button className="btn btn-secondary" onClick={() => navigate(`/sales/${id}`)}>
            <i className="fa-solid fa-arrow-left"></i> Back
          </button>
        </div>
      </div>

      <div className="card" ref={printRef} style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="card-body" style={{ padding: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid var(--primary)' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--primary)' }}>PHARMACY</div>
              <div style={{ color: 'var(--gray-500)', marginTop: '4px' }}>Medical Store</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 600, fontSize: '16px' }}>{sale.invoiceNumber}</div>
              <div style={{ color: 'var(--gray-500)', fontSize: '13px' }}>{new Date(sale.saleDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontWeight: 600 }}>Customer: {sale.customerName}</div>
            {sale.customerPhone && <div style={{ color: 'var(--gray-500)' }}>Phone: {sale.customerPhone}</div>}
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr><th>#</th><th>Medicine</th><th>Qty</th><th>Price</th><th>GST</th><th>Total</th></tr>
              </thead>
              <tbody>
                {sale.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 500 }}>{item.medicineName}</td>
                    <td>{item.quantity}</td>
                    <td>₹{Number(item.sellingPrice).toFixed(2)}</td>
                    <td>{item.gst}%</td>
                    <td style={{ fontWeight: 600 }}>₹{Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '20px', marginLeft: 'auto', width: '350px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span>Subtotal:</span><span style={{ fontWeight: 600 }}>₹{Number(sale.subtotal || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span>GST:</span><span style={{ fontWeight: 600 }}>₹{Number(sale.taxAmount || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span>Discount:</span><span style={{ fontWeight: 600 }}>₹{Number(sale.discountAmount || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid var(--primary)', fontSize: '18px', fontWeight: 700, color: 'var(--primary)' }}>
              <span>Grand Total:</span><span>₹{Number(sale.grandTotal || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span>Paid:</span><span style={{ fontWeight: 600 }}>₹{Number(sale.paidAmount || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span>Due:</span><span style={{ color: sale.dueAmount > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>₹{Number(sale.dueAmount || 0).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span>Payment:</span><span style={{ textTransform: 'capitalize' }}>{sale.paymentMethod} <span className="badge badge-success" style={{ marginLeft: '6px' }}>{sale.paymentStatus}</span></span>
            </div>
          </div>

          <div style={{ marginTop: '40px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '11px', borderTop: '1px solid var(--gray-200)', paddingTop: '16px' }}>
            <div>Thank you for your business!</div>
            <div style={{ marginTop: '4px' }}>Invoice generated on {new Date().toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}