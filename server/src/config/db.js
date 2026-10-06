const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/sprintify_db';

const pool = new Pool({
  connectionString,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

module.exports = pool;
