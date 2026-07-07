// Auth server functions: signIn, signUp, getCurrentUser, updatePassword.
// These replace all supabase.auth.* calls from the route files.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { db } from '@/lib/db.server';
import { hashPassword, verifyPassword, signToken } from '@/lib/auth.server';
import { requireAuth } from '@/lib/auth-middleware';

// ── Sign In ─────────────────────────────────────────────────────────────────
export const signIn = createServerFn({ method: 'POST' })
  .inputValidator((d: { email: string; password: string }) =>
    z.object({ email: z.string().email(), password: z.string().min(1) }).parse(d),
  )
  .handler(async (ctx) => {
    console.time('login-total');
    const data = ctx.data as { email: string; password: string };
    
    console.time('login-db-user-fetch');
    const { rows } = await db.query<{ id: string; email: string; password_hash: string }>(
      'SELECT id, email, password_hash FROM public.users WHERE email = $1 LIMIT 1',
      [data.email.toLowerCase().trim()],
    );
    console.timeEnd('login-db-user-fetch');

    const user = rows[0];
    if (!user) {
      console.timeEnd('login-total');
      throw new Error('Invalid email or password');
    }

    console.time('login-password-verify');
    const valid = await verifyPassword(data.password, user.password_hash);
    console.timeEnd('login-password-verify');

    if (!valid) {
      console.timeEnd('login-total');
      throw new Error('Invalid email or password');
    }

    // Fetch role
    console.time('login-db-role-fetch');
    const { rows: roleRows } = await db.query<{ role: string }>(
      'SELECT role FROM public.user_roles WHERE user_id = $1',
      [user.id],
    );
    console.timeEnd('login-db-role-fetch');

    const isAdmin = roleRows.some((r: { role: string }) => r.role === 'admin');

    console.time('login-token-sign');
    const token = signToken({ sub: user.id, email: user.email });
    console.timeEnd('login-token-sign');

    console.timeEnd('login-total');
    return { token, isAdmin };
  });

// ── Sign Up ─────────────────────────────────────────────────────────────────
export const signUp = createServerFn({ method: 'POST' })
  .inputValidator((d: any) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8).max(72),
        full_name: z.string().min(2).max(120),
        student_id: z.string().min(1).max(40),
        course: z.string().max(80).optional(),
        year_level: z.coerce.number().min(1).max(6).optional(),
        section: z.string().max(40).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async (ctx) => {
    const data = ctx.data as any;
    const email = data.email.toLowerCase().trim();

    // Check duplicate email
    const { rows: existing } = await db.query(
      'SELECT id FROM public.users WHERE email = $1',
      [email],
    );
    if (existing.length > 0) throw new Error('An account with this email already exists');

    // Check if student_id is in the eligible voters list
    const { rows: eligibleRows } = await db.query(
      'SELECT 1 FROM public.eligible_voters WHERE student_id = $1 LIMIT 1',
      [data.student_id],
    );
    if (eligibleRows.length === 0)
      throw new Error('Your Student ID is not included in the list of eligible voters.');

    // Check if student_id already has an account
    const { rows: existingProfile } = await db.query(
      'SELECT 1 FROM public.profiles WHERE student_id = $1 LIMIT 1',
      [data.student_id],
    );
    if (existingProfile.length > 0)
      throw new Error('An account already exists for this Student ID.');

    const password_hash = await hashPassword(data.password);

    // Insert user
    const { rows: userRows } = await db.query<{ id: string }>(
      'INSERT INTO public.users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [email, password_hash],
    );
    const userId = userRows[0].id;

    // Insert profile
    await db.query(
      `INSERT INTO public.profiles (id, student_id, full_name, email, course, year_level, section)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, data.student_id, data.full_name, email, data.course ?? null, data.year_level ?? null, data.section ?? null],
    );

    // Assign student role
    await db.query(
      'INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, 'student'],
    );

    return { ok: true };
  });

// ── Get Current User ─────────────────────────────────────────────────────────
export const getCurrentUser = createServerFn({ method: 'GET' })
  .middleware([requireAuth])
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const { rows } = await context.db.query(
      'SELECT * FROM public.profiles WHERE id = $1 LIMIT 1',
      [context.userId],
    );
    if (!rows[0]) throw new Error('Profile not found');
    return rows[0];
  });

// ── Sign Out (client-side only — just clears localStorage) ───────────────────
// No server function needed: client calls clearToken() from session-store.ts

// ── Update Password ──────────────────────────────────────────────────────────
export const updatePassword = createServerFn({ method: 'POST' })
  .middleware([requireAuth])
  .inputValidator((d: { password: string }) =>
    z.object({ password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async (ctx) => {
    const context = ctx.context as any;
    const data = ctx.data as { password: string };
    const password_hash = await hashPassword(data.password);
    await context.db.query(
      'UPDATE public.users SET password_hash = $1 WHERE id = $2',
      [password_hash, context.userId],
    );
    return { ok: true };
  });

// ── Get User Roles ────────────────────────────────────────────────────────────
export const getUserRoles = createServerFn({ method: 'GET' })
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
      roles,
    };
  });
