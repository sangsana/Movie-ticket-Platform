function MovieList({
  movies,
  shows,
  selectedMovieId,
  selectedShowId,
  onSelectMovie,
  onSelectShow,
  loading,
  showsLoading
}) {
  if (loading) {
    return <section className="panel"><div className="loading-state">Loading movies…</div></section>;
  }

  return (
    <section className="panel movie-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">01 / MOVIES</p>
          <h2>Choose your movie</h2>
        </div>
        <span className="hint">Select a title to see available shows</span>
      </div>

      <div className="movie-grid">
        {movies.map((movie) => {
          const selected = movie.id === selectedMovieId;
          return (
            <button
              key={movie.id}
              className={`movie-card ${selected ? 'selected' : ''}`}
              onClick={() => onSelectMovie(movie.id)}
              type="button"
            >
              <div className={`poster poster-${(movie.id % 4) + 1}`}>
                <span>{movie.title.slice(0, 1)}</span>
              </div>
              <div className="movie-content">
                <div className="movie-topline">
                  <span className="movie-genre">{movie.genre}</span>
                  <span className="certificate">{movie.certificate}</span>
                </div>
                <h3>{movie.title}</h3>
                <p>{movie.description}</p>
                <div className="movie-meta">
                  <span>{movie.duration_minutes} min</span>
                  <span>{movie.language}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedMovieId && (
        <div className="shows-area">
          <div className="subsection-heading">
            <div>
              <p className="eyebrow">02 / SHOWTIME</p>
              <h2>Pick a show</h2>
            </div>
            {showsLoading && <span className="hint">Loading shows…</span>}
          </div>

          {!showsLoading && (
            <div className="show-grid">
              {shows.map((show) => (
                <button
                  key={show.id}
                  className={`show-card ${show.id === selectedShowId ? 'selected' : ''}`}
                  onClick={() => onSelectShow(show.id)}
                  type="button"
                >
                  <span className="show-date">{formatDate(show.show_date)}</span>
                  <strong>{formatTime(show.start_time)}</strong>
                  <span>{show.cinema_name} · {show.screen_name}</span>
                  <span className="show-price">₹{Number(show.price).toFixed(0)}</span>
                </button>
              ))}
              {shows.length === 0 && <div className="empty-state">No shows are currently available.</div>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  }).format(new Date(`${value}T00:00:00`));
}

function formatTime(value) {
  const [hour, minute] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export default MovieList;
