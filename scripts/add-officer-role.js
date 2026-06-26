import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
    if (match) {
      let val = (match[2] || '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  });
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Checking if "officer" role exists in public.app_role enum...');
    const { rows } = await client.query(`
      SELECT 1 FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      WHERE t.typname = 'app_role' AND e.enumlabel = 'officer'
    `);

    if (rows.length === 0) {
      console.log('Adding "officer" value to public.app_role ENUM...');
      await client.query("ALTER TYPE public.app_role ADD VALUE 'officer'");
      console.log('Successfully added "officer" to app_role enum.');
    } else {
      console.log('"officer" value already exists in public.app_role ENUM. Skipping.');
    }
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
