CREATE TABLE IF NOT EXISTS task_comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content TEXT NOT NULL CHECK (TRIM(content) != ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_deleted_at ON task_comments(deleted_at);

