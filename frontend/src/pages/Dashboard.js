/**
 * Dashboard.js — Main Student Dashboard
 *
 * This is the heart of the application. It shows:
 *   - Stats cards (total, completed, pending, overdue, productivity)
 *   - Upcoming deadlines section
 *   - Search and filter controls
 *   - The full list of tasks
 *   - The TaskForm modal for creating/editing tasks
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  toggleTaskComplete,
} from '../services/api';
import StatsCard from '../components/StatsCard';
import TaskCard from '../components/TaskCard';
import TaskForm from '../components/TaskForm';

function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  // ── State ───────────────────────────────────────────
  const [tasks, setTasks] = useState([]);           // All tasks from the backend
  const [loading, setLoading] = useState(true);     // Loading indicator
  const [error, setError] = useState('');           // Error message

  // Task form modal state
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null); // null = creating new

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');    // all | pending | completed | overdue
  const [filterPriority, setFilterPriority] = useState('all'); // all | low | medium | high
  const [filterCategory, setFilterCategory] = useState('all'); // all | assignment | exam | project | personal

  // ── Redirect if not logged in ───────────────────────
  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  // ── Load tasks from the backend ─────────────────────
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetchTasks();
      setTasks(response.data);
    } catch (err) {
      setError('Failed to load tasks. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load tasks when the component first mounts
  useEffect(() => {
    if (token) loadTasks();
  }, [token, loadTasks]);

  // ── Task Handlers ────────────────────────────────────

  /** Create a new task */
  const handleCreateTask = async (formData) => {
    const response = await createTask(formData);
    // Add the new task to the top of the list
    setTasks(prev => [response.data.task, ...prev]);
  };

  /** Edit an existing task */
  const handleEditTask = async (formData) => {
    const response = await updateTask(editingTask.id, formData);
    // Replace the old task with the updated one
    setTasks(prev => prev.map(t => t.id === editingTask.id ? response.data.task : t));
  };

  /** Delete a task after confirmation */
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      alert('Failed to delete task. Please try again.');
    }
  };

  /** Toggle a task between completed and pending */
  const handleToggleComplete = async (taskId) => {
    try {
      const response = await toggleTaskComplete(taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? response.data.task : t));
    } catch (err) {
      alert('Failed to update task status.');
    }
  };

  /** Open the form for editing */
  const handleOpenEdit = (task) => {
    setEditingTask(task);
    setShowForm(true);
  };

  /** Open the form for creating */
  const handleOpenCreate = () => {
    setEditingTask(null);
    setShowForm(true);
  };

  /** Close the modal */
  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTask(null);
  };

  // ── Computed Statistics ──────────────────────────────

  const now = new Date();

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const pendingTasks = tasks.filter(t => !t.completed).length;
  const overdueTasks = tasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < now).length;

  // Productivity = (completed / total) * 100, rounded to nearest integer
  const productivity = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Upcoming deadlines = incomplete tasks due in the next 7 days, sorted soonest first
  const upcomingTasks = tasks
    .filter(t => {
      if (!t.dueDate || t.completed) return false;
      const due = new Date(t.dueDate);
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return due >= now && due <= sevenDaysFromNow;
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  // ── Search & Filter Logic ────────────────────────────

  const filteredTasks = tasks.filter(task => {
    // 1. Search: match title or description
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      task.title.toLowerCase().includes(query) ||
      (task.description && task.description.toLowerCase().includes(query));

    // 2. Filter by status
    const isOverdue = !task.completed && task.dueDate && new Date(task.dueDate) < now;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'completed' && task.completed) ||
      (filterStatus === 'pending' && !task.completed && !isOverdue) ||
      (filterStatus === 'overdue' && isOverdue);

    // 3. Filter by priority
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;

    // 4. Filter by category
    const matchesCategory = filterCategory === 'all' || task.category === filterCategory;

    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  // ── Helper: Format date ──────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ── Render ───────────────────────────────────────────
  return (
    <div className="container py-4">

      {/* ── Page Title ── */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-0 fw-bold">My Dashboard</h3>
          <small className="text-muted">Manage your tasks and track productivity</small>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          ➕ Add Task
        </button>
      </div>

      {/* ── Error Alert ── */}
      {error && (
        <div className="alert alert-danger mb-4">{error}</div>
      )}

      {/* ── Stats Cards Row ── */}
      <div className="row mb-4">
        <StatsCard title="Total Tasks"   value={totalTasks}      icon="📋" color="primary" />
        <StatsCard title="Completed"     value={completedTasks}  icon="✅" color="success" />
        <StatsCard title="Pending"       value={pendingTasks}    icon="⏳" color="warning" />
        <StatsCard title="Overdue"       value={overdueTasks}    icon="🔴" color="danger"  />
        <StatsCard title="Productivity"  value={`${productivity}%`} icon="📈" color="info" />
        <StatsCard title="Upcoming"      value={upcomingTasks.length} icon="📅" color="secondary" />
      </div>

      {/* ── Productivity Bar ── */}
      <div className="card mb-4 shadow-sm">
        <div className="card-body py-3">
          <div className="d-flex justify-content-between mb-1">
            <span className="fw-semibold small">📈 Productivity</span>
            <span className="fw-bold text-primary">{productivity}%</span>
          </div>
          <div className="progress" style={{ height: '12px' }}>
            <div
              className={`progress-bar ${productivity >= 70 ? 'bg-success' : productivity >= 40 ? 'bg-warning' : 'bg-danger'}`}
              style={{ width: `${productivity}%`, transition: 'width 0.5s ease' }}
            />
          </div>
          <small className="text-muted">
            {completedTasks} of {totalTasks} tasks completed
          </small>
        </div>
      </div>

      {/* ── Upcoming Deadlines ── */}
      {upcomingTasks.length > 0 && (
        <div className="card mb-4 shadow-sm border-warning">
          <div className="card-header bg-warning bg-opacity-10">
            <strong>⏰ Upcoming Deadlines (Next 7 Days)</strong>
          </div>
          <div className="card-body py-2">
            <div className="d-flex flex-wrap gap-2">
              {upcomingTasks.map(task => (
                <span key={task.id} className="badge bg-warning text-dark fs-6 px-3 py-2">
                  📅 {task.title} — {formatDate(task.dueDate)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Search & Filters ── */}
      <div className="card mb-4 shadow-sm">
        <div className="card-body py-3">
          <div className="row g-2 align-items-end">
            {/* Search box */}
            <div className="col-12 col-md-4">
              <label className="form-label small fw-semibold mb-1">🔍 Search</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search by title or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status filter */}
            <div className="col-6 col-md-3">
              <label className="form-label small fw-semibold mb-1">Status</label>
              <select
                className="form-select form-select-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">⏳ Pending</option>
                <option value="completed">✅ Completed</option>
                <option value="overdue">🔴 Overdue</option>
              </select>
            </div>

            {/* Priority filter */}
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold mb-1">Priority</label>
              <select
                className="form-select form-select-sm"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
              >
                <option value="all">All</option>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>

            {/* Category filter */}
            <div className="col-6 col-md-2">
              <label className="form-label small fw-semibold mb-1">Category</label>
              <select
                className="form-select form-select-sm"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All</option>
                <option value="assignment">📝 Assignment</option>
                <option value="exam">📖 Exam</option>
                <option value="project">💼 Project</option>
                <option value="personal">🙂 Personal</option>
              </select>
            </div>

            {/* Clear filters button */}
            <div className="col-6 col-md-1">
              <button
                className="btn btn-outline-secondary btn-sm w-100"
                onClick={() => {
                  setSearchQuery('');
                  setFilterStatus('all');
                  setFilterPriority('all');
                  setFilterCategory('all');
                }}
                title="Clear all filters"
              >
                ✕ Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Task List ── */}
      <div>
        {/* Result count */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0 fw-semibold">
            Tasks
            <span className="badge bg-primary ms-2">{filteredTasks.length}</span>
          </h5>
        </div>

        {/* Loading spinner */}
        {loading && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
            <div className="mt-2 text-muted">Loading your tasks...</div>
          </div>
        )}

        {/* No tasks at all */}
        {!loading && tasks.length === 0 && (
          <div className="text-center py-5">
            <div className="fs-1">📋</div>
            <h5 className="text-muted mt-2">No tasks yet!</h5>
            <p className="text-muted">Click "Add Task" to create your first task.</p>
          </div>
        )}

        {/* No results for current filter */}
        {!loading && tasks.length > 0 && filteredTasks.length === 0 && (
          <div className="text-center py-5">
            <div className="fs-1">🔍</div>
            <h5 className="text-muted mt-2">No tasks match your search or filters.</h5>
            <button
              className="btn btn-outline-secondary btn-sm mt-2"
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
                setFilterPriority('all');
                setFilterCategory('all');
              }}
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Render task cards */}
        {!loading && filteredTasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={handleOpenEdit}
            onDelete={handleDeleteTask}
            onToggle={handleToggleComplete}
          />
        ))}
      </div>

      {/* ── Task Form Modal ── */}
      <TaskForm
        show={showForm}
        onClose={handleCloseForm}
        onSubmit={editingTask ? handleEditTask : handleCreateTask}
        editTask={editingTask}
      />
    </div>
  );
}

export default Dashboard;
