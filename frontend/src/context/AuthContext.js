/**
 * AuthContext.js — Global Authentication State
 *
 * This file uses React Context to share the logged-in user's info
 * with ALL components in the app — no prop drilling needed.
 *
 * Any component can call: const { user, token, login, logout } = useAuth();
 */

import React, { createContext, useState, useContext, useEffect } from 'react';

// Create the context object
const AuthContext = createContext(null);

/**
 * AuthProvider wraps the entire app and provides auth state to all children.
 * It also loads the saved token from localStorage on page refresh.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // The logged-in user's info
  const [token, setToken] = useState(null); // The JWT token

  // On first load, check if a token was previously saved in localStorage
  // This keeps the user logged in even after a page refresh
  useEffect(() => {
    const savedToken = localStorage.getItem('studentflow_token');
    const savedUser = localStorage.getItem('studentflow_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  /**
   * Call this after a successful login.
   * Saves the token and user info both in state and localStorage.
   */
  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    localStorage.setItem('studentflow_token', jwtToken);
    localStorage.setItem('studentflow_user', JSON.stringify(userData));
  };

  /**
   * Call this to log the user out.
   * Clears everything from state and localStorage.
   */
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('studentflow_token');
    localStorage.removeItem('studentflow_user');
  };

  // Provide the auth state and functions to all child components
  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook — makes it easy to use auth in any component.
 * Usage: const { user, token, login, logout } = useAuth();
 */
export function useAuth() {
  return useContext(AuthContext);
}
