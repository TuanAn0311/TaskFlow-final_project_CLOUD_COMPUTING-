function getDatabaseConfig(env = process.env) {
  const ssl = env.DB_SSL === 'true'
    ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined;
  const poolOptions = {
    ssl,
    max: Number(env.DB_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  if (env.NODE_ENV === 'test') {
    const testDatabaseUrl = env.TEST_DATABASE_URL;
    let databaseName = '';

    try {
      const parsedUrl = new URL(testDatabaseUrl);
      databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
      if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
        databaseName = '';
      }
    } catch {
      databaseName = '';
    }

    if (!testDatabaseUrl || !/(^|[_-])test($|[_-])/i.test(databaseName)) {
      throw new Error(
        'Refusing to run tests without TEST_DATABASE_URL pointing to a database whose name includes a test segment.'
      );
    }

    if (env.DB_NAME && env.DB_NAME.toLowerCase() === databaseName.toLowerCase()) {
      throw new Error('Refusing to run tests against the configured development database.');
    }

    if (env.DATABASE_URL) {
      try {
        const defaultUrl = new URL(env.DATABASE_URL);
        const testUrl = new URL(testDatabaseUrl);
        const defaultDatabaseName = decodeURIComponent(defaultUrl.pathname.replace(/^\/+/, ''));
        const sameDatabase = ['postgres:', 'postgresql:'].includes(defaultUrl.protocol)
          && defaultDatabaseName.toLowerCase() === databaseName.toLowerCase()
          && defaultUrl.hostname.toLowerCase() === testUrl.hostname.toLowerCase()
          && (defaultUrl.port || '5432') === (testUrl.port || '5432');
        if (sameDatabase) {
          throw new Error('Refusing to run tests against the configured default database.');
        }
      } catch (error) {
        if (error.message === 'Refusing to run tests against the configured default database.') {
          throw error;
        }
      }
    }

    return { ...poolOptions, connectionString: testDatabaseUrl };
  }

  return {
    ...poolOptions,
    connectionString: env.DATABASE_URL || undefined,
    user: env.DB_USER,
    host: env.DB_HOST,
    database: env.DB_NAME,
    password: env.DB_PASSWORD,
    port: env.DB_PORT ? Number(env.DB_PORT) : undefined,
  };
}

module.exports = { getDatabaseConfig };
