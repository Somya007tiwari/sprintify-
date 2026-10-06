const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function runMigration() {
  const dbUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/sprintify_db';
  
  // Extract database name from connection string
  const urlObj = new URL(dbUrl);
  const dbName = urlObj.pathname.slice(1) || 'sprintify_db';
  
  // Connect to default 'postgres' database first to ensure target db exists
  const rootUrl = `${urlObj.protocol}//${urlObj.username}${urlObj.password ? ':' + urlObj.password : ''}@${urlObj.hostname}:${urlObj.port}/postgres`;
  
  const rootClient = new Client({ connectionString: rootUrl });
  try {
    await rootClient.connect();
    const res = await rootClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
    if (res.rowCount === 0) {
      console.log(`Database '${dbName}' does not exist. Creating...`);
      await rootClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database '${dbName}' created successfully.`);
    }
  } catch (err) {
    console.warn(`Warning checking root DB existence: ${err.message}. Proceeding to connect directly.`);
  } finally {
    await rootClient.end().catch(() => {});
  }

  // Connect to target database and execute schema.sql
  const targetClient = new Client({ connectionString: dbUrl });
  try {
    await targetClient.connect();
    console.log(`Connected to database '${dbName}'. Running schema.sql...`);
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await targetClient.query(sql);
    console.log('Schema executed successfully!');

    // Add search pg_trgm extension and GIN trigram indexes safely
    try {
      await targetClient.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
      await targetClient.query(`CREATE INDEX IF NOT EXISTS idx_tasks_title_trgm ON tasks USING gin (title gin_trgm_ops);`);
      await targetClient.query(`CREATE INDEX IF NOT EXISTS idx_projects_title_trgm ON projects USING gin (title gin_trgm_ops);`);
      console.log('Trigram search indexes created successfully.');
    } catch (trgmErr) {
      console.warn('pg_trgm extension or index creation warning (falling back to ILIKE):', trgmErr.message);
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await targetClient.end();
  }
}

runMigration();
