import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchMedicine, clearSelectedMedicine } from '../../redux/slices/medicineSlice';
import { medicineService } from '../../services/medicineService';
import { useAuth } from '../../hooks/useAuth';

export default function MedicineDetail() {
  const dispatch = useDispatch();
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedMedicine: medicine, loading } = useSelector((state) => state.medicines);
  const { isCashier } = useAuth();
  const [substituteInfo, setSubstituteInfo] = useState(null);
  const [loadingSubs, setLoadingSubs] = useState(false);

  useEffect(() => {
    dispatch(fetchMedicine(id));
    return () => {
      dispatch(clearSelectedMedicine());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (id && medicine) {
      loadSubstitutes();
    }
  }, [id, medicine?._id]);

  const loadSubstitutes = async () => {
    setLoadingSubs(true);
    try {
      const { data } = await medicineService.getSubstitutes(id);
      if (data.data) {
        setSubstituteInfo(data.data);
      }
    } catch (err) {
      // Silently fail
    } finally {
      setLoadingSubs(false);
    }
  };

  if (loading || !medicine) {
    return (
      <div className="loading-spinner" style={{ marginTop: '40px' }}>
        <i className="fa-solid fa-spinner fa-spin"></i>
      </div>
    );
  }

  const isExpired = new Date(medicine.expiryDate) < new Date();
  const isLowStock = medicine.currentStock <= medicine.minStockAlert;

  return (
    <div className="medicine-detail">
      {/* Page Header with Actions */}
      <div className="page-header">
        <div>
          <h2>{medicine.medicineName}</h2>
          <p>{medicine.genericName || 'Medicine Details'}</p>
        </div>
        <div className="btn-group-grid">
          {!isCashier && (
            <button className="btn btn-warning" onClick={() => navigate(`/medicines/${id}/edit`)}>
              <i className="fa-solid fa-edit"></i> Edit
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => navigate('/medicines')}>
            <i className="fa-solid fa-arrow-left"></i> Back
          </button>
        </div>
      </div>

      <div className="medicine-detail-grid">
        {/* Left Column - Image & Status */}
        <div>
          <div className="card medicine-detail-image-card">
            <div className="card-body medicine-detail-image-body">
              {medicine.medicineImage ? (
                <img
                  src={medicine.medicineImage}
                  alt={medicine.medicineName}
                  className="medicine-detail-image"
                />
              ) : (
                <div className="medicine-detail-image-placeholder">
                  <i className="fa-solid fa-pills"></i>
                </div>
              )}
              <div className="medicine-detail-badges">
                <span className={`badge ${medicine.status ? 'badge-success' : 'badge-danger'}`}>
                  {medicine.status ? 'Active' : 'Inactive'}
                </span>
                {isExpired && <span className="badge badge-danger">Expired</span>}
                {isLowStock && <span className="badge badge-warning">Low Stock</span>}
              </div>
            </div>
          </div>

          {/* Supplier Card - shown in left column on desktop */}
          <div className="card medicine-detail-card">
            <div className="card-header"><h5>Supplier</h5></div>
            <div className="card-body medicine-detail-card-body">
              <MedicineInfoRow label="Supplier Name" value={medicine.supplier?.supplierName} />
              <MedicineInfoRow label="Company" value={medicine.supplier?.companyName} />
              <MedicineInfoRow label="Email" value={medicine.supplier?.email} />
              <MedicineInfoRow label="Phone" value={medicine.supplier?.phone} />
              <MedicineInfoRow label="Address" value={medicine.supplier?.address} />
              <MedicineInfoRow label="GST Number" value={medicine.supplier?.gstNumber} />
            </div>
          </div>
        </div>

        {/* Right Column - All Details */}
        <div>
          <div className="card medicine-detail-card">
            <div className="card-header"><h5>Medicine Information</h5></div>
            <div className="card-body medicine-detail-card-body">
              <MedicineInfoRow label="Medicine Name" value={medicine.medicineName} />
              <MedicineInfoRow label="Generic Name" value={medicine.genericName} />
              <MedicineInfoRow label="Category" value={medicine.category?.name} />
              <MedicineInfoRow label="Brand" value={medicine.brand?.name} />
              <MedicineInfoRow label="Unit" value={medicine.unit} />
              <MedicineInfoRow label="Rack Number" value={medicine.rackNumber} />
              <MedicineInfoRow label="HSN Code" value={medicine.hsnCode} />
              <MedicineInfoRow label="Description" value={medicine.description} />
            </div>
          </div>

          <div className="card medicine-detail-card">
            <div className="card-header"><h5>Pricing & Stock</h5></div>
            <div className="card-body medicine-detail-card-body">
              <MedicineInfoRow label="Purchase Price" value={`₹${medicine.purchasePrice?.toFixed(2)}`} />
              <MedicineInfoRow label="Selling Price" value={`₹${medicine.sellingPrice?.toFixed(2)}`} />
              <MedicineInfoRow label="GST" value={`${medicine.gst}%`} />
              <MedicineInfoRow
                label="Current Stock"
                value={
                  <span style={{ color: isLowStock ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                    {medicine.currentStock} {medicine.unit}
                  </span>
                }
              />
              <MedicineInfoRow label="Min Stock Alert" value={medicine.minStockAlert} />
            </div>
          </div>

          <div className="card medicine-detail-card">
            <div className="card-header"><h5>Batch & Expiry</h5></div>
            <div className="card-body medicine-detail-card-body">
              <MedicineInfoRow label="Batch Number" value={medicine.batchNumber} />
              <MedicineInfoRow label="Barcode" value={medicine.barcode || '-'} />
              <MedicineInfoRow
                label="Manufacturing Date"
                value={medicine.manufacturingDate ? new Date(medicine.manufacturingDate).toLocaleDateString() : '-'}
              />
              <MedicineInfoRow
                label="Expiry Date"
                value={
                  <span style={{ color: isExpired ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                    {new Date(medicine.expiryDate).toLocaleDateString()}
                    {isExpired && ' (Expired)'}
                  </span>
                }
              />
            </div>
          </div>

          <div className="card medicine-detail-card">
            <div className="card-header"><h5>Audit</h5></div>
            <div className="card-body medicine-detail-card-body">
              <MedicineInfoRow label="Created By" value={medicine.createdBy?.name} />
              <MedicineInfoRow label="Created At" value={new Date(medicine.createdAt).toLocaleString()} />
              <MedicineInfoRow label="Updated At" value={new Date(medicine.updatedAt).toLocaleString()} />
            </div>
          </div>

          {/* Substitute Medicines Section */}
          <div className="card medicine-detail-card">
            <div className="card-header">
              <h5><i className="fa-solid fa-exchange-alt"></i> Substitute Medicines</h5>
              {!isCashier && (
                <button className="btn btn-sm btn-outline-primary" onClick={() => navigate(`/medicines/${id}/edit`)}>
                  <i className="fa-solid fa-pen"></i> Manage
                </button>
              )}
            </div>
            <div className="card-body medicine-detail-card-body">
              {loadingSubs ? (
                <div style={{ textAlign: 'center', padding: '12px', color: '#888' }}>
                  <i className="fa-solid fa-spinner fa-spin"></i> Loading substitutes...
                </div>
              ) : substituteInfo && substituteInfo.hasSubstitutes ? (
                <>
                  {substituteInfo.explicitSubstitutes && substituteInfo.explicitSubstitutes.length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 500 }}>
                        <i className="fa-solid fa-link"></i> Linked Substitutes
                      </div>
                      {substituteInfo.explicitSubstitutes.map(sub => (
                        <div key={sub._id} className="substitute-item" style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 0', borderBottom: '1px solid var(--gray-100)',
                        }}>
                          <div>
                            <a href={`/medicines/${sub._id}`} style={{ fontWeight: 500, color: 'var(--primary)', textDecoration: 'none' }}
                              onClick={(e) => { e.preventDefault(); navigate(`/medicines/${sub._id}`); }}>
                              {sub.medicineName}
                            </a>
                            {sub.genericName && <div style={{ fontSize: '11px', color: '#888' }}>{sub.genericName}</div>}
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '12px' }}>
                            <div style={{ fontWeight: 600 }}>₹{sub.sellingPrice?.toFixed(2)}</div>
                            <div style={{ color: sub.currentStock > 0 ? 'var(--success)' : 'var(--danger)' }}>
                              Stock: {sub.currentStock} {sub.unit}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {substituteInfo.genericSubstitutes && substituteInfo.genericSubstitutes.length > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 500 }}>
                        <i className="fa-solid fa-flask"></i> Same Generic Name (Auto-suggested)
                      </div>
                      {substituteInfo.genericSubstitutes.map(sub => (
                        <div key={sub._id} className="substitute-item" style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 0', borderBottom: '1px solid var(--gray-100)',
                        }}>
                          <div>
                            <a href={`/medicines/${sub._id}`} style={{ fontWeight: 500, color: 'var(--primary)', textDecoration: 'none' }}
                              onClick={(e) => { e.preventDefault(); navigate(`/medicines/${sub._id}`); }}>
                              {sub.medicineName}
                            </a>
                            {sub.genericName && <div style={{ fontSize: '11px', color: '#888' }}>{sub.genericName}</div>}
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '12px' }}>
                            <div style={{ fontWeight: 600 }}>₹{sub.sellingPrice?.toFixed(2)}</div>
                            <div style={{ color: sub.currentStock > 0 ? 'var(--success)' : 'var(--danger)' }}>
                              Stock: {sub.currentStock} {sub.unit}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '12px', color: '#888', fontSize: '13px' }}>
                  <i className="fa-solid fa-info-circle"></i> No substitute medicines defined
                  {!isCashier && (
                    <div style={{ marginTop: '6px' }}>
                      <button className="btn btn-sm btn-outline-primary"
                        onClick={() => navigate(`/medicines/${id}/edit`)}>
                        Add Substitutes
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MedicineInfoRow({ label, value }) {
  return (
    <div className="med-detail-row">
      <span className="med-detail-label">{label}</span>
      <span className="med-detail-value">{value || '-'}</span>
    </div>
  );
}