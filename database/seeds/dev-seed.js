const path = require('path');
if (!process.env.DB_NAME && !process.env.DATABASE_URL) {
  require(path.join(__dirname, '../../backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../../backend/.env') });
}
const bcrypt = require(path.join(__dirname, '../../backend/node_modules/bcrypt'));

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development seed data is disabled in production.');
  }
  const adminEmail = process.env.DEV_ADMIN_EMAIL;
  const adminPassword = process.env.DEV_ADMIN_PASSWORD;
  const employeePassword = process.env.DEV_EMPLOYEE_PASSWORD;
  if (!adminEmail || !adminPassword || !employeePassword) {
    throw new Error('DEV_ADMIN_EMAIL, DEV_ADMIN_PASSWORD, and DEV_EMPLOYEE_PASSWORD are required.');
  }
  const passwordLengths = [adminPassword, employeePassword].map((password) => Buffer.byteLength(password, 'utf8'));
  if (passwordLengths.some((length) => length < 8 || length > 72)) {
    throw new Error('Development seed passwords must be between 8 and 72 UTF-8 bytes.');
  }

  const pool = require(path.join(__dirname, '../../backend/src/database/connection'));
  const client = await pool.connect();
  try {
    console.log('Seeding development data...');
    const devPassword = await bcrypt.hash(employeePassword, 12);

    // Create admin if not exists
    let adminId;
    const existingAdmin = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existingAdmin.rows.length === 0) {
      const adminHash = await bcrypt.hash(adminPassword, 12);
      const r = await client.query(
        `INSERT INTO users(full_name,email,password_hash,role) VALUES('Dev Admin',$1,$2,'admin') RETURNING id`,
        [adminEmail, adminHash]
      );
      adminId = r.rows[0].id;
      console.log('Created dev admin:', adminId);
    } else {
      adminId = existingAdmin.rows[0].id;
      console.log('Dev admin exists:', adminId);
    }

    // Create employees
    const employees = [
      { name: 'Alice Nguyen', email: 'alice@taskmanager.dev' },
      { name: 'Bob Tran', email: 'bob@taskmanager.dev' },
      { name: 'Carol Le', email: 'carol@taskmanager.dev' },
    ];
    const empIds = [];
    for (const emp of employees) {
      const ex = await client.query('SELECT id FROM users WHERE email=$1', [emp.email]);
      if (ex.rows.length === 0) {
        const r = await client.query(
          `INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,'employee') RETURNING id`,
          [emp.name, emp.email, devPassword]
        );
        empIds.push(r.rows[0].id);
      } else {
        empIds.push(ex.rows[0].id);
      }
    }
    console.log('Employee IDs:', empIds);

    const now = new Date();
    const future = (days) => new Date(now.getTime() + days * 86400000).toISOString();
    const past = (days) => new Date(now.getTime() - days * 86400000).toISOString();

    // Task 1: Multi-assigned to Alice and Bob, different statuses
    let taskId;
    const t1 = await client.query(
      `INSERT INTO tasks(title,description,priority,due_date,created_by)
       VALUES('Build REST API','Implement all REST endpoints for the task management system','high',$1,$2)
       RETURNING id`,
      [future(7), adminId]
    );
    taskId = t1.rows[0].id;

    // Assign Alice as in_progress
    const a1 = await client.query(
      `INSERT INTO task_assignments(task_id,user_id,assigned_by,status,assignment_status)
       VALUES($1,$2,$3,'in_progress','active') RETURNING id`,
      [taskId, empIds[0], adminId]
    );
    await client.query(
      `INSERT INTO task_status_history(assignment_id,changed_by,old_status,new_status,note)
       VALUES($1,$2,NULL,'todo','Initial assignment')`,
      [a1.rows[0].id, adminId]
    );
    await client.query(
      `INSERT INTO task_status_history(assignment_id,changed_by,old_status,new_status,note)
       VALUES($1,$2,'todo','in_progress','Started working')`,
      [a1.rows[0].id, empIds[0]]
    );

    // Assign Bob as todo
    const a2 = await client.query(
      `INSERT INTO task_assignments(task_id,user_id,assigned_by,status,assignment_status)
       VALUES($1,$2,$3,'todo','active') RETURNING id`,
      [taskId, empIds[1], adminId]
    );
    await client.query(
      `INSERT INTO task_status_history(assignment_id,changed_by,old_status,new_status,note)
       VALUES($1,$2,NULL,'todo','Initial assignment')`,
      [a2.rows[0].id, adminId]
    );

    // Task 2: Completed by Carol
    const t2 = await client.query(
      `INSERT INTO tasks(title,description,priority,due_date,created_by)
       VALUES('Design Database Schema','Create ERD and write SQL migrations','medium',$1,$2)
       RETURNING id`,
      [past(2), adminId]
    );
    const a3 = await client.query(
      `INSERT INTO task_assignments(task_id,user_id,assigned_by,status,assignment_status,completed_at)
       VALUES($1,$2,$3,'completed','active',NOW()) RETURNING id`,
      [t2.rows[0].id, empIds[2], adminId]
    );
    await client.query(
      `INSERT INTO task_status_history(assignment_id,changed_by,old_status,new_status)
       VALUES($1,$2,NULL,'todo')`,
      [a3.rows[0].id, adminId]
    );
    await client.query(
      `INSERT INTO task_status_history(assignment_id,changed_by,old_status,new_status)
       VALUES($1,$2,'todo','in_progress')`,
      [a3.rows[0].id, empIds[2]]
    );
    await client.query(
      `INSERT INTO task_status_history(assignment_id,changed_by,old_status,new_status,note)
       VALUES($1,$2,'in_progress','completed','All done!')`,
      [a3.rows[0].id, empIds[2]]
    );

    // Task 3: Revoked assignment then reassigned (demonstrates history preservation)
    const t3 = await client.query(
      `INSERT INTO tasks(title,description,priority,due_date,created_by)
       VALUES('Write Unit Tests','Add Jest tests for all API endpoints','medium',$1,$2)
       RETURNING id`,
      [future(14), adminId]
    );
    // Revoke Alice's first assignment
    const a4 = await client.query(
      `INSERT INTO task_assignments(task_id,user_id,assigned_by,status,assignment_status,revoked_at,revoked_by,revoke_reason)
       VALUES($1,$2,$3,'todo','revoked',NOW(),$3,'Reassigned to Bob due to workload') RETURNING id`,
      [t3.rows[0].id, empIds[0], adminId]
    );
    await client.query(
      `INSERT INTO task_status_history(assignment_id,changed_by,old_status,new_status,note)
       VALUES($1,$2,NULL,'todo','Initial assignment (later revoked)')`,
      [a4.rows[0].id, adminId]
    );
    // New active assignment to Bob
    const a5 = await client.query(
      `INSERT INTO task_assignments(task_id,user_id,assigned_by,status,assignment_status)
       VALUES($1,$2,$3,'todo','active') RETURNING id`,
      [t3.rows[0].id, empIds[1], adminId]
    );
    await client.query(
      `INSERT INTO task_status_history(assignment_id,changed_by,old_status,new_status,note)
       VALUES($1,$2,NULL,'todo','Reassigned from Alice')`,
      [a5.rows[0].id, adminId]
    );

    // Task 4: Unassigned (admin created, no assignee)
    await client.query(
      `INSERT INTO tasks(title,description,priority,due_date,created_by)
       VALUES('Setup CI/CD Pipeline','Configure GitHub Actions for automated testing and deployment','low',$1,$2)
       RETURNING id`,
      [future(30), adminId]
    );

    // Task 5: Employee-created (auto-assigned to themselves)
    const t5 = await client.query(
      `INSERT INTO tasks(title,description,priority,created_by)
       VALUES('Review pull requests','Daily code review task','low',$1)
       RETURNING id`,
      [empIds[0]]
    );
    const a6 = await client.query(
      `INSERT INTO task_assignments(task_id,user_id,assigned_by,status,assignment_status)
       VALUES($1,$2,$2,'todo','active') RETURNING id`,
      [t5.rows[0].id, empIds[0]]
    );
    await client.query(
      `INSERT INTO task_status_history(assignment_id,changed_by,old_status,new_status,note)
       VALUES($1,$2,NULL,'todo','Auto-assigned on task creation')`,
      [a6.rows[0].id, empIds[0]]
    );

    // Comments
    await client.query(
      `INSERT INTO task_comments(task_id,user_id,content) VALUES($1,$2,$3)`,
      [t1.rows[0].id, empIds[0], 'Starting on the authentication endpoints first.']
    );
    await client.query(
      `INSERT INTO task_comments(task_id,user_id,content) VALUES($1,$2,$3)`,
      [t1.rows[0].id, empIds[1], 'I will handle the task CRUD endpoints.']
    );
    await client.query(
      `INSERT INTO task_comments(task_id,user_id,content) VALUES($1,$2,$3)`,
      [t1.rows[0].id, adminId, 'Great progress team! Please finish by end of week.']
    );

    console.log('Development seed completed successfully!');
    console.log('Development accounts created; use the credentials supplied through DEV_* environment variables.');
  } catch(err) {
    console.error('Seed error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
