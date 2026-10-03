import crypto from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

function makeBookingCode() {
  return `MH-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/', async (req, res, next) => {
  const { show_id: showId, seat_ids: seatIds, customer_name: customerName, customer_email: customerEmail } = req.body || {};

  if (!Number.isInteger(Number(showId)) || Number(showId) <= 0) {
    return res.status(400).json({ message: 'A valid show_id is required.' });
  }
  if (!Array.isArray(seatIds) || seatIds.length < 1 || seatIds.length > 8) {
    return res.status(400).json({ message: 'Choose between 1 and 8 seats.' });
  }
  if (!seatIds.every((id) => Number.isInteger(Number(id)) && Number(id) > 0)) {
    return res.status(400).json({ message: 'seat_ids must contain positive integers.' });
  }
  if (new Set(seatIds.map(Number)).size !== seatIds.length) {
    return res.status(400).json({ message: 'Duplicate seats were selected.' });
  }
  if (typeof customerName !== 'string' || customerName.trim().length < 2 || customerName.trim().length > 80) {
    return res.status(400).json({ message: 'Customer name must be 2-80 characters.' });
  }
  if (typeof customerEmail !== 'string' || customerEmail.length > 160 || !validEmail(customerEmail.trim())) {
    return res.status(400).json({ message: 'A valid customer email is required.' });
  }

  const numericShowId = Number(showId);
  const numericSeatIds = seatIds.map(Number);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock the show row so concurrent bookings for the same show serialize.
    const showResult = await client.query(`
      SELECT s.id, s.movie_id, s.cinema_name, s.screen_name,
             TO_CHAR(s.show_date, 'YYYY-MM-DD') AS show_date,
             TO_CHAR(s.start_time, 'HH24:MI') AS start_time,
             s.price,
             m.title AS movie_title
      FROM shows s
      JOIN movies m ON m.id = s.movie_id
      WHERE s.id = $1
      FOR UPDATE OF s;
    `, [numericShowId]);

    if (showResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Show not found.' });
    }

    const seatResult = await client.query(`
      SELECT id, seat_row, seat_number, status
      FROM show_seats
      WHERE show_id = $1 AND id = ANY($2::int[])
      ORDER BY seat_row, seat_number
      FOR UPDATE;
    `, [numericShowId, numericSeatIds]);

    if (seatResult.rowCount !== numericSeatIds.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'One or more selected seats do not belong to this show.' });
    }

    const unavailable = seatResult.rows.filter((seat) => seat.status !== 'AVAILABLE');
    if (unavailable.length > 0) {
      await client.query('ROLLBACK');
      const names = unavailable.map((seat) => `${seat.seat_row}${seat.seat_number}`).join(', ');
      return res.status(409).json({ message: `These seats are already booked: ${names}. Please choose different seats.` });
    }

    const show = showResult.rows[0];
    const totalAmount = Number(show.price) * seatResult.rows.length;
    const bookingCode = makeBookingCode();

    const bookingResult = await client.query(`
      INSERT INTO bookings (booking_code, show_id, customer_name, customer_email, total_amount)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, booking_code, customer_name, customer_email, total_amount, status,
                TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS created_at;
    `, [bookingCode, numericShowId, customerName.trim(), customerEmail.trim().toLowerCase(), totalAmount]);

    await client.query(`
      UPDATE show_seats
      SET status = 'BOOKED'
      WHERE show_id = $1 AND id = ANY($2::int[]);
    `, [numericShowId, numericSeatIds]);

    for (const seat of seatResult.rows) {
      await client.query(
        `INSERT INTO booking_seats (booking_id, show_seat_id) VALUES ($1, $2)`,
        [bookingResult.rows[0].id, seat.id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      booking: {
        ...bookingResult.rows[0],
        movie: { title: show.movie_title },
        show: {
          id: show.id,
          cinema_name: show.cinema_name,
          screen_name: show.screen_name,
          show_date: show.show_date,
          start_time: show.start_time
        },
        seats: seatResult.rows.map((seat) => ({
          id: seat.id,
          seat_row: seat.seat_row,
          seat_number: seat.seat_number
        }))
      }
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

router.get('/:bookingCode', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT b.id, b.booking_code, b.customer_name, b.customer_email, b.total_amount, b.status,
             TO_CHAR(b.created_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS created_at,
             m.title AS movie_title,
             s.cinema_name, s.screen_name,
             TO_CHAR(s.show_date, 'YYYY-MM-DD') AS show_date,
             TO_CHAR(s.start_time, 'HH24:MI') AS start_time,
             ss.id AS seat_id, ss.seat_row, ss.seat_number
      FROM bookings b
      JOIN shows s ON s.id = b.show_id
      JOIN movies m ON m.id = s.movie_id
      JOIN booking_seats bs ON bs.booking_id = b.id
      JOIN show_seats ss ON ss.id = bs.show_seat_id
      WHERE b.booking_code = $1
      ORDER BY ss.seat_row, ss.seat_number;
    `, [req.params.bookingCode]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const first = result.rows[0];
    res.json({
      booking: {
        id: first.id,
        booking_code: first.booking_code,
        customer_name: first.customer_name,
        customer_email: first.customer_email,
        total_amount: first.total_amount,
        status: first.status,
        created_at: first.created_at,
        movie: { title: first.movie_title },
        show: {
          cinema_name: first.cinema_name,
          screen_name: first.screen_name,
          show_date: first.show_date,
          start_time: first.start_time
        },
        seats: result.rows.map((row) => ({
          id: row.seat_id,
          seat_row: row.seat_row,
          seat_number: row.seat_number
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
