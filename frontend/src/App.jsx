import { useEffect, useMemo, useState } from 'react';
import { api } from './api/client';
import MovieList from './components/MovieList';
import SeatSelection from './components/SeatSelection';
import BookingConfirmation from './components/BookingConfirmation';

function App() {
  const [movies, setMovies] = useState([]);
  const [shows, setShows] = useState([]);
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [selectedShowId, setSelectedShowId] = useState(null);
  const [seats, setSeats] = useState([]);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showsLoading, setShowsLoading] = useState(false);
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    api.getMovies()
      .then((data) => {
        if (active) setMovies(data.movies);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedMovie = useMemo(
    () => movies.find((movie) => movie.id === selectedMovieId) || null,
    [movies, selectedMovieId]
  );

  const selectedShow = useMemo(
    () => shows.find((show) => show.id === selectedShowId) || null,
    [shows, selectedShowId]
  );

  async function handleMovieSelect(movieId) {
    setSelectedMovieId(movieId);
    setSelectedShowId(null);
    setSeats([]);
    setError('');
    setShowsLoading(true);

    try {
      const data = await api.getShowsForMovie(movieId);
      setShows(data.shows);
    } catch (err) {
      setError(err.message);
      setShows([]);
    } finally {
      setShowsLoading(false);
    }
  }

  async function handleShowSelect(showId) {
    setSelectedShowId(showId);
    setSeats([]);
    setError('');
    setSeatsLoading(true);

    try {
      const data = await api.getShowSeats(showId);
      setSeats(data.seats);
    } catch (err) {
      setError(err.message);
      setSeats([]);
    } finally {
      setSeatsLoading(false);
    }
  }

  function handleBookingCreated(newBooking) {
    setBooking(newBooking);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function refreshSeats() {
    if (!selectedShowId) return;
    try {
      const data = await api.getShowSeats(selectedShowId);
      setSeats(data.seats);
    } catch (err) {
      setError(err.message);
    }
  }

  function startOver() {
    setBooking(null);
    setSelectedMovieId(null);
    setSelectedShowId(null);
    setShows([]);
    setSeats([]);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <div>
            <strong>MovieHub</strong>
            <span>Tickets made simple</span>
          </div>
        </div>
        <div className="architecture-badge">React · Node.js · PostgreSQL</div>
      </header>

      {booking ? (
        <main className="page-container confirmation-page">
          <BookingConfirmation booking={booking} onStartOver={startOver} />
        </main>
      ) : (
        <main className="page-container">
          <section className="hero">
            <div>
              <p className="eyebrow">NOW SHOWING</p>
              <h1>Find a movie. Pick your seats. Enjoy the show.</h1>
              <p className="hero-copy">
                A full-stack movie booking demo designed for a three-tier Kubernetes deployment.
              </p>
            </div>
            <div className="hero-stat">
              <span>STEP</span>
              <strong>{selectedShow ? '3' : selectedMovie ? '2' : '1'}</strong>
              <small>of 3</small>
            </div>
          </section>

          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}

          <MovieList
            movies={movies}
            shows={shows}
            selectedMovieId={selectedMovieId}
            selectedShowId={selectedShowId}
            onSelectMovie={handleMovieSelect}
            onSelectShow={handleShowSelect}
            loading={loading}
            showsLoading={showsLoading}
          />

          {selectedShow && (
            <SeatSelection
              key={selectedShow.id}
              movie={selectedMovie}
              show={selectedShow}
              seats={seats}
              loading={seatsLoading}
              onBookingCreated={handleBookingCreated}
              onError={setError}
              onRefreshSeats={refreshSeats}
            />
          )}
        </main>
      )}

      <footer className="footer">
        <span>MovieHub demo platform</span>
        <span>Built for Docker + Amazon EKS</span>
      </footer>
    </div>
  );
}

export default App;
