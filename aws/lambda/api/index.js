/**
 * index.js — AWS Lambda Entry Point for StudentFlow-API
 *
 * Adapts the StudentFlow Express application for AWS Lambda and Amazon API Gateway HTTP API
 * using serverless-http.
 *
 * Target Configuration:
 *   Runtime: Node.js 22.x (or Node.js 20.x)
 *   Handler: index.handler
 *   Architecture: x86_64
 *   Memory: 256 MB (recommended)
 *   Timeout: 15-30 seconds
 *
 * Environment Variables:
 *   USERS_TABLE     (default: 'StudentFlow-Users')
 *   TASKS_TABLE     (default: 'StudentFlow-Tasks')
 *   JWT_SECRET      (required for JWT authentication)
 *   JWT_EXPIRES_IN  (optional, default: '7d')
 *   FRONTEND_ORIGIN (e.g. 'http://localhost:3000' or CloudFront origin)
 *   USE_DYNAMODB    (defaults to 'true' in Lambda)
 */

const fs = require('fs');
const path = require('path');
const serverless = require('serverless-http');

// Load the Express application:
// In the deployed deployment package, app.js is bundled alongside index.js.
// In the local repository context, load from backend/app.js.
let app;
if (fs.existsSync(path.join(__dirname, 'app.js'))) {
  app = require('./app');
} else {
  app = require(path.join(__dirname, '../../../backend/app'));
}

// Adapt Express app for API Gateway HTTP API v2 and REST API v1 payloads
const serverlessHandler = serverless(app);

const handler = async (event, context) => {
  // Ensure DynamoDB mode is active when executing inside AWS Lambda
  if (process.env.USE_DYNAMODB === undefined) {
    process.env.USE_DYNAMODB = 'true';
  }
  return serverlessHandler(event, context);
};

module.exports = {
  handler,
  app,
};
