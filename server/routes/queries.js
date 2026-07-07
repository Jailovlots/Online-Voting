const express = require('express');
const { requireAuth, requireAdmin, requireAdminOrOfficer } = require('../middleware/auth');

const router = express.Router();

// All routes require auth
router.use(requireAuth);

// ── GET /api/queries/positions ─────────────────────────────────────────────
router.get('/positions', async (req, res) => {
  try {
    const { rows } = await req.app.locals.db.query(
      'SELECT * FROM public.positions ORDER BY order_index'
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/candidates ────────────────────────────────────────────
router.get('/candidates', async (req, res) => {
  try {
    const { rows } = await req.app.locals.db.query(
      'SELECT * FROM public.candidates ORDER BY created_at'
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/candidates/approved ──────────────────────────────────
router.get('/candidates/approved', async (req, res) => {
  try {
    const { rows } = await req.app.locals.db.query(
      'SELECT * FROM public.candidates WHERE approved = true ORDER BY created_at'
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/elections ─────────────────────────────────────────────
router.get('/elections', async (req, res) => {
  try {
    const { rows } = await req.app.locals.db.query(
      'SELECT * FROM public.elections ORDER BY starts_at DESC'
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/elections/active ─────────────────────────────────────
router.get('/elections/active', async (req, res) => {
  try {
    const { rows } = await req.app.locals.db.query(
      "SELECT * FROM public.elections WHERE status = 'active' LIMIT 1"
    );
    return res.json(rows[0] ?? null);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/announcements ────────────────────────────────────────
router.get('/announcements', async (req, res) => {
  try {
    const { rows } = await req.app.locals.db.query(
      'SELECT * FROM public.announcements ORDER BY pinned DESC, created_at DESC'
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/announcements/preview ────────────────────────────────
router.get('/announcements/preview', async (req, res) => {
  try {
    const { rows } = await req.app.locals.db.query(
      'SELECT * FROM public.announcements ORDER BY pinned DESC, created_at DESC LIMIT 3'
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/audit-logs ───────────────────────────────────────────
router.get('/audit-logs', async (req, res) => {
  try {
    const { rows } = await req.app.locals.db.query(
      'SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT 200'
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/profile ──────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    const { rows } = await req.app.locals.db.query(
      'SELECT * FROM public.profiles WHERE id = $1 LIMIT 1',
      [req.userId]
    );
    return res.json(rows[0] ?? null);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/profile/registration-status ──────────────────────────
router.get('/profile/registration-status', async (req, res) => {
  try {
    const { rows } = await req.app.locals.db.query(
      'SELECT is_registered FROM public.profiles WHERE id = $1 LIMIT 1',
      [req.userId]
    );
    return res.json({ isApproved: rows[0]?.is_registered === true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/roles ────────────────────────────────────────────────
router.get('/roles', async (req, res) => {
  try {
    const { rows } = await req.app.locals.db.query(
      'SELECT role FROM public.user_roles WHERE user_id = $1',
      [req.userId]
    );
    const roles = rows.map((r) => r.role);
    const isAdmin = roles.includes('admin');
    const isStudent = roles.includes('student');
    return res.json({ roles, isAdmin, isStudent, userId: req.userId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/dashboard/student ────────────────────────────────────
router.get('/dashboard/student', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const [
      { rows: elections },
      { rows: announcements },
      { rows: positionsCount },
      { rows: candidatesCount },
      { rows: votesCount },
    ] = await Promise.all([
      db.query('SELECT * FROM public.elections ORDER BY starts_at DESC'),
      db.query('SELECT * FROM public.announcements ORDER BY pinned DESC, created_at DESC LIMIT 3'),
      db.query('SELECT COUNT(*) AS count FROM public.positions'),
      db.query("SELECT COUNT(*) AS count FROM public.candidates WHERE approved = true"),
      db.query('SELECT COUNT(*) AS count FROM public.votes'),
    ]);
    return res.json({
      elections,
      announcements,
      positionsCount: Number(positionsCount[0]?.count ?? 0),
      candidatesCount: Number(candidatesCount[0]?.count ?? 0),
      votesCount: Number(votesCount[0]?.count ?? 0),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/dashboard/admin ──────────────────────────────────────
router.get('/dashboard/admin', async (req, res) => {
  try {
    const db = req.app.locals.db;
    await requireAdminOrOfficer(req, res, db, async () => {
      const [
        { rows: profilesCount },
        { rows: candidatesCount },
        { rows: elections },
        { rows: votes },
        { rows: positions },
      ] = await Promise.all([
        db.query('SELECT COUNT(*) AS count FROM public.profiles'),
        db.query('SELECT COUNT(*) AS count FROM public.candidates'),
        db.query("SELECT * FROM public.elections WHERE status = 'active'"),
        db.query('SELECT position_id FROM public.votes'),
        db.query('SELECT * FROM public.positions ORDER BY order_index'),
      ]);
      return res.json({
        profilesCount: Number(profilesCount[0]?.count ?? 0),
        candidatesCount: Number(candidatesCount[0]?.count ?? 0),
        elections,
        votes,
        positions,
      });
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/queries/votes ─────────────────────────────────────────────────
router.get('/votes', async (req, res) => {
  try {
    const { rows } = await req.app.locals.db.query('SELECT * FROM public.votes');
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
