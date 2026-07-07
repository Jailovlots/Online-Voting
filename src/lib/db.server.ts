// Server-only PostgreSQL connection pool.
// Import ONLY in .server.ts files or server function handlers.
import { Pool } from 'pg';

let _pool: Pool | undefined;

export function getDb(): Pool {
  if (!_pool) {
    let connectionString = process.env.DATABASE_URL;

    if (connectionString) {
      try {
        const parsedUrl = new URL(connectionString);
        parsedUrl.searchParams.delete('sslmode');
        parsedUrl.searchParams.delete('channel_binding');
        connectionString = parsedUrl.toString();
      } catch (err) {
        // Ignore URL parsing errors
      }

      const isNeonOrVercel = connectionString.includes('neon.tech') || connectionString.includes('vercel-storage.com');

      _pool = new Pool({
        connectionString,
        ssl: isNeonOrVercel ? { rejectUnauthorized: false } : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
      });
    } else {
      const host = process.env.PG_HOST ?? 'localhost';
      const port = parseInt(process.env.PG_PORT ?? '5432', 10);
      const user = process.env.PG_USER ?? 'postgres';
      const password = process.env.PG_PASSWORD;
      const database = process.env.PG_DATABASE ?? 'onlineVoting_db';

      if (!password) {
        throw new Error(
          'PG_PASSWORD is not set. Add it to your .env file.',
        );
      }

      const isNeonOrVercel = host.includes('neon.tech') || host.includes('vercel-storage.com');

      _pool = new Pool({
        host,
        port,
        user,
        password,
        database,
        ssl: isNeonOrVercel ? { rejectUnauthorized: false } : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
      });
    }
  }
  return _pool;
}

// Convenience re-export so callers can write:
//   import { db } from '@/lib/db.server';
//   const rows = await db.query('SELECT ...', [...]);
export const db = new Proxy({} as Pool, {
  get(_, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
