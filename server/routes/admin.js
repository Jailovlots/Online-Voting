const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const { requireAuth, requireAdmin, requireAdminOrOfficer } = require('../middleware/auth');

const router = express.Router();
const SALT = 'sg-voting-2026-salt';

function hashVoter(userId, electionId) {
  return crypto.createHash('sha256').update(`${SALT}|${userId}|${electionId}`).digest('hex');
}

async function log(db, userId, action, target, metadata) {
  await db.query(
    'INSERT INTO public.audit_logs (actor_id, action, target, metadata) VALUES ($1, $2, $3, $4)',
    [userId, action, target ?? null, metadata ? JSON.stringify(metadata) : null]
  );
}

router.use(requireAuth);

// ── Election Status ────────────────────────────────────────────────────────
router.patch('/elections/:id/status', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdmin(req, res, db, async () => {
      const { status } = z.object({ status: z.enum(['upcoming', 'active', 'closed']) }).parse(req.body);
      await db.query('UPDATE public.elections SET status = $1 WHERE id = $2', [status, req.params.id]);
      await log(db, req.userId, 'election_status_change', req.params.id, { status });
      return res.json({ ok: true });
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// ── Upsert Election ────────────────────────────────────────────────────────
router.post('/elections', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdmin(req, res, db, async () => {
      const schema = z.object({
        id: z.string().uuid().optional(),
        title: z.string().min(2).max(200),
        description: z.string().max(1000).optional().nullable(),
        starts_at: z.string(),
        ends_at: z.string(),
        status: z.enum(['upcoming', 'active', 'closed']).optional(),
      });
      const data = schema.parse(req.body);
      if (data.id) {
        await db.query(
          `UPDATE public.elections SET title=$1, description=$2, starts_at=$3, ends_at=$4, status=COALESCE($5, status) WHERE id=$6`,
          [data.title, data.description ?? null, data.starts_at, data.ends_at, data.status ?? null, data.id]
        );
        await log(db, req.userId, 'election_update', data.id);
      } else {
        const { rows } = await db.query(
          `INSERT INTO public.elections (title, description, starts_at, ends_at, status) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [data.title, data.description ?? null, data.starts_at, data.ends_at, data.status ?? 'upcoming']
        );
        await log(db, req.userId, 'election_create', rows[0]?.id);
      }
      return res.json({ ok: true });
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// ── Upsert Candidate ───────────────────────────────────────────────────────
router.post('/candidates', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdminOrOfficer(req, res, db, async () => {
      const schema = z.object({
        id: z.string().uuid().optional(),
        position_id: z.string().uuid(),
        full_name: z.string().min(2).max(120),
        party: z.string().max(80).optional().nullable(),
        bio: z.string().max(4000).optional().nullable(),
        platform: z.string().max(2000).optional().nullable(),
        photo_url: z.string().optional().nullable(),
        approved: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      if (data.id) {
        await db.query(
          `UPDATE public.candidates SET position_id=$1, full_name=$2, party=$3, bio=$4, platform=$5, photo_url=$6, approved=COALESCE($7, approved) WHERE id=$8`,
          [data.position_id, data.full_name, data.party ?? null, data.bio ?? null, data.platform ?? null, data.photo_url ?? null, data.approved ?? null, data.id]
        );
        await log(db, req.userId, 'candidate_update', data.id);
      } else {
        const { rows } = await db.query(
          `INSERT INTO public.candidates (position_id, full_name, party, bio, platform, photo_url, approved) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [data.position_id, data.full_name, data.party ?? null, data.bio ?? null, data.platform ?? null, data.photo_url ?? null, data.approved ?? true]
        );
        await log(db, req.userId, 'candidate_create', rows[0]?.id);
      }
      return res.json({ ok: true });
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// ── Delete Candidate ───────────────────────────────────────────────────────
router.delete('/candidates/:id', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdminOrOfficer(req, res, db, async () => {
      await db.query('DELETE FROM public.candidates WHERE id = $1', [req.params.id]);
      await log(db, req.userId, 'candidate_delete', req.params.id);
      return res.json({ ok: true });
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Upsert Announcement ────────────────────────────────────────────────────
router.post('/announcements', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdmin(req, res, db, async () => {
      const schema = z.object({
        id: z.string().uuid().optional(),
        title: z.string().min(2).max(160),
        body: z.string().min(2).max(2000),
        pinned: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      if (data.id) {
        await db.query(
          'UPDATE public.announcements SET title=$1, body=$2, pinned=COALESCE($3, pinned) WHERE id=$4',
          [data.title, data.body, data.pinned ?? null, data.id]
        );
        await log(db, req.userId, 'announcement_update', data.id);
      } else {
        const { rows } = await db.query(
          'INSERT INTO public.announcements (title, body, pinned) VALUES ($1,$2,$3) RETURNING id',
          [data.title, data.body, data.pinned ?? false]
        );
        await log(db, req.userId, 'announcement_create', rows[0]?.id);
      }
      return res.json({ ok: true });
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// ── Delete Announcement ────────────────────────────────────────────────────
router.delete('/announcements/:id', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdmin(req, res, db, async () => {
      await db.query('DELETE FROM public.announcements WHERE id = $1', [req.params.id]);
      await log(db, req.userId, 'announcement_delete', req.params.id);
      return res.json({ ok: true });
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Upsert Position ────────────────────────────────────────────────────────
router.post('/positions', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdmin(req, res, db, async () => {
      const schema = z.object({
        id: z.string().uuid().optional(),
        title: z.string().min(2).max(120),
        description: z.string().max(800).optional().nullable(),
        max_winners: z.coerce.number().min(1).max(100),
        order_index: z.coerce.number().min(0).optional(),
        allowed_year_levels: z.array(z.coerce.number().min(1).max(6)).nullable().optional(),
        allowed_courses: z.array(z.string().min(1).max(80)).nullable().optional(),
      });
      const data = schema.parse(req.body);
      const yearLevels = data.allowed_year_levels?.length > 0 ? data.allowed_year_levels : null;
      const courses = data.allowed_courses?.length > 0 ? data.allowed_courses : null;

      if (data.id) {
        await db.query(
          `UPDATE public.positions SET title=$1, description=$2, max_winners=$3, order_index=COALESCE($4, order_index), allowed_year_levels=$5, allowed_courses=$6 WHERE id=$7`,
          [data.title, data.description ?? null, data.max_winners, data.order_index ?? null, yearLevels, courses, data.id]
        );
        await log(db, req.userId, 'position_update', data.id, { title: data.title });
      } else {
        let orderIndex = data.order_index;
        if (orderIndex === undefined) {
          const { rows } = await db.query('SELECT COALESCE(MAX(order_index), 0) as max FROM public.positions');
          orderIndex = (rows[0]?.max ?? 0) + 1;
        }
        const { rows } = await db.query(
          `INSERT INTO public.positions (title, description, max_winners, order_index, allowed_year_levels, allowed_courses) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [data.title, data.description ?? null, data.max_winners, orderIndex, yearLevels, courses]
        );
        await log(db, req.userId, 'position_create', rows[0]?.id, { title: data.title });
      }
      return res.json({ ok: true });
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// ── Delete Position ────────────────────────────────────────────────────────
router.delete('/positions/:id', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdmin(req, res, db, async () => {
      const { rows } = await db.query('SELECT title FROM public.positions WHERE id = $1', [req.params.id]);
      await db.query('DELETE FROM public.positions WHERE id = $1', [req.params.id]);
      await log(db, req.userId, 'position_delete', req.params.id, { title: rows[0]?.title });
      return res.json({ ok: true });
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Get Students ───────────────────────────────────────────────────────────
router.get('/students', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdminOrOfficer(req, res, db, async () => {
      const { rows } = await db.query(
        `SELECT p.id, p.student_id, p.full_name, p.email, p.course, p.year_level, p.section, p.is_registered, p.created_at,
                ARRAY(SELECT role::text FROM public.user_roles WHERE user_id = p.id) as roles
         FROM public.profiles p
         JOIN public.user_roles ur ON p.id = ur.user_id
         WHERE ur.role = 'student'
         ORDER BY p.created_at DESC`
      );
      return res.json(rows);
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Update Student Registration ────────────────────────────────────────────
router.patch('/students/:id/registration', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdminOrOfficer(req, res, db, async () => {
      const { is_registered } = z.object({ is_registered: z.boolean() }).parse(req.body);
      await db.query('UPDATE public.profiles SET is_registered = $1 WHERE id = $2', [is_registered, req.params.id]);
      await log(db, req.userId, 'student_registration_update', req.params.id, { is_registered });
      return res.json({ ok: true });
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// ── Delete Student ─────────────────────────────────────────────────────────
router.delete('/students/:id', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdmin(req, res, db, async () => {
      const { rows } = await db.query('SELECT full_name, email FROM public.profiles WHERE id = $1', [req.params.id]);
      await db.query('DELETE FROM public.users WHERE id = $1', [req.params.id]);
      await log(db, req.userId, 'student_delete', req.params.id, { name: rows[0]?.full_name, email: rows[0]?.email });
      return res.json({ ok: true });
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Grant / Toggle Admin ───────────────────────────────────────────────────
router.post('/students/:id/grant-admin', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdmin(req, res, db, async () => {
      await db.query(
        "INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING",
        [req.params.id]
      );
      await log(db, req.userId, 'grant_admin', req.params.id);
      return res.json({ ok: true });
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Toggle Officer Role ────────────────────────────────────────────────────
router.post('/students/:id/officer', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdmin(req, res, db, async () => {
      const { grant } = z.object({ grant: z.boolean() }).parse(req.body);
      if (grant) {
        await db.query(
          "INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'officer') ON CONFLICT DO NOTHING",
          [req.params.id]
        );
        await log(db, req.userId, 'grant_officer', req.params.id);
      } else {
        await db.query("DELETE FROM public.user_roles WHERE user_id = $1 AND role = 'officer'", [req.params.id]);
        await log(db, req.userId, 'revoke_officer', req.params.id);
      }
      return res.json({ ok: true });
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// ── Update My Profile ──────────────────────────────────────────────────────
router.patch('/profile', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const schema = z.object({
      full_name: z.string().min(2).max(120).optional(),
      course: z.string().max(80).optional().nullable(),
      year_level: z.coerce.number().min(1).max(6).optional().nullable(),
      photo_url: z.string().optional().nullable(),
      section: z.string().max(40).optional().nullable(),
    });
    const data = schema.parse(req.body);
    const fields = [];
    const values = [];
    let idx = 1;
    if (data.full_name !== undefined) { fields.push(`full_name=$${idx++}`); values.push(data.full_name); }
    if (data.course !== undefined) { fields.push(`course=$${idx++}`); values.push(data.course); }
    if (data.year_level !== undefined) { fields.push(`year_level=$${idx++}`); values.push(data.year_level); }
    if (data.photo_url !== undefined) { fields.push(`photo_url=$${idx++}`); values.push(data.photo_url); }
    if (data.section !== undefined) { fields.push(`section=$${idx++}`); values.push(data.section); }
    if (fields.length === 0) return res.json({ ok: true });
    values.push(req.userId);
    await db.query(`UPDATE public.profiles SET ${fields.join(', ')} WHERE id=$${idx}`, values);
    return res.json({ ok: true });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

// ── Eligible Voters ────────────────────────────────────────────────────────
router.get('/eligible-voters', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdmin(req, res, db, async () => {
      const { rows } = await db.query(
        'SELECT student_id, last_name, first_name, uploaded_at FROM public.eligible_voters ORDER BY last_name ASC, first_name ASC'
      );
      return res.json(rows);
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/eligible-voters', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdmin(req, res, db, async () => {
      const { rows: data } = { rows: z.object({
        rows: z.array(z.object({
          student_id: z.string().min(1).max(40),
          last_name: z.string().min(1).max(80),
          first_name: z.string().min(1).max(80),
        })).min(1),
      }).parse(req.body) };

      // Re-parse properly
      const parsed = z.object({
        rows: z.array(z.object({
          student_id: z.string().min(1).max(40),
          last_name: z.string().min(1).max(80),
          first_name: z.string().min(1).max(80),
        })).min(1),
      }).parse(req.body);

      let inserted = 0;
      for (const row of parsed.rows) {
        const { rowCount } = await db.query(
          `INSERT INTO public.eligible_voters (student_id, last_name, first_name, uploaded_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (student_id) DO UPDATE SET last_name=EXCLUDED.last_name, first_name=EXCLUDED.first_name, uploaded_at=now()`,
          [row.student_id.trim(), row.last_name.trim(), row.first_name.trim()]
        );
        if (rowCount && rowCount > 0) inserted++;
      }
      await log(db, req.userId, 'eligible_voters_upload', undefined, { total: parsed.rows.length });
      return res.json({ ok: true, total: parsed.rows.length });
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/eligible-voters/:studentId', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdmin(req, res, db, async () => {
      await db.query('DELETE FROM public.eligible_voters WHERE student_id = $1', [req.params.studentId]);
      await log(db, req.userId, 'eligible_voter_delete', req.params.studentId);
      return res.json({ ok: true });
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Voter Participation Report ─────────────────────────────────────────────
router.post('/elections/:id/voter-report', async (req, res) => {
  const db = req.app.locals.db;
  try {
    await requireAdminOrOfficer(req, res, db, async () => {
      const { rows: students } = await db.query(
        `SELECT p.id, p.student_id, p.full_name, p.email, p.course, p.year_level, p.section
         FROM public.profiles p
         JOIN public.user_roles ur ON p.id = ur.user_id
         WHERE ur.role = 'student' AND p.is_registered = true
         ORDER BY p.full_name ASC`
      );
      const { rows: votes } = await db.query(
        `SELECT voter_hash, MIN(created_at) as voted_at FROM public.votes WHERE election_id = $1 GROUP BY voter_hash`,
        [req.params.id]
      );
      const voteMap = new Map(votes.map((v) => [v.voter_hash, v.voted_at]));
      const report = students.map((student) => {
        const hash = hashVoter(student.id, req.params.id);
        const votedAt = voteMap.get(hash);
        return { ...student, voted: !!votedAt, voted_at: votedAt ?? null };
      });
      return res.json(report);
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Upload Image (returns base64 data URL directly) ────────────────────────
router.post('/upload-image', async (req, res) => {
  try {
    const { base64Data } = z.object({ base64Data: z.string() }).parse(req.body);
    const match = base64Data.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Invalid image data format.' });
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(match[1])) return res.status(400).json({ error: 'Unsupported image format.' });
    return res.json({ url: base64Data });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
