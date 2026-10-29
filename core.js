export function minutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function clock(value, withDay = false) {
  const n = Math.round(value);
  const time = `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  return time + (withDay && n >= 1440 ? ' (+1 día)' : '');
}

export function normalize(value) {
  return String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function endOf(event, films) {
  const duration = films[event.filmId]?.duration;
  return Number.isFinite(duration) && duration > 0 ? event.start + duration : null;
}

export function matches(event, film, filters) {
  if (filters.venue && event.venueId !== filters.venue) return false;
  if (filters.section && film.section !== filters.section) return false;
  return normalize([film.title, film.originalTitle, film.director, film.countries, film.alias || ''].join(' ')).includes(normalize(filters.search).trim());
}
