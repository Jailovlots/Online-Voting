import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-middleware';
import { createHash } from 'crypto';

async function ensureAdmin(context: { db: any; userId: string }) {
  const { rows } = await context.db.query(
    "SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'admin' LIMIT 1",
    [context.userId],
  );
  if (rows.length === 0) throw new Error('Forbidden: admin only');
}

async function log(
  context: { db: any; userId: string },
  action: string,
  target?: string,
  metadata?: unknown,
) {
  await context.db.query(
    'INSERT INTO public.audit_logs (actor_id, action, target, metadata) VALUES ($1, $2, $3, $4)',
    [context.userId, action, target ?? null, metadata ? JSON.stringify(metadata) : null],
  );
}

// ── Election Status ───────────────────────────────────────────────────────────
export const setElectionStatus = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: { id: string; status: 'upcoming' | 'active' | 'closed' }) =>
    z.object({ id: z.string().uuid(), status: z.enum(['upcoming', 'active', 'closed']) }).parse(d),
  )
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as { id: string; status: 'upcoming' | 'active' | 'closed' };
    await ensureAdmin(context);
    await context.db.query(
      'UPDATE public.elections SET status = $1 WHERE id = $2',
      [data.status, data.id],
    );
    await log(context, 'election_status_change', data.id, { status: data.status });
    return { ok: true };
  });

// ── Upsert Election ───────────────────────────────────────────────────────────
export const upsertElection = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: any) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(2).max(200),
        description: z.string().max(1000).optional().nullable(),
        starts_at: z.string(),
        ends_at: z.string(),
        status: z.enum(['upcoming', 'active', 'closed']).optional(),
      })
      .parse(d),
  )
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as any;
    await ensureAdmin(context);
    if (data.id) {
      await context.db.query(
        `UPDATE public.elections SET title=$1, description=$2, starts_at=$3, ends_at=$4, status=COALESCE($5, status)
         WHERE id=$6`,
        [data.title, data.description ?? null, data.starts_at, data.ends_at, data.status ?? null, data.id],
      );
      await log(context, 'election_update', data.id);
    } else {
      const { rows } = await context.db.query(
        `INSERT INTO public.elections (title, description, starts_at, ends_at, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [data.title, data.description ?? null, data.starts_at, data.ends_at, data.status ?? 'upcoming'],
      );
      await log(context, 'election_create', rows[0]?.id);
    }
    return { ok: true };
  });

// ── Candidate ─────────────────────────────────────────────────────────────────
export const upsertCandidate = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: any) =>
    z
      .object({
        id: z.string().uuid().optional(),
        position_id: z.string().uuid(),
        full_name: z.string().min(2).max(120),
        party: z.string().max(80).optional().nullable(),
        bio: z.string().max(800).optional().nullable(),
        platform: z.string().max(800).optional().nullable(),
        photo_url: z.string().optional().nullable(),
        approved: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as any;
    await ensureAdmin(context);
    if (data.id) {
      await context.db.query(
        `UPDATE public.candidates SET position_id=$1, full_name=$2, party=$3, bio=$4,
         platform=$5, photo_url=$6, approved=COALESCE($7, approved) WHERE id=$8`,
        [data.position_id, data.full_name, data.party ?? null, data.bio ?? null,
         data.platform ?? null, data.photo_url ?? null, data.approved ?? null, data.id],
      );
      await log(context, 'candidate_update', data.id);
    } else {
      const { rows } = await context.db.query(
        `INSERT INTO public.candidates (position_id, full_name, party, bio, platform, photo_url, approved)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [data.position_id, data.full_name, data.party ?? null, data.bio ?? null,
         data.platform ?? null, data.photo_url ?? null, data.approved ?? true],
      );
      await log(context, 'candidate_create', rows[0]?.id);
    }
    return { ok: true };
  });

export const deleteCandidate = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as { id: string };
    await ensureAdmin(context);
    await context.db.query('DELETE FROM public.candidates WHERE id = $1', [data.id]);
    await log(context, 'candidate_delete', data.id);
    return { ok: true };
  });

// ── Announcement ──────────────────────────────────────────────────────────────
export const upsertAnnouncement = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: any) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(2).max(160),
        body: z.string().min(2).max(2000),
        pinned: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as any;
    await ensureAdmin(context);
    if (data.id) {
      await context.db.query(
        'UPDATE public.announcements SET title=$1, body=$2, pinned=COALESCE($3, pinned) WHERE id=$4',
        [data.title, data.body, data.pinned ?? null, data.id],
      );
      await log(context, 'announcement_update', data.id);
    } else {
      const { rows } = await context.db.query(
        'INSERT INTO public.announcements (title, body, pinned) VALUES ($1,$2,$3) RETURNING id',
        [data.title, data.body, data.pinned ?? false],
      );
      await log(context, 'announcement_create', rows[0]?.id);
    }
    return { ok: true };
  });

export const deleteAnnouncement = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as { id: string };
    await ensureAdmin(context);
    await context.db.query('DELETE FROM public.announcements WHERE id = $1', [data.id]);
    await log(context, 'announcement_delete', data.id);
    return { ok: true };
  });

// ── Grant Admin ───────────────────────────────────────────────────────────────
export const grantAdmin = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as { user_id: string };
    await ensureAdmin(context);
    await context.db.query(
      "INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING",
      [data.user_id],
    );
    await log(context, 'grant_admin', data.user_id);
    return { ok: true };
  });

// ── Update Profile ────────────────────────────────────────────────────────────
export const updateMyProfile = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: any) =>
    z
      .object({
        full_name: z.string().min(2).max(120).optional(),
        course: z.string().max(80).optional().nullable(),
        year_level: z.coerce.number().min(1).max(6).optional().nullable(),
        photo_url: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as any;
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (data.full_name !== undefined) { fields.push(`full_name=$${idx++}`); values.push(data.full_name); }
    if (data.course !== undefined) { fields.push(`course=$${idx++}`); values.push(data.course); }
    if (data.year_level !== undefined) { fields.push(`year_level=$${idx++}`); values.push(data.year_level); }
    if (data.photo_url !== undefined) { fields.push(`photo_url=$${idx++}`); values.push(data.photo_url); }
    if (fields.length === 0) return { ok: true };
    values.push(context.userId);
    await context.db.query(
      `UPDATE public.profiles SET ${fields.join(', ')} WHERE id=$${idx}`,
      values,
    );
    return { ok: true };
  });

// ── Students Management ───────────────────────────────────────────────────────
export const getStudents = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const context = ctx.context as any;
    await ensureAdmin(context);
    const { rows } = await context.db.query(
      `SELECT p.id, p.student_id, p.full_name, p.email, p.course, p.year_level, p.is_registered, p.created_at
       FROM public.profiles p
       JOIN public.user_roles ur ON p.id = ur.user_id
       WHERE ur.role = 'student'
       ORDER BY p.created_at DESC`
    );
    return rows;
  });

export const updateStudentRegistration = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: { id: string; is_registered: boolean }) =>
    z.object({ id: z.string().uuid(), is_registered: z.boolean() }).parse(d)
  )
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as { id: string; is_registered: boolean };
    await ensureAdmin(context);
    await context.db.query(
      'UPDATE public.profiles SET is_registered = $1 WHERE id = $2',
      [data.is_registered, data.id]
    );
    await log(context, 'student_registration_update', data.id, { is_registered: data.is_registered });
    return { ok: true };
  });

export const deleteStudent = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as { id: string };
    await ensureAdmin(context);

    // Get student details for logging
    const { rows: current } = await context.db.query(
      'SELECT full_name, email FROM public.profiles WHERE id = $1',
      [data.id]
    );
    const name = current[0]?.full_name ?? 'unknown';
    const email = current[0]?.email ?? 'unknown';

    // Delete the user (cascades to profiles and roles)
    await context.db.query('DELETE FROM public.users WHERE id = $1', [data.id]);
    await log(context, 'student_delete', data.id, { name, email });
    return { ok: true };
  });

// ── Positions Management ──────────────────────────────────────────────────────
export const upsertPosition = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: any) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().min(2).max(120),
        description: z.string().max(800).optional().nullable(),
        max_winners: z.coerce.number().min(1).max(100),
        order_index: z.coerce.number().min(0).optional(),
      })
      .parse(d),
  )
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as any;
    await ensureAdmin(context);
    
    if (data.id) {
      await context.db.query(
        `UPDATE public.positions 
         SET title=$1, description=$2, max_winners=$3, order_index=COALESCE($4, order_index) 
         WHERE id=$5`,
        [data.title, data.description ?? null, data.max_winners, data.order_index ?? null, data.id],
      );
      await log(context, 'position_update', data.id, { title: data.title, max_winners: data.max_winners });
    } else {
      let orderIndex = data.order_index;
      if (orderIndex === undefined) {
        const { rows } = await context.db.query('SELECT COALESCE(MAX(order_index), 0) as max FROM public.positions');
        orderIndex = (rows[0]?.max ?? 0) + 1;
      }
      const { rows } = await context.db.query(
        `INSERT INTO public.positions (title, description, max_winners, order_index)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [data.title, data.description ?? null, data.max_winners, orderIndex],
      );
      await log(context, 'position_create', rows[0]?.id, { title: data.title, max_winners: data.max_winners });
    }
    return { ok: true };
  });

export const deletePosition = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as { id: string };
    await ensureAdmin(context);
    
    const { rows: current } = await context.db.query('SELECT title FROM public.positions WHERE id = $1', [data.id]);
    const title = current[0]?.title ?? 'unknown';

    await context.db.query('DELETE FROM public.positions WHERE id = $1', [data.id]);
    await log(context, 'position_delete', data.id, { title });
    return { ok: true };
  });

const SALT = 'sg-voting-2026-salt';

function hashVoter(userId: string, electionId: string) {
  return createHash('sha256').update(`${SALT}|${userId}|${electionId}`).digest('hex');
}

export const getVoterParticipationReport = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: { electionId: string }) =>
    z.object({ electionId: z.string().uuid() }).parse(d),
  )
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as { electionId: string };
    await ensureAdmin(context);

    // 1. Get all registered students
    const { rows: students } = await context.db.query(
      `SELECT p.id, p.student_id, p.full_name, p.email, p.course, p.year_level
       FROM public.profiles p
       JOIN public.user_roles ur ON p.id = ur.user_id
       WHERE ur.role = 'student' AND p.is_registered = true
       ORDER BY p.full_name ASC`
    );

    // 2. Get all voter hashes and their voting timestamps for this election
    const { rows: votes } = await context.db.query(
      `SELECT voter_hash, MIN(created_at) as voted_at 
       FROM public.votes 
       WHERE election_id = $1 
       GROUP BY voter_hash`,
      [data.electionId]
    );

    // Create a map of voter_hash -> voted_at for fast lookup
    const voteMap = new Map(votes.map((v: any) => [v.voter_hash, v.voted_at]));

    // 3. Match students to voter hashes
    const report = students.map((student: any) => {
      const hash = hashVoter(student.id, data.electionId);
      const votedAt = voteMap.get(hash);
      return {
        id: student.id,
        student_id: student.student_id,
        full_name: student.full_name,
        email: student.email,
        course: student.course,
        year_level: student.year_level,
        voted: !!votedAt,
        voted_at: votedAt ?? null,
      };
    });

    return report;
  });

export const uploadImage = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: { base64Data: string; fileName: string }) =>
    z
      .object({
        base64Data: z.string(),
        fileName: z.string(),
      })
      .parse(d),
  )
  .handler(async (ctx) => {
    const { base64Data, fileName } = ctx.data;
    
    // Parse the base64 string
    const match = base64Data.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid image data format. Expected base64 data URI.');
    }
    
    const mimeType = match[1];
    const base64Content = match[2];
    
    // Check if mimeType is allowed
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(mimeType)) {
      throw new Error('Unsupported image format. Allowed formats: JPEG, PNG, GIF, WEBP, SVG.');
    }
    
    // Determine extension
    let ext = '.png';
    if (mimeType === 'image/jpeg') ext = '.jpg';
    else if (mimeType === 'image/gif') ext = '.gif';
    else if (mimeType === 'image/webp') ext = '.webp';
    else if (mimeType === 'image/svg+xml') ext = '.svg';
    
    // Import Node.js filesystem modules dynamically to avoid bundling in client
    const fs = await import('fs/promises');
    const path = await import('path');
    const { randomUUID } = await import('crypto');
    
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    
    // Ensure uploads directory exists
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const uniqueName = `${randomUUID()}${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);
    
    // Write buffer to file
    const buffer = Buffer.from(base64Content, 'base64');
    await fs.writeFile(filePath, buffer);
    
    return {
      url: `/api/uploads/${uniqueName}`
    };
  });