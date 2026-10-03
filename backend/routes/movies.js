import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, title, description, duration_minutes, genre, language, certificate, poster_url
      FROM movies
      ORDER BY id;
    `);
    res.json({ movies: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:movieId/shows', async (req, res, next) => {
  const movieId = Number(req.params.movieId);
  if (!Number.isInteger(movieId)) {
    return res.status(400).json({ message: 'movieId must be an integer.' });
  }

  try {
    const result = await pool.query(`
      SELECT id, movie_id, cinema_name, screen_name,
             TO_CHAR(show_date, 'YYYY-MM-DD') AS show_date,
             TO_CHAR(start_time, 'HH24:MI') AS start_time,
             price
      FROM shows
      WHERE movie_id = $1 AND show_date >= CURRENT_DATE
      ORDER BY show_date, start_time;
    `, [movieId]);

    res.json({ shows: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
