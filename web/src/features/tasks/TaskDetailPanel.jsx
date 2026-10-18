export default function TaskDetailPanel({
  assignments,
  assigneeIds,
  comments,
  commentText,
  detailsLoading,
  editingCommentId,
  editingCommentText,
  handleAddComment,
  handleAssignUsers,
  handleDeleteComment,
  handleDeleteTask,
  handleRevokeAssignment,
  handleSaveComment,
  handleUpdateAssignment,
  handleUpdateTask,
  history,
  loading,
  onAssigneeIdsChange,
  onCommentTextChange,
  onEditingCommentChange,
  onTaskEditChange,
  onBack,
  selectedTask,
  setEditingCommentId,
  taskEdit,
  team,
  user,
}) {
  if (!selectedTask || !taskEdit) return null;

  const canEditTask = user.role === 'admin' || String(selectedTask.created_by) === String(user.id);
  const availableAssignees = team.filter((member) => member.is_active && !assignments.some(
    (assignment) => assignment.assignment_status === 'active'
      && String(assignment.user_id) === String(member.id),
  ));

  return (
    <section className="detail-grid">
      <div className="panel wide-panel">
        <div className="panel-header">
          <div>
            <button type="button" className="text-button" onClick={onBack}>← All tasks</button>
            <h3>{selectedTask.title}</h3>
          </div>
          <span className={`badge ${selectedTask.overall_status || 'unassigned'}`}>
            {selectedTask.overall_status || 'unassigned'}
          </span>
        </div>

        {canEditTask && (
          <form className="task-form edit-task-form" onSubmit={handleUpdateTask}>
            <label>
              Title
              <input
                value={taskEdit.title}
                required
                maxLength={200}
                onChange={(event) => onTaskEditChange({ ...taskEdit, title: event.target.value })}
              />
            </label>
            <label>
              Description
              <textarea
                rows="3"
                value={taskEdit.description}
                onChange={(event) => onTaskEditChange({ ...taskEdit, description: event.target.value })}
              />
            </label>
            <div className="inline-fields">
              <select
                value={taskEdit.priority}
                onChange={(event) => onTaskEditChange({ ...taskEdit, priority: event.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                type="date"
                value={taskEdit.due_date}
                onChange={(event) => onTaskEditChange({ ...taskEdit, due_date: event.target.value })}
              />
            </div>
            <div className="action-row">
              <button type="submit" className="primary-action" disabled={loading}>Save changes</button>
              {user.role === 'admin' && (
                <button type="button" className="danger-action" onClick={handleDeleteTask} disabled={loading}>
                  Delete task
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <div className="panel">
        <h3>Assignments</h3>
        {detailsLoading && <p className="muted" role="status">Loading task details...</p>}
        {user.role === 'admin' && (
          <form className="assign-form" onSubmit={handleAssignUsers}>
            <select
              multiple
              value={assigneeIds}
              onChange={(event) => onAssigneeIdsChange(Array.from(
                event.target.selectedOptions,
                (option) => option.value,
              ))}
              aria-label="Select team members to assign"
            >
              {availableAssignees.map((member) => (
                <option value={member.id} key={member.id}>{member.full_name}</option>
              ))}
            </select>
            <small className="muted">
              {availableAssignees.length > 0
                ? 'Use Ctrl or Command to select multiple people.'
                : 'All active team members are already assigned.'}
            </small>
            <button type="submit" className="primary-action" disabled={loading || assigneeIds.length === 0}>
              Assign selected
            </button>
          </form>
        )}

        <div className="member-list">
          {!detailsLoading && assignments.length === 0 && <p className="empty-state">No assignment history yet.</p>}
          {assignments.map((assignment) => (
            <article className="member-card" key={assignment.id}>
              <div>
                <strong>{assignment.assignee_name}</strong>
                <small>{assignment.assignee_email}</small>
                <span className={`badge ${assignment.assignment_status === 'active' ? assignment.status : 'unassigned'}`}>
                  {assignment.assignment_status === 'active' ? assignment.status.replace('_', ' ') : 'revoked'}
                </span>
              </div>
              <div className="action-row compact-actions">
                {assignment.assignment_status === 'active'
                  && (user.role === 'admin' || String(assignment.user_id) === String(user.id)) && (
                  <button
                    type="button"
                    className="secondary-action"
                    disabled={loading}
                    onClick={() => handleUpdateAssignment(
                      assignment,
                      assignment.status === 'todo'
                        ? 'in_progress'
                        : assignment.status === 'in_progress' ? 'completed' : 'in_progress',
                    )}
                  >
                    {assignment.status === 'todo'
                      ? 'Start'
                      : assignment.status === 'in_progress' ? 'Complete' : 'Reopen'}
                  </button>
                )}
                {user.role === 'admin' && assignment.assignment_status === 'active' && (
                  <button
                    type="button"
                    className="danger-action"
                    disabled={loading}
                    onClick={() => handleRevokeAssignment(assignment)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>Comments</h3>
        <form className="comment-form" onSubmit={handleAddComment}>
          <textarea
            rows="3"
            maxLength={5000}
            value={commentText}
            onChange={(event) => onCommentTextChange(event.target.value)}
            placeholder="Write a comment..."
          />
          <button type="submit" className="primary-action" disabled={loading || !commentText.trim()}>
            Add comment
          </button>
        </form>
        <div className="comment-list">
          {!detailsLoading && comments.length === 0 && <p className="empty-state">No comments yet.</p>}
          {comments.map((comment) => (
            <article className="comment-item" key={comment.id}>
              <strong>{comment.author_name || 'Team member'}</strong>
              <small>{new Date(comment.created_at).toLocaleString()}</small>
              {editingCommentId === comment.id ? (
                <div className="comment-edit">
                  <textarea
                    rows="3"
                    maxLength={5000}
                    value={editingCommentText}
                    onChange={(event) => onEditingCommentChange(event.target.value)}
                  />
                  <div className="action-row">
                    <button
                      type="button"
                      className="primary-action"
                      disabled={loading || !editingCommentText.trim()}
                      onClick={() => handleSaveComment(comment)}
                    >
                      Save
                    </button>
                    <button type="button" className="secondary-action" onClick={() => setEditingCommentId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : <p>{comment.content}</p>}
              {(user.role === 'admin' || String(comment.user_id) === String(user.id))
                && editingCommentId !== comment.id && (
                <div className="action-row comment-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      setEditingCommentId(comment.id);
                      onEditingCommentChange(comment.content);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger-action"
                    disabled={loading}
                    onClick={() => handleDeleteComment(comment)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3>Status history</h3>
        <div className="history-list">
          {!detailsLoading && history.length === 0 && <p className="empty-state">No status changes recorded.</p>}
          {history.map((entry) => (
            <article className="history-item" key={entry.id}>
              <strong>{entry.new_status.replace('_', ' ')}</strong>
              <small>{entry.changed_by_name} · {new Date(entry.changed_at).toLocaleString()}</small>
              {entry.note && <p>{entry.note}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
