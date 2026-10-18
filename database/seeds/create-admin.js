const path = require('path');
if (!process.env.DB_NAME && !process.env.DATABASE_URL) {
  require(path.join(__dirname, '../../backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../../backend/.env') });
}
const pool = require(path.join(__dirname, '../../backend/src/database/connection'));
const bcrypt = require(path.join(__dirname, '../../backend/node_modules/bcrypt'));

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'System Administrator';

  if (!email || !password) {
    console.error('ERROR: ADMIN_EMAIL and ADMIN_PASSWORD env vars are required.');
    console.error('Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=SecurePass123 node database/seeds/create-admin.js');
    process.exit(1);
  }

  const passwordLength = Buffer.byteLength(password, 'utf8');
  if (passwordLength < 8 || passwordLength > 72) {
    console.error('ERROR: ADMIN_PASSWORD must be between 8 and 72 UTF-8 bytes.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (rows.length > 0) {
      console.log(`Admin with email ${email} already exists (id=${rows[0].id}). No changes made.`);
      return;
    }
    const hash = await bcrypt.hash(password, 12);
    const result = await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'admin', TRUE)
       RETURNING id, email, role`,
      [name, email, hash]
    );
    console.log('Admin created successfully:', result.rows[0]);
  } finally {
    client.release();
    await pool.end();
  }
}

createAdmin().catch(err => {
  console.error('Error creating admin:', err.message);
  process.exit(1);
});
