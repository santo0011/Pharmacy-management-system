import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../../hooks/useAuth';
import { fetchSubscriptionStatus } from '../../redux/slices/dashboardSlice';

export default function SubscriptionExpired() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, logout } = useAuth();
  const { subscriptionStatus } = useSelector((state) => state.dashboard);

  useEffect(() => {
    if (user?.role === 'admin') {
      dispatch(fetchSubscriptionStatus());
    }
  }, [dispatch, user]);

  const endDate = subscriptionStatus?.endDate
    ? new Date(subscriptionStatus.endDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'N/A';

  const daysRemaining = subscriptionStatus?.daysRemaining !== undefined ? subscriptionStatus.daysRemaining : 0;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 50%, #fecaca 100%)',
      padding: '20px',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        background: '#ffffff',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(239, 68, 68, 0.15), 0 4px 20px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Top accent bar */}
        <div style={{
          height: '6px',
          background: 'linear-gradient(90deg, #ef4444, #dc2626, #b91c1c)',
        }}></div>

        <div style={{ padding: '40px 36px 32px', textAlign: 'center' }}>
          {/* Icon */}
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            border: '3px solid #fecaca',
          }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="8" x2="12" y2="13" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="16.5" r="1" fill="#ef4444"/>
            </svg>
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#991b1b',
            margin: '0 0 8px',
            letterSpacing: '-0.5px',
          }}>
            Subscription Expired
          </h1>

          <p style={{
            fontSize: '15px',
            color: '#7f1d1d',
            margin: '0 0 28px',
            lineHeight: '1.6',
            opacity: 0.85,
          }}>
            Your subscription has ended. Please contact the Super Admin to renew your subscription and restore full access.
          </p>

          {/* Status Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '28px',
          }}>
            <div style={{
              padding: '16px',
              background: '#fef2f2',
              borderRadius: '12px',
              border: '1px solid #fecaca',
            }}>
              <div style={{
                fontSize: '11px',
                color: '#dc2626',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: 600,
                marginBottom: '6px',
              }}>
                Status
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
                fontSize: '16px',
                color: '#dc2626',
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  display: 'inline-block',
                }}></span>
                Expired
              </div>
            </div>

            <div style={{
              padding: '16px',
              background: '#fef2f2',
              borderRadius: '12px',
              border: '1px solid #fecaca',
            }}>
              <div style={{
                fontSize: '11px',
                color: '#dc2626',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: 600,
                marginBottom: '6px',
              }}>
                Remaining Days
              </div>
              <div style={{
                fontWeight: 700,
                fontSize: '16px',
                color: '#dc2626',
              }}>
                {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
              </div>
            </div>

            <div style={{
              padding: '16px',
              background: '#fef2f2',
              borderRadius: '12px',
              border: '1px solid #fecaca',
            }}>
              <div style={{
                fontSize: '11px',
                color: '#dc2626',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: 600,
                marginBottom: '6px',
              }}>
                Expiry Date
              </div>
              <div style={{
                fontWeight: 600,
                fontSize: '14px',
                color: '#991b1b',
              }}>
                {endDate}
              </div>
            </div>

            <div style={{
              padding: '16px',
              background: '#fef2f2',
              borderRadius: '12px',
              border: '1px solid #fecaca',
            }}>
              <div style={{
                fontSize: '11px',
                color: '#dc2626',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: 600,
                marginBottom: '6px',
              }}>
                Plan
              </div>
              <div style={{
                fontWeight: 600,
                fontSize: '14px',
                color: '#991b1b',
                textTransform: 'capitalize',
              }}>
                {subscriptionStatus?.plan || 'Free'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => navigate('/subscriptions')}
              style={{
                padding: '14px 24px',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              <i className="fa-solid fa-credit-card"></i>
              View Subscription Details
            </button>

            <button
              onClick={async () => {
                try {
                  await logout();
                  navigate('/login');
                } catch (e) {
                  // fallback
                }
              }}
              style={{
                padding: '12px 24px',
                background: 'transparent',
                color: '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f8fafc';
                e.target.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = '#e2e8f0';
              }}
            >
              <i className="fa-solid fa-right-from-bracket"></i>
              Logout
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 36px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: '12px',
            color: '#94a3b8',
            margin: 0,
          }}>
            <i className="fa-solid fa-shield-halved" style={{ marginRight: '4px' }}></i>
            Pharmacy Management System
          </p>
        </div>
      </div>
    </div>
  );
}