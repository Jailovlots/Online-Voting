// Migration script: create eligible_voters table
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');

// Parse .env file
const env = readFileSync(envPath, 'utf8');
const vars = Object.fromEntries(
  env
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

let dbConnectionString = vars.DATABASE_URL;
if (dbConnectionString) {
  dbConnectionString = dbConnectionString
    .replace('sslmode=require', 'sslmode=verify-full')
    .replace('sslmode=prefer', 'sslmode=verify-full')
    .replace('sslmode=verify-ca', 'sslmode=verify-full');
}
const isNeonOrVercel = dbConnectionString?.includes('neon.tech') || dbConnectionString?.includes('vercel-storage.com');

const pool = new Pool(
  dbConnectionString
    ? {
        connectionString: dbConnectionString,
        ssl: isNeonOrVercel ? { rejectUnauthorized: false } : undefined,
      }
    : {
        host: vars.PG_HOST || 'localhost',
        port: parseInt(vars.PG_PORT || '5432', 10),
        user: vars.PG_USER || 'postgres',
        password: vars.PG_PASSWORD,
        database: vars.PG_DATABASE || 'onlineVoting_db',
      },
);

const SQL = `
  CREATE TABLE IF NOT EXISTS public.eligible_voters (
    student_id  TEXT PRIMARY KEY,
    last_name   TEXT NOT NULL,
    first_name  TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_eligible_voters_student_id
    ON public.eligible_voters(student_id);
`;

pool
  .query(SQL)
  .then(() => {
    console.log('✓ Migration successful: eligible_voters table is ready.');
    pool.end();
  })
  .catch((e) => {
    console.error('✗ Migration error:', e.message);
    pool.end();
    process.exit(1);
  });
