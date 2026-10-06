/**
 * api.test.js — Unit and Integration Tests for StudentFlow-API & DynamoDB Repository
 *
 * Verifies:
 * 1. Module importing (Lambda handler, DynamoDB repository, Express app)
 * 2. DynamoDB repository methods using mock DocumentClient (no AWS credentials required)
 * 3. Express API routes with local JSON DB (health check, auth, tasks CRUD)
 * 4. AWS Lambda handler execution via serverless-http simulation
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const http = require('http');

// Set dummy JWT secret for test execution if not set
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';
process.env.PORT = '0'; // ephemeral port for local tests

describe('1. Module Import & Integrity Verification', () => {
  it('should import backend/utils/dynamoDb without syntax errors', () => {
    const dynamoDb = require('../utils/dynamoDb');
    assert.ok(dynamoDb, 'dynamoDb module should exist');
    assert.strictEqual(typeof dynamoDb.findUserByEmail, 'function');
    assert.strictEqual(typeof dynamoDb.findUserById, 'function');
    assert.strictEqual(typeof dynamoDb.saveUser, 'function');
    assert.strictEqual(typeof dynamoDb.updateUser, 'function');
    assert.strictEqual(typeof dynamoDb.getAllUsers, 'function');
    assert.strictEqual(typeof dynamoDb.getTasksByUser, 'function');
    assert.strictEqual(typeof dynamoDb.findTaskById, 'function');
    assert.strictEqual(typeof dynamoDb.saveTask, 'function');
    assert.strictEqual(typeof dynamoDb.updateTask, 'function');
    assert.strictEqual(typeof dynamoDb.deleteTask, 'function');
  });

  it('should import backend/app without syntax errors and export an Express instance', () => {
    const app = require('../app');
    assert.ok(app, 'app module should exist');
    assert.strictEqual(typeof app.handle, 'function', 'app should be an Express application');
  });

  it('should import aws/lambda/api/index without errors and export handler', () => {
    const lambdaApi = require('../../aws/lambda/api/index');
    assert.ok(lambdaApi, 'lambda module should exist');
    assert.strictEqual(typeof lambdaApi.handler, 'function', 'handler should be a function');
    assert.ok(lambdaApi.app, 'lambda module should export app');
  });

  it('should verify backend/utils/db provides database interface', () => {
    const db = require('../utils/db');
    assert.strictEqual(typeof db.findUserByEmail, 'function');
    assert.strictEqual(typeof db.findUserById, 'function');
    assert.strictEqual(typeof db.saveUser, 'function');
    assert.strictEqual(typeof db.updateUser, 'function');
    assert.strictEqual(typeof db.getTasksByUser, 'function');
    assert.strictEqual(typeof db.findTaskById, 'function');
    assert.strictEqual(typeof db.saveTask, 'function');
    assert.strictEqual(typeof db.updateTask, 'function');
    assert.strictEqual(typeof db.deleteTask, 'function');
  });
});

describe('2. DynamoDB Repository with Mock DocumentClient', () => {
  const dynamoDb = require('../utils/dynamoDb');

  // Set up mock document client to simulate DynamoDB operations without credentials
  const mockStorage = {
    users: [
      { id: 'user-1', name: 'Test User', email: 'test@studentflow.io', password: 'hashedpassword' },
    ],
    tasks: [
      { id: 'task-1', userId: 'user-1', title: 'Test Task 1', completed: false, createdAt: '2026-10-06T10:00:00Z' },
    ],
  };

  const mockDocClient = {
    send: async (command) => {
      const cmdName = command.constructor.name;
      const input = command.input || {};

      if (cmdName === 'ScanCommand') {
        if (input.TableName && input.TableName.includes('Users')) {
          if (input.ExpressionAttributeValues && input.ExpressionAttributeValues[':email']) {
            const email = input.ExpressionAttributeValues[':email'];
            const matched = mockStorage.users.filter(u => u.email.toLowerCase() === email.toLowerCase());
            return { Items: matched };
          }
          return { Items: [...mockStorage.users] };
        }
        if (input.TableName && input.TableName.includes('Tasks')) {
          if (input.ExpressionAttributeValues && input.ExpressionAttributeValues[':userId']) {
            const userId = input.ExpressionAttributeValues[':userId'];
            const matched = mockStorage.tasks.filter(t => t.userId === userId);
            return { Items: matched };
          }
          return { Items: [...mockStorage.tasks] };
        }
        return { Items: [] };
      }

      if (cmdName === 'GetCommand') {
        if (input.TableName && input.TableName.includes('Users')) {
          const item = mockStorage.users.find(u => u.id === input.Key.id);
          return { Item: item || null };
        }
        if (input.TableName && input.TableName.includes('Tasks')) {
          const item = mockStorage.tasks.find(t => t.id === input.Key.id);
          return { Item: item || null };
        }
        return { Item: null };
      }

      if (cmdName === 'PutCommand') {
        if (input.TableName && input.TableName.includes('Users')) {
          const idx = mockStorage.users.findIndex(u => u.id === input.Item.id);
          if (idx >= 0) {
            mockStorage.users[idx] = input.Item;
          } else {
            mockStorage.users.push(input.Item);
          }
          return {};
        }
        if (input.TableName && input.TableName.includes('Tasks')) {
          const idx = mockStorage.tasks.findIndex(t => t.id === input.Item.id);
          if (idx >= 0) {
            mockStorage.tasks[idx] = input.Item;
          } else {
            mockStorage.tasks.push(input.Item);
          }
          return {};
        }
        return {};
      }

      if (cmdName === 'DeleteCommand') {
        if (input.TableName && input.TableName.includes('Tasks')) {
          mockStorage.tasks = mockStorage.tasks.filter(t => t.id !== input.Key.id);
          return {};
        }
        return {};
      }

      return {};
    },
  };

  before(() => {
    dynamoDb.setDocClient(mockDocClient);
  });

  after(() => {
    dynamoDb.setDocClient(null);
  });

  it('should find user by email from DynamoDB repository', async () => {
    const user = await dynamoDb.findUserByEmail('test@studentflow.io');
    assert.ok(user);
    assert.strictEqual(user.id, 'user-1');
  });

  it('should find user by ID from DynamoDB repository', async () => {
    const user = await dynamoDb.findUserById('user-1');
    assert.ok(user);
    assert.strictEqual(user.name, 'Test User');
  });

  it('should save a new user to DynamoDB repository', async () => {
    const newUser = {
      id: 'user-2',
      name: 'Second User',
      email: 'second@studentflow.io',
      password: 'hashedpassword2',
      createdAt: new Date().toISOString(),
    };
    const saved = await dynamoDb.saveUser(newUser);
    assert.strictEqual(saved.id, 'user-2');
    const found = await dynamoDb.findUserById('user-2');
    assert.ok(found);
    assert.strictEqual(found.name, 'Second User');
  });

  it('should get tasks for user from DynamoDB repository', async () => {
    const tasks = await dynamoDb.getTasksByUser('user-1');
    assert.ok(Array.isArray(tasks));
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].id, 'task-1');
  });

  it('should save and update a task in DynamoDB repository', async () => {
    const newTask = {
      id: 'task-new',
      userId: 'user-1',
      title: 'Dynamo Task',
      completed: false,
      createdAt: new Date().toISOString(),
    };
    await dynamoDb.saveTask(newTask);

    const retrieved = await dynamoDb.findTaskById('task-new');
    assert.ok(retrieved);
    assert.strictEqual(retrieved.title, 'Dynamo Task');

    const updated = await dynamoDb.updateTask('task-new', { completed: true });
    assert.strictEqual(updated.completed, true);
  });

  it('should delete a task from DynamoDB repository', async () => {
    const deleted = await dynamoDb.deleteTask('task-new');
    assert.strictEqual(deleted, true);
    const afterDelete = await dynamoDb.findTaskById('task-new');
    assert.strictEqual(afterDelete, null);
  });
});

describe('3. Express Application Endpoints (Local JSON DB)', () => {
  const app = require('../app');
  let server;
  let baseUrl;
  let testUserToken;
  let createdTaskId;
  const testEmail = `test_${Date.now()}@example.com`;

  before((t, done) => {
    // Explicitly test local JSON database mode
    process.env.USE_DYNAMODB = 'false';
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.DB_TYPE;

    // Start temporary server for testing
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  after((t, done) => {
    try {
      const fs = require('fs');
      const usersFile = path.join(__dirname, '../data/users.json');
      if (fs.existsSync(usersFile)) {
        const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        const cleaned = users.filter(u => !u.email.startsWith('test_'));
        fs.writeFileSync(usersFile, JSON.stringify(cleaned, null, 2));
      }
    } catch (_) {}

    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  // Helper function for making HTTP requests in tests
  async function request(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const headers = options.headers || {};
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const json = await res.json().catch(() => null);
    return { status: res.status, body: json };
  }

  it('GET /api/health should return 200 with OK status', async () => {
    const res = await request('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'OK');
    assert.ok(res.body.message.includes('running'));
  });

  it('POST /api/auth/register should validate required fields', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Incomplete' },
    });
    assert.strictEqual(res.status, 400);
  });

  it('POST /api/auth/register should create a new user successfully', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Integration Student',
        email: testEmail,
        password: 'password123',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.message.includes('successfully'));
  });

  it('POST /api/auth/register should reject duplicate email with 409', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Duplicate Student',
        email: testEmail,
        password: 'password123',
      },
    });
    assert.strictEqual(res.status, 409);
  });

  it('POST /api/auth/login should reject invalid credentials', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'wrongpassword' },
    });
    assert.strictEqual(res.status, 401);
  });

  it('POST /api/auth/login should succeed and return JWT token', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'password123' },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.ok(res.body.user);
    assert.strictEqual(res.body.user.email, testEmail);
    testUserToken = res.body.token;
  });

  it('GET /api/tasks should reject unauthenticated requests with 401', async () => {
    const res = await request('/api/tasks');
    assert.strictEqual(res.status, 401);
  });

  it('POST /api/tasks should create a task for the authenticated user', async () => {
    const res = await request('/api/tasks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: {
        title: 'Complete Math Assignment',
        description: 'Chapter 5 problems',
        priority: 'high',
        category: 'assignment',
        dueDate: '2026-10-15',
      },
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.task);
    assert.strictEqual(res.body.task.title, 'Complete Math Assignment');
    assert.strictEqual(res.body.task.completed, false);
    createdTaskId = res.body.task.id;
  });

  it('GET /api/tasks should retrieve the created task', async () => {
    const res = await request('/api/tasks', {
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const found = res.body.find(t => t.id === createdTaskId);
    assert.ok(found);
    assert.strictEqual(found.title, 'Complete Math Assignment');
  });

  it('PATCH /api/tasks/:id/complete should toggle completion status', async () => {
    const res = await request(`/api/tasks/${createdTaskId}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.task.completed, true);
    assert.ok(res.body.task.completedAt);
  });

  it('PUT /api/tasks/:id should update task fields', async () => {
    const res = await request(`/api/tasks/${createdTaskId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: {
        title: 'Complete Math Assignment - Revised',
        priority: 'medium',
      },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.task.title, 'Complete Math Assignment - Revised');
    assert.strictEqual(res.body.task.priority, 'medium');
  });

  it('DELETE /api/tasks/:id should delete the task', async () => {
    const res = await request(`/api/tasks/${createdTaskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.message.includes('deleted'));

    // Verify task is gone
    const listRes = await request('/api/tasks', {
      headers: { Authorization: `Bearer ${testUserToken}` },
    });
    const found = listRes.body.find(t => t.id === createdTaskId);
    assert.strictEqual(found, undefined);
  });
});

describe('4. AWS Lambda Handler Simulation', () => {
  const { handler } = require('../../aws/lambda/api/index');

  it('should handle an API Gateway v2 HTTP API health check event', async () => {
    const mockEvent = {
      version: '2.0',
      routeKey: 'GET /api/health',
      rawPath: '/api/health',
      rawQueryString: '',
      headers: {
        host: 'api.example.com',
        accept: 'application/json',
      },
      requestContext: {
        http: {
          method: 'GET',
          path: '/api/health',
          protocol: 'HTTP/1.1',
        },
      },
      isBase64Encoded: false,
    };

    const response = await handler(mockEvent, {});
    assert.ok(response);
    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.status, 'OK');
  });

  it('should handle 404 for unknown route through Lambda', async () => {
    const mockEvent = {
      version: '2.0',
      routeKey: 'GET /api/unknown-endpoint',
      rawPath: '/api/unknown-endpoint',
      headers: { host: 'api.example.com' },
      requestContext: {
        http: {
          method: 'GET',
          path: '/api/unknown-endpoint',
          protocol: 'HTTP/1.1',
        },
      },
      isBase64Encoded: false,
    };

    const response = await handler(mockEvent, {});
    assert.strictEqual(response.statusCode, 404);
  });
});
