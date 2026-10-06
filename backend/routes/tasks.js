/**
 * tasks.js — Task Routes
 *
 * All routes here are PROTECTED — the user must be logged in.
 *
 * Handles:
 *   GET    /api/tasks           → Get all tasks for the logged-in user
 *   POST   /api/tasks           → Create a new task
 *   PUT    /api/tasks/:id       → Edit a task
 *   DELETE /api/tasks/:id       → Delete a task
 *   PATCH  /api/tasks/:id/complete → Toggle task completion status
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Apply the authentication middleware to ALL routes in this file
// This means every request must have a valid JWT token
router.use(authenticateToken);

// Valid options for priority and category fields
const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_CATEGORIES = ['assignment', 'exam', 'project', 'personal'];

// ─────────────────────────────────────────
// GET /api/tasks
// Get all tasks for the currently logged-in user
// ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    // req.user.id was set by the authenticateToken middleware
    const tasks = await db.getTasksByUser(req.user.id);

    // Sort tasks by creation date (newest first)
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error.message);
    res.status(500).json({ message: 'Failed to retrieve tasks.' });
  }
});

// ─────────────────────────────────────────
// POST /api/tasks
// Create a new task
// ─────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { title, description, priority, category, dueDate } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({ message: 'Task title is required.' });
    }

    if (priority && !VALID_PRIORITIES.includes(priority.toLowerCase())) {
      return res.status(400).json({ message: 'Priority must be low, medium, or high.' });
    }

    if (category && !VALID_CATEGORIES.includes(category.toLowerCase())) {
      return res.status(400).json({ message: 'Invalid category.' });
    }

    // Build the new task object
    const newTask = {
      id: uuidv4(),
      userId: req.user.id,         // Link task to the logged-in user
      title: title.trim(),
      description: description ? description.trim() : '',
      priority: priority ? priority.toLowerCase() : 'medium',
      category: category ? category.toLowerCase() : 'personal',
      dueDate: dueDate || null,
      completed: false,             // New tasks start as not completed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const savedTask = await db.saveTask(newTask);

    res.status(201).json({
      message: 'Task created successfully!',
      task: savedTask,
    });
  } catch (error) {
    console.error('Create task error:', error.message);
    res.status(500).json({ message: 'Failed to create task.' });
  }
});

// ─────────────────────────────────────────
// PUT /api/tasks/:id
// Edit an existing task
// ─────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, category, dueDate } = req.body;

    // Find the task and make sure it belongs to this user
    const task = await db.findTaskById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }
    if (task.userId !== req.user.id) {
      return res.status(403).json({ message: 'You can only edit your own tasks.' });
    }

    // Validate priority and category if provided
    if (priority && !VALID_PRIORITIES.includes(priority.toLowerCase())) {
      return res.status(400).json({ message: 'Priority must be low, medium, or high.' });
    }
    if (category && !VALID_CATEGORIES.includes(category.toLowerCase())) {
      return res.status(400).json({ message: 'Invalid category.' });
    }

    // Only update fields that were actually provided
    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (priority !== undefined) updates.priority = priority.toLowerCase();
    if (category !== undefined) updates.category = category.toLowerCase();
    if (dueDate !== undefined) updates.dueDate = dueDate;

    const updatedTask = await db.updateTask(id, updates);

    res.json({
      message: 'Task updated successfully!',
      task: updatedTask,
    });
  } catch (error) {
    console.error('Update task error:', error.message);
    res.status(500).json({ message: 'Failed to update task.' });
  }
});

// ─────────────────────────────────────────
// DELETE /api/tasks/:id
// Delete a task
// ─────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Make sure the task exists and belongs to this user
    const task = await db.findTaskById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }
    if (task.userId !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own tasks.' });
    }

    await db.deleteTask(id);

    res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    console.error('Delete task error:', error.message);
    res.status(500).json({ message: 'Failed to delete task.' });
  }
});

// ─────────────────────────────────────────
// PATCH /api/tasks/:id/complete
// Toggle a task's completion status (completed ↔ not completed)
// ─────────────────────────────────────────
router.patch('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;

    // Find the task
    const task = await db.findTaskById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }
    if (task.userId !== req.user.id) {
      return res.status(403).json({ message: 'You can only update your own tasks.' });
    }

    // Toggle: if completed → mark incomplete; if incomplete → mark complete
    const updatedTask = await db.updateTask(id, {
      completed: !task.completed,
      completedAt: !task.completed ? new Date().toISOString() : null,
    });

    res.json({
      message: `Task marked as ${updatedTask.completed ? 'completed' : 'pending'}.`,
      task: updatedTask,
    });
  } catch (error) {
    console.error('Toggle complete error:', error.message);
    res.status(500).json({ message: 'Failed to update task status.' });
  }
});

module.exports = router;
