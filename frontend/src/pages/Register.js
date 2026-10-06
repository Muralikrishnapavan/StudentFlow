/**
 * Register.js — Registration Page
 *
 * Allows new students to create an account.
 * On success, redirects to the login page.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../services/api';

function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Client-side validation
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const response = await registerUser(name, email, password);
      setSuccess(response.data.message);

      // Redirect to login after 2 seconds so the user can read the success message
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
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
          <p className="mb-0 opacity-75 small">Create Your Account</p>
        </div>

        <div className="card-body p-4">
          <h4 className="text-center mb-4">Get Started 🚀</h4>

          {/* Success / Error alerts */}
          {success && <div className="alert alert-success py-2">{success}</div>}
          {error && <div className="alert alert-danger py-2">{error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Full Name */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Full Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

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
            <div className="mb-3">
              <label className="form-label fw-semibold">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Confirm Password */}
            <div className="mb-4">
              <label className="form-label fw-semibold">Confirm Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary w-100 py-2"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Link to login */}
          <div className="text-center mt-3">
            <span className="text-muted">Already have an account? </span>
            <Link to="/login" className="text-primary fw-semibold">
              Login here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
