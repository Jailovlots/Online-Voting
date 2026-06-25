import { createServerFn } from '@tanstack/react-start';
import { db } from '@/lib/db.server';
import { requireAuth } from '@/lib/auth-middleware';

// ── Positions ────────────────────────────────────────────────────────────────
export const getPositions = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const { rows } = await (ctx.context as any).db.query(
      'SELECT * FROM public.positions ORDER BY order_index',
    );
    return rows;
  });

// ── Candidates ───────────────────────────────────────────────────────────────
export const getCandidates = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const { rows } = await (ctx.context as any).db.query(
      'SELECT * FROM public.candidates ORDER BY created_at',
    );
    return rows;
  });

export const getApprovedCandidates = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const { rows } = await (ctx.context as any).db.query(
      'SELECT * FROM public.candidates WHERE approved = true ORDER BY created_at',
    );
    return rows;
  });

// ── Elections ─────────────────────────────────────────────────────────────────
export const getElections = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const { rows } = await (ctx.context as any).db.query(
      'SELECT * FROM public.elections ORDER BY starts_at DESC',
    );
    return rows;
  });

export const getActiveElection = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const { rows } = await (ctx.context as any).db.query(
      "SELECT * FROM public.elections WHERE status = 'active' LIMIT 1",
    );
    return rows[0] ?? null;
  });

// ── Announcements ─────────────────────────────────────────────────────────────
export const getAnnouncements = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const { rows } = await (ctx.context as any).db.query(
      'SELECT * FROM public.announcements ORDER BY pinned DESC, created_at DESC',
    );
    return rows;
  });

export const getAnnouncementsPreview = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const { rows } = await (ctx.context as any).db.query(
      'SELECT * FROM public.announcements ORDER BY pinned DESC, created_at DESC LIMIT 3',
    );
    return rows;
  });

// ── Audit Logs ────────────────────────────────────────────────────────────────
export const getAuditLogs = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const { rows } = await (ctx.context as any).db.query(
      'SELECT * FROM public.audit_logs ORDER BY created_at DESC LIMIT 200',
    );
    return rows;
  });

// ── Profile ───────────────────────────────────────────────────────────────────
export const getMyProfile = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const { rows } = await context.db.query(
      'SELECT * FROM public.profiles WHERE id = $1 LIMIT 1',
      [context.userId],
    );
    return rows[0] ?? null;
  });

// Returns only the approval/registration flag — used to gate the voting UI.
export const getMyRegistrationStatus = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const { rows } = await context.db.query(
      'SELECT is_registered FROM public.profiles WHERE id = $1 LIMIT 1',
      [context.userId],
    );
    return { isApproved: rows[0]?.is_registered === true };
  });

export const getMyRoles = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const { rows } = await context.db.query(
      'SELECT role FROM public.user_roles WHERE user_id = $1',
      [context.userId],
    );
    return rows.map((r: { role: string }) => r.role);
  });

// ── Dashboard Stats ───────────────────────────────────────────────────────────
export const getDashboardStats = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const db = (ctx.context as any).db;
    const [
      { rows: elections },
      { rows: announcementsPreview },
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
    return {
      elections,
      announcements: announcementsPreview,
      positionsCount: Number(positionsCount[0]?.count ?? 0),
      candidatesCount: Number(candidatesCount[0]?.count ?? 0),
      votesCount: Number(votesCount[0]?.count ?? 0),
    };
  });

export const getAdminDashboardStats = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const db = (ctx.context as any).db;
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
    return {
      profilesCount: Number(profilesCount[0]?.count ?? 0),
      candidatesCount: Number(candidatesCount[0]?.count ?? 0),
      elections,
      votes,
      positions,
    };
  });

// ── Votes ────────────────────────────────────────────────────────────────────
export const getVotes = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const { rows } = await (ctx.context as any).db.query(
      'SELECT * FROM public.votes',
    );
    return rows;
  });
