require('dotenv').config();
const { Pool } = require('pg');

let _pool;

function getDb() {
  if (!_pool) {
    let connectionString = process.env.DATABASE_URL;

    if (connectionString) {
      try {
        const parsedUrl = new URL(connectionString);
        parsedUrl.searchParams.delete('sslmode');
        parsedUrl.searchParams.delete('channel_binding');
        connectionString = parsedUrl.toString();
      } catch (err) {
        // ignore
      }
    }

    const isNeon =
      (connectionString || '').includes('neon.tech') ||
      (connectionString || '').includes('vercel-storage.com');

    _pool = new Pool({
      connectionString,
      ssl: isNeon ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });

    _pool.on('error', (err) => {
      console.error('Unexpected error on idle DB client', err);
    });
  }
  return _pool;
}

module.exports = { getDb };
