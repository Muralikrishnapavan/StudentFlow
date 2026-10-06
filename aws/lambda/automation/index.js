/**
 * StudentFlow — AWS Lambda Automation Function
 *
 * Target Architecture:
 * EventBridge Scheduler -> Automation Lambda -> DynamoDB (Tasks & Users) + SNS
 * CloudWatch -> Logs
 *
 * Responsibilities:
 * 1. Scan StudentFlow-Tasks table.
 * 2. Mark incomplete tasks whose dueDate has passed with status='overdue'.
 * 3. Find incomplete tasks due within the next 24 hours.
 * 4. Publish one SNS reminder per task/due-date using reminderSentForDueDate to prevent duplicates.
 * 5. Calculate each user's productivity as (completed / total) * 100 and store productivityPercentage on StudentFlow-Users.
 *
 * AWS Credentials:
 * In accordance with AWS security best practices, no credentials are hardcoded
 * or loaded from local .env files. When deployed, the Lambda execution IAM role
 * supplies temporary credentials automatically.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

// Default environment variable configuration
const DEFAULT_TASKS_TABLE = 'StudentFlow-Tasks';
const DEFAULT_USERS_TABLE = 'StudentFlow-Users';

// ─────────────────────────────────────────────────────────────────────────────
// 1. PURE DOMAIN & BUSINESS LOGIC FUNCTIONS (Testable & Reusable)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely parses any date format (ISO 8601 string, date string YYYY-MM-DD,
 * timestamp, or Date instance) into a valid JavaScript Date object.
 *
 * If a date-only string (e.g. "2026-10-06") is provided, it is parsed
 * in UTC (e.g., 2026-10-06T00:00:00.000Z).
 *
 * @param {string|number|Date} dueDate
 * @returns {Date|null} Valid Date object or null if invalid or missing
 */
function parseDueDate(dueDate) {
  if (dueDate === null || dueDate === undefined || dueDate === '') {
    return null;
  }

  if (dueDate instanceof Date) {
    return isNaN(dueDate.getTime()) ? null : dueDate;
  }

  if (typeof dueDate === 'number') {
    const d = new Date(dueDate);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof dueDate !== 'string') {
    return null;
  }

  const str = dueDate.trim();
  if (!str) return null;

  // Check if string contains only digits (e.g. numeric timestamp serialized as string)
  if (/^\d{10,13}$/.test(str)) {
    const num = Number(str);
    const d = new Date(num);
    return isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

/**
 * Determines whether a task is overdue.
 *
 * An overdue task satisfies:
 * 1. It is incomplete (task.completed is false / falsy).
 * 2. It has a valid dueDate.
 * 3. The dueDate has strictly passed relative to `now` (dueDate < now).
 *
 * Completed tasks (task.completed === true) are never overdue.
 *
 * @param {Object} task
 * @param {Date} [now]
 * @returns {boolean}
 */
function isTaskOverdue(task, now = new Date()) {
  if (!task || task.completed === true) {
    return false;
  }

  const dueDate = parseDueDate(task.dueDate);
  if (!dueDate) {
    return false;
  }

  return dueDate.getTime() < now.getTime();
}

/**
 * Determines whether an incomplete task is due within the next 24 hours.
 *
 * Condition:
 * 1. Task is incomplete (completed !== true).
 * 2. Due date has not passed yet (dueDate >= now).
 * 3. Due date is within 24 hours from now (dueDate <= now + 24 hours).
 *
 * @param {Object} task
 * @param {Date} [now]
 * @returns {boolean}
 */
function isDueWithinNext24Hours(task, now = new Date()) {
  if (!task || task.completed === true) {
    return false;
  }

  const dueDate = parseDueDate(task.dueDate);
  if (!dueDate) {
    return false;
  }

  const nowTime = now.getTime();
  const dueTime = dueDate.getTime();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;

  return dueTime >= nowTime && dueTime <= nowTime + twentyFourHoursMs;
}

/**
 * Determines whether a reminder should be published to SNS for a task.
 *
 * Deduplication requirement:
 * "publish one SNS reminder per task/due-date using reminderSentForDueDate to prevent duplicates"
 *
 * Returns true if:
 * 1. The task is due within the next 24 hours.
 * 2. The task has NOT already had a reminder sent for this specific dueDate
 *    (i.e. task.reminderSentForDueDate !== task.dueDate).
 *
 * If a student changes the due date later and it again falls within 24h,
 * reminderSentForDueDate won't match, allowing a single fresh reminder.
 *
 * @param {Object} task
 * @param {Date} [now]
 * @returns {boolean}
 */
function shouldSendReminder(task, now = new Date()) {
  if (!isDueWithinNext24Hours(task, now)) {
    return false;
  }

  // Deduplication check against the exact dueDate string
  if (task.reminderSentForDueDate && String(task.reminderSentForDueDate) === String(task.dueDate)) {
    return false;
  }

  return true;
}

/**
 * Calculates productivity percentage for a list of tasks.
 * Formula: completed / total * 100
 *
 * Returns 0 if total tasks is 0.
 * Rounds to the nearest integer (matching Dashboard.js behavior).
 *
 * @param {Array<Object>} tasks
 * @returns {number}
 */
function calculateProductivity(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return 0;
  }

  const total = tasks.length;
  const completed = tasks.filter(t => Boolean(t.completed)).length;

  return Math.round((completed / total) * 100);
}

/**
 * Groups tasks by userId and computes each user's productivity percentage.
 *
 * @param {Array<Object>} tasks - All tasks scanned from StudentFlow-Tasks
 * @param {Array<Object>} [users=[]] - All users scanned from StudentFlow-Users
 * @returns {Map<string, { total: number, completed: number, productivityPercentage: number }>}
 */
function calculateUserProductivity(tasks, users = []) {
  const userMap = new Map();

  // Seed map with all known users so users with 0 tasks are assigned 0%
  if (Array.isArray(users)) {
    for (const user of users) {
      if (user && user.id) {
        userMap.set(String(user.id), {
          total: 0,
          completed: 0,
          productivityPercentage: 0,
        });
      }
    }
  }

  // Aggregate task counts per user
  if (Array.isArray(tasks)) {
    for (const task of tasks) {
      if (!task || !task.userId) continue;
      const userIdStr = String(task.userId);

      let stats = userMap.get(userIdStr);
      if (!stats) {
        stats = { total: 0, completed: 0, productivityPercentage: 0 };
        userMap.set(userIdStr, stats);
      }

      stats.total += 1;
      if (task.completed === true) {
        stats.completed += 1;
      }
    }
  }

  // Compute percentage for each user
  for (const stats of userMap.values()) {
    stats.productivityPercentage = stats.total > 0
      ? Math.round((stats.completed / stats.total) * 100)
      : 0;
  }

  return userMap;
}

/**
 * Formats a clean, student-friendly message for SNS notifications.
 *
 * @param {Object} task
 * @returns {string}
 */
function formatReminderMessage(task) {
  return [
    '🔔 StudentFlow Task Reminder',
    '====================================',
    `Task:        ${task.title}`,
    `Due Date:    ${task.dueDate || 'Unspecified'}`,
    `Priority:    ${(task.priority || 'medium').toUpperCase()}`,
    `Category:    ${task.category || 'personal'}`,
    task.description ? `Description: ${task.description}` : null,
    '====================================',
    'Please log in to StudentFlow to complete or update your task.',
    'Happy studying!',
  ]
    .filter(Boolean)
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DYNAMODB UTILITIES (Auto-pagination & updates)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scans all items from a DynamoDB table, automatically following pagination
 * tokens (ExclusiveStartKey) until all records are retrieved.
 *
 * @param {DynamoDBDocumentClient} docClient
 * @param {string} tableName
 * @returns {Promise<Array<Object>>}
 */
async function scanAllItems(docClient, tableName) {
  const items = [];
  let lastEvaluatedKey = undefined;

  do {
    const command = new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await docClient.send(command);
    if (response.Items && response.Items.length > 0) {
      items.push(...response.Items);
    }
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CORE AUTOMATION ORCHESTRATION PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Orchestrates the full automation workflow:
 * 1. Scans StudentFlow-Tasks and StudentFlow-Users.
 * 2. Marks incomplete overdue tasks with status='overdue'.
 * 3. Identifies incomplete tasks due within the next 24 hours.
 * 4. Publishes SNS reminders (one per task/due-date) and records reminderSentForDueDate.
 * 5. Computes completed/total*100 and saves productivityPercentage to StudentFlow-Users.
 *
 * @param {Object} options
 * @param {DynamoDBDocumentClient} options.docClient
 * @param {SNSClient} options.snsClient
 * @param {Object} [options.env] - Environment variables override
 * @param {Date} [options.now] - Current date reference (useful for deterministic tests)
 * @returns {Promise<Object>} Execution summary metrics
 */
async function processAutomation({
  docClient,
  snsClient,
  env = process.env,
  now = new Date(),
}) {
  const startTime = Date.now();
  const tasksTable = env.TASKS_TABLE || DEFAULT_TASKS_TABLE;
  const usersTable = env.USERS_TABLE || DEFAULT_USERS_TABLE;
  const snsTopicArn = env.SNS_TOPIC_ARN;

  console.log(`[StudentFlow-Automation] Starting run at ${now.toISOString()}`);
  console.log(`[StudentFlow-Automation] Config: TASKS_TABLE=${tasksTable}, USERS_TABLE=${usersTable}, SNS_TOPIC_ARN=${snsTopicArn ? '(configured)' : '(not set)'}`);

  // Step 1: Scan both DynamoDB tables
  const [tasks, users] = await Promise.all([
    scanAllItems(docClient, tasksTable),
    scanAllItems(docClient, usersTable),
  ]);

  console.log(`[StudentFlow-Automation] Scanned ${tasks.length} tasks and ${users.length} users.`);

  let overdueMarkedCount = 0;
  let remindersSentCount = 0;
  let remindersDeduplicatedCount = 0;
  let usersUpdatedCount = 0;

  // Step 2: Mark incomplete overdue tasks with status='overdue'
  for (const task of tasks) {
    if (isTaskOverdue(task, now)) {
      // Only perform update if status is not already 'overdue' to conserve write capacity
      if (task.status !== 'overdue') {
        const updateCmd = new UpdateCommand({
          TableName: tasksTable,
          Key: { id: task.id },
          UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status', // 'status' is a DynamoDB reserved keyword
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':status': 'overdue',
            ':updatedAt': new Date().toISOString(),
          },
        });
        await docClient.send(updateCmd);
        overdueMarkedCount++;
        task.status = 'overdue'; // keep in-memory task state current
      }
    }
  }

  // Step 3 & 4: Find tasks due in next 24 hours & publish deduplicated SNS reminders
  const tasksDueSoon = tasks.filter(t => isDueWithinNext24Hours(t, now));

  for (const task of tasksDueSoon) {
    if (shouldSendReminder(task, now)) {
      // Valid topic ARN check (skip placeholder or missing ARN gracefully)
      const isValidTopicArn =
        snsTopicArn &&
        typeof snsTopicArn === 'string' &&
        snsTopicArn.startsWith('arn:aws:sns:') &&
        !snsTopicArn.includes('<');

      if (isValidTopicArn) {
        const subject = `Task Due Soon: ${task.title}`.substring(0, 100);
        const publishCmd = new PublishCommand({
          TopicArn: snsTopicArn,
          Subject: subject,
          Message: formatReminderMessage(task),
          MessageAttributes: {
            eventType: { DataType: 'String', StringValue: 'TASK_DUE_REMINDER' },
            taskId: { DataType: 'String', StringValue: String(task.id) },
            userId: { DataType: 'String', StringValue: String(task.userId || '') },
            dueDate: { DataType: 'String', StringValue: String(task.dueDate) },
          },
        });

        await snsClient.send(publishCmd);
        remindersSentCount++;
        console.log(`[StudentFlow-Automation] SNS reminder published for task ${task.id} (dueDate: ${task.dueDate})`);
      } else {
        console.log(`[StudentFlow-Automation] SNS_TOPIC_ARN is not configured or is a placeholder. Skipping SNS publish for task ${task.id}.`);
      }

      // Record reminderSentForDueDate in DynamoDB to ensure deduplication on future runs
      const dedupeCmd = new UpdateCommand({
        TableName: tasksTable,
        Key: { id: task.id },
        UpdateExpression: 'SET #reminderSent = :dueDate, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#reminderSent': 'reminderSentForDueDate',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':dueDate': task.dueDate,
          ':updatedAt': new Date().toISOString(),
        },
      });

      await docClient.send(dedupeCmd);
      task.reminderSentForDueDate = task.dueDate;
    } else {
      remindersDeduplicatedCount++;
    }
  }

  // Step 5: Calculate each user's productivity and store productivityPercentage on StudentFlow-Users
  const userProductivityMap = calculateUserProductivity(tasks, users);

  for (const [userId, stats] of userProductivityMap.entries()) {
    const userUpdateCmd = new UpdateCommand({
      TableName: usersTable,
      Key: { id: userId },
      UpdateExpression: 'SET #prod = :prod, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#prod': 'productivityPercentage',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':prod': stats.productivityPercentage,
        ':updatedAt': new Date().toISOString(),
      },
    });

    await docClient.send(userUpdateCmd);
    usersUpdatedCount++;
  }

  const durationMs = Date.now() - startTime;
  const metrics = {
    tasksScanned: tasks.length,
    usersScanned: users.length,
    overdueTasksMarked: overdueMarkedCount,
    tasksDueIn24Hours: tasksDueSoon.length,
    remindersSent: remindersSentCount,
    remindersDeduplicated: remindersDeduplicatedCount,
    usersUpdated: usersUpdatedCount,
    durationMs,
  };

  console.log(`[StudentFlow-Automation] Run completed in ${durationMs}ms:`, JSON.stringify(metrics));

  return metrics;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AWS LAMBDA HANDLER (AWS Entry Point)
// ─────────────────────────────────────────────────────────────────────────────

// Lazily initialized AWS SDK v3 clients (reused across warm Lambda containers)
let cachedDocClient = null;
let cachedSnsClient = null;

function getClients() {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

  if (!cachedDocClient) {
    const rawDdb = new DynamoDBClient({ region });
    cachedDocClient = DynamoDBDocumentClient.from(rawDdb, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false,
      },
    });
  }

  if (!cachedSnsClient) {
    cachedSnsClient = new SNSClient({ region });
  }

  return { docClient: cachedDocClient, snsClient: cachedSnsClient };
}

/**
 * Standard AWS Lambda Handler function.
 * Invoked by EventBridge Scheduler or manual test invocations.
 *
 * @param {Object} event - EventBridge event or manual invocation payload
 * @param {Object} context - Lambda runtime context
 * @returns {Promise<Object>} API Gateway / Lambda standard response
 */
exports.handler = async (event, context) => {
  try {
    const { docClient, snsClient } = getClients();

    const metrics = await processAutomation({
      docClient,
      snsClient,
      env: process.env,
      now: new Date(),
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'StudentFlow automation completed successfully.',
        metrics,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('[StudentFlow-Automation] Execution failed:', error);

    // Provide friendly guidance if running locally without AWS credentials
    if (error.name === 'CredentialsProviderError' || error.message?.includes('credentials')) {
      console.warn(
        '[StudentFlow-Automation] NOTE: AWS credentials not found in local environment. ' +
        'In production Lambda, credentials are automatically provided by the IAM execution role.'
      );
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'StudentFlow automation failed.',
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

// Export pure functions for testing and local simulation
module.exports = {
  ...module.exports,
  parseDueDate,
  isTaskOverdue,
  isDueWithinNext24Hours,
  shouldSendReminder,
  calculateProductivity,
  calculateUserProductivity,
  formatReminderMessage,
  scanAllItems,
  processAutomation,
  DEFAULT_TASKS_TABLE,
  DEFAULT_USERS_TABLE,
};
