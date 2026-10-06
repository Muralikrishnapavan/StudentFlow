/**
 * runLocalAutomation.js — Local Simulation of the AWS Automation Lambda
 *
 * This script runs the exact same business logic as the AWS Lambda automation function
 * (overdue task marking, 24-hour reminder detection & deduplication, and user productivity calculation),
 * but executes against the local JSON database files in `backend/data/`.
 *
 * This allows full testing and demonstration while AWS account activation is pending!
 */

const path = require('path');
const fs = require('fs');
const db = require('../utils/db');
const {
  isTaskOverdue,
  isDueWithinNext24Hours,
  shouldSendReminder,
  calculateUserProductivity,
  formatReminderMessage,
} = require('../../aws/lambda/automation/index');

const TASKS_FILE = path.join(__dirname, '../data/tasks.json');

function runLocalAutomation() {
  const now = new Date();
  console.log('====================================================');
  console.log('🚀 StudentFlow Local Automation Simulation');
  console.log(`⏰ Executing at: ${now.toISOString()}`);
  console.log('====================================================\n');

  // Load existing tasks and users
  const tasksRaw = fs.existsSync(TASKS_FILE) ? JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')) : [];
  const users = db.getAllUsers();

  console.log(`📊 Local Database Stats: ${tasksRaw.length} tasks, ${users.length} registered users.\n`);

  let overdueCount = 0;
  let remindersSent = 0;
  let remindersDeduplicated = 0;
  let usersUpdated = 0;

  // 1. Process Overdue Tasks
  console.log('--- 1. Checking for Overdue Tasks ---');
  for (const task of tasksRaw) {
    if (isTaskOverdue(task, now)) {
      if (task.status !== 'overdue') {
        db.updateTask(task.id, { status: 'overdue' });
        console.log(`  ⚠️  Task Marked OVERDUE: "${task.title}" (Due: ${task.dueDate}, ID: ${task.id})`);
        overdueCount++;
      } else {
        console.log(`  ℹ️  Task already marked overdue: "${task.title}"`);
      }
    }
  }
  if (overdueCount === 0) {
    console.log('  ✅ No newly overdue tasks found.\n');
  } else {
    console.log(`  ✅ Updated ${overdueCount} task(s) to 'overdue'.\n`);
  }

  // 2. Process Reminders Due in Next 24 Hours
  console.log('--- 2. Checking for Deadlines in the Next 24 Hours ---');
  const tasksDueSoon = tasksRaw.filter(t => isDueWithinNext24Hours(t, now));

  for (const task of tasksDueSoon) {
    if (shouldSendReminder(task, now)) {
      console.log(`  🔔 SIMULATED SNS NOTIFICATION:`);
      console.log('  ' + formatReminderMessage(task).split('\n').join('\n  '));
      console.log(`  -> Recording reminderSentForDueDate="${task.dueDate}" on task.`);
      db.updateTask(task.id, { reminderSentForDueDate: task.dueDate });
      remindersSent++;
    } else {
      console.log(`  🛡️  Deduplication: Reminder already sent for task "${task.title}" (Due: ${task.dueDate}). Skipping.`);
      remindersDeduplicated++;
    }
  }
  if (tasksDueSoon.length === 0) {
    console.log('  ✅ No incomplete tasks due within the next 24 hours.\n');
  } else {
    console.log(`  ✅ Reminders sent: ${remindersSent}, Deduplicated: ${remindersDeduplicated}.\n`);
  }

  // 3. Calculate and Store Productivity for Each User
  console.log('--- 3. Calculating and Updating User Productivity ---');
  const freshTasks = fs.existsSync(TASKS_FILE) ? JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8')) : [];
  const productivityMap = calculateUserProductivity(freshTasks, users);

  for (const user of users) {
    const stats = productivityMap.get(user.id) || { total: 0, completed: 0, productivityPercentage: 0 };
    db.updateUser(user.id, { productivityPercentage: stats.productivityPercentage });
    console.log(`  👤 User: ${user.name} (${user.email})`);
    console.log(`     Total: ${stats.total}, Completed: ${stats.completed} -> Productivity: ${stats.productivityPercentage}%`);
    usersUpdated++;
  }

  console.log('\n====================================================');
  console.log('✅ Local Automation Complete!');
  console.log(`Summary:
  - Tasks Processed:       ${tasksRaw.length}
  - Newly Overdue Marked:  ${overdueCount}
  - Reminders Dispatched:  ${remindersSent}
  - Reminders Deduplicated:${remindersDeduplicated}
  - User Profiles Updated: ${usersUpdated}`);
  console.log('====================================================\n');
}

if (require.main === module) {
  runLocalAutomation();
}

module.exports = { runLocalAutomation };
