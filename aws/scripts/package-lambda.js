/**
 * package-lambda.js — Node.js wrapper to package the StudentFlow Automation Lambda
 *
 * Runs package-lambda.py to create aws/dist/studentflow-automation.zip
 * containing the Lambda implementation (index.js), package.json, and
 * the AWS SDK v3 production dependencies (node_modules).
 */

const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'package-lambda.py');
const result = spawnSync('python', [scriptPath], { stdio: 'inherit' });

if (result.status !== 0) {
  process.exit(result.status || 1);
}
