import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchMedicine, clearSelectedMedicine } from '../../redux/slices/medicineSlice';
import { useAuth } from '../../hooks/useAuth';

export default function MedicineDetail() {
  const dispatch = useDispatch();
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedMedicine: medicine, loading } = useSelector((state) => state.medicines);
  const { isCashier } = useAuth();

  useEffect(() => {
    dispatch(fetchMedicine(id));
    return () => {
      dispatch(clearSelectedMedicine());
    };
  }, [dispatch, id]);

  if (loading || !medicine) {
    return (
      <div className="loading-spinner" style={{ marginTop: '40px' }}>
        <i className="fa-solid fa-spinner fa-spin"></i>
      </div>
    );
  }

  const isExpired = new Date(medicine.expiryDate) < new Date();
  const isLowStock = medicine.currentStock <= medicine.minStockAlert;

  const InfoRow = ({ label, value }) => (
    <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
      <div style={{ width: '180px', fontWeight: 500, color: 'var(--gray-600)' }}>{label}</div>
      <div>{value || '-'}</div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{medicine.medicineName}</h2>
          <p>{medicine.genericName || 'Medicine Details'}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        {/* Image Section */}
        <div className="card">
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {medicine.medicineImage ? (
              <img src={medicine.medicineImage} alt={medicine.medicineName}
                style={{ width: '100%', maxHeight: '250px', objectFit: 'cover', borderRadius: '8px' }} />
            ) : (
              <div style={{ width: '100%', height: '200px', background: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', color: 'var(--gray-400)' }}>
                <i className="fa-solid fa-pills" style={{ fontSize: '60px' }}></i>
              </div>
            )}
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <span className={`badge ${medicine.status ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '14px', padding: '6px 16px' }}>
                {medicine.status ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {isExpired && <span className="badge badge-danger">Expired</span>}
              {isLowStock && <span className="badge badge-warning">Low Stock</span>}
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header"><h5>Medicine Information</h5></div>
            <div className="card-body">
              <InfoRow label="Medicine Name" value={medicine.medicineName} />
              <InfoRow label="Generic Name" value={medicine.genericName} />
              <InfoRow label="Category" value={medicine.category?.name} />
              <InfoRow label="Brand" value={medicine.brand?.name} />
              <InfoRow label="Unit" value={medicine.unit} />
              <InfoRow label="Rack Number" value={medicine.rackNumber} />
              <InfoRow label="HSN Code" value={medicine.hsnCode} />
              <InfoRow label="Description" value={medicine.description} />
            </div>
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header"><h5>Pricing & Stock</h5></div>
            <div className="card-body">
              <InfoRow label="Purchase Price" value={`₹${medicine.purchasePrice?.toFixed(2)}`} />
              <InfoRow label="Selling Price" value={`₹${medicine.sellingPrice?.toFixed(2)}`} />
              <InfoRow label="GST" value={`${medicine.gst}%`} />
              <InfoRow label="Current Stock" value={
                <span style={{ color: isLowStock ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                  {medicine.currentStock} {medicine.unit}
                </span>
              } />
              <InfoRow label="Min Stock Alert" value={medicine.minStockAlert} />
            </div>
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header"><h5>Batch & Expiry</h5></div>
            <div className="card-body">
              <InfoRow label="Batch Number" value={medicine.batchNumber} />
              <InfoRow label="Barcode" value={medicine.barcode || '-'} />
              <InfoRow label="Manufacturing Date" value={medicine.manufacturingDate ? new Date(medicine.manufacturingDate).toLocaleDateString() : '-'} />
              <InfoRow label="Expiry Date" value={
                <span style={{ color: isExpired ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                  {new Date(medicine.expiryDate).toLocaleDateString()}
                  {isExpired && ' (Expired)'}
                </span>
              } />
            </div>
          </div>

          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header"><h5>Supplier</h5></div>
            <div className="card-body">
              <InfoRow label="Supplier Name" value={medicine.supplier?.supplierName} />
              <InfoRow label="Company" value={medicine.supplier?.companyName} />
              <InfoRow label="Email" value={medicine.supplier?.email} />
              <InfoRow label="Phone" value={medicine.supplier?.phone} />
              <InfoRow label="Address" value={medicine.supplier?.address} />
              <InfoRow label="GST Number" value={medicine.supplier?.gstNumber} />
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h5>Audit</h5></div>
            <div className="card-body">
              <InfoRow label="Created By" value={medicine.createdBy?.name} />
              <InfoRow label="Created At" value={new Date(medicine.createdAt).toLocaleString()} />
              <InfoRow label="Updated At" value={new Date(medicine.updatedAt).toLocaleString()} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}