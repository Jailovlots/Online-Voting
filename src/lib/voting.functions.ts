import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { createHash } from 'crypto';
import { requireAuth } from '@/lib/auth-middleware';

const SALT = 'sg-voting-2026-salt';

function hashVoter(userId: string, electionId: string) {
  return createHash('sha256').update(`${SALT}|${userId}|${electionId}`).digest('hex');
}

export const castVote = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: { electionId: string; selections: Record<string, string | string[]> }) =>
    z
      .object({
        electionId: z.string().uuid(),
        selections: z.record(z.string().uuid(), z.union([z.string().uuid(), z.array(z.string().uuid())])),
      })
      .parse(d),
  )
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as { electionId: string; selections: Record<string, string | string[]> };
    const { db, userId } = context;

    // ── Guard 1: Registration / Approval ─────────────────────────────────────
    const { rows: profileRows } = await db.query(
      'SELECT is_registered FROM public.profiles WHERE id = $1 LIMIT 1',
      [userId],
    );
    if (!profileRows[0]) throw new Error('Student profile not found.');
    if (!profileRows[0].is_registered) {
      throw new Error(
        'Your account has not been approved yet. Please wait for an admin to approve your registration before voting.',
      );
    }

    // Verify election exists and is active
    const { rows: electionRows } = await db.query(
      'SELECT id, status FROM public.elections WHERE id = $1 LIMIT 1',
      [data.electionId],
    );
    const election = electionRows[0];
    if (!election) throw new Error('Election not found');
    if (election.status !== 'active') throw new Error('Election is not open');

    const voter_hash = hashVoter(userId, data.electionId);

    // ── Guard 2: Duplicate vote pre-check ─────────────────────────────────────
    const { rows: existingVote } = await db.query(
      'SELECT 1 FROM public.votes WHERE election_id = $1 AND voter_hash = $2 LIMIT 1',
      [data.electionId, voter_hash],
    );
    if (existingVote.length > 0) {
      throw new Error('You have already cast your vote in this election. Each student may only vote once.');
    }

    const entries = Object.entries(data.selections);
    if (entries.length === 0) throw new Error('Select at least one candidate');

    // Verify max_winners constraints
    const { rows: positions } = await db.query('SELECT id, max_winners FROM public.positions');
    const positionMap = new Map(positions.map((p: any) => [p.id, p.max_winners]));

    for (const [position_id, candidate_ids] of entries) {
      const max = Number(positionMap.get(position_id) ?? 1);
      const count = Array.isArray(candidate_ids) ? candidate_ids.length : 1;
      if (count > max) {
        throw new Error(`You selected too many candidates for a position. Max allowed: ${max}`);
      }
    }

    // Insert votes
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
            [data.electionId, position_id, candidate_id, voter_hash],
          );
          totalVotes++;
        }
      }
      await client.query(
        'INSERT INTO public.audit_logs (actor_id, action, target, metadata) VALUES ($1, $2, $3, $4)',
        [userId, 'cast_vote', data.electionId, JSON.stringify({ positions: entries.length, votes: totalVotes })],
      );
      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.code === '23505') throw new Error('You have already voted in this election');
      throw new Error(err.message);
    } finally {
      client.release();
    }

    return { ok: true, receipt: voter_hash.slice(0, 12).toUpperCase(), positions: entries.length };
  });

export const hasVoted = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: { electionId: string }) =>
    z.object({ electionId: z.string().uuid() }).parse(d),
  )
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as { electionId: string };
    const voter_hash = hashVoter(context.userId, data.electionId);
    const { rows } = await context.db.query(
      'SELECT 1 FROM public.votes WHERE election_id = $1 AND voter_hash = $2 LIMIT 1',
      [data.electionId, voter_hash],
    );
    return { voted: rows.length > 0 };
  });

export const getMyRole = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const { rows } = await context.db.query(
      'SELECT role FROM public.user_roles WHERE user_id = $1',
      [context.userId],
    );
    const roles = rows.map((r: { role: string }) => r.role);
    return {
      userId: context.userId,
      isAdmin: roles.includes('admin'),
      isStudent: roles.includes('student'),
    };
  });