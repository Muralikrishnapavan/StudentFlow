/**
 * api.js — Centralized API Service
 *
 * All HTTP calls to the backend are defined here.
 * This keeps components clean — they just call these functions
 * instead of writing fetch/axios code directly.
 */

import axios from 'axios';

// The base URL of our backend API
// When running locally, defaults to '/api' (proxied to http://localhost:5000 via package.json proxy)
// When connecting to AWS API Gateway, set REACT_APP_API_URL in .env
const rawApiUrl = (process.env.REACT_APP_API_URL || '').trim().replace(/\/+$/, '');
const API_BASE = rawApiUrl
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`)
  : '/api';

/**
 * Creates an axios instance with the Authorization header set.
 * The token is read from localStorage each time so it's always fresh.
 */
function getAuthHeaders() {
  const token = localStorage.getItem('studentflow_token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

// ─────────────────────────────────────────
// AUTH ENDPOINTS
// ─────────────────────────────────────────

/** Register a new account */
export const registerUser = (name, email, password) =>
  axios.post(`${API_BASE}/auth/register`, { name, email, password });

/** Log in and get a token */
export const loginUser = (email, password) =>
  axios.post(`${API_BASE}/auth/login`, { email, password });

// ─────────────────────────────────────────
// TASK ENDPOINTS
// ─────────────────────────────────────────

/** Get all tasks for the logged-in user */
export const fetchTasks = () =>
  axios.get(`${API_BASE}/tasks`, getAuthHeaders());

/** Create a new task */
export const createTask = (taskData) =>
  axios.post(`${API_BASE}/tasks`, taskData, getAuthHeaders());

/** Update a task */
export const updateTask = (taskId, taskData) =>
  axios.put(`${API_BASE}/tasks/${taskId}`, taskData, getAuthHeaders());

/** Delete a task */
export const deleteTask = (taskId) =>
  axios.delete(`${API_BASE}/tasks/${taskId}`, getAuthHeaders());

/** Toggle task completion */
export const toggleTaskComplete = (taskId) =>
  axios.patch(`${API_BASE}/tasks/${taskId}/complete`, {}, getAuthHeaders());
