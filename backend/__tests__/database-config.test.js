const { getDatabaseConfig } = require('../src/database/config');

describe('database configuration safety', () => {
  test('refuses test mode without an explicit test database URL', () => {
    expect(() => getDatabaseConfig({
      NODE_ENV: 'test',
      DB_NAME: 'taskflow_development',
      DB_HOST: 'localhost',
      DATABASE_URL: 'postgresql://localhost/taskflow_development',
    })).toThrow(/TEST_DATABASE_URL/);
  });

  test('refuses a test URL whose database name is not identified as a test database', () => {
    expect(() => getDatabaseConfig({
      NODE_ENV: 'test',
      TEST_DATABASE_URL: 'postgresql://localhost/taskflow',
    })).toThrow(/database whose name includes a test segment/);
  });

  test('refuses a test URL that names the configured development database', () => {
    expect(() => getDatabaseConfig({
      NODE_ENV: 'test',
      TEST_DATABASE_URL: 'postgresql://localhost/taskflow_test',
      DB_NAME: 'taskflow_test',
    })).toThrow(/configured development database/);
  });

  test('refuses a test URL that targets the configured default database', () => {
    expect(() => getDatabaseConfig({
      NODE_ENV: 'test',
      TEST_DATABASE_URL: 'postgresql://localhost/taskflow_test',
      DATABASE_URL: 'postgresql://localhost:5432/taskflow_test',
    })).toThrow(/configured default database/);
  });

  test('uses only the explicitly identified test URL in test mode', () => {
    const config = getDatabaseConfig({
      NODE_ENV: 'test',
      TEST_DATABASE_URL: 'postgresql://localhost/taskflow_test',
      DATABASE_URL: 'postgresql://localhost/taskflow_production',
      DB_NAME: 'taskflow_development',
      DB_HOST: 'development-db',
    });

    expect(config.connectionString).toBe('postgresql://localhost/taskflow_test');
    expect(config).not.toHaveProperty('database');
    expect(config).not.toHaveProperty('host');
  });

  test('keeps non-test database configuration unchanged', () => {
    const config = getDatabaseConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://localhost/taskflow_development',
      DB_NAME: 'taskflow_development',
      DB_HOST: 'development-db',
      DB_USER: 'developer',
      DB_PASSWORD: 'not-a-real-password',
      DB_POOL_MAX: '4',
    });

    expect(config.connectionString).toBe('postgresql://localhost/taskflow_development');
    expect(config.database).toBe('taskflow_development');
    expect(config.host).toBe('development-db');
    expect(config.max).toBe(4);
  });
});
