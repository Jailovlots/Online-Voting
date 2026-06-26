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
    console.log('Checking if "section" column exists in public.profiles table...');
    const { rows } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'section'
    `);

    if (rows.length === 0) {
      console.log('Adding "section" column to public.profiles table...');
      await client.query("ALTER TABLE public.profiles ADD COLUMN section TEXT");
      console.log('Successfully added "section" column to public.profiles table.');
    } else {
      console.log('"section" column already exists in public.profiles. Skipping.');
    }
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
