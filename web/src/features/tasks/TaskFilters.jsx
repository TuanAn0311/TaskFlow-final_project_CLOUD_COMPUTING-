export default function TaskFilters({ filters, team, isAdmin, onChange }) {
  return (
    <div className="task-filters">
      <input
        className="task-search"
        value={filters.search}
        maxLength={200}
        onChange={(event) => onChange({ search: event.target.value })}
        placeholder="Search title or description"
        aria-label="Search tasks"
      />
      <select value={filters.status} onChange={(event) => onChange({ status: event.target.value })} aria-label="Filter by status">
        <option value="all">All statuses</option>
        <option value="todo">Todo</option>
        <option value="in_progress">In progress</option>
        <option value="completed">Completed</option>
        <option value="unassigned">Unassigned</option>
      </select>
      <select value={filters.priority} onChange={(event) => onChange({ priority: event.target.value })} aria-label="Filter by priority">
        <option value="all">All priorities</option>
        <option value="low">Low priority</option>
        <option value="medium">Medium priority</option>
        <option value="high">High priority</option>
      </select>
      <label>
        Due on or after
        <input
          type="date"
          value={filters.due_after}
          max={filters.due_before || undefined}
          onChange={(event) => onChange({ due_after: event.target.value })}
        />
      </label>
      <label>
        Due on or before
        <input
          type="date"
          value={filters.due_before}
          min={filters.due_after || undefined}
          onChange={(event) => onChange({ due_before: event.target.value })}
        />
      </label>
      {isAdmin && (
        <>
          <select value={filters.assignee_id} onChange={(event) => onChange({ assignee_id: event.target.value })} aria-label="Filter by assignee">
            <option value="">All assignees</option>
            {team.map((member) => <option value={member.id} key={member.id}>{member.full_name}</option>)}
          </select>
          <select value={filters.created_by} onChange={(event) => onChange({ created_by: event.target.value })} aria-label="Filter by creator">
            <option value="">All creators</option>
            {team.map((member) => <option value={member.id} key={member.id}>{member.full_name}</option>)}
          </select>
        </>
      )}
    </div>
  );
}
