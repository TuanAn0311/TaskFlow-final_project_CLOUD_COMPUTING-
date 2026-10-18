import { useState } from 'react';

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
  handleUploadTaskDocuments,
  handleUploadReportFiles,
  handleOpenDocument,
  history,
  loading,
  onAssigneeIdsChange,
  onCommentTextChange,
  onEditingCommentChange,
  onTaskEditChange,
  onBack,
  selectedTask,
  taskDocuments,
  completionReports,
  setEditingCommentId,
  taskEdit,
  team,
  user,
}) {
  const [completionAssignmentId, setCompletionAssignmentId] = useState(null);
  const [completionNote, setCompletionNote] = useState('');
  const [completionFiles, setCompletionFiles] = useState([]);

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

      <div className="panel wide-panel">
        <h3>Task documents</h3>
        {canEditTask && (
          <label>
            Add documents
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
              disabled={loading}
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                event.target.value = '';
                handleUploadTaskDocuments(files);
              }}
            />
          </label>
        )}
        {taskDocuments.length === 0
          ? <p className="empty-state">No task documents have been added.</p>
          : taskDocuments.map((document) => (
            <article className="member-card" key={document.id}>
              <div>
                <strong>{document.original_filename}</strong>
                <small>{(Number(document.file_size) / 1024 / 1024).toFixed(2)} MB</small>
              </div>
              <div className="action-row compact-actions">
                <button type="button" className="secondary-action" onClick={() => handleOpenDocument(
                  `/api/tasks/${selectedTask.id}/documents/${document.id}/url`, 'inline',
                )}>View</button>
                <button type="button" className="secondary-action" onClick={() => handleOpenDocument(
                  `/api/tasks/${selectedTask.id}/documents/${document.id}/url`, 'attachment',
                )}>Download</button>
              </div>
            </article>
          ))}
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
                  assignment.status === 'in_progress' && completionAssignmentId === assignment.id ? (
                    <form className="task-form" onSubmit={(event) => {
                      event.preventDefault();
                      handleUpdateAssignment(assignment, 'completed', completionNote, completionFiles).then((updated) => {
                        if (!updated) return;
                        setCompletionAssignmentId(null);
                        setCompletionNote('');
                        setCompletionFiles([]);
                      });
                    }}>
                      <label>
                        Completion note (optional)
                        <textarea
                          rows="3"
                          maxLength={5000}
                          value={completionNote}
                          onChange={(event) => setCompletionNote(event.target.value)}
                        />
                      </label>
                      <label>
                        Report files (optional)
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
                          onChange={(event) => setCompletionFiles(Array.from(event.target.files || []))}
                        />
                      </label>
                      <div className="action-row">
                        <button type="submit" className="primary-action" disabled={loading}>Confirm completion</button>
                        <button type="button" className="secondary-action" onClick={() => setCompletionAssignmentId(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="secondary-action"
                      disabled={loading}
                      onClick={() => {
                        if (assignment.status === 'in_progress') {
                          setCompletionAssignmentId(assignment.id);
                          setCompletionNote('');
                          setCompletionFiles([]);
                        } else {
                          handleUpdateAssignment(assignment, 'in_progress');
                        }
                      }}
                    >
                      {assignment.status === 'todo' ? 'Start' : assignment.status === 'in_progress' ? 'Complete' : 'Reopen'}
                    </button>
                  )
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

      <div className="panel wide-panel">
        <h3>Completion reports</h3>
        {completionReports.length === 0
          ? <p className="empty-state">No completion reports have been submitted.</p>
          : completionReports.map((report) => {
            const assignment = assignments.find((item) => String(item.id) === String(report.assignment_id));
            const latestReportId = completionReports.find((item) => String(item.assignment_id) === String(report.assignment_id))?.id;
            const canAddFiles = String(report.id) === String(latestReportId)
              && assignment?.status === 'completed'
              && assignment.assignment_status === 'active'
              && (user.role === 'admin' || String(report.assignee_id) === String(user.id));
            return (
              <article className="member-card report-card" key={report.id}>
                <div>
                  <strong>{report.assignee_name} · {new Date(report.created_at).toLocaleString()}</strong>
                  <small>Reported by {report.submitted_by_name}</small>
                  {report.note && <p>{report.note}</p>}
                  {report.files.map((file) => (
                    <div className="action-row compact-actions" key={file.id}>
                      <span>{file.original_filename}</span>
                      <button type="button" className="secondary-action" onClick={() => handleOpenDocument(
                        `/api/tasks/${selectedTask.id}/reports/${report.id}/documents/${file.id}/url`, 'inline',
                      )}>View</button>
                      <button type="button" className="secondary-action" onClick={() => handleOpenDocument(
                        `/api/tasks/${selectedTask.id}/reports/${report.id}/documents/${file.id}/url`, 'attachment',
                      )}>Download</button>
                    </div>
                  ))}
                  {canAddFiles && (
                    <label>
                      Add report files
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
                        disabled={loading}
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          event.target.value = '';
                          handleUploadReportFiles(report.assignment_id, files);
                        }}
                      />
                    </label>
                  )}
                </div>
              </article>
            );
          })}
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
