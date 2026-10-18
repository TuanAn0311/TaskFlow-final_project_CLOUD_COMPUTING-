// Run via: npm run migrate (from backend/ directory)
// node_modules are resolved from backend/ because npm scripts set that as CWD
const path = require('path');
const fs = require('fs');

// Load env if not already loaded (supports both --require dotenv/config and direct run)
if (!process.env.DB_NAME && !process.env.DATABASE_URL) {
  require(path.join(__dirname, '../backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../backend/.env') });
}

const pool = require(path.join(__dirname, '../backend/src/database/connection'));

async function migrate() {
  const client = await pool.connect();
  let lockAcquired = false;
  try {
    await client.query('SELECT pg_advisory_lock(741928360415)');
    lockAcquired = true;

    // Create migrations tracking table first
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Skip the schema_migrations file itself since we handled it above
    const migrationFiles = files.filter(f => !f.startsWith('001_create_schema_migrations'));

    const { rows: applied } = await client.query(
      'SELECT filename FROM schema_migrations'
    );
    const appliedSet = new Set(applied.map(r => r.filename));

    let count = 0;
    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        console.log(`  [SKIP] ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`  [APPLY] ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations(filename) VALUES($1)',
          [file]
        );
        await client.query('COMMIT');
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }
    console.log(`Migration complete. ${count} migration(s) applied.`);
  } finally {
    try {
      if (lockAcquired) {
        await client.query('SELECT pg_advisory_unlock(741928360415)');
      }
    } finally {
      client.release();
      await pool.end();
    }
  }
}

migrate().catch(err => {
  console.error('Migration error:', err.message);
  process.exit(1);
});
