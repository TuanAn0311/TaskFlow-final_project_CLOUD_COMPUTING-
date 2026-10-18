const tabs = ['dashboard', 'tasks', 'team', 'profile'];

export default function WorkspaceHeader({
  activeTab,
  onLogout,
  onTabChange,
  taskSummary,
  user,
}) {
  return (
    <>
      <header className="topbar">
        <div>
          <div className="eyebrow">Task Management System</div>
          <h2>Workspace dashboard</h2>
        </div>
        <div className="profile-box">
          <div>
            <strong>{user.full_name}</strong>
            <small>{user.role}</small>
          </div>
          <button type="button" className="secondary-action" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <nav className="tab-bar" aria-label="Main navigation">
        {tabs.map((tab) => {
          const isDisabled = tab === 'team' && user.role !== 'admin';
          return (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? 'tab active' : 'tab'}
              onClick={() => !isDisabled && onTabChange(tab)}
              disabled={isDisabled}
              aria-current={activeTab === tab ? 'page' : undefined}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          );
        })}
      </nav>

      <section className="stats-grid" aria-label="Task summary">
        <div className="stat-card"><span>Todo</span><strong>{taskSummary.todo}</strong></div>
        <div className="stat-card"><span>In progress</span><strong>{taskSummary.in_progress}</strong></div>
        <div className="stat-card"><span>Completed</span><strong>{taskSummary.completed}</strong></div>
        <div className="stat-card"><span>Unassigned</span><strong>{taskSummary.unassigned}</strong></div>
      </section>
    </>
  );
}
