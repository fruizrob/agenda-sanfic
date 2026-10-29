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

export function pairsFor(selection, events, films, buffer = 15) {
  const chosen = events.filter(e => selection.has(e.id));
  const pairs = [];
  for (let a = 0; a < chosen.length; a++) {
    for (let b = a + 1; b < chosen.length; b++) {
      let first = chosen[a], second = chosen[b];
      if (first.date !== second.date) continue;
      if (first.start > second.start || (first.start === second.start && first.id > second.id)) [first, second] = [second, first];
      const finish = endOf(first, films), otherFinish = endOf(second, films);
      if (finish === null || otherFinish === null) {
        pairs.push({ first, second, type: 'unknown', gap: null, required: null });
        continue;
      }
      const gap = second.start - finish;
      const required = first.roomId === second.roomId ? 0 : buffer;
      const overlap = first.start < otherFinish && second.start < finish;
      if (overlap || gap < required) pairs.push({ first, second, type: overlap ? 'overlap' : 'transfer', gap, required });
    }
  }
  return pairs;
}

export function eventState(event, selection, events, films, buffer) {
  const selected = selection.has(event.id);
  const next = new Set(selection);
  next.add(event.id);
  const pairs = pairsFor(next, events, films, buffer).filter(p => p.first.id === event.id || p.second.id === event.id);
  return { selected, pairs, overlap: pairs.some(p => p.type === 'overlap'), transfer: pairs.some(p => p.type === 'transfer'), unknown: pairs.some(p => p.type === 'unknown') };
}

export function matches(event, film, filters) {
  if (filters.venue && event.venueId !== filters.venue) return false;
  if (filters.section && film.section !== filters.section) return false;
  if (filters.onlySelected && !filters.selection.has(event.id)) return false;
  return normalize([film.title, film.originalTitle, film.director, film.countries, film.alias || ''].join(' ')).includes(normalize(filters.search).trim());
}

export function calendarFile(selection, events, films, rooms) {
  const escape = text => String(text).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const utc = (date, value) => new Date(`${date}T00:00:00-03:00`).getTime() + value * 60000;
  const format = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agenda SANFIC22//ES', 'CALSCALE:GREGORIAN'];
  for (const event of events.filter(e => selection.has(e.id))) {
    const film = films[event.filmId], room = rooms.find(r => r.id === event.roomId), finish = endOf(event, films);
    if (finish === null) continue;
    lines.push('BEGIN:VEVENT', `UID:${event.id}@sanfic22-agenda`, `DTSTAMP:${stamp}`, `DTSTART:${format(utc(event.date, event.start))}`, `DTEND:${format(utc(event.date, finish))}`, `SUMMARY:${escape(film.title)}`, `LOCATION:${escape(`${room.venue} · Sala ${room.number}`)}`, `DESCRIPTION:${escape('Término calculado por metraje. No incluye presentación ni conversatorio. ' + film.source)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  // Fold at UTF-8 octet boundaries, as required by RFC 5545.
  return lines.map(line => {
    const chunks = []; let current = '', size = 0;
    for (const char of line) {
      const bytes = new TextEncoder().encode(char).length;
      if (size + bytes > 74) { chunks.push(current); current = ' '; size = 1; }
      current += char; size += bytes;
    }
    chunks.push(current); return chunks.join('\r\n');
  }).join('\r\n') + '\r\n';
}
