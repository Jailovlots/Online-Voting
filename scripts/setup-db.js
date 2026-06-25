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

async function runSetup() {
  // First, connect to default database to create our target database if it doesn't exist
  const adminPool = new pg.Pool({ ...dbConfig, database: 'postgres' });
  const adminClient = await adminPool.connect();
  
  try {
    const res = await adminClient.query(`SELECT datname FROM pg_catalog.pg_database WHERE datname = '${databaseName}'`);
    if (res.rowCount === 0) {
      console.log(`Database '${databaseName}' does not exist. Creating...`);
      await adminClient.query(`CREATE DATABASE "${databaseName}"`);
      console.log(`Database '${databaseName}' created.`);
    } else {
      console.log(`Database '${databaseName}' already exists.`);
    }
  } catch (err) {
    console.error('Error creating database:', err);
    throw err;
  } finally {
    adminClient.release();
    await adminPool.end();
  }

  // Now connect to the target database and run the setup script
  const pool = new pg.Pool({ ...dbConfig, database: databaseName });
  const client = await pool.connect();
  
  try {
    console.log(`Connected to database '${databaseName}'. Running setup script...`);
    
    const setupScriptPath = path.join(__dirname, '..', 'database', 'setup.sql');
    const sql = fs.readFileSync(setupScriptPath, 'utf8');
    
    await client.query(sql);
    
    console.log('Setup script executed successfully!');
    console.log('Default admin credentials seeded.');
  } catch (err) {
    console.error('Error executing setup script:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runSetup();
