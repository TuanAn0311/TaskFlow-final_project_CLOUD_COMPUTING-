CREATE TABLE IF NOT EXISTS task_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  assignment_id BIGINT NOT NULL REFERENCES task_assignments(id) ON DELETE RESTRICT,
  changed_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  old_status task_status_type,
  new_status task_status_type NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_history_assignment_id ON task_status_history(assignment_id);
CREATE INDEX IF NOT EXISTS idx_history_changed_by ON task_status_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_history_changed_at ON task_status_history(changed_at);

