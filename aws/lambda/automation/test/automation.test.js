/**
 * Unit & Integration Tests for StudentFlow AWS Automation
 *
 * Covers:
 * 1. Date parsing (parseDueDate)
 * 2. Overdue detection (isTaskOverdue)
 * 3. 24h window detection & SNS reminder deduplication (isDueWithinNext24Hours, shouldSendReminder)
 * 4. Productivity calculation (calculateProductivity, calculateUserProductivity)
 * 5. Full end-to-end automation pipeline simulation (processAutomation) with mock clients
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  parseDueDate,
  isTaskOverdue,
  isDueWithinNext24Hours,
  shouldSendReminder,
  calculateProductivity,
  calculateUserProductivity,
  processAutomation,
} = require('../index');

describe('1. Date Parsing (parseDueDate)', () => {
  it('should parse an ISO 8601 UTC string correctly', () => {
    const parsed = parseDueDate('2026-10-06T15:30:00.000Z');
    assert.ok(parsed instanceof Date);
    assert.strictEqual(parsed.toISOString(), '2026-10-06T15:30:00.000Z');
  });

  it('should parse a standard YYYY-MM-DD date string', () => {
    const parsed = parseDueDate('2026-10-06');
    assert.ok(parsed instanceof Date);
    assert.strictEqual(isNaN(parsed.getTime()), false);
    assert.strictEqual(parsed.getUTCFullYear(), 2026);
    assert.strictEqual(parsed.getUTCMonth(), 9); // October is month index 9
    assert.strictEqual(parsed.getUTCDate(), 6);
  });

  it('should handle strings with leading or trailing whitespace', () => {
    const parsed = parseDueDate('   2026-10-06   ');
    assert.ok(parsed instanceof Date);
    assert.strictEqual(parsed.getUTCFullYear(), 2026);
  });

  it('should pass through existing valid Date instances', () => {
    const original = new Date('2026-11-01T00:00:00.000Z');
    const parsed = parseDueDate(original);
    assert.strictEqual(parsed, original);
  });

  it('should parse numeric millisecond timestamps', () => {
    const timestamp = 1791244800000;
    const parsed = parseDueDate(timestamp);
    assert.ok(parsed instanceof Date);
    assert.strictEqual(parsed.getTime(), timestamp);
  });

  it('should return null for invalid date strings', () => {
    assert.strictEqual(parseDueDate('invalid-date'), null);
    assert.strictEqual(parseDueDate('not-a-timestamp'), null);
  });

  it('should return null for null, undefined, empty string, or non-date objects', () => {
    assert.strictEqual(parseDueDate(null), null);
    assert.strictEqual(parseDueDate(undefined), null);
    assert.strictEqual(parseDueDate(''), null);
    assert.strictEqual(parseDueDate('   '), null);
    assert.strictEqual(parseDueDate({}), null);
    assert.strictEqual(parseDueDate(true), null);
  });
});

describe('2. Overdue Detection (isTaskOverdue)', () => {
  const referenceNow = new Date('2026-10-05T12:00:00.000Z');

  it('should mark an incomplete task overdue when its dueDate has passed', () => {
    const task = {
      id: 'task-1',
      title: 'Submit Assignment 1',
      dueDate: '2026-10-04T23:59:59.000Z',
      completed: false,
    };
    assert.strictEqual(isTaskOverdue(task, referenceNow), true);
  });

  it('should NOT mark a completed task overdue even if dueDate has passed', () => {
    const task = {
      id: 'task-2',
      title: 'Finished Project',
      dueDate: '2026-09-20T00:00:00.000Z',
      completed: true,
    };
    assert.strictEqual(isTaskOverdue(task, referenceNow), false);
  });

  it('should NOT mark a task overdue if dueDate is in the future', () => {
    const task = {
      id: 'task-3',
      title: 'Upcoming Presentation',
      dueDate: '2026-10-06T12:00:00.000Z',
      completed: false,
    };
    assert.strictEqual(isTaskOverdue(task, referenceNow), false);
  });

  it('should NOT mark a task overdue if it has no dueDate', () => {
    assert.strictEqual(isTaskOverdue({ id: 'task-4', completed: false, dueDate: null }, referenceNow), false);
    assert.strictEqual(isTaskOverdue({ id: 'task-5', completed: false, dueDate: '' }, referenceNow), false);
    assert.strictEqual(isTaskOverdue({ id: 'task-6', completed: false }, referenceNow), false);
  });

  it('should NOT mark a task overdue if dueDate is invalid', () => {
    const task = {
      id: 'task-7',
      title: 'Malformed Date',
      dueDate: 'someday-soon',
      completed: false,
    };
    assert.strictEqual(isTaskOverdue(task, referenceNow), false);
  });
});

describe('3. 24h Window & Reminder Deduplication', () => {
  const referenceNow = new Date('2026-10-05T12:00:00.000Z');

  it('should identify a task due within 6 hours as due within the next 24 hours', () => {
    const task = {
      id: 'task-soon',
      dueDate: '2026-10-05T18:00:00.000Z', // 6 hours ahead
      completed: false,
    };
    assert.strictEqual(isDueWithinNext24Hours(task, referenceNow), true);
  });

  it('should identify a task due in 23 hours as due within the next 24 hours', () => {
    const task = {
      id: 'task-tomorrow-morning',
      dueDate: '2026-10-06T11:00:00.000Z', // 23 hours ahead
      completed: false,
    };
    assert.strictEqual(isDueWithinNext24Hours(task, referenceNow), true);
  });

  it('should NOT identify a task due in 25 hours as due within 24 hours', () => {
    const task = {
      id: 'task-later',
      dueDate: '2026-10-06T13:00:00.000Z', // 25 hours ahead
      completed: false,
    };
    assert.strictEqual(isDueWithinNext24Hours(task, referenceNow), false);
  });

  it('should NOT identify a past due task as due within next 24 hours', () => {
    const task = {
      id: 'task-past',
      dueDate: '2026-10-05T10:00:00.000Z', // 2 hours ago
      completed: false,
    };
    assert.strictEqual(isDueWithinNext24Hours(task, referenceNow), false);
  });

  it('should NOT send reminders for completed tasks even if due within 24 hours', () => {
    const task = {
      id: 'task-done',
      dueDate: '2026-10-05T18:00:00.000Z',
      completed: true,
    };
    assert.strictEqual(isDueWithinNext24Hours(task, referenceNow), false);
    assert.strictEqual(shouldSendReminder(task, referenceNow), false);
  });

  describe('Deduplication using reminderSentForDueDate', () => {
    it('should allow sending reminder when reminderSentForDueDate is not set', () => {
      const task = {
        id: 'task-first-reminder',
        title: 'Quiz 3',
        dueDate: '2026-10-05T20:00:00.000Z',
        completed: false,
        reminderSentForDueDate: undefined,
      };
      assert.strictEqual(shouldSendReminder(task, referenceNow), true);
    });

    it('should PREVENT duplicate reminder when reminderSentForDueDate equals dueDate', () => {
      const task = {
        id: 'task-already-reminded',
        title: 'Quiz 3',
        dueDate: '2026-10-05T20:00:00.000Z',
        completed: false,
        reminderSentForDueDate: '2026-10-05T20:00:00.000Z', // already sent for this due date!
      };
      assert.strictEqual(shouldSendReminder(task, referenceNow), false);
    });

    it('should ALLOW new reminder if dueDate was rescheduled to a new date within 24h', () => {
      const task = {
        id: 'task-rescheduled',
        title: 'Rescheduled Quiz',
        dueDate: '2026-10-06T08:00:00.000Z', // new due date in 20 hours
        completed: false,
        reminderSentForDueDate: '2026-10-04T12:00:00.000Z', // old reminder sent for previous date
      };
      assert.strictEqual(shouldSendReminder(task, referenceNow), true);
    });
  });
});

describe('4. Productivity Calculation (calculateProductivity & calculateUserProductivity)', () => {
  it('should return 0 when task list is empty', () => {
    assert.strictEqual(calculateProductivity([]), 0);
    assert.strictEqual(calculateProductivity(null), 0);
  });

  it('should return 100 when all tasks are completed', () => {
    const tasks = [
      { id: '1', completed: true },
      { id: '2', completed: true },
      { id: '3', completed: true },
    ];
    assert.strictEqual(calculateProductivity(tasks), 100);
  });

  it('should return 0 when 0 tasks are completed', () => {
    const tasks = [
      { id: '1', completed: false },
      { id: '2', completed: false },
    ];
    assert.strictEqual(calculateProductivity(tasks), 0);
  });

  it('should round correctly for fractional percentages', () => {
    // 1 of 3 = 33.333% -> 33
    assert.strictEqual(
      calculateProductivity([
        { id: '1', completed: true },
        { id: '2', completed: false },
        { id: '3', completed: false },
      ]),
      33
    );

    // 2 of 3 = 66.666% -> 67
    assert.strictEqual(
      calculateProductivity([
        { id: '1', completed: true },
        { id: '2', completed: true },
        { id: '3', completed: false },
      ]),
      67
    );

    // 1 of 2 = 50% -> 50
    assert.strictEqual(
      calculateProductivity([
        { id: '1', completed: true },
        { id: '2', completed: false },
      ]),
      50
    );
  });

  it('should compute productivity per user correctly across multiple users', () => {
    const users = [
      { id: 'user-a', name: 'Alice' },
      { id: 'user-b', name: 'Bob' },
      { id: 'user-c', name: 'Charlie (No tasks)' },
    ];

    const tasks = [
      // User A: 2 of 2 completed = 100%
      { id: 't1', userId: 'user-a', completed: true },
      { id: 't2', userId: 'user-a', completed: true },

      // User B: 1 of 4 completed = 25%
      { id: 't3', userId: 'user-b', completed: true },
      { id: 't4', userId: 'user-b', completed: false },
      { id: 't5', userId: 'user-b', completed: false },
      { id: 't6', userId: 'user-b', completed: false },
    ];

    const productivityMap = calculateUserProductivity(tasks, users);

    const userAStats = productivityMap.get('user-a');
    assert.strictEqual(userAStats.total, 2);
    assert.strictEqual(userAStats.completed, 2);
    assert.strictEqual(userAStats.productivityPercentage, 100);

    const userBStats = productivityMap.get('user-b');
    assert.strictEqual(userBStats.total, 4);
    assert.strictEqual(userBStats.completed, 1);
    assert.strictEqual(userBStats.productivityPercentage, 25);

    const userCStats = productivityMap.get('user-c');
    assert.strictEqual(userCStats.total, 0);
    assert.strictEqual(userCStats.completed, 0);
    assert.strictEqual(userCStats.productivityPercentage, 0);
  });
});

describe('5. End-to-End Automation Pipeline Simulation (Mock AWS Clients)', () => {
  it('should orchestrate scan, overdue marking, reminder sending with deduplication, and user updates', async () => {
    const fixedNow = new Date('2026-10-05T12:00:00.000Z');

    // Sample data simulating DynamoDB StudentFlow-Tasks and StudentFlow-Users
    const mockTasks = [
      // 1. Incomplete task whose dueDate passed -> must be marked overdue
      {
        id: 'task-overdue-1',
        userId: 'user-1',
        title: 'Overdue Assignment',
        dueDate: '2026-10-04T12:00:00.000Z',
        completed: false,
        status: 'pending',
      },
      // 2. Overdue task that already has status='overdue' -> should not trigger redundant update
      {
        id: 'task-overdue-already',
        userId: 'user-1',
        title: 'Already Marked Overdue',
        dueDate: '2026-10-03T12:00:00.000Z',
        completed: false,
        status: 'overdue',
      },
      // 3. Incomplete task due in 6 hours, no reminder sent yet -> SNS publish + update reminderSentForDueDate
      {
        id: 'task-reminder-needed',
        userId: 'user-1',
        title: 'Study for Midterm',
        dueDate: '2026-10-05T18:00:00.000Z',
        completed: false,
        status: 'pending',
        reminderSentForDueDate: null,
      },
      // 4. Incomplete task due in 6 hours, reminder ALREADY sent -> skipped
      {
        id: 'task-reminder-sent',
        userId: 'user-2',
        title: 'Lab Report',
        dueDate: '2026-10-05T18:00:00.000Z',
        completed: false,
        status: 'pending',
        reminderSentForDueDate: '2026-10-05T18:00:00.000Z',
      },
      // 5. Completed task due yesterday -> neither overdue nor reminder
      {
        id: 'task-completed-yesterday',
        userId: 'user-2',
        title: 'Finished Homework',
        dueDate: '2026-10-04T10:00:00.000Z',
        completed: true,
        status: 'completed',
      },
      // 6. Task due in 5 days -> future, no reminder yet
      {
        id: 'task-far-future',
        userId: 'user-2',
        title: 'Final Project',
        dueDate: '2026-10-10T12:00:00.000Z',
        completed: false,
        status: 'pending',
      },
    ];

    const mockUsers = [
      { id: 'user-1', name: 'Student One', email: 'one@student.edu' },
      { id: 'user-2', name: 'Student Two', email: 'two@student.edu' },
    ];

    // Mock DynamoDB and SNS recording tracking arrays
    const ddbCommandsSent = [];
    const snsCommandsSent = [];

    const mockDocClient = {
      send: async (command) => {
        ddbCommandsSent.push(command);
        const cmdName = command.constructor.name;

        // Simulate ScanCommand responses
        if (cmdName === 'ScanCommand') {
          if (command.input.TableName === 'StudentFlow-Tasks') {
            return { Items: JSON.parse(JSON.stringify(mockTasks)) };
          }
          if (command.input.TableName === 'StudentFlow-Users') {
            return { Items: JSON.parse(JSON.stringify(mockUsers)) };
          }
          return { Items: [] };
        }

        // Simulate UpdateCommand responses
        if (cmdName === 'UpdateCommand') {
          return { Attributes: {} };
        }

        return {};
      },
    };

    const mockSnsClient = {
      send: async (command) => {
        snsCommandsSent.push(command);
        return { MessageId: 'mock-sns-msg-12345' };
      },
    };

    // Execute automation
    const metrics = await processAutomation({
      docClient: mockDocClient,
      snsClient: mockSnsClient,
      env: {
        TASKS_TABLE: 'StudentFlow-Tasks',
        USERS_TABLE: 'StudentFlow-Users',
        SNS_TOPIC_ARN: 'arn:aws:sns:us-east-1:123456789012:StudentFlow-Reminders',
      },
      now: fixedNow,
    });

    // Validate metrics returned
    assert.strictEqual(metrics.tasksScanned, 6);
    assert.strictEqual(metrics.usersScanned, 2);
    assert.strictEqual(metrics.overdueTasksMarked, 1); // only task-overdue-1 updated (task-overdue-already was skipped)
    assert.strictEqual(metrics.remindersSent, 1); // only task-reminder-needed sent
    assert.strictEqual(metrics.remindersDeduplicated, 1); // task-reminder-sent deduplicated
    assert.strictEqual(metrics.usersUpdated, 2); // both user-1 and user-2 updated

    // Validate SNS Publish command
    assert.strictEqual(snsCommandsSent.length, 1);
    const publishedMsg = snsCommandsSent[0].input;
    assert.strictEqual(publishedMsg.TopicArn, 'arn:aws:sns:us-east-1:123456789012:StudentFlow-Reminders');
    assert.strictEqual(publishedMsg.MessageAttributes.taskId.StringValue, 'task-reminder-needed');
    assert.strictEqual(publishedMsg.MessageAttributes.eventType.StringValue, 'TASK_DUE_REMINDER');

    // Validate DynamoDB Updates:
    // 1 update for overdue task-overdue-1
    // 1 update for reminderSentForDueDate on task-reminder-needed
    // 2 updates for users' productivityPercentage
    const updateCommands = ddbCommandsSent.filter(c => c.constructor.name === 'UpdateCommand');
    assert.strictEqual(updateCommands.length, 4);

    // Verify overdue update command details
    const overdueUpdate = updateCommands.find(
      c => c.input.TableName === 'StudentFlow-Tasks' && c.input.Key.id === 'task-overdue-1'
    );
    assert.ok(overdueUpdate);
    assert.strictEqual(overdueUpdate.input.ExpressionAttributeValues[':status'], 'overdue');

    // Verify reminder deduplication update command details
    const reminderUpdate = updateCommands.find(
      c => c.input.TableName === 'StudentFlow-Tasks' && c.input.Key.id === 'task-reminder-needed'
    );
    assert.ok(reminderUpdate);
    assert.strictEqual(
      reminderUpdate.input.ExpressionAttributeValues[':dueDate'],
      '2026-10-05T18:00:00.000Z'
    );

    // Verify user productivity calculations:
    // user-1 has: task-overdue-1 (incomplete), task-overdue-already (incomplete), task-reminder-needed (incomplete) -> 0 of 3 = 0%
    const user1Update = updateCommands.find(
      c => c.input.TableName === 'StudentFlow-Users' && c.input.Key.id === 'user-1'
    );
    assert.ok(user1Update);
    assert.strictEqual(user1Update.input.ExpressionAttributeValues[':prod'], 0);

    // user-2 has: task-reminder-sent (incomplete), task-completed-yesterday (completed), task-far-future (incomplete) -> 1 of 3 = 33%
    const user2Update = updateCommands.find(
      c => c.input.TableName === 'StudentFlow-Users' && c.input.Key.id === 'user-2'
    );
    assert.ok(user2Update);
    assert.strictEqual(user2Update.input.ExpressionAttributeValues[':prod'], 33);
  });
});

describe('6. Additional Edge Cases & Utilities', () => {
  const { scanAllItems, formatReminderMessage } = require('../index');

  it('scanAllItems should handle multi-page DynamoDB scans using LastEvaluatedKey', async () => {
    let callCount = 0;
    const mockDocClient = {
      send: async (cmd) => {
        callCount++;
        if (callCount === 1) {
          return {
            Items: [{ id: 'page-1-item' }],
            LastEvaluatedKey: { id: 'page-1-item' },
          };
        }
        return {
          Items: [{ id: 'page-2-item' }],
          LastEvaluatedKey: undefined,
        };
      },
    };

    const results = await scanAllItems(mockDocClient, 'TestTable');
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].id, 'page-1-item');
    assert.strictEqual(results[1].id, 'page-2-item');
    assert.strictEqual(callCount, 2);
  });

  it('formatReminderMessage should generate student-friendly reminder text', () => {
    const task = {
      title: 'Chemistry Lab Report',
      dueDate: '2026-10-06',
      priority: 'high',
      category: 'assignment',
      description: 'Submit PDF report to Canvas',
    };
    const message = formatReminderMessage(task);
    assert.ok(message.includes('Chemistry Lab Report'));
    assert.ok(message.includes('2026-10-06'));
    assert.ok(message.includes('HIGH'));
    assert.ok(message.includes('Submit PDF report to Canvas'));
  });

  it('processAutomation should handle empty tables gracefully without throwing', async () => {
    const mockDocClient = {
      send: async () => ({ Items: [] }),
    };
    const mockSnsClient = {
      send: async () => ({}),
    };

    const metrics = await processAutomation({
      docClient: mockDocClient,
      snsClient: mockSnsClient,
      env: {
        TASKS_TABLE: 'EmptyTasks',
        USERS_TABLE: 'EmptyUsers',
      },
    });

    assert.strictEqual(metrics.tasksScanned, 0);
    assert.strictEqual(metrics.usersScanned, 0);
    assert.strictEqual(metrics.overdueTasksMarked, 0);
    assert.strictEqual(metrics.remindersSent, 0);
    assert.strictEqual(metrics.usersUpdated, 0);
  });
});

