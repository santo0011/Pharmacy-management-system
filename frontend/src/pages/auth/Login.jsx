import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, clearError } from '../../redux/slices/authSlice';
import { showError, showSuccess } from '../../utils/sweetAlert';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, user } = useSelector((state) => state.auth);
  const hasShownSuccess = useRef(false);
  const errorTimerRef = useRef(null);

  useEffect(() => {
    if (error) {
      showError(error);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        dispatch(clearError());
      }, 3000);
    }
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [error, dispatch]);

  useEffect(() => {
    if (user && !hasShownSuccess.current) {
      hasShownSuccess.current = true;
      showSuccess('Login successful!');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(loginUser(formData));
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
        {/* Left Side - Branding/Welcome Section (hidden on mobile) */}
        <div className="login-branding">
          <div className="login-branding-content">
            {/* Floating elements */}
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

            {/* Logo */}
            <div className="login-branding-logo">
              <div className="login-branding-icon">
                <i className="fa-solid fa-prescription-bottle-medical"></i>
              </div>
              <h1>Pharmacy Management</h1>
              <p className="login-branding-tagline">
                Streamline your pharmacy operations with our comprehensive management solution
              </p>
            </div>

            {/* Feature highlights */}
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

            {/* Developer credit */}
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

        {/* Right Side - Login Form */}
        <div className="login-form-section">
          <div className="login-form-card">
            {/* Form Header */}
            <div className="login-form-header">
              <div className="login-form-logo">
                <i className="fa-solid fa-prescription-bottle-medical"></i>
              </div>
              <h2>Welcome Back</h2>
              <p>Sign in to your account to continue</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-input-group">
                <label htmlFor="email">
                  <i className="fa-solid fa-envelope"></i>
                  Email Address
                </label>
                <div className="login-input-wrapper">
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email address"
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <div className="login-input-group">
                <label htmlFor="password">
                  <i className="fa-solid fa-lock"></i>
                  Password
                </label>
                <div className="login-input-wrapper login-password-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="login-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Signing in...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-right-to-bracket"></i>
                    Sign In
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="login-form-footer">
              <p>&copy; {new Date().getFullYear()} Pharmacy Management System. All rights reserved.</p>
            </div>

            {/* Mobile Developer Credit - shown only on mobile */}
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