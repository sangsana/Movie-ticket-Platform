import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import moviesRouter from './routes/movies.js';
import showsRouter from './routes/shows.js';
import bookingsRouter from './routes/bookings.js';
import { pool } from './db/pool.js';
import { migrate } from './db/migrate.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);

const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const corsOrigin = (origin, callback) => {
  if (!origin || configuredOrigins.length === 0 || configuredOrigins.includes('*') || configuredOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error('Origin not allowed by CORS.'));
};

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'up', service: 'movie-ticket-backend' });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'down' });
  }
});

app.use('/api/movies', moviesRouter);
app.use('/api/shows', showsRouter);
app.use('/api/bookings', bookingsRouter);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Internal server error.' });
});

async function start() {
  try {
    await migrate();
    app.listen(PORT, () => {
      console.log(`Movie ticket backend listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start backend:', error);
    process.exit(1);
  }
}

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down...`);
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
