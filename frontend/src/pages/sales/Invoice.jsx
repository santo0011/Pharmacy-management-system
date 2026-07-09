import { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchSale, clearSelectedSale } from '../../redux/slices/saleSlice';
import { getInvoiceHTML, INVOICE_TEMPLATES, PRINT_FORMATS } from '../../utils/invoiceTemplates';
import { invoiceSettingService } from '../../services/invoiceSettingService';
import { showSuccess, showError } from '../../utils/sweetAlert';

export default function Invoice() {
  const dispatch = useDispatch();
  const { id } = useParams();
  const navigate = useNavigate();
  const previewRef = useRef();
  const { selectedSale: sale, loading } = useSelector((state) => state.sales);
  const [printSettings, setPrintSettings] = useState({ invoiceTemplate: 'classic', printFormat: 'a4' });

  useEffect(() => {
    dispatch(fetchSale(id));
    return () => dispatch(clearSelectedSale());
  }, [dispatch, id]);

  // Fetch print settings from pharmacy settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await invoiceSettingService.getMySettings();
        if (data.data) {
          setPrintSettings({
            invoiceTemplate: data.data.invoiceTemplate || 'classic',
            printFormat: data.data.printFormat || 'a4',
          });
        }
      } catch (error) {
        // Use defaults
      }
    };
    fetchSettings();
  }, []);

  // Render preview into iframe whenever sale or settings change
  const renderPreview = useCallback(() => {
    if (!sale || !previewRef.current) return;

    const html = getInvoiceHTML(
      sale,
      sale.pharmacyId,
      printSettings.invoiceTemplate,
      printSettings.printFormat
    );

    // Inject the HTML body content into the iframe, stripping the outer html/head/script
    // We want only the styled body content for preview, without auto-print script
    const iframeDoc = previewRef.current.contentDocument || previewRef.current.contentWindow.document;
    iframeDoc.open();

    // Extract just the body content from getInvoiceHTML by taking everything between <body> and </body>
    const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : '';

    // Also extract styles from the head
    const styleMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
    const headContent = styleMatch ? styleMatch[1] : '';

    iframeDoc.write(`
      <html>
        <head>
          ${headContent}
          <style>
            body { margin: 0; padding: 0; background: #fff; }
            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          ${bodyContent.replace(/<script>[\s\S]*?<\/script>/gi, '')}
        </body>
      </html>
    `);
    iframeDoc.close();
  }, [sale, printSettings]);

  // Re-render preview when sale loads or settings change
  useEffect(() => {
    if (sale) {
      // Small delay to allow iframe to mount on first render
      const timer = setTimeout(() => renderPreview(), 100);
      return () => clearTimeout(timer);
    }
  }, [sale, renderPreview]);

  const handleSavePreference = async (key, value) => {
    const updated = { ...printSettings, [key]: value };
    setPrintSettings(updated);
    try {
      await invoiceSettingService.updateMySettings(updated);
      showSuccess(`${key === 'invoiceTemplate' ? 'Template' : 'Format'} updated`);
    } catch (error) {
      showError('Failed to save preference');
    }
  };

  const handlePrint = () => {
    if (!sale) return;

    const html = getInvoiceHTML(
      sale,
      sale.pharmacyId,
      printSettings.invoiceTemplate,
      printSettings.printFormat
    );

    const win = window.open('', '_blank');
    win.document.write(html);
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

      {/* Template & Format Selector Bar */}
      <div className="card invoice-template-format-bar" style={{ marginBottom: '16px' }}>
        <div className="card-body" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                <i className="fa-solid fa-palette"></i> Template:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {INVOICE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    className={`btn btn-sm ${printSettings.invoiceTemplate === tpl.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleSavePreference('invoiceTemplate', tpl.id)}
                    title={tpl.description}
                    style={{ borderRadius: '20px', padding: '4px 12px', fontSize: '12px' }}
                  >
                    {tpl.preview} {tpl.name}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ width: '1px', height: '28px', background: 'var(--gray-300)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                <i className="fa-solid fa-print"></i> Format:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {PRINT_FORMATS.map((fmt) => (
                  <button
                    key={fmt.id}
                    className={`btn btn-sm ${printSettings.printFormat === fmt.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleSavePreference('printFormat', fmt.id)}
                    title={fmt.description}
                    style={{ borderRadius: '20px', padding: '4px 12px', fontSize: '12px' }}
                  >
                    {fmt.preview} {fmt.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Preview Iframe — rendered exactly as it will print */}
      <div className="card" style={{ maxWidth: '800px', margin: '0 auto', overflow: 'hidden' }}>
        <div className="card-body" style={{ padding: 0 }}>
          <iframe
            ref={previewRef}
            title="Invoice Preview"
            style={{
              width: '100%',
              height: '800px',
              border: 'none',
              display: 'block',
            }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}