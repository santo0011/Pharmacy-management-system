import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CurrencyDisplay from '../../components/common/CurrencyDisplay';
import { getCurrentSymbol } from '../../utils/currency';
import { purchaseService } from '../../services/purchaseService';
import { purchaseReturnService } from '../../services/purchaseReturnService';
import { showSuccess, showError, confirmAction } from '../../utils/sweetAlert';

export default function PurchaseReturn() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [returnItems, setReturnItems] = useState([]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await purchaseService.getPurchase(id);
        if (data.data) {
          setPurchase(data.data.purchase);
          // Initialize return items with 0 quantity
          setReturnItems(
            data.data.purchase.items.map(item => ({
              medicineId: item.medicine?._id || item.medicine,
              medicineName: item.medicineName,
              batchNumber: item.batchNumber,
              purchasedQuantity: item.quantity,
              purchasePrice: item.purchasePrice,
              returnedQuantity: 0,
            }))
          );
        }
      } catch (error) {
        showError(error.response?.data?.message || 'Failed to load purchase');
        navigate('/purchases');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  const handleQuantityChange = (index, value) => {
    const qty = Math.max(0, parseInt(value) || 0);
    const updated = [...returnItems];
    const item = updated[index];
    if (qty > item.purchasedQuantity) {
      showError(`Return quantity cannot exceed purchased quantity (${item.purchasedQuantity})`);
      return;
    }
    item.returnedQuantity = qty;
    setReturnItems(updated);
  };

  const handleSelectAll = () => {
    setReturnItems(prev => prev.map(item => ({
      ...item,
      returnedQuantity: item.purchasedQuantity,
    })));
  };

  const handleClearAll = () => {
    setReturnItems(prev => prev.map(item => ({
      ...item,
      returnedQuantity: 0,
    })));
  };

  const totalReturnAmount = returnItems.reduce(
    (sum, item) => sum + item.returnedQuantity * item.purchasePrice, 0
  );

  const totalReturnQty = returnItems.reduce(
    (sum, item) => sum + item.returnedQuantity, 0
  );

  const hasReturns = returnItems.some(item => item.returnedQuantity > 0);

  const handleSubmit = async () => {
    if (!hasReturns) {
      showError('Please select at least one item to return');
      return;
    }

    const confirmed = await confirmAction(
      'Confirm Return',
      `Return ${totalReturnQty} item(s) worth ${getCurrentSymbol()} ${totalReturnAmount.toFixed(2)} from purchase ${purchase.invoiceNumber}?`,
      'Yes, Return Items'
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const itemsToReturn = returnItems
        .filter(item => item.returnedQuantity > 0)
        .map(item => ({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          returnedQuantity: item.returnedQuantity,
        }));

      await purchaseReturnService.returnPurchase(id, {
        items: itemsToReturn,
        reason,
      });
      showSuccess('Purchase return processed successfully');
      navigate(`/purchases/${id}`);
    } catch (error) {
      showError(error.response?.data?.message || 'Failed to process return');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-spinner" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', color: 'var(--primary)' }}></i>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="empty-state">
        <i className="fa-solid fa-exclamation-circle" style={{ fontSize: '48px', color: 'var(--gray-300)' }}></i>
        <h4>Purchase Not Found</h4>
        <button className="btn btn-primary" onClick={() => navigate('/purchases')}>
          <i className="fa-solid fa-arrow-left"></i> Back to Purchases
        </button>
      </div>
    );
  }

  return (
    <div className="purchase-return-page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={() => navigate(`/purchases/${id}`)} style={{ borderRadius: '8px' }}>
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h2><i className="fa-solid fa-undo"></i> Return Purchase</h2>
            <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>
              {purchase.invoiceNumber} • {purchase.supplierName || purchase.supplier?.supplierName}
            </p>
          </div>
        </div>
      </div>

      {/* Purchase Summary */}
      <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
        <div className="card-body" style={{ padding: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>Invoice</div>
              <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '2px' }}>{purchase.invoiceNumber}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>Supplier</div>
              <div style={{ fontWeight: 500, marginTop: '2px' }}>{purchase.supplierName || purchase.supplier?.supplierName}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>Purchase Date</div>
              <div style={{ fontWeight: 500, marginTop: '2px' }}>{new Date(purchase.purchaseDate).toLocaleDateString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>Grand Total</div>
              <div style={{ fontWeight: 700, fontSize: '15px', marginTop: '2px', color: '#2563eb' }}><CurrencyDisplay value={purchase.grandTotal} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* Return Items */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h5><i className="fa-solid fa-pills"></i> Select Items to Return</h5>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm btn-secondary" onClick={handleSelectAll}>
              <i className="fa-solid fa-check-double"></i> Select All
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleClearAll}>
              <i className="fa-solid fa-xmark"></i> Clear
            </button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Medicine</th>
                  <th>Batch</th>
                  <th>Purchase Price</th>
                  <th>Purchased Qty</th>
                  <th>Return Qty</th>
                  <th>Return Amount</th>
                </tr>
              </thead>
              <tbody>
                {returnItems.map((item, idx) => (
                  <tr key={idx} style={{ background: item.returnedQuantity > 0 ? '#f0fdf4' : 'transparent' }}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 500 }}>{item.medicineName}</td>
                    <td style={{ fontSize: '13px', color: '#888' }}>{item.batchNumber || '-'}</td>
                    <td><CurrencyDisplay value={item.purchasePrice} /></td>
                    <td>{item.purchasedQuantity}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max={item.purchasedQuantity}
                        value={item.returnedQuantity}
                        onChange={(e) => handleQuantityChange(idx, e.target.value)}
                        className="form-select"
                        style={{ width: '80px', padding: '4px 8px', fontSize: '13px' }}
                      />
                    </td>
                    <td style={{ fontWeight: 600, color: item.returnedQuantity > 0 ? '#dc2626' : '#888' }}>
                      <CurrencyDisplay value={item.returnedQuantity * item.purchasePrice} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Return Summary */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><h5><i className="fa-solid fa-calculator"></i> Return Summary</h5></div>
        <div className="card-body">
          <div style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
              <div style={{ width: '160px', fontWeight: 500, color: 'var(--gray-600)' }}>Total Items Selected</div>
              <div style={{ fontWeight: 600 }}>{returnItems.filter(i => i.returnedQuantity > 0).length} / {returnItems.length}</div>
            </div>
            <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
              <div style={{ width: '160px', fontWeight: 500, color: 'var(--gray-600)' }}>Total Return Quantity</div>
              <div style={{ fontWeight: 600 }}>{totalReturnQty}</div>
            </div>
            <div style={{ display: 'flex', padding: '12px 0', borderTop: '2px solid var(--gray-200)', fontWeight: 700, fontSize: '16px', color: '#dc2626' }}>
              <div style={{ width: '160px' }}>Total Return Amount</div>
              <div><CurrencyDisplay value={totalReturnAmount} /></div>
            </div>
          </div>
        </div>
      </div>

      {/* Reason */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header"><h5><i className="fa-solid fa-pen"></i> Return Reason</h5></div>
        <div className="card-body">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="form-select"
            style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
            placeholder="Enter reason for return (optional)..."
            rows={3}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={() => navigate(`/purchases/${id}`)}>
          <i className="fa-solid fa-times"></i> Cancel
        </button>
        <button
          className="btn btn-danger"
          onClick={handleSubmit}
          disabled={!hasReturns || submitting}
          style={{ minWidth: '180px' }}
        >
          {submitting ? (
            <><i className="fa-solid fa-spinner fa-spin"></i> Processing...</>
          ) : (
            <><i className="fa-solid fa-undo"></i> Process Return (<CurrencyDisplay value={totalReturnAmount} />)</>
          )}
        </button>
      </div>
    </div>
  );
}