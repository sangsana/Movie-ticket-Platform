import pg from 'pg';

const { Pool } = pg;

const useSsl = String(process.env.DB_SSL || 'false').toLowerCase() === 'true';

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'movie_booking',
  user: process.env.DB_USER || 'movie_user',
  password: process.env.DB_PASSWORD || 'change_me',
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});
