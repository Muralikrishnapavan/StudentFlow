/**
 * app.js — Express Application Factory / Setup
 *
 * Configures the Express app with middleware and routes.
 * Exported separately from server.js so it can be used:
 *   1. Locally with HTTP server: node server.js
 *   2. In AWS Lambda via serverless-http: aws/lambda/api/index.js
 */

// Load environment variables from .env file when available
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Import our route handlers
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');

const app = express();

// ─────────────────────────────────────────
// CORS SETUP
// ─────────────────────────────────────────

// Make frontend origin configurable via FRONTEND_ORIGIN
// Defaults to http://localhost:3000 for local development
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';
const configuredOrigin = process.env.FRONTEND_ORIGIN || DEFAULT_FRONTEND_ORIGIN;

const allowedOrigins = configuredOrigin === '*'
  ? ['*']
  : configuredOrigin.split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, Postman, serverless tests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse incoming JSON request bodies
app.use(express.json());

// ─────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────

// Health check — visit /api/health to verify server status
const healthHandler = (req, res) => {
  res.json({
    status: 'OK',
    message: 'StudentFlow backend is running!',
    environment: process.env.NODE_ENV || 'development',
    database: (process.env.DB_TYPE === 'dynamodb' || process.env.USE_DYNAMODB === 'true' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME))
      ? 'DynamoDB'
      : 'Local JSON',
  });
};

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// Authentication routes (login, register) — no token needed
app.use('/api/auth', authRoutes);

// Task routes — all require a valid JWT token
app.use('/api/tasks', taskRoutes);

// ─────────────────────────────────────────
// 404 HANDLER
// Catches any unknown routes
// ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found.` });
});

// ─────────────────────────────────────────
// GLOBAL ERROR HANDLER
// Catches any unhandled errors
// ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

module.exports = app;
