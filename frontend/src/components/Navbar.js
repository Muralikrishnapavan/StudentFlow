/**
 * Navbar.js — Top Navigation Bar
 *
 * Shows the app name and a logout button when the user is logged in.
 * Uses Bootstrap's navbar component.
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Handle logout: clear auth state and redirect to login
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm">
      <div className="container">
        {/* App logo/name */}
        <span className="navbar-brand fw-bold fs-4">
          📚 StudentFlow
        </span>

        {/* Show user name and logout button if logged in */}
        {user && (
          <div className="d-flex align-items-center gap-3">
            <span className="text-white-50 d-none d-sm-inline">
              👋 Hello, <strong className="text-white">{user.name}</strong>
            </span>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
