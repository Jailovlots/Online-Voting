import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

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

const SALT = 'sg-voting-2026-salt';
function hashVoter(userId, electionId) {
  return createHash('sha256').update(`${SALT}|${userId}|${electionId}`).digest('hex');
}

async function check() {
  // Get the active election
  const { rows: elections } = await pool.query("SELECT id, title, status FROM public.elections ORDER BY created_at DESC");
  console.log('ELECTIONS:', JSON.stringify(elections, null, 2));

  const activeElection = elections.find(e => e.status === 'active');
  if (!activeElection) { console.log('No active election!'); await pool.end(); return; }

  console.log('\nActive election:', activeElection.title, activeElection.id);

  // Get all registered students
  const { rows: students } = await pool.query(
    `SELECT p.id, p.full_name, p.student_id FROM public.profiles p
     JOIN public.user_roles ur ON p.id = ur.user_id
     WHERE ur.role = 'student' AND p.is_registered = true`
  );
  console.log('\nRegistered students:', students.length);

  // Get votes for active election
  const { rows: votes } = await pool.query(
    'SELECT voter_hash, candidate_id, position_id FROM public.votes WHERE election_id = $1',
    [activeElection.id]
  );
  console.log('\nVotes in active election:', votes.length);

  // Check hashes
  console.log('\nHash check per student:');
  const voteHashSet = new Set(votes.map(v => v.voter_hash));
  for (const student of students) {
    const hash = hashVoter(student.id, activeElection.id);
    const voted = voteHashSet.has(hash);
    console.log(`  ${student.full_name}: hash=${hash.slice(0,12)}... voted=${voted}`);
  }

  // Check all votes in DB regardless of election
  const { rows: allVotes } = await pool.query('SELECT election_id, LEFT(voter_hash,12) as hash_prefix FROM public.votes');
  console.log('\nALL votes in DB (any election):', allVotes.length);
  console.log(JSON.stringify(allVotes, null, 2));

  await pool.end();
}

check().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
