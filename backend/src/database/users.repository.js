'use strict';
const pool = require('./connection');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

async function getAllUsers({ page = 1, limit = 20, role, is_active, search } = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  let i = 1;

  if (role) { conditions.push(`role = $${i++}`); params.push(role); }
  if (is_active !== undefined) { conditions.push(`is_active = $${i++}`); params.push(is_active); }
  if (search) {
    conditions.push(`(full_name ILIKE $${i} OR email ILIKE $${i})`);
    params.push(`%${search}%`);
    i++;
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const [{ rows: users }, { rows: countRows }] = await Promise.all([
    pool.query(
      `SELECT id, full_name, email, role, is_active, created_at, updated_at FROM users ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    ),
    pool.query(`SELECT COUNT(*) FROM users ${where}`, params),
  ]);
  return { users, total: parseInt(countRows[0].count), page, limit };
}

async function getUserById(id, requestingUser) {
  const { rows } = await pool.query(
    'SELECT id, full_name, email, role, is_active, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );
  if (rows.length === 0) throw new NotFoundError('User not found');
  if (requestingUser.role !== 'admin' && requestingUser.id !== rows[0].id) {
    throw new ForbiddenError('Access denied');
  }
  return rows[0];
}

async function updateUserStatus(id, is_active, requestingUser) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: lockedUsers } = await client.query(
      `SELECT id, role, is_active
       FROM users
       WHERE id = $1 OR (role = 'admin' AND is_active = TRUE)
       ORDER BY id
       FOR UPDATE`,
      [id]
    );
    const target = lockedUsers.find((row) => String(row.id) === String(id));
    if (!target) throw new NotFoundError('User not found');

    if (!is_active && String(id) === String(requestingUser.id)) {
      throw new ForbiddenError('You cannot deactivate your own account');
    }
    const activeAdminCount = lockedUsers.filter((row) => row.role === 'admin' && row.is_active).length;
    if (!is_active && target.role === 'admin' && activeAdminCount <= 1) {
      throw new ForbiddenError('The last active administrator cannot be deactivated');
    }

    const { rows } = await client.query(
      `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, full_name, email, role, is_active, updated_at`,
      [is_active, id]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getAllUsers, getUserById, updateUserStatus };
