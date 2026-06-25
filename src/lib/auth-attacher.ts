// Client-side middleware: attaches JWT from localStorage as Authorization header
// on every TanStack server function call.
// Replaces @/integrations/supabase/auth-attacher
import { createMiddleware } from '@tanstack/react-start';
import { getToken } from '@/lib/session-store';

export const attachAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const token = getToken();
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
