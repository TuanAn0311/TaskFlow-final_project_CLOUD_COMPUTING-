CREATE TYPE assignment_status_type AS ENUM ('active', 'revoked');
CREATE TYPE task_status_type AS ENUM ('todo', 'in_progress', 'completed');

CREATE TABLE IF NOT EXISTS task_assignments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status task_status_type NOT NULL DEFAULT 'todo',
  assignment_status assignment_status_type NOT NULL DEFAULT 'active',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  revoke_reason TEXT,
  CONSTRAINT chk_completed_at CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR status != 'completed'
  ),
  CONSTRAINT chk_revoked_fields CHECK (
    (assignment_status = 'revoked' AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
    OR assignment_status = 'active'
  )
);

-- Partial unique index: only one active assignment per task-user pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_assignments_active_unique
  ON task_assignments(task_id, user_id)
  WHERE assignment_status = 'active';

CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user_id ON task_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_status ON task_assignments(status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assignment_status ON task_assignments(assignment_status);

