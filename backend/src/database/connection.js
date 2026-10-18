const { Pool } = require('pg');
require('dotenv').config();
const logger = require('../utils/logger');
const { getDatabaseConfig } = require('./config');

// Shared PostgreSQL connection pool for database repositories.
const pool = new Pool(getDatabaseConfig());

pool.on('error', (error) => {
  logger.error('Unexpected PostgreSQL pool error', error);
});

module.exports = pool;
