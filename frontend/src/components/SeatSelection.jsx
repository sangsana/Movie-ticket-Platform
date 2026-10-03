import { useMemo, useState } from 'react';
import { api } from '../api/client';

const MAX_SEATS = 8;

function SeatSelection({ movie, show, seats, loading, onBookingCreated, onError, onRefreshSeats }) {
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const groupedSeats = useMemo(() => {
    return seats.reduce((groups, seat) => {
      if (!groups[seat.seat_row]) groups[seat.seat_row] = [];
      groups[seat.seat_row].push(seat);
      return groups;
    }, {});
  }, [seats]);

  const selectedSeats = seats.filter((seat) => selectedSeatIds.includes(seat.id));
  const total = Number(show.price) * selectedSeats.length;

  function toggleSeat(seat) {
    if (seat.status !== 'AVAILABLE') return;

    setSelectedSeatIds((current) => {
      if (current.includes(seat.id)) return current.filter((id) => id !== seat.id);
      if (current.length >= MAX_SEATS) return current;
      return [...current, seat.id];
    });
  }

  async function submitBooking(event) {
    event.preventDefault();
    onError('');

    if (selectedSeatIds.length === 0) {
      onError('Select at least one seat.');
      return;
    }
    if (!customerName.trim() || !customerEmail.trim()) {
      onError('Enter your name and email before booking.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.createBooking({
        show_id: show.id,
        seat_ids: selectedSeatIds,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim()
      });
      onBookingCreated(result.booking);
    } catch (err) {
      onError(err.message);
      if (err.message.toLowerCase().includes('seat') && onRefreshSeats) {
        setSelectedSeatIds([]);
        await onRefreshSeats();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel seat-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">03 / SEATS & BOOKING</p>
          <h2>{movie.title}</h2>
          <p className="selection-summary">
            {formatDate(show.show_date)} · {formatTime(show.start_time)} · {show.cinema_name} · {show.screen_name}
          </p>
        </div>
        <div className="price-chip">₹{Number(show.price).toFixed(0)} / seat</div>
      </div>

      {loading ? (
        <div className="loading-state">Loading seat map…</div>
      ) : (
        <div className="booking-layout">
          <div className="seat-map-wrapper">
            <div className="screen">SCREEN</div>
            <div className="seat-map">
              {Object.entries(groupedSeats).map(([row, rowSeats]) => (
                <div className="seat-row" key={row}>
                  <span className="row-label">{row}</span>
                  {rowSeats.map((seat) => {
                    const selected = selectedSeatIds.includes(seat.id);
                    return (
                      <button
                        key={seat.id}
                        type="button"
                        disabled={seat.status !== 'AVAILABLE'}
                        className={`seat ${seat.status.toLowerCase()} ${selected ? 'selected' : ''}`}
                        title={`${seat.seat_row}${seat.seat_number}`}
                        onClick={() => toggleSeat(seat)}
                      >
                        {seat.seat_number}
                      </button>
                    );
                  })}
                  <span className="row-label">{row}</span>
                </div>
              ))}
            </div>
            <div className="seat-legend">
              <Legend className="available" label="Available" />
              <Legend className="selected" label="Selected" />
              <Legend className="booked" label="Booked" />
            </div>
            <p className="seat-limit">Up to {MAX_SEATS} seats per booking.</p>
          </div>

          <form className="booking-form" onSubmit={submitBooking}>
            <div className="booking-summary">
              <span>Selected seats</span>
              <strong>{selectedSeats.length ? selectedSeats.map((s) => `${s.seat_row}${s.seat_number}`).join(', ') : 'None'}</strong>
            </div>
            <label>
              Full name
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Sandeep Sunny"
                maxLength="80"
                autoComplete="name"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength="120"
                autoComplete="email"
              />
            </label>
            <div className="total-row">
              <span>Total</span>
              <strong>₹{total.toFixed(0)}</strong>
            </div>
            <button className="primary-button" type="submit" disabled={submitting || selectedSeats.length === 0}>
              {submitting ? 'Booking…' : 'Confirm booking'}
            </button>
            <p className="micro-copy">Seats are reserved atomically in PostgreSQL when you confirm.</p>
          </form>
        </div>
      )}
    </section>
  );
}

function Legend({ className, label }) {
  return (
    <span className="legend-item">
      <i className={`legend-dot ${className}`} />
      {label}
    </span>
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

export default SeatSelection;
