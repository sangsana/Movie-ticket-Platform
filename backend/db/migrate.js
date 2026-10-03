import { pool } from './pool.js';

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS movies (
      id SERIAL PRIMARY KEY,
      title VARCHAR(120) NOT NULL,
      description TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
      genre VARCHAR(60) NOT NULL,
      language VARCHAR(40) NOT NULL,
      certificate VARCHAR(10) NOT NULL DEFAULT 'U/A',
      poster_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS shows (
      id SERIAL PRIMARY KEY,
      movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      cinema_name VARCHAR(120) NOT NULL,
      screen_name VARCHAR(60) NOT NULL,
      show_date DATE NOT NULL,
      start_time TIME NOT NULL,
      price NUMERIC(10,2) NOT NULL CHECK (price > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (movie_id, cinema_name, screen_name, show_date, start_time)
    );

    CREATE TABLE IF NOT EXISTS show_seats (
      id SERIAL PRIMARY KEY,
      show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
      seat_row VARCHAR(2) NOT NULL,
      seat_number INTEGER NOT NULL CHECK (seat_number > 0),
      status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BOOKED')),
      UNIQUE (show_id, seat_row, seat_number)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id BIGSERIAL PRIMARY KEY,
      booking_code VARCHAR(32) NOT NULL UNIQUE,
      show_id INTEGER NOT NULL REFERENCES shows(id),
      customer_name VARCHAR(80) NOT NULL,
      customer_email VARCHAR(160) NOT NULL,
      total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
      status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS booking_seats (
      booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      show_seat_id INTEGER NOT NULL REFERENCES show_seats(id),
      PRIMARY KEY (booking_id, show_seat_id)
    );

    CREATE INDEX IF NOT EXISTS idx_shows_movie_date ON shows(movie_id, show_date);
    CREATE INDEX IF NOT EXISTS idx_show_seats_show ON show_seats(show_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_code ON bookings(booking_code);
  `);
}

async function seedData(client) {
  const movieCount = await client.query('SELECT COUNT(*)::int AS count FROM movies');
  if (movieCount.rows[0].count > 0) return;

  const movieRows = await client.query(`
    INSERT INTO movies (title, description, duration_minutes, genre, language, certificate, poster_url)
    VALUES
      ('Neon Horizon', 'A courier races through a hyper-connected megacity to deliver a message that could change the future.', 132, 'Sci-Fi', 'English', 'U/A', NULL),
      ('Midnight Protocol', 'A night-shift security analyst discovers a hidden operation buried inside the systems she protects.', 118, 'Thriller', 'English', 'UA 16+', NULL),
      ('Ocean of Stars', 'Two astronomers chase a once-in-a-generation signal while dealing with everything they left behind on Earth.', 126, 'Drama', 'English', 'U', NULL)
    RETURNING id, title;
  `);

  const ids = Object.fromEntries(movieRows.rows.map((row) => [row.title, row.id]));

  await client.query(`
    INSERT INTO shows (movie_id, cinema_name, screen_name, show_date, start_time, price)
    VALUES
      ($1, 'MovieHub Central', 'Screen 1', CURRENT_DATE, '11:00', 220),
      ($1, 'MovieHub Central', 'Screen 1', CURRENT_DATE + 1, '18:30', 260),
      ($2, 'MovieHub Central', 'Screen 2', CURRENT_DATE, '14:15', 240),
      ($2, 'MovieHub Central', 'Screen 2', CURRENT_DATE + 2, '21:00', 280),
      ($3, 'MovieHub Central', 'Screen 3', CURRENT_DATE + 1, '16:45', 230),
      ($3, 'MovieHub Central', 'Screen 3', CURRENT_DATE + 2, '19:30', 270)
    ON CONFLICT DO NOTHING;
  `, [ids['Neon Horizon'], ids['Midnight Protocol'], ids['Ocean of Stars']]);

  const shows = await client.query(`
    SELECT id
    FROM shows
    WHERE movie_id = ANY($1::int[])
    ORDER BY id;
  `, [[ids['Neon Horizon'], ids['Midnight Protocol'], ids['Ocean of Stars']]]);

  for (const show of shows.rows) {
    for (const row of 'ABCDEFGH') {
      for (let number = 1; number <= 10; number += 1) {
        await client.query(
          `INSERT INTO show_seats (show_id, seat_row, seat_number) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [show.id, row, number]
        );
      }
    }
  }
}

export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(739201)');
    await client.query('BEGIN');
    await ensureSchema(client);
    await seedData(client);
    await client.query('COMMIT');
    console.log('Database schema is ready.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.query('SELECT pg_advisory_unlock(739201)').catch(() => {});
    client.release();
  }
}

if (process.argv[1]?.endsWith('/migrate.js')) {
  try {
    await migrate();
    await pool.end();
  } catch (error) {
    console.error('Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}
