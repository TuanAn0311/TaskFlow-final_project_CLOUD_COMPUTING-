CREATE INDEX IF NOT EXISTS idx_tasks_active_created_at
  ON tasks(created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_comments_active_task_created_at
  ON task_comments(task_id, created_at ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_status_history_assignment_changed_at
  ON task_status_history(assignment_id, changed_at ASC);
