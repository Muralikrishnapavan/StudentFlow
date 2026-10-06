/**
 * server.js — Main Backend Entry Point
 *
 * This file sets up the Express web server and connects all routes.
 * Run this file with: node server.js
 */

// Load environment variables from .env file
require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────
// START THE SERVER
// ─────────────────────────────────────────
let server;
if (require.main === module || !process.env.NODE_TEST_CONTEXT) {
  server = app.listen(PORT, () => {
    console.log(`✅ StudentFlow backend is running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  });
}

module.exports = { app, server };
