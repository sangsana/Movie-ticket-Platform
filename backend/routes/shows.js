import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

router.get('/:showId/seats', async (req, res, next) => {
  const showId = Number(req.params.showId);
  if (!Number.isInteger(showId)) {
    return res.status(400).json({ message: 'showId must be an integer.' });
  }

  try {
    const show = await pool.query(`
      SELECT s.id, s.movie_id, s.cinema_name, s.screen_name,
             TO_CHAR(s.show_date, 'YYYY-MM-DD') AS show_date,
             TO_CHAR(s.start_time, 'HH24:MI') AS start_time,
             s.price,
             m.title AS movie_title
      FROM shows s
      JOIN movies m ON m.id = s.movie_id
      WHERE s.id = $1;
    `, [showId]);

    if (show.rowCount === 0) {
      return res.status(404).json({ message: 'Show not found.' });
    }

    const seats = await pool.query(`
      SELECT id, seat_row, seat_number, status
      FROM show_seats
      WHERE show_id = $1
      ORDER BY seat_row, seat_number;
    `, [showId]);

    res.json({ show: show.rows[0], seats: seats.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
