const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Express middleware — verifies the Bearer JWT token in Authorization header.
 * Attaches `req.userId` and `req.userEmail` on success.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Checks if the authenticated user has admin role.
 * Must be called AFTER requireAuth.
 */
async function requireAdmin(req, res, db, next) {
  const { rows } = await db.query(
    "SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role = 'admin' LIMIT 1",
    [req.userId]
  );
  if (rows.length === 0) {
    return res.status(403).json({ error: 'Forbidden: admin only' });
  }
  next();
}

/**
 * Checks if the authenticated user has admin or officer role.
 */
async function requireAdminOrOfficer(req, res, db, next) {
  const { rows } = await db.query(
    "SELECT 1 FROM public.user_roles WHERE user_id = $1 AND role IN ('admin', 'officer') LIMIT 1",
    [req.userId]
  );
  if (rows.length === 0) {
    return res.status(403).json({ error: 'Forbidden: admin or officer only' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireAdminOrOfficer };
