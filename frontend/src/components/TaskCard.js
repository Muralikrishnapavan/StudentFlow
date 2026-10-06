/**
 * TaskCard.js — Individual Task Display
 *
 * Shows a single task with its details and action buttons.
 * Props:
 *   - task:     The task object
 *   - onEdit:   Function called when Edit is clicked
 *   - onDelete: Function called when Delete is clicked
 *   - onToggle: Function called when complete/incomplete checkbox is clicked
 */

import React from 'react';

// Map priority to Bootstrap badge color
const PRIORITY_COLORS = {
  high: 'danger',
  medium: 'warning',
  low: 'success',
};

// Map category to an emoji icon
const CATEGORY_ICONS = {
  assignment: '📝',
  exam: '📖',
  project: '💼',
  personal: '🙂',
};

function TaskCard({ task, onEdit, onDelete, onToggle }) {
  // Check if this task is overdue
  const isOverdue = () => {
    if (!task.dueDate || task.completed) return false;
    return new Date(task.dueDate) < new Date();
  };

  // Format date nicely (e.g., "Sep 20, 2024")
  const formatDate = (dateStr) => {
    if (!dateStr) return 'No due date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Pick a card border color based on status
  const getBorderClass = () => {
    if (task.completed) return 'border-success';
    if (isOverdue()) return 'border-danger';
    return 'border-0';
  };

  return (
    <div className={`card mb-3 shadow-sm task-card ${getBorderClass()} ${task.completed ? 'opacity-75' : ''}`}>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start">
          {/* Left side: checkbox + title */}
          <div className="d-flex align-items-start gap-2 flex-grow-1">
            {/* Completion checkbox */}
            <input
              type="checkbox"
              className="form-check-input mt-1 flex-shrink-0"
              checked={task.completed}
              onChange={() => onToggle(task.id)}
              title={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
            />

            <div className="flex-grow-1">
              {/* Task title */}
              <h6 className={`mb-1 ${task.completed ? 'text-decoration-line-through text-muted' : 'fw-semibold'}`}>
                {CATEGORY_ICONS[task.category] || '📋'} {task.title}
              </h6>

              {/* Task description (if any) */}
              {task.description && (
                <p className="text-muted small mb-2">{task.description}</p>
              )}

              {/* Badges: priority, category, due date */}
              <div className="d-flex flex-wrap gap-1 align-items-center">
                {/* Priority badge */}
                <span className={`badge bg-${PRIORITY_COLORS[task.priority] || 'secondary'}`}>
                  {task.priority?.charAt(0).toUpperCase() + task.priority?.slice(1)} Priority
                </span>

                {/* Category badge */}
                <span className="badge bg-secondary text-capitalize">
                  {task.category}
                </span>

                {/* Due date badge */}
                {task.dueDate && (
                  <span className={`badge ${isOverdue() ? 'bg-danger' : 'bg-light text-dark border'}`}>
                    📅 {formatDate(task.dueDate)} {isOverdue() && '⚠️ Overdue'}
                  </span>
                )}

                {/* Completed badge */}
                {task.completed && (
                  <span className="badge bg-success">✅ Completed</span>
                )}
              </div>
            </div>
          </div>

          {/* Right side: Edit and Delete buttons */}
          <div className="d-flex gap-1 ms-2 flex-shrink-0">
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => onEdit(task)}
              title="Edit task"
            >
              ✏️
            </button>
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => onDelete(task.id)}
              title="Delete task"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskCard;
