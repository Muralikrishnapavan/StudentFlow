/**
 * TaskForm.js — Create / Edit Task Modal Form
 *
 * This modal appears when the user clicks "Add Task" or "Edit" on a task.
 * It handles both creating a new task and editing an existing one.
 *
 * Props:
 *   - show:      Whether the modal is visible
 *   - onClose:   Function to close the modal
 *   - onSubmit:  Function called with form data on submit
 *   - editTask:  If provided, pre-fills the form for editing
 */

import React, { useState, useEffect } from 'react';

// Initial empty form state
const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 'medium',
  category: 'assignment',
  dueDate: '',
};

function TaskForm({ show, onClose, onSubmit, editTask }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // When the modal opens: if editing, pre-fill with existing data; otherwise reset
  useEffect(() => {
    if (editTask) {
      setForm({
        title: editTask.title || '',
        description: editTask.description || '',
        priority: editTask.priority || 'medium',
        category: editTask.category || 'assignment',
        dueDate: editTask.dueDate ? editTask.dueDate.split('T')[0] : '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError('');
  }, [editTask, show]);

  // Handle input changes — updates the corresponding field in state
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) {
      setError('Task title is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Call the onSubmit function passed from the Dashboard
      await onSubmit(form);
      onClose(); // Close the modal on success
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything if the modal is not shown
  if (!show) return null;

  return (
    // Modal backdrop
    <div className="modal-backdrop-custom" onClick={onClose}>
      {/* Modal dialog — stop click propagation so clicking inside doesn't close */}
      <div
        className="modal-dialog-custom card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">{editTask ? '✏️ Edit Task' : '➕ Add New Task'}</h5>
          <button className="btn-close btn-close-white" onClick={onClose} />
        </div>

        <div className="card-body">
          {/* Error alert */}
          {error && (
            <div className="alert alert-danger py-2">{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Task Title */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Task Title *</label>
              <input
                type="text"
                name="title"
                className="form-control"
                placeholder="e.g., Complete Math Assignment"
                value={form.title}
                onChange={handleChange}
                required
              />
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Description</label>
              <textarea
                name="description"
                className="form-control"
                rows="2"
                placeholder="Add more details (optional)"
                value={form.description}
                onChange={handleChange}
              />
            </div>

            {/* Priority and Category — side by side on larger screens */}
            <div className="row">
              <div className="col-sm-6 mb-3">
                <label className="form-label fw-semibold">Priority</label>
                <select name="priority" className="form-select" value={form.priority} onChange={handleChange}>
                  <option value="low">🟢 Low</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="high">🔴 High</option>
                </select>
              </div>

              <div className="col-sm-6 mb-3">
                <label className="form-label fw-semibold">Category</label>
                <select name="category" className="form-select" value={form.category} onChange={handleChange}>
                  <option value="assignment">📝 Assignment</option>
                  <option value="exam">📖 Exam</option>
                  <option value="project">💼 Project</option>
                  <option value="personal">🙂 Personal</option>
                </select>
              </div>
            </div>

            {/* Due Date */}
            <div className="mb-4">
              <label className="form-label fw-semibold">Due Date</label>
              <input
                type="date"
                name="dueDate"
                className="form-control"
                value={form.dueDate}
                onChange={handleChange}
              />
            </div>

            {/* Action Buttons */}
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Saving...' : (editTask ? 'Save Changes' : 'Create Task')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default TaskForm;
