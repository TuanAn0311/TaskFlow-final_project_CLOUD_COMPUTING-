'use strict';
const pool = require('./connection');
const { NotFoundError, ForbiddenError, AppError } = require('../utils/errors');

const OVERALL_STATUS_SQL = `(
  SELECT CASE
    WHEN COUNT(*) FILTER (WHERE ta.assignment_status = 'active') = 0 THEN 'unassigned'
    WHEN COUNT(*) FILTER (WHERE ta.assignment_status = 'active' AND ta.status != 'todo') = 0 THEN 'todo'
    WHEN COUNT(*) FILTER (WHERE ta.assignment_status = 'active' AND ta.status != 'completed') = 0 THEN 'completed'
    ELSE 'in_progress'
  END
  FROM task_assignments ta
  WHERE ta.task_id = t.id
)`;

async function getTaskOverallStatus(taskId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${OVERALL_STATUS_SQL} AS overall_status FROM tasks t WHERE t.id = $1`,
    [taskId]
  );
  return rows[0]?.overall_status || 'unassigned';
}

async function canAccessTask(taskId, user, client = pool) {
  const { rows } = await client.query(
    `SELECT (
       $2 = 'admin'
       OR t.created_by = $3
       OR EXISTS (
         SELECT 1 FROM task_assignments ta
         WHERE ta.task_id = t.id AND ta.user_id = $3 AND ta.assignment_status = 'active'
       )
     ) AS can_access
     FROM tasks t
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [taskId, user.role, user.id]
  );
  if (rows.length === 0) throw new NotFoundError('Task not found');
  return rows[0].can_access;
}

async function createTask({ title, description, priority, due_date, created_by, assignee_ids = [] }) {
  if (!Array.isArray(assignee_ids)) {
    throw new AppError('assignee_ids must be an array', 400);
  }
  if (new Set(assignee_ids.map(String)).size !== assignee_ids.length) {
    throw new AppError('assignee_ids must not contain duplicates', 400);
  }

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    const userIdsToLock = [...new Set([...assignee_ids, created_by].map(String))];
    const { rows: lockedUsers } = await dbClient.query(
      `SELECT id, is_active
       FROM users
       WHERE id = ANY($1::bigint[])
       ORDER BY id
       FOR SHARE`,
      [userIdsToLock]
    );
    const activeUserIds = new Set(lockedUsers.filter((row) => row.is_active).map((row) => String(row.id)));
    if (!activeUserIds.has(String(created_by))) {
      throw new ForbiddenError('Your account is inactive');
    }
    if (assignee_ids.some((userId) => !activeUserIds.has(String(userId)))) {
      throw new NotFoundError('One or more assignee users not found or inactive');
    }

    const { rows } = await dbClient.query(
      `INSERT INTO tasks (title, description, priority, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, description || null, priority || 'medium', due_date || null, created_by]
    );
    const task = rows[0];

    if (assignee_ids && assignee_ids.length > 0) {
      for (const userId of assignee_ids) {
        const aResult = await dbClient.query(
          `INSERT INTO task_assignments (task_id, user_id, assigned_by, status, assignment_status)
           VALUES ($1, $2, $3, 'todo', 'active')
           RETURNING id`,
          [task.id, userId, created_by]
        );
        await dbClient.query(
          `INSERT INTO task_status_history (assignment_id, changed_by, old_status, new_status, note)
           VALUES ($1, $2, NULL, 'todo', 'Initial assignment')`,
          [aResult.rows[0].id, created_by]
        );
      }
    }

    await dbClient.query('COMMIT');
    return task;
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
}

async function getTasks(user, { page = 1, limit = 20, search, status, priority, assignee_id, due_after, due_before, created_by } = {}) {
  const offset = (page - 1) * limit;
  const conditions = ['t.deleted_at IS NULL'];
  const params = [];
  let i = 1;

  // Authorization filter: employees only see their own created or assigned tasks
  if (user.role === 'employee') {
    conditions.push(`(t.created_by = $${i} OR EXISTS (
      SELECT 1 FROM task_assignments ta WHERE ta.task_id = t.id AND ta.user_id = $${i} AND ta.assignment_status = 'active'
    ))`);
    params.push(user.id);
    i++;
  }

  if (search) {
    conditions.push(`(t.title ILIKE $${i} OR t.description ILIKE $${i})`);
    params.push(`%${search}%`);
    i++;
  }
  if (priority) { conditions.push(`t.priority = $${i++}`); params.push(priority); }
  if (due_after) { conditions.push(`t.due_date >= $${i++}`); params.push(due_after); }
  if (due_before) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(due_before)) {
      conditions.push(`t.due_date < ($${i++}::date + INTERVAL '1 day')`);
    } else {
      conditions.push(`t.due_date <= $${i++}`);
    }
    params.push(due_before);
  }
  if (created_by && user.role === 'admin') { conditions.push(`t.created_by = $${i++}`); params.push(created_by); }
  if (assignee_id) {
    conditions.push(`EXISTS (SELECT 1 FROM task_assignments ta2 WHERE ta2.task_id = t.id AND ta2.user_id = $${i++} AND ta2.assignment_status = 'active')`);
    params.push(assignee_id);
  }

  const where = 'WHERE ' + conditions.join(' AND ');

  const baseQuery = `
    SELECT t.id, t.title, t.description, t.priority, t.due_date,
           t.created_by, t.created_at, t.updated_at,
           u.full_name AS creator_name,
           ${OVERALL_STATUS_SQL} AS overall_status
    FROM tasks t
    JOIN users u ON u.id = t.created_by
    ${where}
  `;

  let finalQuery = baseQuery;
  let finalParams = [...params];

  if (status && status !== 'all') {
    finalQuery = `SELECT * FROM (${baseQuery}) sub WHERE sub.overall_status = $${i}`;
    finalParams = [...params, status];
    const countInner = `SELECT COUNT(*) FROM (${baseQuery}) sub WHERE sub.overall_status = $${i}`;
    const [{ rows: tasks }, { rows: countRows }] = await Promise.all([
      pool.query(`${finalQuery} ORDER BY created_at DESC LIMIT $${i + 1} OFFSET $${i + 2}`, [...finalParams, limit, offset]),
      pool.query(countInner, [...params, status]),
    ]);
    return { tasks, total: parseInt(countRows[0].count), page, limit };
  }

  const [{ rows: tasks }, { rows: countRows }] = await Promise.all([
    pool.query(`${finalQuery} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`, [...params, limit, offset]),
    pool.query(`SELECT COUNT(*) FROM tasks t JOIN users u ON u.id = t.created_by ${where}`, params),
  ]);

  return { tasks, total: parseInt(countRows[0].count), page, limit };
}

async function getTaskById(taskId, user) {
  const access = await canAccessTask(taskId, user);
  if (!access) throw new ForbiddenError('Access denied');

  const { rows } = await pool.query(
    `SELECT t.*, u.full_name AS creator_name,
     ${OVERALL_STATUS_SQL} AS overall_status
     FROM tasks t JOIN users u ON u.id = t.created_by
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [taskId]
  );
  if (rows.length === 0) throw new NotFoundError('Task not found');
  return rows[0];
}

async function updateTask(taskId, user, updates) {
  const task = await getTaskById(taskId, user);
  if (user.role !== 'admin' && task.created_by !== user.id) {
    throw new ForbiddenError('Only the task creator or admin can edit this task');
  }
  const allowed = ['title', 'description', 'priority', 'due_date'];
  const fields = [];
  const params = [];
  let i = 1;
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = $${i++}`);
      params.push(updates[key]);
    }
  }
  if (fields.length === 0) throw new AppError('No valid fields to update', 400);
  fields.push(`updated_at = NOW()`);
  params.push(taskId);
  const { rows } = await pool.query(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
    params
  );
  if (rows.length === 0) throw new NotFoundError('Task not found');
  return rows[0];
}

async function deleteTask(taskId, user) {
  if (user.role !== 'admin') throw new ForbiddenError('Only admins can delete tasks');
  const { rows } = await pool.query(
    `UPDATE tasks SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [taskId]
  );
  if (rows.length === 0) throw new NotFoundError('Task not found or already deleted');
  return { id: taskId, deleted: true };
}

module.exports = { createTask, getTasks, getTaskById, updateTask, deleteTask, canAccessTask, getTaskOverallStatus };
