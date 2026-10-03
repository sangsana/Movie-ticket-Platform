function BookingConfirmation({ booking, onStartOver }) {
  return (
    <section className="confirmation-card">
      <div className="confirmation-icon">✓</div>
      <p className="eyebrow">BOOKING CONFIRMED</p>
      <h1>Your movie night is booked.</h1>
      <p className="confirmation-copy">
        A confirmation has been generated for {booking.customer_name}.
      </p>

      <div className="ticket-card">
        <div className="ticket-main">
          <span className="ticket-label">Booking reference</span>
          <strong className="booking-code">{booking.booking_code}</strong>
          <h2>{booking.movie.title}</h2>
          <p>{formatDate(booking.show.show_date)} · {formatTime(booking.show.start_time)}</p>
          <p>{booking.show.cinema_name} · {booking.show.screen_name}</p>
        </div>
        <div className="ticket-divider" />
        <div className="ticket-side">
          <span>Seats</span>
          <strong>{booking.seats.map((seat) => `${seat.seat_row}${seat.seat_number}`).join(', ')}</strong>
          <span>Total</span>
          <strong>₹{Number(booking.total_amount).toFixed(0)}</strong>
        </div>
      </div>

      <button className="primary-button narrow" type="button" onClick={onStartOver}>
        Book another movie
      </button>
    </section>
  );
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
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

export default BookingConfirmation;
