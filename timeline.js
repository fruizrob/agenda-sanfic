import { clock, endOf, matches } from './core.js?v=20261028-2';

export const RANGE = { start: 900, end: 1500 };
export const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const sectionStyle = section => `--event-color:${section.color};--event-edge:${section.edge};--event-ink:${section.ink}`;

export function drawTimeline(data, state) {
  const { rooms, films, events, sections } = data;
  const dayEvents = events.filter(e => e.date === state.date);
  const shown = dayEvents.filter(e => matches(e, films[e.filmId], state));
  const visibleRooms = rooms.filter(r => !state.venue || r.venueId === state.venue);
  const position = n => (n - RANGE.start) / (RANGE.end - RANGE.start) * 100;
  let html = '<div class="axis"><div class="axis-label">SEDE / SALA</div><div class="axis-times">';
  for (let n = RANGE.start; n <= RANGE.end; n += 60) html += `<span class="tick-label" style="left:${position(n)}%">${clock(n)}${n >= 1440 ? '<sup>+1</sup>' : ''}</span>`;
  html += '</div></div>';
  let previousVenue = null;
  visibleRooms.forEach(room => {
    const isNew = previousVenue !== null && previousVenue !== room.venueId;
    previousVenue = room.venueId;
    html += `<div class="room-row${isNew ? ' new-venue' : ''}"><div class="room-label"><span class="venue-name"><span class="venue-dot" aria-hidden="true"></span>${escapeHtml(room.shortVenue)}</span><strong>Sala ${room.number}</strong></div><div class="plot">`;
    for (const event of shown.filter(e => e.roomId === room.id)) {
      const film = films[event.filmId], section = sections[film.section], finish = endOf(event, films);
      const count = events.filter(e => e.filmId === event.filmId).sort((a,b) => a.date.localeCompare(b.date) || a.start-b.start);
      const order = `${count.findIndex(e => e.id === event.id) + 1}/${count.length}`;
      const classes = film.duration < 45 ? 'event short' : 'event';
      const width = film.duration / (RANGE.end - RANGE.start) * 100;
      const nextInRoom = dayEvents.filter(e => e.roomId === room.id && e.start > event.start).sort((a,b) => a.start-b.start)[0];
      const shortLabel = film.duration < 45 && nextInRoom ? `--short-label-width:calc(${Math.max(0,nextInRoom.start-finish)/film.duration*100}% - 12px);` : '';
      const timeRange = `${clock(event.start)}–${clock(finish, true)}`;
      html += `<article class="${classes}" style="left:${position(event.start)}%;width:${width}%;${shortLabel}${sectionStyle(section)}" data-event="${event.id}"><button class="event-main" data-detail="${event.id}" aria-label="${escapeHtml(`${film.title}. ${timeRange}. ${room.venue}, sala ${room.number}. ${film.duration} minutos. Ver detalle.`)}" title="${escapeHtml(`${film.title} · ${timeRange} · ${film.duration} min`)}"><span class="event-time">${film.duration < 45 ? clock(event.start) : `${clock(event.start)}–${clock(finish)}`}</span><span class="event-title">${escapeHtml(film.title)}</span><span class="event-meta"><span>${film.duration} min${film.durationKind === 'sum' ? '*' : ''}</span><span class="event-order" title="Función ${order}">${order}</span></span></button></article>`;
    }
    html += '</div></div>';
  });
  return { html, shown, visibleRooms };
}
