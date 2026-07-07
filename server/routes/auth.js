const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// ── POST /api/auth/signin ──────────────────────────────────────────────────
router.post('/signin', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    });
    const { email, password } = schema.parse(req.body);
    const db = req.app.locals.db;

    console.time('signin-db-fetch');
    const { rows } = await db.query(
      'SELECT id, email, password_hash FROM public.users WHERE email = $1 LIMIT 1',
      [email.toLowerCase().trim()]
    );
    console.timeEnd('signin-db-fetch');

    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    console.time('signin-bcrypt');
    const valid = await bcrypt.compare(password, user.password_hash);
    console.timeEnd('signin-bcrypt');

    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const { rows: roleRows } = await db.query(
      'SELECT role FROM public.user_roles WHERE user_id = $1',
      [user.id]
    );
    const isAdmin = roleRows.some((r) => r.role === 'admin');
    const token = signToken({ sub: user.id, email: user.email });

    return res.json({ token, isAdmin });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    console.error('signin error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/signup ──────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8).max(72),
      full_name: z.string().min(2).max(120),
      student_id: z.string().min(1).max(40),
      course: z.string().max(80).optional(),
      year_level: z.coerce.number().min(1).max(6).optional(),
      section: z.string().max(40).optional().nullable(),
    });
    const data = schema.parse(req.body);
    const email = data.email.toLowerCase().trim();
    const db = req.app.locals.db;

    // Check duplicate email
    const { rows: existing } = await db.query(
      'SELECT id FROM public.users WHERE email = $1',
      [email]
    );
    if (existing.length > 0)
      return res.status(409).json({ error: 'An account with this email already exists' });

    // Check eligible voter
    const { rows: eligible } = await db.query(
      'SELECT 1 FROM public.eligible_voters WHERE student_id = $1 LIMIT 1',
      [data.student_id]
    );
    if (eligible.length === 0)
      return res
        .status(403)
        .json({ error: 'Your Student ID is not included in the list of eligible voters.' });

    // Check duplicate student_id
    const { rows: existingProfile } = await db.query(
      'SELECT 1 FROM public.profiles WHERE student_id = $1 LIMIT 1',
      [data.student_id]
    );
    if (existingProfile.length > 0)
      return res.status(409).json({ error: 'An account already exists for this Student ID.' });

    const password_hash = await bcrypt.hash(data.password, 12);

    const { rows: userRows } = await db.query(
      'INSERT INTO public.users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, password_hash]
    );
    const userId = userRows[0].id;

    await db.query(
      `INSERT INTO public.profiles (id, student_id, full_name, email, course, year_level, section)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, data.student_id, data.full_name, email, data.course ?? null, data.year_level ?? null, data.section ?? null]
    );

    await db.query(
      "INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'student') ON CONFLICT DO NOTHING",
      [userId]
    );

    return res.json({ ok: true });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    console.error('signup error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { rows } = await db.query(
      'SELECT * FROM public.profiles WHERE id = $1 LIMIT 1',
      [req.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Profile not found' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/auth/password ───────────────────────────────────────────────
router.patch('/password', requireAuth, async (req, res) => {
  try {
    const { password } = z.object({ password: z.string().min(8).max(72) }).parse(req.body);
    const db = req.app.locals.db;
    const password_hash = await bcrypt.hash(password, 12);
    await db.query('UPDATE public.users SET password_hash = $1 WHERE id = $2', [
      password_hash,
      req.userId,
    ]);
    return res.json({ ok: true });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
