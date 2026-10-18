'use strict';
const pool = require('./connection');
const { ForbiddenError } = require('../utils/errors');
const { canAccessTask } = require('./tasks.repository');

async function getTaskHistory(taskId, user, { assignment_id } = {}) {
  const access = await canAccessTask(taskId, user);
  if (!access) throw new ForbiddenError('Access denied');

  let query = `
    SELECT tsh.id, tsh.assignment_id, tsh.old_status, tsh.new_status, tsh.note, tsh.changed_at,
           u.full_name AS changed_by_name, u.id AS changed_by_id,
           ta.user_id AS assignee_id, au.full_name AS assignee_name
    FROM task_status_history tsh
    JOIN users u ON u.id = tsh.changed_by
    JOIN task_assignments ta ON ta.id = tsh.assignment_id
    JOIN users au ON au.id = ta.user_id
    WHERE ta.task_id = $1
  `;
  const params = [taskId];

  if (assignment_id) {
    query += ` AND tsh.assignment_id = $2`;
    params.push(assignment_id);
  }

  query += ` ORDER BY tsh.changed_at ASC`;

  const { rows } = await pool.query(query, params);
  return rows;
}

module.exports = { getTaskHistory };
