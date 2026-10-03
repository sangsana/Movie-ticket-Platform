const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Ignore non-JSON responses.
  }

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed with status ${response.status}`);
  }

  return payload;
}

export const api = {
  getMovies: () => request('/movies'),
  getShowsForMovie: (movieId) => request(`/movies/${movieId}/shows`),
  getShowSeats: (showId) => request(`/shows/${showId}/seats`),
  createBooking: (payload) => request('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  getBooking: (bookingCode) => request(`/bookings/${encodeURIComponent(bookingCode)}`)
};
