/**
 * db.js — Local JSON File Database Utility
 *
 * This file handles reading and writing data to JSON files.
 * It acts like a simple database for the local version.
 *
 * IMPORTANT FOR FUTURE: When you move to AWS DynamoDB,
 * you only need to change THIS file. All other code stays the same.
 */

const fs = require('fs');
const path = require('path');
const dynamoDb = require('./dynamoDb');

// Paths to our JSON "database" files
const USERS_FILE = path.join(__dirname, '../data/users.json');
const TASKS_FILE = path.join(__dirname, '../data/tasks.json');

/**
 * Determines whether the active database should be DynamoDB
 * @returns {boolean}
 */
function isDynamoEnabled() {
  return (
    process.env.DB_TYPE === 'dynamodb' ||
    process.env.USE_DYNAMODB === 'true' ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)
  );
}

/**
 * Reads data from a JSON file.
 * If the file doesn't exist, it creates it with an empty array.
 * @param {string} filePath - Path to the JSON file
 * @returns {Array} - Parsed array of records
 */
function readData(filePath) {
  try {
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      // Create the file with an empty array if it doesn't exist
      fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      return [];
    }
    // Read and parse the JSON file
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data file:', error.message);
    return [];
  }
}

/**
 * Writes data to a JSON file.
 * @param {string} filePath - Path to the JSON file
 * @param {Array} data - Array of records to write
 */
function writeData(filePath, data) {
  try {
    // Write the data as formatted JSON (2-space indent for readability)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing data file:', error.message);
    throw new Error('Failed to save data');
  }
}

// --- USER OPERATIONS ---

/** Get all users */
function getAllUsers() {
  if (isDynamoEnabled()) {
    return dynamoDb.getAllUsers();
  }
  return readData(USERS_FILE);
}

/** Find a user by their email address */
function findUserByEmail(email) {
  if (isDynamoEnabled()) {
    return dynamoDb.findUserByEmail(email);
  }
  const users = getAllUsers();
  return users.find(user => user.email === email) || null;
}

/** Find a user by their ID */
function findUserById(id) {
  if (isDynamoEnabled()) {
    return dynamoDb.findUserById(id);
  }
  const users = getAllUsers();
  return users.find(user => user.id === id) || null;
}

/** Save a new user */
function saveUser(user) {
  if (isDynamoEnabled()) {
    return dynamoDb.saveUser(user);
  }
  const users = getAllUsers();
  users.push(user);
  writeData(USERS_FILE, users);
  return user;
}

/** Update an existing user */
function updateUser(userId, updatedFields) {
  if (isDynamoEnabled()) {
    return dynamoDb.updateUser(userId, updatedFields);
  }
  const users = getAllUsers();
  const index = users.findIndex(user => user.id === userId);
  if (index === -1) return null;

  users[index] = { ...users[index], ...updatedFields, updatedAt: new Date().toISOString() };
  writeData(USERS_FILE, users);
  return users[index];
}

// --- TASK OPERATIONS ---

/** Get all tasks belonging to a specific user */
function getTasksByUser(userId) {
  if (isDynamoEnabled()) {
    return dynamoDb.getTasksByUser(userId);
  }
  const tasks = readData(TASKS_FILE);
  return tasks.filter(task => task.userId === userId);
}

/** Get a single task by its ID */
function findTaskById(taskId) {
  if (isDynamoEnabled()) {
    return dynamoDb.findTaskById(taskId);
  }
  const tasks = readData(TASKS_FILE);
  return tasks.find(task => task.id === taskId) || null;
}

/** Save a new task */
function saveTask(task) {
  if (isDynamoEnabled()) {
    return dynamoDb.saveTask(task);
  }
  const tasks = readData(TASKS_FILE);
  tasks.push(task);
  writeData(TASKS_FILE, tasks);
  return task;
}

/** Update an existing task */
function updateTask(taskId, updatedFields) {
  if (isDynamoEnabled()) {
    return dynamoDb.updateTask(taskId, updatedFields);
  }
  const tasks = readData(TASKS_FILE);
  const index = tasks.findIndex(task => task.id === taskId);
  if (index === -1) return null;

  // Merge the existing task with the updated fields
  tasks[index] = { ...tasks[index], ...updatedFields, updatedAt: new Date().toISOString() };
  writeData(TASKS_FILE, tasks);
  return tasks[index];
}

/** Delete a task by ID */
function deleteTask(taskId) {
  if (isDynamoEnabled()) {
    return dynamoDb.deleteTask(taskId);
  }
  const tasks = readData(TASKS_FILE);
  const filteredTasks = tasks.filter(task => task.id !== taskId);

  if (filteredTasks.length === tasks.length) return false; // task not found

  writeData(TASKS_FILE, filteredTasks);
  return true;
}

// Export all functions so routes can use them
module.exports = {
  isDynamoEnabled,
  getAllUsers,
  findUserByEmail,
  findUserById,
  saveUser,
  updateUser,
  getTasksByUser,
  findTaskById,
  saveTask,
  updateTask,
  deleteTask,
};
