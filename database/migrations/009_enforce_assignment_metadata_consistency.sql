ALTER TABLE task_assignments
  ADD CONSTRAINT chk_completed_at_consistency
  CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  ) NOT VALID;

ALTER TABLE task_assignments
  ADD CONSTRAINT chk_revoked_fields_consistency
  CHECK (
    (assignment_status = 'revoked' AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
    OR (
      assignment_status = 'active'
      AND revoked_at IS NULL
      AND revoked_by IS NULL
    )
  ) NOT VALID;

ALTER TABLE task_assignments
  VALIDATE CONSTRAINT chk_completed_at_consistency;

ALTER TABLE task_assignments
  VALIDATE CONSTRAINT chk_revoked_fields_consistency;

ALTER TABLE task_assignments
  DROP CONSTRAINT chk_completed_at,
  DROP CONSTRAINT chk_revoked_fields;
