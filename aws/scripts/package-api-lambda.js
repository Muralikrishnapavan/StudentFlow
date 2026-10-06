/**
 * package-api-lambda.js — Node.js wrapper to package the StudentFlow-API Lambda
 *
 * Runs package-api-lambda.py to create aws/dist/studentflow-api.zip
 * containing index.js, backend application code, and production dependencies.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'package-api-lambda.py');
const result = spawnSync('python', [scriptPath], { stdio: 'inherit' });

if (result.status !== 0) {
  process.exit(result.status || 1);
}
