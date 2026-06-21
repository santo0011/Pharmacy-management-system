import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCategories } from '../../redux/slices/categorySlice';
import { fetchBrands } from '../../redux/slices/brandSlice';
import { fetchSuppliers } from '../../redux/slices/supplierSlice';

export default function Dashboard() {
  const dispatch = useDispatch();
  const categories = useSelector((state) => state.categories);
  const brands = useSelector((state) => state.brands);
  const suppliers = useSelector((state) => state.suppliers);

  useEffect(() => {
    dispatch(fetchCategories({ limit: 5 }));
    dispatch(fetchBrands({ limit: 5 }));
    dispatch(fetchSuppliers({ limit: 5 }));
  }, [dispatch]);

  const stats = [
    {
      label: 'Total Categories',
      value: categories.total || 0,
      icon: 'fa-solid fa-tags',
      color: 'blue',
    },
    {
      label: 'Total Brands',
      value: brands.total || 0,
      icon: 'fa-solid fa-copyright',
      color: 'green',
    },
    {
      label: 'Total Suppliers',
      value: suppliers.total || 0,
      icon: 'fa-solid fa-truck',
      color: 'yellow',
    },
    {
      label: 'Active Items',
      value:
        (categories.items?.filter((c) => c.status)?.length || 0) +
        (brands.items?.filter((b) => b.status)?.length || 0) +
        (suppliers.items?.filter((s) => s.status)?.length || 0),
      icon: 'fa-solid fa-circle-check',
      color: 'purple',
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Overview of your pharmacy management system</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div className="stat-card" key={index}>
            <div className={`stat-icon ${stat.color}`}>
              <i className={stat.icon}></i>
            </div>
            <div className="stat-info">
              <h3>{stat.value}</h3>
              <p>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Data */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
        {/* Recent Categories */}
        <div className="card">
          <div className="card-header">
            <h5>Recent Categories</h5>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {categories.loading ? (
              <div className="loading-spinner">
                <i className="fa-solid fa-spinner fa-spin"></i>
              </div>
            ) : categories.items?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.items.slice(0, 5).map((item) => (
                      <tr key={item._id}>
                        <td>{item.name}</td>
                        <td>
                          <span className={`badge ${item.status ? 'badge-success' : 'badge-danger'}`}>
                            {item.status ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '30px' }}>
                <p>No categories found</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Brands */}
        <div className="card">
          <div className="card-header">
            <h5>Recent Brands</h5>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {brands.loading ? (
              <div className="loading-spinner">
                <i className="fa-solid fa-spinner fa-spin"></i>
              </div>
            ) : brands.items?.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brands.items.slice(0, 5).map((item) => (
                      <tr key={item._id}>
                        <td>{item.name}</td>
                        <td>
                          <span className={`badge ${item.status ? 'badge-success' : 'badge-danger'}`}>
                            {item.status ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '30px' }}>
                <p>No brands found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}