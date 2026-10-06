/**
 * dynamoDb.js — AWS DynamoDB Repository Implementation
 *
 * Implements the database abstraction interface for StudentFlow:
 *   - User operations (findUserByEmail, findUserById, saveUser, updateUser, getAllUsers)
 *   - Task operations (getTasksByUser, findTaskById, saveTask, updateTask, deleteTask)
 *
 * Uses AWS SDK v3 with DynamoDBDocumentClient.
 * Environment variables:
 *   USERS_TABLE (default: 'StudentFlow-Users')
 *   TASKS_TABLE (default: 'StudentFlow-Tasks')
 *   AWS_REGION  (default: 'us-east-1')
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

const DEFAULT_USERS_TABLE = 'StudentFlow-Users';
const DEFAULT_TASKS_TABLE = 'StudentFlow-Tasks';

let defaultDocClient = null;

/**
 * Returns or initializes the DynamoDB Document Client lazily.
 * Lazy initialization ensures importing this module never throws or
 * makes network calls when AWS credentials are not configured.
 */
function getDocClient() {
  if (defaultDocClient) {
    return defaultDocClient;
  }

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const client = new DynamoDBClient({ region });

  defaultDocClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  });

  return defaultDocClient;
}

/**
 * Allows overriding the document client (useful for unit tests and mocks).
 * @param {DynamoDBDocumentClient|null} client
 */
function setDocClient(client) {
  defaultDocClient = client;
}

function getUsersTableName() {
  return process.env.USERS_TABLE || DEFAULT_USERS_TABLE;
}

function getTasksTableName() {
  return process.env.TASKS_TABLE || DEFAULT_TASKS_TABLE;
}

// ─────────────────────────────────────────
// USER OPERATIONS
// ─────────────────────────────────────────

/**
 * Get all users from DynamoDB (scans table with pagination support)
 * @returns {Promise<Array<Object>>}
 */
async function getAllUsers() {
  const docClient = getDocClient();
  const items = [];
  let lastEvaluatedKey = undefined;

  do {
    const command = new ScanCommand({
      TableName: getUsersTableName(),
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

/**
 * Find a user by their email address
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function findUserByEmail(email) {
  if (!email) return null;
  const docClient = getDocClient();

  const command = new ScanCommand({
    TableName: getUsersTableName(),
    FilterExpression: '#email = :email',
    ExpressionAttributeNames: {
      '#email': 'email',
    },
    ExpressionAttributeValues: {
      ':email': email.trim().toLowerCase(),
    },
  });

  const response = await docClient.send(command);
  if (response.Items && response.Items.length > 0) {
    return response.Items[0];
  }

  // Fallback: search case-insensitively across scanned users if exact match not found
  if (response.Items) {
    const matched = response.Items.find(
      u => u.email && u.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (matched) return matched;
  }

  return null;
}

/**
 * Find a user by their unique ID (Partition Key)
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function findUserById(id) {
  if (!id) return null;
  const docClient = getDocClient();

  const command = new GetCommand({
    TableName: getUsersTableName(),
    Key: { id },
  });

  const response = await docClient.send(command);
  return response.Item || null;
}

/**
 * Save a new user
 * @param {Object} user
 * @returns {Promise<Object>}
 */
async function saveUser(user) {
  const docClient = getDocClient();

  // Normalize email to lowercase for consistent indexing
  const userToSave = {
    ...user,
    email: user.email ? user.email.trim().toLowerCase() : user.email,
  };

  const command = new PutCommand({
    TableName: getUsersTableName(),
    Item: userToSave,
  });

  await docClient.send(command);
  return userToSave;
}

/**
 * Update an existing user
 * @param {string} userId
 * @param {Object} updatedFields
 * @returns {Promise<Object|null>}
 */
async function updateUser(userId, updatedFields) {
  const existingUser = await findUserById(userId);
  if (!existingUser) return null;

  const docClient = getDocClient();
  const updated = {
    ...existingUser,
    ...updatedFields,
    updatedAt: new Date().toISOString(),
  };

  if (updated.email) {
    updated.email = updated.email.trim().toLowerCase();
  }

  const command = new PutCommand({
    TableName: getUsersTableName(),
    Item: updated,
  });

  await docClient.send(command);
  return updated;
}

// ─────────────────────────────────────────
// TASK OPERATIONS
// ─────────────────────────────────────────

/**
 * Get all tasks belonging to a specific user
 * @param {string} userId
 * @returns {Promise<Array<Object>>}
 */
async function getTasksByUser(userId) {
  if (!userId) return [];
  const docClient = getDocClient();
  const items = [];
  let lastEvaluatedKey = undefined;

  do {
    const command = new ScanCommand({
      TableName: getTasksTableName(),
      FilterExpression: '#userId = :userId',
      ExpressionAttributeNames: {
        '#userId': 'userId',
      },
      ExpressionAttributeValues: {
        ':userId': userId,
      },
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

/**
 * Get a single task by its unique ID (Partition Key)
 * @param {string} taskId
 * @returns {Promise<Object|null>}
 */
async function findTaskById(taskId) {
  if (!taskId) return null;
  const docClient = getDocClient();

  const command = new GetCommand({
    TableName: getTasksTableName(),
    Key: { id: taskId },
  });

  const response = await docClient.send(command);
  return response.Item || null;
}

/**
 * Save a new task
 * @param {Object} task
 * @returns {Promise<Object>}
 */
async function saveTask(task) {
  const docClient = getDocClient();

  const command = new PutCommand({
    TableName: getTasksTableName(),
    Item: task,
  });

  await docClient.send(command);
  return task;
}

/**
 * Update an existing task
 * @param {string} taskId
 * @param {Object} updatedFields
 * @returns {Promise<Object|null>}
 */
async function updateTask(taskId, updatedFields) {
  const existingTask = await findTaskById(taskId);
  if (!existingTask) return null;

  const docClient = getDocClient();
  const updated = {
    ...existingTask,
    ...updatedFields,
    updatedAt: new Date().toISOString(),
  };

  const command = new PutCommand({
    TableName: getTasksTableName(),
    Item: updated,
  });

  await docClient.send(command);
  return updated;
}

/**
 * Delete a task by ID
 * @param {string} taskId
 * @returns {Promise<boolean>}
 */
async function deleteTask(taskId) {
  const existingTask = await findTaskById(taskId);
  if (!existingTask) return false;

  const docClient = getDocClient();
  const command = new DeleteCommand({
    TableName: getTasksTableName(),
    Key: { id: taskId },
  });

  await docClient.send(command);
  return true;
}

module.exports = {
  // Client management
  getDocClient,
  setDocClient,
  getUsersTableName,
  getTasksTableName,

  // User operations
  getAllUsers,
  findUserByEmail,
  findUserById,
  saveUser,
  updateUser,

  // Task operations
  getTasksByUser,
  findTaskById,
  saveTask,
  updateTask,
  deleteTask,
};
