CREATE TABLE task_completion_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  assignment_id BIGINT NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
  submitted_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  note TEXT CHECK (note IS NULL OR LENGTH(note) <= 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_completion_reports_assignment
  ON task_completion_reports(assignment_id, created_at DESC);

CREATE TABLE task_documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completion_report_id BIGINT REFERENCES task_completion_reports(id) ON DELETE CASCADE,
  uploaded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL UNIQUE,
  original_filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(127) NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_task_documents_task ON task_documents(task_id);
CREATE INDEX idx_task_documents_report ON task_documents(completion_report_id);
