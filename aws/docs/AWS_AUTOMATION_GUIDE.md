# ☁️ StudentFlow — AWS Automation Architecture & Deployment Guide

This document details the automated serverless backend infrastructure designed for **StudentFlow**.

---

## 🏗️ 1. Target AWS Architecture

```
                    ┌────────────────────────────┐
                    │  Amazon EventBridge Rule   │
                    │    (AWS::Events::Rule)     │
                    │   (Hourly: rate(1 hour))   │
                    └─────────────┬──────────────┘
                                  │ Triggers (events.amazonaws.com)
                                  ▼
                    ┌────────────────────────────┐
                    │      AWS Lambda (Node.js)  │
                    │   (StudentFlow-Automation) │
                    └──────┬───────────────┬─────┘
                           │               │
        Scan / Updates     │               │ Publishes 24h Reminders
                           ▼               ▼
      ┌─────────────────────────┐   ┌──────────────────────────┐
      │     Amazon DynamoDB     │   │        Amazon SNS        │
      │   StudentFlow-Tasks     │   │ StudentFlow-TaskReminders│
      │   StudentFlow-Users     │   └─────────────┬────────────┘
      └─────────────────────────┘                 │
                                                  ▼
                                      ┌────────────────────────┐
                                      │ Subscriptions: Email,  │
                                      │ SMS, Webhook, Discord  │
                                      └────────────────────────┘
                                                  
      All operations emit structured logs to:
      ┌────────────────────────────────────────────────────────┐
      │       Amazon CloudWatch Logs (/aws/lambda/...)         │
      └────────────────────────────────────────────────────────┘
```

---

## 📋 2. Automation Responsibilities

The Lambda function at `aws/lambda/automation/index.js` executes on a recurring schedule and performs four primary jobs:

1. **Table Scanning**:
   - Scans the `StudentFlow-Tasks` table (with automatic multi-page pagination using `LastEvaluatedKey`).
   - Scans the `StudentFlow-Users` table.

2. **Overdue Task Detection & Status Update**:
   - Identifies tasks where `completed === false` and `dueDate < now`.
   - Updates the task in DynamoDB:
     - Sets `#status = 'overdue'` (using ExpressionAttributeNames since `status` is a DynamoDB reserved word).
     - Updates `#updatedAt` timestamp.
   - Idempotent: tasks already having `status === 'overdue'` are not re-written, conserving DynamoDB write capacity units.

3. **24-Hour Upcoming Due Date Reminders with Deduplication**:
   - Identifies tasks where `completed === false` and `now <= dueDate <= now + 24 hours`.
   - **Deduplication mechanism**:
     - Compares `task.reminderSentForDueDate` with `task.dueDate`.
     - If `task.reminderSentForDueDate === task.dueDate`, the reminder for this specific deadline has already been sent and is skipped.
     - If it has not been sent, it publishes an SNS reminder message to `SNS_TOPIC_ARN`.
     - Immediately writes `reminderSentForDueDate = task.dueDate` back to DynamoDB.
     - If the student changes or reschedules the due date in the future, the new due date will trigger a fresh reminder once it enters the 24-hour window.

4. **User Productivity Calculation & Storage**:
   - For every registered user in `StudentFlow-Users`, calculates:
     $$\text{Productivity Percentage} = \text{round}\left(\frac{\text{completed tasks}}{\text{total tasks}} \times 100\right)$$
   - If a user has 0 tasks, productivity defaults to `0%`.
   - Stores `productivityPercentage` directly on the user's record in `StudentFlow-Users`.

---

## 🆓 3. AWS Free Tier Compliance (Zero Cost Guarantee)

All services used in this automation fall strictly within the **AWS Free Tier**:

| AWS Service | Free Tier Allowance | StudentFlow Usage | Cost |
|---|---|---|---|
| **AWS Lambda** | 1,000,000 requests/month + 3.2M seconds compute | ~720 invocations/month (hourly) | **$0.00** |
| **Amazon DynamoDB** | 25 GB storage + 25 WCU / 25 RCU | < 50 MB, on-demand pay-per-request | **$0.00** |
| **Amazon EventBridge Rule** (`AWS::Events::Rule`) | Scheduled rules included at no cost | 720 invocations/month | **$0.00** |
| **Amazon SNS** | 1,000,000 publishes + 1,000 emails/month | ~100–500 emails/month | **$0.00** |
| **CloudWatch Logs** | 5 GB ingestion + 5 GB storage | < 50 MB/month (14-day retention) | **$0.00** |

*No paid or billable services (such as NAT Gateways, Provisioned Concurrency, or OpenSearch) are used.*

---

## 🔐 4. IAM Permissions (Least-Privilege Security Policy)

The Lambda execution role (`StudentFlow-Automation-LambdaRole`) requires only the minimum permissions necessary to interact with its target resources. No wildcard (`*`) access is used for data tables.

### A. Trust Relationship (`sts:AssumeRole`)
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

### B. DynamoDB Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan",
        "dynamodb:UpdateItem",
        "dynamodb:GetItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/StudentFlow-Tasks",
        "arn:aws:dynamodb:*:*:table/StudentFlow-Users"
      ]
    }
  ]
}
```

### C. Amazon SNS Publish Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "arn:aws:sns:*:*:StudentFlow-TaskReminders"
    }
  ]
}
```

### D. CloudWatch Logs Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/StudentFlow-Automation:*"
    }
  ]
}
```

---

## 🚀 5. Deployment Guide

### Option 1: CloudFormation Packaging & Deployment (Recommended)

The project includes an infrastructure template at `aws/cloudformation/template.yaml`.

Since the Lambda function uses external files and AWS SDK dependencies, deployment follows the standard two-step AWS CLI packaging and deployment flow:

```bash
# Step 1: Package Lambda code and AWS SDK dependencies into S3
aws cloudformation package \
  --template-file aws/cloudformation/template.yaml \
  --s3-bucket <your-s3-bucket-name> \
  --output-template-file aws/cloudformation/packaged.yaml

# Step 2: Deploy the packaged CloudFormation stack
aws cloudformation deploy \
  --template-file aws/cloudformation/packaged.yaml \
  --stack-name studentflow-automation-stack \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

You can also package the Lambda zip locally at any time using:
```bash
npm run package:lambda
# Creates: aws/dist/studentflow-automation.zip (includes index.js and production AWS SDK v3 node_modules)
```

And validate the template locally without deploying:
```bash
npm run validate:template
```

---

### Option 2: Step-by-Step Manual Deployment in AWS Console

Once your AWS account is activated, follow these steps in the AWS Management Console:

#### Step 1: Create DynamoDB Tables
1. Open the **Amazon DynamoDB Console** -> Click **Create table**.
2. **Tasks Table**:
   - Table name: `StudentFlow-Tasks`
   - Partition key: `id` (Type: `String`)
   - Table settings: **Customize settings** -> Capacity mode: **On-demand** (Free Tier friendly)
   - Click **Create table**.
3. **Users Table**:
   - Table name: `StudentFlow-Users`
   - Partition key: `id` (Type: `String`)
   - Table settings: **On-demand**
   - Click **Create table**.

#### Step 2: Create the Amazon SNS Topic & Subscription
1. Open the **Amazon SNS Console** -> Click **Topics** -> **Create topic**.
2. Type: **Standard**.
3. Name: `StudentFlow-TaskReminders`.
4. Click **Create topic**. Copy the generated **Topic ARN** (e.g. `arn:aws:sns:us-east-1:123456789012:StudentFlow-TaskReminders`).
5. Inside the newly created topic, click **Create subscription**:
   - Protocol: **Email**
   - Endpoint: Your email address (e.g., `student@university.edu`)
   - Click **Create subscription**.
6. Check your inbox and click **Confirm subscription** in the verification email sent by AWS.

#### Step 3: Create the IAM Execution Role
1. Open the **AWS IAM Console** -> Click **Roles** -> **Create role**.
2. Trusted entity type: **AWS service** -> Use case: **Lambda**.
3. Add the managed policy `AWSLambdaBasicExecutionRole`.
4. Add custom inline policies for DynamoDB and SNS as described in Section 4.
5. Role name: `StudentFlow-Automation-LambdaRole` -> Click **Create role**.

#### Step 4: Create & Deploy the Lambda Function
1. Open the **AWS Lambda Console** -> Click **Create function**.
2. Function name: `StudentFlow-Automation`.
3. Runtime: **Node.js 20.x** (or Node.js 18.x).
4. Architecture: `x86_64`.
5. Permissions: **Use an existing role** -> Select `StudentFlow-Automation-LambdaRole`.
6. Click **Create function**.
7. In the **Code** tab:
   - Click **Upload from** -> **.zip file**.
   - Select `aws/dist/studentflow-automation.zip` (built via `npm run package:lambda`).
   - Click **Save**.
8. Go to the **Configuration** tab -> **Environment variables** -> Click **Edit**:
   - `TASKS_TABLE` = `StudentFlow-Tasks`
   - `USERS_TABLE` = `StudentFlow-Users`
   - `SNS_TOPIC_ARN` = `<Your SNS Topic ARN from Step 2>`
   - Click **Save**.
9. In **Configuration** -> **General configuration**:
   - Set **Timeout** to `1 min 0 sec`.

#### Step 5: Configure Amazon EventBridge Rule (AWS::Events::Rule)
1. Open the **Amazon EventBridge Console** -> Click **Rules** -> **Create rule**.
2. Rule name: `StudentFlow-HourlyAutomationTrigger`.
3. Rule type: **Schedule**.
4. Schedule pattern: Runs at a regular rate, such as `1 hours` (or cron expression `cron(0 * * * ? *)`).
5. Target types: **AWS service** -> Target: **Lambda function** -> Function: `StudentFlow-Automation`.
6. Click **Next** through tags and review -> Click **Create rule**.

---

## 📊 6. Monitoring & CloudWatch Logs

1. Open the **CloudWatch Console** -> Click **Log groups**.
2. Open `/aws/lambda/StudentFlow-Automation`.
3. Each run outputs structured execution logs:
   ```
   [StudentFlow-Automation] Starting run at 2026-10-05T18:00:00.000Z
   [StudentFlow-Automation] Config: TASKS_TABLE=StudentFlow-Tasks, USERS_TABLE=StudentFlow-Users, SNS_TOPIC_ARN=(configured)
   [StudentFlow-Automation] Scanned 18 tasks and 5 users.
   [StudentFlow-Automation] SNS reminder published for task 78a65493 (dueDate: 2026-10-06)
   [StudentFlow-Automation] Run completed in 240ms: {"tasksScanned":18,"usersScanned":5,"overdueTasksMarked":2,"tasksDueIn24Hours":1,"remindersSent":1,"remindersDeduplicated":0,"usersUpdated":5,"durationMs":240}
   ```
4. **Log Retention Recommendation**:
   Set retention to **14 days** (Actions -> Edit retention setting) to keep total storage well below the 5 GB free tier limit.

---

## 🧪 7. Local Testing (While AWS Activation is Pending)

You can run and test all automation logic immediately on your local machine without waiting for live AWS resources.

### A. Run Automated Unit & Simulation Tests
From the project root:
```bash
node --test aws/lambda/automation/test/automation.test.js
```
Or from the `backend/` directory:
```bash
cd backend
npm run test:automation
```
✅ Executes 29 automated tests verifying:
- Date parsing (ISO 8601, YYYY-MM-DD, timestamps, invalid formats)
- Overdue detection (incomplete past tasks, completed tasks, null due dates)
- 24-hour reminder window filtering
- Strict reminder deduplication using `reminderSentForDueDate`
- Productivity percentage calculation and user aggregation
- End-to-end simulated run with mock DynamoDB and SNS clients

### B. Run Local Database Automation Simulation
To see the automation update your actual local JSON database (`backend/data/tasks.json` and `backend/data/users.json`):
```bash
cd backend
npm run automation:local
```
This inspects local tasks, flags any overdue items, triggers mock SNS notifications for tasks due in 24 hours, deduplicates repeated alerts, and calculates each student's `productivityPercentage`.
