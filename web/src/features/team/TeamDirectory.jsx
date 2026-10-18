import Pagination from '../../components/Pagination.jsx';

export default function TeamDirectory({
  isLoading,
  members,
  onPageChange,
  onSearchChange,
  onStatusChange,
  onToggleStatus,
  pagination,
  search,
  statusFilter,
  user,
  updating,
}) {
  return (
    <section className="panel wide-panel">
      <div className="panel-header">
        <h3>Team members</h3>
        <select
          value={statusFilter}
          onChange={(event) => onStatusChange(event.target.value)}
          aria-label="Filter team by status"
        >
          <option value="all">All members</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <input
        className="task-search"
        value={search}
        maxLength={200}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search by name or email"
        aria-label="Search team members"
      />
      {isLoading && <p className="muted" role="status">Loading team members...</p>}
      {!isLoading && members.length === 0 && (
        <p className="empty-state">No team members match the current filters.</p>
      )}

      <div className="member-list">
        {members.map((member) => (
          <article key={member.id} className="member-card">
            <div>
              <strong>{member.full_name}</strong>
              <small>{member.email}</small>
            </div>
            <div className="member-meta">
              <span className={`role-badge ${member.role}`}>{member.role}</span>
              <span>{member.is_active ? 'Active' : 'Inactive'}</span>
              {String(member.id) !== String(user.id) && (
                <button
                  type="button"
                  className="secondary-action"
                  disabled={updating}
                  onClick={() => onToggleStatus(member)}
                >
                  {member.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <Pagination pagination={pagination} itemLabel="members" onPageChange={onPageChange} />
    </section>
  );
}
