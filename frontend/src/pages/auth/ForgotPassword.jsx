import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { showSuccess, showError } from '../../utils/sweetAlert';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const emailRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      showError('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authService.forgotPassword(email.trim());
      setSubmitted(true);
      showSuccess(
        data.message || 'If an account with that email exists, a password reset link has been sent.'
      );
    } catch (error) {
      const msg = error.response?.data?.message || 'Something went wrong. Please try again.';
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Background decoration */}
      <div className="login-bg-decoration">
        <div className="login-bg-circle login-bg-circle-1"></div>
        <div className="login-bg-circle login-bg-circle-2"></div>
        <div className="login-bg-circle login-bg-circle-3"></div>
      </div>

      <div className="login-container">
        {/* Left Side - Branding */}
        <div className="login-branding">
          <div className="login-branding-content">
            <div className="login-float login-float-1">
              <i className="fa-solid fa-prescription-bottle-medical"></i>
            </div>
            <div className="login-float login-float-2">
              <i className="fa-solid fa-pills"></i>
            </div>
            <div className="login-float login-float-3">
              <i className="fa-solid fa-stethoscope"></i>
            </div>
            <div className="login-float login-float-4">
              <i className="fa-solid fa-heart-pulse"></i>
            </div>

            <div className="login-branding-logo">
              <div className="login-branding-icon">
                <i className="fa-solid fa-prescription-bottle-medical"></i>
              </div>
              <h1>Pharmacy Management</h1>
              <p className="login-branding-tagline">
                Streamline your pharmacy operations with our comprehensive management solution
              </p>
            </div>

            <div className="login-features">
              <div className="login-feature">
                <div className="login-feature-icon">
                  <i className="fa-solid fa-boxes-stacked"></i>
                </div>
                <div className="login-feature-text">
                  <h4>Inventory Management</h4>
                  <p>Track stock levels, expiry dates, and manage supplies efficiently</p>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon">
                  <i className="fa-solid fa-cash-register"></i>
                </div>
                <div className="login-feature-text">
                  <h4>Sales & Billing</h4>
                  <p>Process transactions quickly with integrated billing and invoicing</p>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon">
                  <i className="fa-solid fa-chart-line"></i>
                </div>
                <div className="login-feature-text">
                  <h4>Reports & Analytics</h4>
                  <p>Gain insights with detailed reports and real-time analytics</p>
                </div>
              </div>
            </div>

            <div className="login-developer">
              <div className="login-developer-divider">
                <span></span>
              </div>
              <div className="login-developer-content">
                <div className="login-developer-avatar">
                  <i className="fa-solid fa-code"></i>
                </div>
                <div className="login-developer-info">
                  <span className="login-developer-label">Designed & Developed by</span>
                  <strong className="login-developer-name">Santo Biswas</strong>
                  <span className="login-developer-role">Software Developer</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Forgot Password Form */}
        <div className="login-form-section">
          <div className="login-form-card">
            <div className="login-form-header">
              <div className="login-form-logo">
                <i className="fa-solid fa-key"></i>
              </div>
              <h2>Forgot Password</h2>
              <p>
                {submitted
                  ? 'Check your email for the reset link'
                  : 'Enter your email to receive a password reset link'}
              </p>
            </div>

            {submitted ? (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  <i
                    className="fa-solid fa-envelope-circle-check"
                    style={{ fontSize: '28px', color: '#16a34a' }}
                  ></i>
                </div>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#475569',
                    lineHeight: '1.7',
                    marginBottom: '8px',
                  }}
                >
                  If an account with that email address exists, we have sent a password reset link.
                </p>
                <p
                  style={{
                    fontSize: '13px',
                    color: '#94a3b8',
                    lineHeight: '1.6',
                    marginBottom: '20px',
                  }}
                >
                  Please check your inbox and follow the instructions. The link will expire in 15
                  minutes.
                </p>
                <Link
                  to="/login"
                  className="login-submit-btn"
                  style={{
                    display: 'inline-flex',
                    textDecoration: 'none',
                    padding: '10px 24px',
                    width: 'auto',
                    minWidth: '160px',
                  }}
                >
                  <i className="fa-solid fa-arrow-left"></i>
                  Back to Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="login-form">
                <div className="login-input-group">
                  <label htmlFor="email">
                    <i className="fa-solid fa-envelope"></i>
                    Email Address
                  </label>
                  <div className="login-input-wrapper">
                    <input
                      id="email"
                      ref={emailRef}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your registered email address"
                      required
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <button type="submit" className="login-submit-btn" disabled={loading}>
                  {loading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      Sending...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-paper-plane"></i>
                      Send Reset Link
                    </>
                  )}
                </button>

                <div style={{ textAlign: 'center', marginTop: '4px' }}>
                  <Link
                    to="/login"
                    style={{
                      color: '#0ea5e9',
                      fontSize: '13px',
                      fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    <i className="fa-solid fa-arrow-left"></i> Back to Login
                  </Link>
                </div>
              </form>
            )}

            <div className="login-form-footer">
              <p>
                &copy; {new Date().getFullYear()} Pharmacy Management System. All rights reserved.
              </p>
            </div>

            <div className="login-mobile-developer">
              <div className="login-mobile-dev-content">
                <div className="login-mobile-dev-avatar">
                  <i className="fa-solid fa-code"></i>
                </div>
                <div className="login-mobile-dev-info">
                  <span className="login-mobile-dev-label">Designed & Developed by</span>
                  <strong className="login-mobile-dev-name">Santo Biswas</strong>
                  <span className="login-mobile-dev-role">Software Developer</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}