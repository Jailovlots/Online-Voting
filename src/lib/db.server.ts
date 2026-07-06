// Server-only PostgreSQL connection pool.
// Import ONLY in .server.ts files or server function handlers.
import { Pool } from 'pg';

let _pool: Pool | undefined;

export function getDb(): Pool {
  if (!_pool) {
    let connectionString = process.env.DATABASE_URL;

    if (connectionString) {
      // Silence pg connection warnings by replacing sslmode aliases with verify-full
      connectionString = connectionString
        .replace('sslmode=require', 'sslmode=verify-full')
        .replace('sslmode=prefer', 'sslmode=verify-full')
        .replace('sslmode=verify-ca', 'sslmode=verify-full');

      const isNeonOrVercel = connectionString.includes('neon.tech') || connectionString.includes('vercel-storage.com');

      _pool = new Pool({
        connectionString,
        ssl: isNeonOrVercel ? { rejectUnauthorized: false } : undefined,
        max: 50,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
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

      _pool = new Pool({
        host,
        port,
        user,
        password,
        database,
        max: 50, // Support up to 50 simultaneous DB connections for ~200 concurrent users
        idleTimeoutMillis: 30000, // Release idle connections after 30 seconds
        connectionTimeoutMillis: 5000, // Fail fast if the pool is exhausted (instead of hanging)
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
