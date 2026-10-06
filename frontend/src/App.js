/**
 * App.js — Root React Component
 *
 * Sets up the router and wraps everything in the AuthProvider
 * so all pages can access the logged-in user's info.
 *
 * Routes:
 *   /            → redirects to /login
 *   /login       → Login page
 *   /register    → Register page
 *   /dashboard   → Dashboard (protected — must be logged in)
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

// Components
import Navbar from './components/Navbar';

/**
 * ProtectedRoute — Wraps routes that require login.
 * If the user is not logged in, redirects to /login.
 */
function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

/**
 * AppContent — Separated so it can use the useAuth hook
 * (which requires being inside AuthProvider).
 */
function AppContent() {
  return (
    <Router>
      {/* Navbar is shown on every page */}
      <Navbar />

      <main>
        <Routes>
          {/* Default: redirect root to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Public pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected pages — user must be logged in */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Catch-all: any unknown URL goes to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </Router>
  );
}

/**
 * App — The root component.
 * Wraps everything in AuthProvider so all child components
 * can access auth state via the useAuth() hook.
 */
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
