/**
 * Login.js — Login Page
 *
 * Shows a login form. On success, saves the token via AuthContext
 * and redirects the user to the dashboard.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../services/api';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Call the login API
      const response = await loginUser(email, password);
      const { user, token } = response.data;

      // Save to global auth state (and localStorage)
      login(user, token);

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      // Show the error message from the backend
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card card shadow-lg">
        {/* Header */}
        <div className="card-header bg-primary text-white text-center py-4">
          <h2 className="mb-0">📚 StudentFlow</h2>
          <p className="mb-0 opacity-75 small">Your Student Productivity System</p>
        </div>

        <div className="card-body p-4">
          <h4 className="text-center mb-4">Welcome Back! 👋</h4>

          {/* Error alert */}
          {error && (
            <div className="alert alert-danger py-2">{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div className="mb-4">
              <label className="form-label fw-semibold">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="btn btn-primary w-100 py-2"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          {/* Link to register */}
          <div className="text-center mt-3">
            <span className="text-muted">Don't have an account? </span>
            <Link to="/register" className="text-primary fw-semibold">
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
