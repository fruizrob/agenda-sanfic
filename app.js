import data from './data.js';
import { clock, normalize, endOf, pairsFor, eventState, calendarFile } from './core.js';
import { drawTimeline, drawConnections, escapeHtml as esc, sectionStyle, RANGE } from './timeline.js';

const $ = selector => document.querySelector(selector);
const key = 'sanfic22-agenda-v1';
const validIds = new Set(data.events.map(e => e.id));
const margins = [0,10,15,30,45,60];
let saved = {}, storageAvailable = true;
try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { storageAvailable = false; }
const requestedDay = new URLSearchParams(location.search).get('dia');
const state = {
  date: data.days.some(d => d.date === requestedDay) ? requestedDay : data.days[0].date,
  selected: new Set(Array.isArray(saved.selected) ? saved.selected.filter(id => validIds.has(id)) : []),
  buffer: margins.includes(saved.buffer) ? saved.buffer : 15,
  search: '', venue: '', section: '', onlySelected: false, zoom: 1,
};
let detailEvent = null, toastTimer, resizeTimer;

function persist() {
  try { localStorage.setItem(key, JSON.stringify({ selected: [...state.selected], buffer: state.buffer })); }
  catch { storageAvailable = false; }
  $('#storage-status').textContent = storageAvailable ? 'Tu selección se guarda solo en este navegador.' : 'El guardado no está disponible. La selección se mantiene mientras esta página siga abierta.';
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2800);
}

function roomFor(event) { return data.rooms.find(r => r.id === event.roomId); }
function dateLabel(date, short = false) {
  const day = data.days.find(d => d.date === date);
  return short ? `${day.short.toLowerCase()} ${day.number} nov` : `${day.label} ${day.number} de noviembre`;
}

function conflictText(pair, event) {
  const other = pair.first.id === event.id ? pair.second : pair.first;
  const title = data.films[other.filmId].title;
  if (pair.type === 'overlap') {
    const overlap = Math.min(endOf(pair.first,data.films),endOf(pair.second,data.films))-Math.max(pair.first.start,pair.second.start);
    return `Tope de ${overlap} min con ${title}`;
  }
  if (pair.type === 'transfer') return `Solo ${pair.gap} min entre salas; margen elegido: ${pair.required} min. ${title}`;
  return `Término pendiente: revisa la compatibilidad con ${title}`;
}

function renderDays() {
  $('#days').innerHTML = data.days.map(d => `<button class="day-button" data-day="${d.date}" ${d.date === state.date ? 'aria-current="date"' : ''} aria-label="${d.label} ${d.number} de noviembre. ${data.events.filter(e=>e.date===d.date).length} funciones"><span><span class="day-name">${d.short}</span><span class="day-number">${String(d.number).padStart(2,'0')}</span></span><span class="day-count"><b>${data.events.filter(e=>e.date===d.date).length}</b>funciones</span></button>`).join('');
}

function resizeTimeline(visibleRooms) {
  const container = $('#timeline'), scroll = $('#timeline-scroll');
  const labelWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--label-width'));
  const fit = Math.max(850, scroll.clientWidth-labelWidth);
  const width = Math.round(fit*state.zoom);
  container.style.setProperty('--plot-width',`${width}px`);
  container.style.setProperty('--hour-width',`${width/((RANGE.end-RANGE.start)/60)}px`);
  container.querySelector('.route-overlay')?.remove();
  drawConnections(container,data,state,visibleRooms);
  $('.scroll-hint').hidden = width+labelWidth <= scroll.clientWidth+2;
  $('#zoom-out').disabled = state.zoom <= .8;
  $('#zoom-in').disabled = state.zoom >= 1.8;
}

function renderSchedule() {
  const { html, shown, visibleRooms } = drawTimeline(data,state);
  $('#timeline').innerHTML = html;
  $('#day-heading').textContent = dateLabel(state.date);
  const count = data.events.filter(e=>e.date===state.date).length;
  $('#visible-count').textContent = shown.length === count ? `${count} funciones · ${visibleRooms.length} salas` : `${shown.length} de ${count} funciones`;
  $('#empty-results').hidden = shown.length !== 0;
  resizeTimeline(visibleRooms);
  $('#legend').innerHTML = Object.entries(data.sections).map(([id,s]) => `<button class="legend-button" data-section="${id}" aria-pressed="${state.section===id}" style="${sectionStyle(s)}"><span class="legend-dot" aria-hidden="true"></span>${esc(s.label)}</button>`).join('');
}

function renderRoute() {
  const chosen = data.events.filter(e=>state.selected.has(e.id));
  const pairs = pairsFor(state.selected,data.events,data.films,state.buffer);
  const overlaps = pairs.filter(p=>p.type==='overlap').length;
  const transfers = pairs.filter(p=>p.type==='transfer').length;
  const summary = [overlaps ? `${overlaps} ${overlaps===1?'tope':'topes'}` : '',transfers ? `${transfers} ${transfers===1?'cambio sin margen':'cambios sin margen'}` : ''].filter(Boolean).join(' · ');
  $('#route-count').textContent = chosen.length;
  $('#route-status').textContent = !chosen.length ? 'Elige tu primera función' : summary || 'Sin topes por metraje';
  $('#route-status').classList.toggle('has-conflict',Boolean(pairs.length));
  $('#route-summary').textContent = chosen.length ? `${chosen.length} ${chosen.length===1?'función elegida':'funciones elegidas'}${summary ? ` · ${summary}` : ' · sin topes por metraje'}` : 'Agrega funciones con el botón + de cada bloque.';
  $('#export-route').disabled = !chosen.length;
  $('#clear-route').hidden = !chosen.length;
  if (!chosen.length) {
    $('#route-content').innerHTML = '<div class="route-empty"><span class="empty-path" aria-hidden="true">○ ┄ ○ ┄ ○</span><p>Una película, otra sala, una nueva historia.<br>Tu recorrido aparece aquí al elegir funciones.</p></div>';
    return;
  }
  let html = '';
  for(const day of data.days) {
    const daily=chosen.filter(e=>e.date===day.date).sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
    if (!daily.length) continue;
    html += `<div class="route-day"><h3>${dateLabel(day.date)}</h3><div class="route-items">`;
    daily.forEach((event,i)=>{
      const film=data.films[event.filmId], room=roomFor(event);
      const issues=pairs.filter(p=>p.first.id===event.id||p.second.id===event.id);
      if(i) {
        const previous=daily[i-1], gap=event.start-endOf(previous,data.films);
        html += `<span class="route-gap">${gap<0?'Se superponen':`${gap} min entre funciones`}${previous.venueId!==event.venueId?'<br>Cambio de sede':''}</span>`;
      }
      html += `<article class="route-item${issues.length?' conflict':''}"><button class="route-item-title" data-detail="${event.id}">${esc(film.title)}</button><button class="route-remove" data-toggle="${event.id}" aria-label="Quitar ${esc(film.title)} de mi ruta">×</button><p>${clock(event.start)}–${clock(endOf(event,data.films),true)} · ${film.duration} min<br>${esc(room.venue)} · Sala ${room.number}</p>${issues.map(p=>`<p class="route-warning">${esc(conflictText(p,event))}</p>`).join('')}</article>`;
    });
    html+='</div></div>';
  }
  $('#route-content').innerHTML=html;
}

function renderDetail() {
  if(!detailEvent) return;
  const event=data.events.find(e=>e.id===detailEvent);
  const film=data.films[event.filmId], room=roomFor(event), section=data.sections[film.section];
  const selected=state.selected.has(event.id);
  const status=eventState(event,state.selected,data.events,data.films,state.buffer);
  const alternatives=data.events.filter(e=>e.filmId===event.filmId).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
  $('#film-detail').innerHTML=`<p class="eyebrow" style="color:${section.ink}">${esc(section.label)}</p><h2 id="film-title">${esc(film.title)}</h2><p class="detail-when">${dateLabel(event.date)} · ${clock(event.start)}–${clock(endOf(event,data.films),true)}<span>${esc(room.venue)} · Sala ${room.number}</span></p><dl class="film-facts"><dt>Dirección</dt><dd>${esc(film.director)}</dd><dt>Duración</dt><dd>${film.duration} minutos${film.durationKind==='sum'?' · suma del metraje de siete cortos':''}</dd><dt>Países</dt><dd>${esc(film.countries)}</dd><dt>Idioma</dt><dd>${esc(film.language)}</dd>${film.alias?`<dt>Otro título</dt><dd>${esc(film.alias)}</dd>`:''}</dl>${film.note?`<p>${esc(film.note)}</p>`:''}${status.pairs.map(p=>`<p class="detail-warning">${esc(conflictText(p,event))}</p>`).join('')}<div class="detail-actions"><button class="button ${selected?'secondary':'primary'}" data-toggle="${event.id}">${selected?'✓ En mi ruta · quitar':'+ Agregar a mi ruta'}</button><a class="detail-source" href="${esc(film.source)}" target="_blank" rel="noopener">${film.components?'Fuente del bloque':'Ficha oficial'} ↗</a></div>${film.components?`<details><summary>Los siete cortometrajes</summary><ul class="short-list">${film.components.map(c=>`<li><a href="${esc(c.source)}" target="_blank" rel="noopener">${esc(c.title)}</a> · ${c.duration} min<br>${esc(c.director)}</li>`).join('')}</ul></details>`:''}<p style="font-size:10px">Término calculado por metraje. No incluye presentación ni conversatorio. ${film.aliasSources?film.aliasSources.map((url,i)=>`<a href="${esc(url)}" target="_blank" rel="noopener">${i?'Festival de San Sebastián':'Distribuidora'}</a>`).join(' · '):''}</p><div class="alternatives"><h3>${alternatives.length===1?'Única función en esta grilla':'Otras oportunidades para verla'}</h3>${alternatives.map(e=>{
    const r=roomFor(e), current=e.id===event.id;
    return `<div class="alternative${current?' is-current':''}"><span>${dateLabel(e.date,true)} · ${clock(e.start)}<br>${esc(r.venue)} · Sala ${r.number}</span><button data-detail="${e.id}">${state.selected.has(e.id)?'✓ En mi ruta':current?'Esta función':'Ver función'}</button></div>`;
  }).join('')}</div>`;
}

function render() { renderDays(); renderSchedule(); renderRoute(); if($('#film-dialog').open) renderDetail(); }

function changeDay(date, focus=false) {
  if(!data.days.some(d=>d.date===date)) return;
  state.date=date;
  const url=new URL(location.href);url.searchParams.set('dia',date);history.replaceState(null,'',url);
  renderDays();renderSchedule();
  if(focus) $(`[data-day="${date}"]`).focus();
}

function toggle(id) {
  if(!validIds.has(id)) return;
  const removing=state.selected.has(id);
  if(removing) state.selected.delete(id); else state.selected.add(id);
  persist(); render();
  const event=data.events.find(e=>e.id===id), film=data.films[event.filmId];
  toast(`${removing?'Quitada':'Agregada'}: ${film.title}`);
  if($('#film-dialog').open) $('#film-dialog').querySelector(`[data-toggle="${id}"]`)?.focus();
  else $(`.event-toggle[data-toggle="${id}"]`)?.focus({preventScroll:true});
}

document.addEventListener('click',event=>{
  const toggleButton=event.target.closest('[data-toggle]');
  if(toggleButton){toggle(toggleButton.dataset.toggle);return;}
  const detailButton=event.target.closest('[data-detail]');
  if(detailButton){
    if(!validIds.has(detailButton.dataset.detail))return;
    detailEvent=detailButton.dataset.detail;renderDetail();
    if(!$('#film-dialog').open)$('#film-dialog').showModal();
    return;
  }
  const dayButton=event.target.closest('[data-day]');
  if(dayButton){changeDay(dayButton.dataset.day);return;}
  const sectionButton=event.target.closest('[data-section]');
  if(sectionButton){state.section=state.section===sectionButton.dataset.section?'':sectionButton.dataset.section;$('#section').value=state.section;renderSchedule();}
});

$('#days').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const i=data.days.findIndex(d=>d.date===state.date);
  const next=event.key==='Home'?0:event.key==='End'?6:(i+(event.key==='ArrowRight'?1:6))%7;
  changeDay(data.days[next].date,true);
});
$('#search').addEventListener('input',event=>{state.search=event.target.value;renderSchedule();});
$('#venue').addEventListener('change',event=>{state.venue=event.target.value;renderSchedule();});
$('#section').addEventListener('change',event=>{state.section=event.target.value;renderSchedule();});
$('#only-selected').addEventListener('change',event=>{state.onlySelected=event.target.checked;renderSchedule();});
$('#buffer').addEventListener('change',event=>{const value=Number(event.target.value);if(!margins.includes(value))return;state.buffer=value;persist();render();});
$('#reset-filters').addEventListener('click',()=>{state.search='';state.venue='';state.section='';state.onlySelected=false;$('#search').value='';$('#venue').value='';$('#section').value='';$('#only-selected').checked=false;renderSchedule();});
$('#zoom-in').addEventListener('click',()=>{state.zoom=Math.min(1.8,Math.round((state.zoom+.2)*10)/10);renderSchedule();});
$('#zoom-out').addEventListener('click',()=>{state.zoom=Math.max(.8,Math.round((state.zoom-.2)*10)/10);renderSchedule();});
$('#zoom-fit').addEventListener('click',()=>{state.zoom=1;renderSchedule();$('#timeline-scroll').scrollLeft=0;});
$('#about-button').addEventListener('click',()=>$('#about-dialog').showModal());
$('#clear-route').addEventListener('click',()=>{state.selected.clear();persist();render();toast('Ruta vaciada. Puedes volver a elegir funciones.');});
$('#export-route').addEventListener('click',()=>{
  const calendar=calendarFile(state.selected,data.events,data.films,data.rooms);
  const url=URL.createObjectURL(new Blob([calendar],{type:'text/calendar;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='mi-ruta-sanfic22.ics';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Calendario exportado con los finales calculados por metraje.');
});
for(const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
}
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderSchedule,120);});
$('#venue').insertAdjacentHTML('beforeend',[...new Map(data.rooms.map(r=>[r.venueId,r.venue])).entries()].map(([id,title])=>`<option value="${id}">${esc(title)}</option>`).join(''));
$('#section').insertAdjacentHTML('beforeend',Object.entries(data.sections).map(([id,s])=>`<option value="${id}">${esc(s.label)}</option>`).join(''));
$('#buffer').value=state.buffer;
render();persist();
