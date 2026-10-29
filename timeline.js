import { clock, endOf, eventState, matches } from './core.js';

export const RANGE = { start: 900, end: 1500 };
export const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const sectionStyle = section => `--event-color:${section.color};--event-edge:${section.edge};--event-ink:${section.ink}`;

export function drawTimeline(data, state) {
  const { rooms, films, events, sections } = data;
  const dayEvents = events.filter(e => e.date === state.date);
  const shown = dayEvents.filter(e => matches(e, films[e.filmId], { ...state, selection: state.selected }));
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
      const status = eventState(event, state.selected, events, films, state.buffer);
      const count = events.filter(e => e.filmId === event.filmId).sort((a,b) => a.date.localeCompare(b.date) || a.start-b.start);
      const order = `${count.findIndex(e => e.id === event.id) + 1}/${count.length}`;
      const classes = ['event', status.selected && 'is-selected', status.overlap && 'has-overlap', status.transfer && 'has-transfer', film.duration < 45 && 'short'].filter(Boolean).join(' ');
      const width = film.duration / (RANGE.end - RANGE.start) * 100;
      const nextInRoom = dayEvents.filter(e => e.roomId === room.id && e.start > event.start).sort((a,b) => a.start-b.start)[0];
      const shortLabel = film.duration < 45 && nextInRoom ? `--short-label-width:calc(${Math.max(0,nextInRoom.start-finish)/film.duration*100}% - 12px);` : '';
      const timeRange = `${clock(event.start)}–${clock(finish, true)}`;
      const badge = status.overlap ? '<span class="event-badge">Tope</span>' : status.transfer ? '<span class="event-badge transfer">Sin margen</span>' : `<span class="event-order" title="Función ${order}">${order}</span>`;
      html += `<article class="${classes}" style="left:${position(event.start)}%;width:${width}%;${shortLabel}${sectionStyle(section)}" data-event="${event.id}"><button class="event-main" data-detail="${event.id}" aria-label="${escapeHtml(`${film.title}. ${timeRange}. ${room.venue}, sala ${room.number}. ${film.duration} minutos. Ver detalle.`)}" title="${escapeHtml(`${film.title} · ${timeRange} · ${film.duration} min`)}"><span class="event-time">${film.duration < 45 ? clock(event.start) : `${clock(event.start)}–${clock(finish)}`}</span><span class="event-title">${escapeHtml(film.title)}</span><span class="event-meta"><span>${film.duration} min${film.durationKind === 'sum' ? '*' : ''}</span>${badge}</span></button><button class="event-toggle" data-toggle="${event.id}" aria-pressed="${status.selected}" aria-label="${escapeHtml(`${status.selected ? 'Quitar' : 'Agregar'} ${film.title} ${clock(event.start)} ${room.venue} sala ${room.number} ${status.selected ? 'de' : 'a'} mi ruta`)}" title="${status.selected ? 'Quitar de mi ruta' : 'Agregar a mi ruta'}">${status.selected ? '✓' : '+'}</button></article>`;
    }
    html += '</div></div>';
  });
  return { html, shown, visibleRooms };
}

export function drawConnections(container, data, state, visibleRooms) {
  const selected = data.events.filter(e => e.date === state.date && state.selected.has(e.id) && visibleRooms.some(r => r.id === e.roomId) && matches(e, data.films[e.filmId], { ...state, selection: state.selected })).sort((a,b) => a.start-b.start);
  if (selected.length < 2) return;
  const style = getComputedStyle(container), plotWidth = parseFloat(style.getPropertyValue('--plot-width')), rowHeight = parseFloat(style.getPropertyValue('--row-height'));
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('route-overlay'); svg.setAttribute('width', plotWidth); svg.setAttribute('height', visibleRooms.length * rowHeight); svg.setAttribute('aria-hidden', 'true');
  const x = value => (value-RANGE.start)/(RANGE.end-RANGE.start)*plotWidth;
  const y = event => visibleRooms.findIndex(r=>r.id===event.roomId)*rowHeight+rowHeight/2;
  for(let i=1;i<selected.length;i++) {
    const a=selected[i-1], b=selected[i], end=endOf(a,data.films);
    if(end === null || end > b.start) continue;
    const startX=x(end)+4, endX=x(b.start)-4, bend=(startX+endX)/2;
    const path=document.createElementNS(ns,'path');
    path.setAttribute('d',`M ${startX} ${y(a)} C ${bend} ${y(a)}, ${bend} ${y(b)}, ${endX} ${y(b)}`);
    path.classList.add('route-line'); svg.appendChild(path);
  }
  container.appendChild(svg);
}
