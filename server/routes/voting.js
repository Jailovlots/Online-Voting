const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const SALT = 'sg-voting-2026-salt';

function hashVoter(userId, electionId) {
  return crypto.createHash('sha256').update(`${SALT}|${userId}|${electionId}`).digest('hex');
}

router.use(requireAuth);

// ── POST /api/voting/cast ──────────────────────────────────────────────────
router.post('/cast', async (req, res) => {
  try {
    const schema = z.object({
      electionId: z.string().uuid(),
      selections: z.record(
        z.string().uuid(),
        z.union([z.string().uuid(), z.array(z.string().uuid())])
      ),
    });
    const data = schema.parse(req.body);
    const db = req.app.locals.db;
    const userId = req.userId;

    // Guard 1: registration
    const { rows: profileRows } = await db.query(
      'SELECT is_registered, year_level, course FROM public.profiles WHERE id = $1 LIMIT 1',
      [userId]
    );
    if (!profileRows[0]) return res.status(404).json({ error: 'Student profile not found.' });
    if (!profileRows[0].is_registered)
      return res.status(403).json({
        error: 'Your account has not been approved yet. Please wait for an admin to approve your registration before voting.',
      });

    const voterYearLevel = profileRows[0].year_level ?? null;
    const voterCourse = profileRows[0].course ?? null;

    // Guard 2: election is active
    const { rows: electionRows } = await db.query(
      'SELECT id, status FROM public.elections WHERE id = $1 LIMIT 1',
      [data.electionId]
    );
    const election = electionRows[0];
    if (!election) return res.status(404).json({ error: 'Election not found' });
    if (election.status !== 'active') return res.status(400).json({ error: 'Election is not open' });

    const voter_hash = hashVoter(userId, data.electionId);

    // Guard 3: duplicate vote
    const { rows: existingVote } = await db.query(
      'SELECT 1 FROM public.votes WHERE election_id = $1 AND voter_hash = $2 LIMIT 1',
      [data.electionId, voter_hash]
    );
    if (existingVote.length > 0)
      return res.status(409).json({
        error: 'You have already cast your vote in this election. Each student may only vote once.',
      });

    const entries = Object.entries(data.selections);
    if (entries.length === 0)
      return res.status(400).json({ error: 'Select at least one candidate' });

    // Guard 4: max_winners and eligibility
    const { rows: positions } = await db.query(
      'SELECT id, max_winners, allowed_year_levels, allowed_courses, title FROM public.positions'
    );
    const positionMap = new Map(positions.map((p) => [p.id, p]));

    for (const [position_id, candidate_ids] of entries) {
      const pos = positionMap.get(position_id);
      if (!pos) continue;

      const max = Number(pos.max_winners ?? 1);
      const count = Array.isArray(candidate_ids) ? candidate_ids.length : 1;
      if (count > max)
        return res.status(400).json({ error: `You selected too many candidates for a position. Max allowed: ${max}` });

      const allowedYears = pos.allowed_year_levels ?? null;
      const allowedCourses = pos.allowed_courses ?? null;

      if (allowedYears && allowedYears.length > 0) {
        if (voterYearLevel === null || !allowedYears.includes(voterYearLevel))
          return res.status(403).json({
            error: `You are not eligible to vote for "${pos.title}". This position is restricted to Year ${allowedYears.join(' or ')} students only.`,
          });
      }

      if (allowedCourses && allowedCourses.length > 0) {
        const normalizedVoterCourse = (voterCourse ?? '').trim().toUpperCase();
        const normalizedAllowed = allowedCourses.map((c) => c.trim().toUpperCase());
        if (!normalizedAllowed.includes(normalizedVoterCourse))
          return res.status(403).json({
            error: `You are not eligible to vote for "${pos.title}". This position is restricted to ${allowedCourses.join(' or ')} students only.`,
          });
      }
    }

    // Insert votes in transaction
    const client = await db.connect();
    let totalVotes = 0;
    try {
      await client.query('BEGIN');
      for (const [position_id, candidate_ids] of entries) {
        const candidates = Array.isArray(candidate_ids) ? candidate_ids : [candidate_ids];
        for (const candidate_id of candidates) {
          await client.query(
            `INSERT INTO public.votes (election_id, position_id, candidate_id, voter_hash)
             VALUES ($1, $2, $3, $4)`,
            [data.electionId, position_id, candidate_id, voter_hash]
          );
          totalVotes++;
        }
      }
      await client.query(
        'INSERT INTO public.audit_logs (actor_id, action, target, metadata) VALUES ($1, $2, $3, $4)',
        [userId, 'cast_vote', data.electionId, JSON.stringify({ positions: entries.length, votes: totalVotes })]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') return res.status(409).json({ error: 'You have already voted in this election' });
      throw err;
    } finally {
      client.release();
    }

    return res.json({
      ok: true,
      receipt: voter_hash.slice(0, 12).toUpperCase(),
      positions: entries.length,
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    console.error('cast vote error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/voting/has-voted ─────────────────────────────────────────────
router.post('/has-voted', async (req, res) => {
  try {
    const { electionId } = z.object({ electionId: z.string().uuid() }).parse(req.body);
    const voter_hash = hashVoter(req.userId, electionId);
    const { rows } = await req.app.locals.db.query(
      'SELECT 1 FROM public.votes WHERE election_id = $1 AND voter_hash = $2 LIMIT 1',
      [electionId, voter_hash]
    );
    return res.json({ voted: rows.length > 0 });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
