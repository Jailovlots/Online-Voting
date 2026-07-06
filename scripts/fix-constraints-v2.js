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
    console.log('Beginning transaction...');
    await client.query('BEGIN');

    console.log('Dropping incorrect unique constraints on votes table...');
    await client.query('ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_election_id_voter_hash_key CASCADE');
    await client.query('ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_election_id_position_id_voter_hash_key CASCADE');
    await client.query('ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_election_voter_position_unique CASCADE');

    console.log('Adding correct UNIQUE constraint on (election_id, candidate_id, voter_hash)...');
    await client.query('ALTER TABLE public.votes ADD CONSTRAINT votes_election_id_candidate_id_voter_hash_key UNIQUE (election_id, candidate_id, voter_hash)');

    console.log('Committing transaction...');
    await client.query('COMMIT');
    console.log('Database constraint fixed to support multi-candidate positions successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
