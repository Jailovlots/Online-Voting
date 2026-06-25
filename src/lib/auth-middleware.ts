// Auth middleware: reads JWT from Authorization header and attaches userId to context.
// Replaces @/integrations/supabase/auth-middleware
import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { verifyToken } from '@/lib/auth.server';
import { db } from '@/lib/db.server';

export const requireAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }: { next: any }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Error('Unauthorized: No request headers available');
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized: No bearer token provided');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) throw new Error('Unauthorized: Empty token');

    let payload: { sub: string; email: string };
    try {
      payload = verifyToken(token);
    } catch {
      throw new Error('Unauthorized: Invalid or expired token');
    }

    return next({
      context: {
        db,
        userId: payload.sub,
        email: payload.email,
      },
    });
  },
);
