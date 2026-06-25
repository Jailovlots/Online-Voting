import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
};

const databaseName = process.env.PG_DATABASE || 'onlineVoting_db';

async function resetDb() {
  const adminPool = new pg.Pool({ ...dbConfig, database: 'postgres' });
  const adminClient = await adminPool.connect();
  
  try {
    console.log(`Dropping database '${databaseName}'...`);
    // Terminate existing connections first
    await adminClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${databaseName}'
        AND pid <> pg_backend_pid();
    `);
    await adminClient.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    console.log(`Database '${databaseName}' dropped.`);
  } catch (err) {
    console.error('Error dropping database:', err);
  } finally {
    adminClient.release();
    await adminPool.end();
  }
}

resetDb().then(() => {
  console.log('Now run setup-db.js to recreate the database.');
}).catch(console.error);
