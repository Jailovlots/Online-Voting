require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getDb } = require('./db');

// Routes
const authRoutes = require('./routes/auth');
const queriesRoutes = require('./routes/queries');
const votingRoutes = require('./routes/voting');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ──────────────────────────────────────────────────────────────────
// Allow the Vercel frontend + local dev to call this API
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Always allow localhost for dev
const devOrigins = ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, etc.)
      if (!origin) return callback(null, true);
      const allowed = [...allowedOrigins, ...devOrigins];
      if (allowed.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ── Body Parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Database ───────────────────────────────────────────────────────────────
// Attach the database pool to app.locals so all routes can use req.app.locals.db
app.locals.db = getDb();

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const { rows } = await req.app.locals.db.query('SELECT NOW() as time');
    return res.json({ ok: true, time: rows[0].time, env: process.env.NODE_ENV });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/queries', queriesRoutes);
app.use('/api/voting', votingRoutes);
app.use('/api/admin', adminRoutes);

// ── 404 ────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Global Error Handler ───────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Campus E-Vote API running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
});
