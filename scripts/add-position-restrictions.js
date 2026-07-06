import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  });
}

let dbConnectionString = process.env.DATABASE_URL;
if (dbConnectionString) {
  dbConnectionString = dbConnectionString
    .replace('sslmode=require', 'sslmode=verify-full')
    .replace('sslmode=prefer', 'sslmode=verify-full')
    .replace('sslmode=verify-ca', 'sslmode=verify-full');
}
const isNeonOrVercel = dbConnectionString?.includes('neon.tech') || dbConnectionString?.includes('vercel-storage.com');

const pool = new pg.Pool({
  connectionString: dbConnectionString,
  ssl: isNeonOrVercel ? { rejectUnauthorized: false } : undefined,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Adding position restriction columns...');

    // Add allowed_year_levels column (array of integers, e.g. {1,2})
    await client.query(`
      ALTER TABLE public.positions
      ADD COLUMN IF NOT EXISTS allowed_year_levels INT[] DEFAULT NULL
    `);
    console.log('✓ allowed_year_levels column added (or already exists)');

    // Add allowed_courses column (array of text, e.g. {'ACT','BSIS'})
    await client.query(`
      ALTER TABLE public.positions
      ADD COLUMN IF NOT EXISTS allowed_courses TEXT[] DEFAULT NULL
    `);
    console.log('✓ allowed_courses column added (or already exists)');

    console.log('\n✓ Migration completed successfully!');
    console.log('  - NULL allowed_year_levels means ALL year levels can vote');
    console.log('  - NULL allowed_courses means ALL courses can vote');
    console.log('  - Example: ACT 1 Representative → allowed_year_levels={1}, allowed_courses={"ACT"}');
  } catch (err) {
    console.error('✗ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
