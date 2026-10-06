# 🌐 StudentFlow-API — AWS Lambda & API Gateway Architecture Guide

This document describes the design, configuration, IAM permissions, API Gateway integration, and deployment procedures for the **StudentFlow-API** Lambda function.

---

## 🏗️ 1. Architecture Overview

```
                               ┌────────────────────────────────┐
                               │         React Frontend         │
                               │ (Local: http://localhost:3000) │
                               │ (Production: S3 / CloudFront)  │
                               └───────────────┬────────────────┘
                                               │ HTTPS
                                               ▼
                               ┌────────────────────────────────┐
                               │ Amazon API Gateway (HTTP API)  │
                               │     $default / ANY /{proxy+}   │
                               └───────────────┬────────────────┘
                                               │ Lambda Proxy (v2)
                                               ▼
                               ┌────────────────────────────────┐
                               │   AWS Lambda (Node.js 22.x)    │
                               │        StudentFlow-API         │
                               │   (Adapted via serverless-http)│
                               └───────────────┬────────────────┘
                                               │ AWS SDK v3
                                               ▼
                               ┌────────────────────────────────┐
                               │        Amazon DynamoDB         │
                               │   ├── StudentFlow-Users        │
                               │   └── StudentFlow-Tasks        │
                               └────────────────────────────────┘
```

---

## ⚖️ 2. StudentFlow-API vs. StudentFlow-Automation

StudentFlow separates scheduled batch jobs from real-time student interactions to ensure isolation, optimal resource usage, and least-privilege security:

| Feature / Responsibility | `StudentFlow-API` (This Service) | `StudentFlow-Automation` (Existing) |
|---|---|---|
| **Trigger Mechanism** | Amazon API Gateway HTTP API (synchronous HTTP requests) | Amazon EventBridge Schedule (`rate(1 hour)`) |
| **Primary Goal** | Serve real-time REST API requests for student authentication and task CRUD | Hourly background batch processing |
| **Authentication** | Validates JWT tokens on protected routes, hashes passwords with bcrypt | None (internal machine execution) |
| **SNS Access** | ❌ No SNS permissions (not needed) | ✅ Publishes 24h task reminder notifications |
| **Execution Pattern** | Sub-second request/response cycles | Scheduled batch scan over all records |
| **Tables Accessed** | `StudentFlow-Users`, `StudentFlow-Tasks` | `StudentFlow-Users`, `StudentFlow-Tasks` |
| **Deployment Package** | `aws/dist/studentflow-api.zip` | `aws/dist/studentflow-automation.zip` |

---

## 📁 3. Files Created & Modified

### Files Created:
1. [`aws/lambda/api/index.js`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/aws/lambda/api/index.js) — AWS Lambda entry point adapting the Express app via `serverless-http`.
2. [`aws/lambda/api/package.json`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/aws/lambda/api/package.json) — Package manifest for the API Lambda function.
3. [`backend/app.js`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/backend/app.js) — Decoupled Express application setup (CORS, routes, middleware, error handlers).
4. [`backend/utils/dynamoDb.js`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/backend/utils/dynamoDb.js) — DynamoDB repository implementing the database abstraction interface with AWS SDK v3.
5. [`backend/test/api.test.js`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/backend/test/api.test.js) — Comprehensive unit & integration tests covering local JSON DB, DynamoDB repository mocks, and Lambda handler execution.
6. [`aws/scripts/package-api-lambda.py`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/aws/scripts/package-api-lambda.py) & [`package-api-lambda.js`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/aws/scripts/package-api-lambda.js) — Automated packaging tool building `aws/dist/studentflow-api.zip`.
7. [`aws/docs/AWS_API_GUIDE.md`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/aws/docs/AWS_API_GUIDE.md) — This architecture, IAM, and API Gateway guide.

### Files Modified (Preserving Local Development):
1. [`backend/server.js`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/backend/server.js) — Refactored to import `app` from `./app.js`. Preserves all local server startup behavior and logging.
2. [`backend/utils/db.js`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/backend/utils/db.js) — Retains 100% of local JSON database logic as the default; automatically delegates to `dynamoDb.js` when `USE_DYNAMODB=true` or in AWS Lambda.
3. [`backend/routes/auth.js`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/backend/routes/auth.js) — Added `await` to DB calls. Works identically for synchronous JSON storage and asynchronous DynamoDB.
4. [`backend/routes/tasks.js`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/backend/routes/tasks.js) — Added `async/await` to task handlers.
5. [`frontend/src/services/api.js`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/frontend/src/services/api.js) — Added support for `process.env.REACT_APP_API_URL` while preserving `'/api'` default for local development.

---

## ⚙️ 4. Lambda Function Configuration

When configuring `StudentFlow-API` in the AWS Lambda Console or via AWS CLI:

| Setting | Recommended Value |
|---|---|
| **Function Name** | `StudentFlow-API` |
| **Runtime** | `Node.js 22.x` (or `Node.js 20.x`) |
| **Handler** | `index.handler` |
| **Architecture** | `x86_64` |
| **Memory** | `256 MB` (optimal balance of cold-start speed and cost) |
| **Timeout** | `15 - 30 seconds` |
| **Execution Role** | `StudentFlow-API-LambdaRole` (see IAM permissions below) |

---

## 🔐 5. Required Environment Variables

Configure these environment variables in the Lambda Console under **Configuration > Environment variables**:

| Variable | Required | Default / Example | Purpose |
|---|---|---|---|
| `USERS_TABLE` | Yes | `StudentFlow-Users` | Name of the DynamoDB table storing user accounts |
| `TASKS_TABLE` | Yes | `StudentFlow-Tasks` | Name of the DynamoDB table storing task records |
| `JWT_SECRET` | **Yes (Secret)** | `your-secure-random-256-bit-key` | Secret key used to sign and verify user session tokens |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiration period |
| `FRONTEND_ORIGIN`| No | `http://localhost:3000` | Allowed CORS origin (can be set to your React web host) |
| `USE_DYNAMODB` | No | `true` | Explicitly enables DynamoDB repository mode |

> [!CAUTION]
> Never hardcode `JWT_SECRET` in source code or commit `.env` files to git. In AWS Lambda, enter the secret in the Lambda Environment Variables configuration console or reference AWS Secrets Manager / SSM Parameter Store.

---

## 🛡️ 6. Minimum IAM Permissions (Least Privilege)

The `StudentFlow-API` Lambda requires read and write permissions to only the two StudentFlow DynamoDB tables, plus basic CloudWatch logging permissions. It should **not** have permissions for Amazon SNS, Amazon EventBridge, or any other AWS services.

### IAM Trust Policy (AssumeRole):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### IAM Permissions Policy (`StudentFlow-API-Policy`):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBTableAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:*:table/StudentFlow-Users",
        "arn:aws:dynamodb:us-east-1:*:table/StudentFlow-Tasks",
        "arn:aws:dynamodb:us-east-1:*:table/StudentFlow-Users/index/*",
        "arn:aws:dynamodb:us-east-1:*:table/StudentFlow-Tasks/index/*"
      ]
    },
    {
      "Sid": "CloudWatchLogsAccess",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:*:log-group:/aws/lambda/StudentFlow-API:*"
    }
  ]
}
```

---

## 🔌 7. Connecting Amazon API Gateway (HTTP API)

Amazon API Gateway HTTP APIs provide native, high-performance, cost-effective proxying for Lambda functions using Payload Format Version 2.0.

### Step-by-Step Manual Setup in AWS Console:

1. **Open API Gateway Console**:
   - Go to [AWS API Gateway](https://console.aws.amazon.com/apigateway).
   - Click **Create API**.
   - Under **HTTP API**, click **Build**.

2. **Configure Integration**:
   - Click **Add integration**.
   - Choose **Lambda**.
   - AWS Region: `us-east-1`.
   - Lambda function: Select `StudentFlow-API`.
   - API name: `StudentFlow-HTTP-API`.
   - Click **Next**.

3. **Configure Routes**:
   - Method: `ANY`
   - Resource path: `$default` (catch-all route)
   - Integration target: `StudentFlow-API`
   - *(Optional explicit routes)*: If preferred, you can also define:
     - `ANY /{proxy+}` → `StudentFlow-API`
     - `ANY /` → `StudentFlow-API`
   - Click **Next**.

4. **Configure Stages**:
   - Stage name: `$default`
   - Auto-deploy: **Enabled (Checked)**
   - Click **Next**, then **Create**.

5. **Configure CORS in API Gateway**:
   - In the API Gateway left navigation, select **CORS**.
   - Click **Configure**.
   - **Access-Control-Allow-Origin**: Enter your frontend origin (e.g. `http://localhost:3000` or production domain).
   - **Access-Control-Allow-Headers**: `Content-Type, Authorization`.
   - **Access-Control-Allow-Methods**: `GET, POST, PUT, DELETE, PATCH, OPTIONS`.
   - **Access-Control-Allow-Credentials**: `Yes` (enabled).
   - Click **Save**.

6. **Note Your Invoke URL**:
   - On the API details page, copy the **Invoke URL**:
     `https://<api-id>.execute-api.us-east-1.amazonaws.com`

---

## 💻 8. Connecting the React Frontend to AWS API Gateway

When ready to test or deploy the React frontend against AWS:

1. Create or edit `frontend/.env` (or `frontend/.env.production`):
   ```bash
   REACT_APP_API_URL=https://<api-id>.execute-api.us-east-1.amazonaws.com
   ```
2. When `REACT_APP_API_URL` is set, [`frontend/src/services/api.js`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/frontend/src/services/api.js) automatically routes all HTTP calls to:
   `https://<api-id>.execute-api.us-east-1.amazonaws.com/api/...`
3. When `REACT_APP_API_URL` is empty or omitted, it defaults to `/api`, communicating with the local Express server via Create React App proxy.

---

## 🧪 9. Running and Testing Locally

### Run Backend Locally (JSON DB Mode):
```bash
npm run start:backend
# or from backend directory:
npm run dev
```

### Run Frontend Locally:
```bash
npm run start:frontend
```

### Run All Unit & Integration Tests:
```bash
# Run API tests (Express, JSON DB, DynamoDB repository mocks, Lambda handler)
npm run test:api

# Run automation tests
npm run test:automation

# Run all test suites
npm run test:all
```

### Build Deployment Archives:
```bash
# Package StudentFlow-API Lambda into aws/dist/studentflow-api.zip
npm run package:api

# Package StudentFlow-Automation Lambda into aws/dist/studentflow-automation.zip
npm run package:lambda
```
