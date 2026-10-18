const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const pool = require('../src/database/connection');

function makeUniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function createUser({ full_name, email, password, role = 'employee', is_active = true }) {
  const password_hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, full_name, email, role, is_active`,
    [full_name, email, password_hash, role, is_active]
  );
  return rows[0];
}

describe('Task Management API core flows', () => {
  test('does not expose the unused starter product API', async () => {
    const response = await request(app).get('/api/products').expect(404);
    expect(response.body.message).toBe('Route not found');
  });

  test('health endpoint verifies the database connection', async () => {
    const health = await request(app).get('/api/health').expect(200);
    expect(health.body.status).toBe('success');
    expect(health.body.message).toMatch(/database are healthy/i);
  });

  test('rejects passwords that exceed the bcrypt input limit', async () => {
    const email = `long-password-${makeUniqueSuffix()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ full_name: 'Long Password User', email, password: 'a'.repeat(73) })
      .expect(422);

    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    expect(rows).toHaveLength(0);
  });

  test('returns a payload-too-large response instead of an internal server error', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(`{"email":"${'a'.repeat(1024 * 1024)}","password":"password"}`)
      .expect(413);

    expect(response.body.message).toBe('Request body is too large');
  });

  test('register then login succeeds and duplicate email is rejected', async () => {
    const email = `register-${makeUniqueSuffix()}@example.com`;
    const password = 'Password123';

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ full_name: 'Register User', email, password })
      .expect(201);

    expect(registerRes.body.status).toBe('success');
    expect(registerRes.body.data.user.email).toBe(email);
    expect(registerRes.body.data.token).toBeTruthy();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    expect(loginRes.body.data.user.email).toBe(email);
    expect(loginRes.body.data.token).toBeTruthy();

    await request(app)
      .get('/api/tasks/not-a-number')
      .set('Authorization', `Bearer ${loginRes.body.data.token}`)
      .expect(422);
    await request(app)
      .get('/api/tasks?limit=1000')
      .set('Authorization', `Bearer ${loginRes.body.data.token}`)
      .expect(422);

    const dupRes = await request(app)
      .post('/api/auth/register')
      .send({ full_name: 'Duplicate User', email, password })
      .expect(409);

    expect(dupRes.body.message).toMatch(/already registered|already/i);

    await pool.query('DELETE FROM users WHERE email = $1', [email]);
  });

  test('concurrent registrations with the same email return one conflict instead of a server error', async () => {
    const email = `register-race-${makeUniqueSuffix()}@example.com`;

    try {
      const responses = await Promise.all([
        request(app)
          .post('/api/auth/register')
          .send({ full_name: 'Concurrent User One', email, password: 'Password123' }),
        request(app)
          .post('/api/auth/register')
          .send({ full_name: 'Concurrent User Two', email, password: 'Password123' }),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    } finally {
      await pool.query('DELETE FROM users WHERE email = $1', [email]);
    }
  });

  test('employee created task is auto-assigned to the creator', async () => {
    const email = `task-auto-${makeUniqueSuffix()}@example.com`;
    const employee = await createUser({
      full_name: 'Self Assigned Employee',
      email,
      password: 'Password123',
      role: 'employee',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Password123' })
      .expect(200);

    const token = loginRes.body.data.token;
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Auto Assign Task',
        description: 'Employee-created task should assign itself',
        priority: 'medium',
      })
      .expect(201);

    const taskId = taskRes.body.data.id;
    const assignmentsRes = await request(app)
      .get(`/api/tasks/${taskId}/assignments`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(assignmentsRes.body.data.some((assignment) => assignment.user_id === employee.id && assignment.assignment_status === 'active')).toBe(true);

    await pool.query('DELETE FROM task_status_history WHERE assignment_id IN (SELECT id FROM task_assignments WHERE task_id = $1)', [taskId]);
    await pool.query('DELETE FROM task_assignments WHERE task_id = $1', [taskId]);
    await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    await pool.query('DELETE FROM users WHERE id = $1', [employee.id]);
  });

  test('admin can inspect users, employee cannot', async () => {
    const admin = await createUser({
      full_name: 'Admin List User',
      email: `admin-list-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'admin',
    });
    const employee = await createUser({
      full_name: 'Employee List User',
      email: `employee-list-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'employee',
    });

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'Password123' })
      .expect(200);

    const employeeLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: employee.email, password: 'Password123' })
      .expect(200);

    const adminList = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminLogin.body.data.token}`)
      .expect(200);

    const employeeList = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${employeeLogin.body.data.token}`)
      .expect(403);

    expect(adminList.body.data.length).toBeGreaterThanOrEqual(2);
    expect(employeeList.body.message).toMatch(/permission|denied|access/i);

    await request(app)
      .patch(`/api/users/${admin.id}/status`)
      .set('Authorization', `Bearer ${adminLogin.body.data.token}`)
      .send({ is_active: false })
      .expect(403);

    await request(app)
      .patch(`/api/users/${employee.id}/status`)
      .set('Authorization', `Bearer ${adminLogin.body.data.token}`)
      .send({ is_active: false })
      .expect(200);
    await request(app)
      .patch(`/api/users/${employee.id}/status`)
      .set('Authorization', `Bearer ${adminLogin.body.data.token}`)
      .send({ is_active: true })
      .expect(200);

    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [admin.id, employee.id]);
  });

  test('assignment status updates record history and the task becomes completed', async () => {
    const admin = await createUser({
      full_name: 'Admin Status User',
      email: `admin-status-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'admin',
    });
    const employee = await createUser({
      full_name: 'Employee Status User',
      email: `emp-status-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'employee',
    });

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: 'Password123' })
      .expect(200);

    const employeeLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: employee.email, password: 'Password123' })
      .expect(200);

    const createTaskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminLogin.body.data.token}`)
      .send({
        title: 'Status tracking task',
        description: 'Follow assignment status and history',
        priority: 'low',
        assignee_ids: [employee.id],
      })
      .expect(201);

    const taskId = createTaskRes.body.data.id;
    const assignment = await pool.query(
      'SELECT id FROM task_assignments WHERE task_id = $1 AND user_id = $2 AND assignment_status = $3',
      [taskId, employee.id, 'active']
    );
    const assignmentId = assignment.rows[0].id;

    const inProgressRes = await request(app)
      .patch(`/api/tasks/${taskId}/assignments/${assignmentId}/status`)
      .set('Authorization', `Bearer ${employeeLogin.body.data.token}`)
      .send({ status: 'in_progress', note: 'Started working' })
      .expect(200);

    expect(inProgressRes.body.data.status).toBe('in_progress');

    const completionRes = await request(app)
      .patch(`/api/tasks/${taskId}/assignments/${assignmentId}/status`)
      .set('Authorization', `Bearer ${employeeLogin.body.data.token}`)
      .send({ status: 'completed', note: 'Finished the task' })
      .expect(200);

    expect(completionRes.body.data.status).toBe('completed');

    const historyRes = await request(app)
      .get(`/api/tasks/${taskId}/history`)
      .set('Authorization', `Bearer ${employeeLogin.body.data.token}`)
      .expect(200);

    expect(historyRes.body.data.some((item) => item.assignment_id === assignmentId && item.new_status === 'completed')).toBe(true);

    await pool.query('DELETE FROM task_status_history WHERE assignment_id = $1', [assignmentId]);
    await pool.query('DELETE FROM task_assignments WHERE id = $1', [assignmentId]);
    await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [admin.id, employee.id]);
  });

  test('overall task status reflects active assignments, revocation, reassignment, and soft deletion', async () => {
    const admin = await createUser({
      full_name: 'Overall Status Admin',
      email: `overall-admin-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'admin',
    });
    const employees = await Promise.all([1, 2].map((number) => createUser({
      full_name: `Overall Status Employee ${number}`,
      email: `overall-employee-${number}-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
    })));
    let taskId;

    try {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: admin.email, password: 'Password123' })
        .expect(200);
      const auth = { Authorization: 'Bearer ' + login.body.data.token };

      const created = await request(app)
        .post('/api/tasks')
        .set(auth)
        .send({ title: 'Overall status edge cases', priority: 'medium' })
        .expect(201);
      taskId = created.body.data.id;

      const readStatus = async () => {
        const response = await request(app).get(`/api/tasks/${taskId}`).set(auth).expect(200);
        return response.body.data.overall_status;
      };
      expect(await readStatus()).toBe('unassigned');

      const assigned = await request(app)
        .post(`/api/tasks/${taskId}/assignments`)
        .set(auth)
        .send({ assignee_ids: employees.map((employee) => employee.id) })
        .expect(201);
      const [first, second] = assigned.body.data;
      expect(await readStatus()).toBe('todo');

      const setStatus = (assignment, status) => request(app)
        .patch(`/api/tasks/${taskId}/assignments/${assignment.id}/status`)
        .set(auth)
        .send({ status })
        .expect(200);
      const revoke = (assignment) => request(app)
        .patch(`/api/tasks/${taskId}/assignments/${assignment.id}/revoke`)
        .set(auth)
        .send({ revoke_reason: 'Status regression test' })
        .expect(200);

      await setStatus(first, 'in_progress');
      expect(await readStatus()).toBe('in_progress');
      await setStatus(first, 'completed');
      expect(await readStatus()).toBe('in_progress');
      await setStatus(second, 'in_progress');
      await setStatus(second, 'completed');
      expect(await readStatus()).toBe('completed');
      await request(app)
        .patch(`/api/users/${employees[1].id}/status`)
        .set(auth)
        .send({ is_active: false })
        .expect(200);
      expect(await readStatus()).toBe('completed');
      await request(app)
        .patch(`/api/users/${employees[1].id}/status`)
        .set(auth)
        .send({ is_active: true })
        .expect(200);
      await setStatus(first, 'in_progress');
      expect(await readStatus()).toBe('in_progress');

      await revoke(first);
      expect(await readStatus()).toBe('completed');
      await revoke(second);
      expect(await readStatus()).toBe('unassigned');

      const reassigned = await request(app)
        .post(`/api/tasks/${taskId}/assignments`)
        .set(auth)
        .send({ assignee_ids: [employees[0].id] })
        .expect(201);
      expect(String(reassigned.body.data[0].id)).not.toBe(String(first.id));
      expect(await readStatus()).toBe('todo');

      await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set(auth)
        .send({ content: 'Keep this comment with the task history.' })
        .expect(201);
      await request(app).delete(`/api/tasks/${taskId}`).set(auth).expect(200);

      const retained = await pool.query(
        `SELECT t.deleted_at,
                (SELECT COUNT(*) FROM task_assignments WHERE task_id = t.id) AS assignment_count,
                (SELECT COUNT(*) FROM task_status_history h
                 JOIN task_assignments a ON a.id = h.assignment_id
                 WHERE a.task_id = t.id) AS history_count,
                (SELECT COUNT(*) FROM task_comments WHERE task_id = t.id) AS comment_count
         FROM tasks t
         WHERE t.id = $1`,
        [taskId]
      );
      expect(retained.rows[0].deleted_at).not.toBeNull();
      expect(Number(retained.rows[0].assignment_count)).toBe(3);
      expect(Number(retained.rows[0].history_count)).toBeGreaterThan(0);
      expect(Number(retained.rows[0].comment_count)).toBe(1);
      await request(app).get(`/api/tasks/${taskId}`).set(auth).expect(404);
    } finally {
      if (taskId) {
        await pool.query(
          'DELETE FROM task_status_history WHERE assignment_id IN (SELECT id FROM task_assignments WHERE task_id = $1)',
          [taskId]
        );
        await pool.query('DELETE FROM task_assignments WHERE task_id = $1', [taskId]);
        await pool.query('DELETE FROM task_comments WHERE task_id = $1', [taskId]);
        await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
      }
      await pool.query('DELETE FROM users WHERE id = $1 OR id = ANY($2::bigint[])', [
        admin.id,
        employees.map((employee) => employee.id),
      ]);
    }
  });

  test('task detail workflows support editing, assignments, comments, and history', async () => {
    const admin = await createUser({
      full_name: 'Task Detail Admin',
      email: `detail-admin-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'admin',
    });
    const employee = await createUser({
      full_name: 'Task Detail Employee',
      email: `detail-employee-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
    });
    let taskId;

    try {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: admin.email, password: 'Password123' })
        .expect(200);
      const auth = { Authorization: 'Bearer ' + login.body.data.token };

      const created = await request(app)
        .post('/api/tasks')
        .set(auth)
        .send({ title: 'Task details', description: 'Initial description', priority: 'low' })
        .expect(201);
      taskId = created.body.data.id;

      const assignmentResponse = await request(app)
        .post(`/api/tasks/${taskId}/assignments`)
        .set(auth)
        .send({ assignee_ids: [employee.id] })
        .expect(201);
      expect(assignmentResponse.body.data).toHaveLength(1);
      expect(String(assignmentResponse.body.data[0].user_id)).toBe(String(employee.id));

      const updated = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set(auth)
        .send({ title: 'Updated task details', priority: 'high' })
        .expect(200);
      expect(updated.body.data.title).toBe('Updated task details');
      expect(updated.body.data.priority).toBe('high');

      await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set(auth)
        .send({ content: 'Task detail discussion' })
        .expect(201);

      const [assignments, comments, history] = await Promise.all([
        request(app).get(`/api/tasks/${taskId}/assignments`).set(auth).expect(200),
        request(app).get(`/api/tasks/${taskId}/comments`).set(auth).expect(200),
        request(app).get(`/api/tasks/${taskId}/history`).set(auth).expect(200),
      ]);

      expect(assignments.body.data).toHaveLength(1);
      expect(comments.body.data.some((comment) => comment.content === 'Task detail discussion')).toBe(true);
      expect(comments.body.data[0]).not.toHaveProperty('author_email');
      expect(history.body.data.some((entry) => entry.new_status === 'todo')).toBe(true);
    } finally {
      if (taskId) {
        await pool.query('DELETE FROM task_comments WHERE task_id = $1', [taskId]);
        await pool.query(
          'DELETE FROM task_status_history WHERE assignment_id IN (SELECT id FROM task_assignments WHERE task_id = $1)',
          [taskId]
        );
        await pool.query('DELETE FROM task_assignments WHERE task_id = $1', [taskId]);
        await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
      }
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [admin.id, employee.id]);
    }
  });

  test('concurrent assignment requests return a conflict without creating duplicates', async () => {
    const admin = await createUser({
      full_name: 'Concurrent Assignment Admin',
      email: `concurrent-assignment-admin-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'admin',
    });
    const employee = await createUser({
      full_name: 'Concurrent Assignment Employee',
      email: `concurrent-assignment-employee-${makeUniqueSuffix()}@example.com`,
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
        .send({ title: 'Concurrent assignment task' })
        .expect(201);
      taskId = task.body.data.id;

      const responses = await Promise.all([
        request(app)
          .post(`/api/tasks/${taskId}/assignments`)
          .set('Authorization', authorization)
          .send({ assignee_ids: [employee.id] }),
        request(app)
          .post(`/api/tasks/${taskId}/assignments`)
          .set('Authorization', authorization)
          .send({ assignee_ids: [employee.id] }),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
      const assignments = await pool.query(
        `SELECT id FROM task_assignments
         WHERE task_id = $1 AND user_id = $2 AND assignment_status = 'active'`,
        [taskId, employee.id]
      );
      expect(assignments.rows).toHaveLength(1);
    } finally {
      if (taskId) {
        await pool.query(
          'DELETE FROM task_status_history WHERE assignment_id IN (SELECT id FROM task_assignments WHERE task_id = $1)',
          [taskId]
        );
        await pool.query('DELETE FROM task_assignments WHERE task_id = $1', [taskId]);
        await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
      }
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [admin.id, employee.id]);
    }
  });

  test('assignment creation rechecks task and assignee state after concurrent updates', async () => {
    const admin = await createUser({
      full_name: 'Assignment Race Admin',
      email: `assignment-race-admin-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'admin',
    });
    const employee = await createUser({
      full_name: 'Assignment Race Employee',
      email: `assignment-race-employee-${makeUniqueSuffix()}@example.com`,
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
        .send({ title: 'Assignment race task' })
        .expect(201);
      taskId = task.body.data.id;

      const taskDeleteClient = await pool.connect();
      try {
        await taskDeleteClient.query('BEGIN');
        await taskDeleteClient.query(
          'UPDATE tasks SET deleted_at = NOW() WHERE id = $1',
          [taskId]
        );
        const assignToDeletedTask = request(app)
          .post(`/api/tasks/${taskId}/assignments`)
          .set('Authorization', authorization)
          .send({ assignee_ids: [employee.id] });
        await new Promise((resolve) => setTimeout(resolve, 100));
        await taskDeleteClient.query('COMMIT');

        const response = await assignToDeletedTask;
        expect(response.status).toBe(404);
      } finally {
        await taskDeleteClient.query('ROLLBACK');
        taskDeleteClient.release();
      }

      await pool.query('UPDATE tasks SET deleted_at = NULL WHERE id = $1', [taskId]);

      const userStatusClient = await pool.connect();
      try {
        await userStatusClient.query('BEGIN');
        await userStatusClient.query(
          'UPDATE users SET is_active = FALSE WHERE id = $1',
          [employee.id]
        );
        const assignToInactiveUser = request(app)
          .post(`/api/tasks/${taskId}/assignments`)
          .set('Authorization', authorization)
          .send({ assignee_ids: [employee.id] });
        await new Promise((resolve) => setTimeout(resolve, 100));
        await userStatusClient.query('COMMIT');

        const response = await assignToInactiveUser;
        expect(response.status).toBe(404);
      } finally {
        await userStatusClient.query('ROLLBACK');
        userStatusClient.release();
      }

      const assignments = await pool.query(
        `SELECT id FROM task_assignments
         WHERE task_id = $1 AND user_id = $2 AND assignment_status = 'active'`,
        [taskId, employee.id]
      );
      expect(assignments.rows).toHaveLength(0);
    } finally {
      if (taskId) {
        await pool.query(
          'DELETE FROM task_status_history WHERE assignment_id IN (SELECT id FROM task_assignments WHERE task_id = $1)',
          [taskId]
        );
        await pool.query('DELETE FROM task_assignments WHERE task_id = $1', [taskId]);
        await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
      }
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [admin.id, employee.id]);
    }
  });

  test('task creation rejects duplicate and inactive assignees without leaving partial tasks', async () => {
    const admin = await createUser({
      full_name: 'Assignment Validation Admin',
      email: `assignment-validation-admin-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'admin',
    });
    const inactiveEmployee = await createUser({
      full_name: 'Inactive Assignee',
      email: `inactive-assignee-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      is_active: false,
    });

    try {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: admin.email, password: 'Password123' })
        .expect(200);
      const authorization = `Bearer ${login.body.data.token}`;

      await request(app)
        .post('/api/tasks')
        .set('Authorization', authorization)
        .send({ title: 'Reject inactive assignee', assignee_ids: [inactiveEmployee.id] })
        .expect(404);
      await request(app)
        .post('/api/tasks')
        .set('Authorization', authorization)
        .send({ title: 'Reject duplicate assignee', assignee_ids: [admin.id, admin.id] })
        .expect(400);

      const remaining = await pool.query(
        `SELECT id FROM tasks WHERE title IN ('Reject inactive assignee', 'Reject duplicate assignee')`
      );
      expect(remaining.rows).toHaveLength(0);
    } finally {
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [admin.id, inactiveEmployee.id]);
    }
  });

  test('database rejects inconsistent completion and revocation metadata', async () => {
    const admin = await createUser({
      full_name: 'Assignment Constraint Admin',
      email: `assignment-constraint-admin-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'admin',
    });
    const employee = await createUser({
      full_name: 'Assignment Constraint Employee',
      email: `assignment-constraint-employee-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
    });
    let taskId;
    let assignmentId;

    try {
      const task = await pool.query(
        'INSERT INTO tasks (title, created_by) VALUES ($1, $2) RETURNING id',
        ['Assignment metadata constraints', admin.id]
      );
      taskId = task.rows[0].id;
      const assignment = await pool.query(
        `INSERT INTO task_assignments (task_id, user_id, assigned_by)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [taskId, employee.id, admin.id]
      );
      assignmentId = assignment.rows[0].id;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SAVEPOINT completion_metadata');
        let completionError;
        try {
          await client.query(
            'UPDATE task_assignments SET completed_at = NOW() WHERE id = $1',
            [assignmentId]
          );
        } catch (error) {
          completionError = error;
        }
        expect(completionError?.constraint).toBe('chk_completed_at_consistency');
        await client.query('ROLLBACK TO SAVEPOINT completion_metadata');

        await client.query('SAVEPOINT revocation_metadata');
        let revocationError;
        try {
          await client.query(
            'UPDATE task_assignments SET revoked_at = NOW() WHERE id = $1',
            [assignmentId]
          );
        } catch (error) {
          revocationError = error;
        }
        expect(revocationError?.constraint).toBe('chk_revoked_fields_consistency');
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    } finally {
      if (taskId) {
        await pool.query('DELETE FROM task_assignments WHERE task_id = $1', [taskId]);
        await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
      }
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [admin.id, employee.id]);
    }
  });

  test('employees cannot edit or delete their comments after task access is revoked', async () => {
    const admin = await createUser({
      full_name: 'Comment Access Admin',
      email: `comment-access-admin-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'admin',
    });
    const employee = await createUser({
      full_name: 'Comment Access Employee',
      email: `comment-access-employee-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
    });
    let taskId;
    let assignmentId;

    try {
      const [adminLogin, employeeLogin] = await Promise.all([
        request(app).post('/api/auth/login').send({ email: admin.email, password: 'Password123' }),
        request(app).post('/api/auth/login').send({ email: employee.email, password: 'Password123' }),
      ]);
      const adminAuth = `Bearer ${adminLogin.body.data.token}`;
      const employeeAuth = `Bearer ${employeeLogin.body.data.token}`;

      const created = await request(app)
        .post('/api/tasks')
        .set('Authorization', adminAuth)
        .send({ title: 'Comment access control', assignee_ids: [employee.id] })
        .expect(201);
      taskId = created.body.data.id;
      const assignment = await pool.query(
        'SELECT id FROM task_assignments WHERE task_id = $1 AND user_id = $2 AND assignment_status = $3',
        [taskId, employee.id, 'active']
      );
      assignmentId = assignment.rows[0].id;

      const comment = await request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set('Authorization', employeeAuth)
        .send({ content: 'Comment before access revocation' })
        .expect(201);

      const revokeClient = await pool.connect();
      try {
        await revokeClient.query('BEGIN');
        await revokeClient.query(
          `UPDATE task_assignments
           SET assignment_status = 'revoked', revoked_at = NOW(), revoked_by = $2
           WHERE id = $1`,
          [assignmentId, admin.id]
        );
        const concurrentEdit = request(app)
          .patch(`/api/tasks/${taskId}/comments/${comment.body.data.id}`)
          .set('Authorization', employeeAuth)
          .send({ content: 'Edit during access revocation' });
        await new Promise((resolve) => setTimeout(resolve, 100));
        await revokeClient.query('COMMIT');

        const response = await concurrentEdit;
        expect(response.status).toBe(403);
      } finally {
        await revokeClient.query('ROLLBACK');
        revokeClient.release();
      }
      await pool.query(
        `UPDATE task_assignments
         SET assignment_status = 'active', revoked_at = NULL, revoked_by = NULL
         WHERE id = $1`,
        [assignmentId]
      );

      await request(app)
        .patch(`/api/tasks/${taskId}/assignments/${assignmentId}/revoke`)
        .set('Authorization', adminAuth)
        .send({ revoke_reason: 'Access revoked for authorization test' })
        .expect(200);

      await request(app)
        .patch(`/api/tasks/${taskId}/comments/${comment.body.data.id}`)
        .set('Authorization', employeeAuth)
        .send({ content: 'Unauthorized edit' })
        .expect(403);
      await request(app)
        .delete(`/api/tasks/${taskId}/comments/${comment.body.data.id}`)
        .set('Authorization', employeeAuth)
        .expect(403);
    } finally {
      if (taskId) {
        await pool.query('DELETE FROM task_comments WHERE task_id = $1', [taskId]);
        await pool.query(
          'DELETE FROM task_status_history WHERE assignment_id IN (SELECT id FROM task_assignments WHERE task_id = $1)',
          [taskId]
        );
        await pool.query('DELETE FROM task_assignments WHERE task_id = $1', [taskId]);
        await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
      }
      await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [admin.id, employee.id]);
    }
  });

  test('date-only due-before filters include tasks due later on that date', async () => {
    const admin = await createUser({
      full_name: 'Due Date Filter Admin',
      email: `due-date-filter-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'admin',
    });
    const taskTitle = `Due date boundary ${makeUniqueSuffix()}`;

    try {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: admin.email, password: 'Password123' })
        .expect(200);
      const authorization = `Bearer ${login.body.data.token}`;
      const { rows: tasks } = await pool.query(
        `INSERT INTO tasks (title, created_by, due_date)
         VALUES ($1, $2, '2030-06-15T12:00:00Z'),
                ($1, $2, '2030-06-16T12:00:00Z')
         RETURNING id`,
        [taskTitle, admin.id]
      );

      const response = await request(app)
        .get('/api/tasks')
        .query({ search: taskTitle, due_before: '2030-06-15' })
        .set('Authorization', authorization)
        .expect(200);

      expect(response.body.data.map((task) => String(task.id))).toEqual([String(tasks[0].id)]);
    } finally {
      await pool.query('DELETE FROM tasks WHERE title = $1', [taskTitle]);
      await pool.query('DELETE FROM users WHERE id = $1', [admin.id]);
    }
  });

  test('nested task endpoints return not found for deleted tasks', async () => {
    const admin = await createUser({
      full_name: 'Deleted Task Admin',
      email: `deleted-task-admin-${makeUniqueSuffix()}@example.com`,
      password: 'Password123',
      role: 'admin',
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
        .send({ title: 'Deleted nested task' })
        .expect(201);
      taskId = task.body.data.id;

      await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', authorization)
        .expect(200);
      await request(app)
        .get(`/api/tasks/${taskId}/assignments`)
        .set('Authorization', authorization)
        .expect(404);
      await request(app)
        .get(`/api/tasks/${taskId}/history`)
        .set('Authorization', authorization)
        .expect(404);
      await request(app)
        .get(`/api/tasks/${taskId}/comments`)
        .set('Authorization', authorization)
        .expect(404);
    } finally {
      if (taskId) {
        await pool.query('DELETE FROM task_comments WHERE task_id = $1', [taskId]);
        await pool.query(
          'DELETE FROM task_status_history WHERE assignment_id IN (SELECT id FROM task_assignments WHERE task_id = $1)',
          [taskId]
        );
        await pool.query('DELETE FROM task_assignments WHERE task_id = $1', [taskId]);
        await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
      }
      await pool.query('DELETE FROM users WHERE id = $1', [admin.id]);
    }
  });
});
