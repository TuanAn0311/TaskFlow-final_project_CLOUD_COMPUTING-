const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const pool = require('../src/database/connection');

function makeUniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function createUser({ full_name, email, password, role = 'employee' }) {
  const password_hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, full_name, email, role`,
    [full_name, email, password_hash, role]
  );
  return rows[0];
}

async function cleanupTask(taskId) {
  if (!taskId) return;
  await pool.query('DELETE FROM task_comments WHERE task_id = $1', [taskId]);
  await pool.query(
    'DELETE FROM task_status_history WHERE assignment_id IN (SELECT id FROM task_assignments WHERE task_id = $1)',
    [taskId]
  );
  await pool.query('DELETE FROM task_assignments WHERE task_id = $1', [taskId]);
  await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
}

describe('Authentication and authorization API boundaries', () => {
  test('registration ignores privilege fields, hashes passwords, and login errors do not disclose account existence', async () => {
    const email = `registration-security-${makeUniqueSuffix()}@example.com`;
    const password = 'SecurePassword123';

    try {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          full_name: 'Registration Security User',
          email,
          password,
          role: 'admin',
          id: 1,
          is_active: false,
        })
        .expect(201);

      expect(response.body.data.user.role).toBe('employee');
      expect(response.body.data.user.is_active).toBe(true);
      expect(response.body.data.user.id).not.toBe(1);
      expect(response.body.data.user).not.toHaveProperty('password_hash');
      expect(response.body.data).not.toHaveProperty('password');

      const { rows } = await pool.query(
        'SELECT password_hash FROM users WHERE email = $1',
        [email]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].password_hash).not.toBe(password);
      expect(await bcrypt.compare(password, rows[0].password_hash)).toBe(true);

      const invalidPassword = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassword123' })
        .expect(401);
      const unknownUser = await request(app)
        .post('/api/auth/login')
        .send({ email: `missing-${email}`, password: 'WrongPassword123' })
        .expect(401);
      expect(invalidPassword.body.message).toBe(unknownUser.body.message);
    } finally {
      await pool.query('DELETE FROM users WHERE email = $1', [email]);
    }
  });

  test('protected endpoints reject missing, invalid, expired, forged-role, and inactive-user tokens', async () => {
    const employee = await createUser({
      full_name: 'Token Security Employee',
      email: `token-security-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
    });

    try {
      await request(app).get('/api/tasks').expect(401);
      await request(app).get('/api/users').expect(401);
      await request(app).get('/api/auth/me').expect(401);
      await request(app)
        .get('/api/tasks')
        .set('Authorization', 'Bearer not-a-valid-token')
        .expect(401);

      const expiredToken = jwt.sign(
        { userId: employee.id, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: -1 }
      );
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      const forgedRoleToken = jwt.sign(
        { userId: employee.id, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${forgedRoleToken}`)
        .expect(403);

      const validLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: employee.email, password: 'Password123' })
        .expect(200);
      await pool.query('UPDATE users SET is_active = FALSE WHERE id = $1', [employee.id]);
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validLogin.body.data.token}`)
        .expect(401);
      await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${validLogin.body.data.token}`)
        .expect(401);
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [employee.id]);
    }
  });

  test('employees cannot assign tasks or use client-supplied identity and actor fields', async () => {
    const employee = await createUser({
      full_name: 'Authorization Employee',
      email: `authorization-employee-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
    });
    const otherEmployee = await createUser({
      full_name: 'Other Authorization Employee',
      email: `authorization-other-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
    });
    const admin = await createUser({
      full_name: 'Authorization Admin',
      email: `authorization-admin-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'admin',
    });
    let taskId;
    let otherTaskId;

    try {
      const employeeLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: employee.email, password: 'Password123' })
        .expect(200);
      const authorization = `Bearer ${employeeLogin.body.data.token}`;

      const created = await request(app)
        .post('/api/tasks')
        .set('Authorization', authorization)
        .send({
          title: 'Employee identity boundary',
          role: 'admin',
          created_by: admin.id,
          assignee_ids: [otherEmployee.id],
          assigned_by: otherEmployee.id,
        })
        .expect(201);
      taskId = created.body.data.id;
      expect(String(created.body.data.created_by)).toBe(String(employee.id));

      const assignments = await request(app)
        .get(`/api/tasks/${taskId}/assignments`)
        .set('Authorization', authorization)
        .expect(200);
      expect(assignments.body.data).toHaveLength(1);
      expect(String(assignments.body.data[0].user_id)).toBe(String(employee.id));
      expect(String(assignments.body.data[0].assigned_by)).toBe(String(employee.id));

      await request(app)
        .post(`/api/tasks/${taskId}/assignments`)
        .set('Authorization', authorization)
        .send({ assignee_ids: [otherEmployee.id] })
        .expect(403);

      await request(app)
        .patch(`/api/tasks/${taskId}/assignments/${assignments.body.data[0].id}/status`)
        .set('Authorization', authorization)
        .send({ status: 'in_progress', changed_by: admin.id })
        .expect(200);
      const history = await request(app)
        .get(`/api/tasks/${taskId}/history`)
        .set('Authorization', authorization)
        .expect(200);
      const statusEvent = history.body.data.find((entry) => entry.new_status === 'in_progress');
      expect(String(statusEvent.changed_by_id)).toBe(String(employee.id));

      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: admin.email, password: 'Password123' })
        .expect(200);
      const otherTask = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminLogin.body.data.token}`)
        .send({ title: 'Private task for authorization test' })
        .expect(201);
      otherTaskId = otherTask.body.data.id;

      await request(app)
        .get(`/api/tasks/${otherTaskId}`)
        .set('Authorization', authorization)
        .expect(403);
      await request(app)
        .patch(`/api/tasks/${otherTaskId}`)
        .set('Authorization', authorization)
        .send({ title: 'Unauthorized edit' })
        .expect(403);
    } finally {
      await cleanupTask(taskId);
      await cleanupTask(otherTaskId);
      await pool.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [
        [employee.id, otherEmployee.id, admin.id],
      ]);
    }
  });

  test('reassignment after revocation creates a new assignment and preserves the old record', async () => {
    const admin = await createUser({
      full_name: 'Reassignment Admin',
      email: `reassignment-admin-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'admin',
    });
    const employee = await createUser({
      full_name: 'Reassignment Employee',
      email: `reassignment-employee-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
    });
    let taskId;

    try {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: admin.email, password: 'Password123' })
        .expect(200);
      const authorization = `Bearer ${login.body.data.token}`;
      const task = await request(app)
        .post('/api/tasks')
        .set('Authorization', authorization)
        .send({ title: 'Reassignment history boundary' })
        .expect(201);
      taskId = task.body.data.id;

      const firstAssignment = await request(app)
        .post(`/api/tasks/${taskId}/assignments`)
        .set('Authorization', authorization)
        .send({ assignee_ids: [employee.id] })
        .expect(201);
      const previous = firstAssignment.body.data[0];

      await request(app)
        .patch(`/api/tasks/${taskId}/assignments/${previous.id}/revoke`)
        .set('Authorization', authorization)
        .send({ revoke_reason: 'Reassignment test' })
        .expect(200);

      const secondAssignment = await request(app)
        .post(`/api/tasks/${taskId}/assignments`)
        .set('Authorization', authorization)
        .send({ assignee_ids: [employee.id] })
        .expect(201);
      const current = secondAssignment.body.data[0];
      expect(String(current.id)).not.toBe(String(previous.id));

      const history = await request(app)
        .get(`/api/tasks/${taskId}/assignments`)
        .set('Authorization', authorization)
        .expect(200);
      expect(history.body.data).toHaveLength(2);
      expect(history.body.data.some((record) => (
        String(record.id) === String(previous.id) && record.assignment_status === 'revoked'
      ))).toBe(true);
      expect(history.body.data.some((record) => (
        String(record.id) === String(current.id) && record.assignment_status === 'active'
      ))).toBe(true);
    } finally {
      await cleanupTask(taskId);
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [admin.id, employee.id]);
    }
  });

  test('authentication endpoints enforce the configured request rate limit', async () => {
    const responses = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      responses.push(await request(app).post('/api/auth/login').send({}));
    }

    expect(responses.some((response) => response.status === 429)).toBe(true);
    expect(responses[responses.length - 1].status).toBe(429);
    expect(responses[responses.length - 1].body.message).toMatch(/too many requests/i);
  });
});
