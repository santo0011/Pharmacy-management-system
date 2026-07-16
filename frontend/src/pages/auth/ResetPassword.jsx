import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { showSuccess, showError } from '../../utils/sweetAlert';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError(true);
      showError('Invalid reset link. Please request a new password reset.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      showError('Please fill in both password fields');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authService.resetPasswordByToken(token, {
        password,
        confirmPassword,
      });
      setSuccess(true);
      showSuccess(data.message || 'Password has been reset successfully!');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        'Invalid or expired reset token. Please request a new password reset.';
      showError(msg);
      if (error.response?.status === 400) {
        setTokenError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (tokenError) {
    return (
      <div className="login-page">
        <div className="login-bg-decoration">
          <div className="login-bg-circle login-bg-circle-1"></div>
          <div className="login-bg-circle login-bg-circle-2"></div>
          <div className="login-bg-circle login-bg-circle-3"></div>
        </div>
        <div className="login-container" style={{ maxWidth: '500px' }}>
          <div className="login-form-section" style={{ padding: '48px 32px' }}>
            <div className="login-form-card" style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <i
                  className="fa-solid fa-exclamation-triangle"
                  style={{ fontSize: '28px', color: '#dc2626' }}
                ></i>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                Invalid or Expired Link
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.7', marginBottom: '20px' }}>
                This password reset link is invalid or has expired. Please request a new one.
              </p>
              <Link
                to="/forgot-password"
                className="login-submit-btn"
                style={{
                  display: 'inline-flex',
                  textDecoration: 'none',
                  padding: '10px 24px',
                  width: 'auto',
                  minWidth: '180px',
                }}
              >
                <i className="fa-solid fa-key"></i>
                Request New Link
              </Link>
              <div style={{ marginTop: '12px' }}>
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
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="login-page">
        <div className="login-bg-decoration">
          <div className="login-bg-circle login-bg-circle-1"></div>
          <div className="login-bg-circle login-bg-circle-2"></div>
          <div className="login-bg-circle login-bg-circle-3"></div>
        </div>
        <div className="login-container" style={{ maxWidth: '500px' }}>
          <div className="login-form-section" style={{ padding: '48px 32px' }}>
            <div className="login-form-card" style={{ textAlign: 'center' }}>
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
                  className="fa-solid fa-check-circle"
                  style={{ fontSize: '28px', color: '#16a34a' }}
                ></i>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                Password Reset Successful!
              </h2>
              <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.7', marginBottom: '20px' }}>
                Your password has been updated successfully. You will be redirected to the login page.
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
                <i className="fa-solid fa-right-to-bracket"></i>
                Go to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-bg-decoration">
        <div className="login-bg-circle login-bg-circle-1"></div>
        <div className="login-bg-circle login-bg-circle-2"></div>
        <div className="login-bg-circle login-bg-circle-3"></div>
      </div>

      <div className="login-container" style={{ maxWidth: '500px' }}>
        <div className="login-form-section" style={{ padding: '48px 32px' }}>
          <div className="login-form-card">
            <div className="login-form-header">
              <div className="login-form-logo">
                <i className="fa-solid fa-lock-open"></i>
              </div>
              <h2>Reset Password</h2>
              <p>Enter your new password below</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-input-group">
                <label htmlFor="password">
                  <i className="fa-solid fa-lock"></i>
                  New Password
                </label>
                <div className="login-input-wrapper login-password-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    autoFocus
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

              <div className="login-input-group">
                <label htmlFor="confirmPassword">
                  <i className="fa-solid fa-lock"></i>
                  Confirm Password
                </label>
                <div className="login-input-wrapper login-password-wrapper">
                  <input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    onClick={() => setShowConfirm(!showConfirm)}
                    tabIndex={-1}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fa-solid ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    Resetting...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check"></i>
                    Reset Password
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

            <div className="login-form-footer">
              <p>
                &copy; {new Date().getFullYear()} Pharmacy Management System. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}