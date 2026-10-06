/**
 * validate-template.js — Node.js wrapper to validate the StudentFlow CloudFormation template
 *
 * Runs validate-template.py to perform offline static analysis, syntax validation,
 * dependency checking, and EventBridge rule verification without deploying to AWS.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, 'validate-template.py');
const result = spawnSync('python', [scriptPath], { stdio: 'inherit' });

if (result.status !== 0) {
  process.exit(result.status || 1);
}
