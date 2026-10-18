import Pagination from '../../components/Pagination.jsx';
import TaskFilters from './TaskFilters.jsx';

function TaskRows({ tasks, onOpenTask }) {
  return (
    <div className="task-table">
      <div className="task-row task-row-header">
        <span>Task</span>
        <span>Status</span>
        <span>Priority</span>
        <span>Owner</span>
      </div>

      {tasks.map((task) => (
        <div className="task-row" key={task.id}>
          <span>
            <button type="button" className="task-title-button" onClick={() => onOpenTask(task)}>
              {task.title}
            </button>
            <small>{task.description || 'No description'}</small>
          </span>
          <span className={`badge ${task.overall_status || 'unassigned'}`}>
            {task.overall_status || 'unassigned'}
          </span>
          <span>{task.priority}</span>
          <span>{task.creator_name}</span>
        </div>
      ))}
    </div>
  );
}

function TaskCards({ tasks, onOpenTask }) {
  return (
    <div className="task-list">
      {tasks.map((task) => (
        <article key={task.id} className="task-item">
          <div className="task-header">
            <strong>{task.title}</strong>
            <span className={`badge ${task.overall_status || 'unassigned'}`}>
              {task.overall_status || 'unassigned'}
            </span>
          </div>
          <p>{task.description || 'No description provided.'}</p>
          <div className="task-meta">
            <span>Priority: {task.priority}</span>
            <span>By: {task.creator_name}</span>
            {task.due_date ? <span>Due: {task.due_date}</span> : null}
            <button type="button" className="task-title-button" onClick={() => onOpenTask(task)}>Open details</button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function CreateTaskForm({ form, files, loading, onChange, onFilesChange, onSubmit }) {
  return (
    <div className="panel">
      <h3>Create task</h3>
      <form className="task-form" onSubmit={onSubmit}>
        <input
          value={form.title}
          required
          maxLength={200}
          onChange={(event) => onChange({ ...form, title: event.target.value })}
          placeholder="Task title"
        />
        <textarea
          value={form.description}
          rows="4"
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          placeholder="Task description"
        />
        <label>
          Task documents (optional)
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
            onChange={(event) => onFilesChange(Array.from(event.target.files || []))}
          />
        </label>
        {files.length > 0 && <small className="muted">{files.length} file(s) selected; maximum 5 files, 10 MB each.</small>}
        <div className="inline-fields">
          <select value={form.priority} onChange={(event) => onChange({ ...form, priority: event.target.value })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input
            type="date"
            value={form.due_date}
            onChange={(event) => onChange({ ...form, due_date: event.target.value })}
          />
        </div>
        <button type="submit" className="primary-action" disabled={loading}>
          {loading ? 'Saving...' : 'Create task'}
        </button>
      </form>
    </div>
  );
}

export function TaskCollection({
  filters,
  isAdmin,
  loading,
  onChangeFilters,
  onOpenTask,
  onPageChange,
  pageData,
  team,
  tasks,
  variant = 'table',
}) {
  const isDashboard = variant === 'dashboard';

  return (
    <section className={isDashboard ? 'panel' : 'panel wide-panel'}>
      <div className="panel-header">
        <h3>{isDashboard ? 'Recent tasks' : 'Task overview'}</h3>
      </div>
      <TaskFilters filters={filters} team={team} isAdmin={isAdmin} onChange={onChangeFilters} />
      {loading && <p className="muted" role="status">Loading tasks...</p>}
      {!loading && tasks.length === 0 && <p className="empty-state">No tasks match the current filters.</p>}
      {isDashboard
        ? <TaskCards tasks={tasks} onOpenTask={onOpenTask} />
        : <TaskRows tasks={tasks} onOpenTask={onOpenTask} />}
      <Pagination pagination={pageData} itemLabel="tasks" onPageChange={onPageChange} />
    </section>
  );
}
