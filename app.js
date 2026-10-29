import data from './data.js';
import { clock, endOf } from './core.js?v=20261028-2';
import { drawTimeline, escapeHtml as esc, sectionStyle, RANGE } from './timeline.js?v=20261028-2';

const $ = selector => document.querySelector(selector);
const validIds = new Set(data.events.map(e => e.id));
const requestedDay = new URLSearchParams(location.search).get('dia');
const state = {
  date: data.days.some(d => d.date === requestedDay) ? requestedDay : data.days[0].date,
  search: '', venue: '', section: '', zoom: 1,
};
let detailEvent = null, resizeTimer;

function roomFor(event) { return data.rooms.find(r => r.id === event.roomId); }
function dateLabel(date, short = false) {
  const day = data.days.find(d => d.date === date);
  return short ? `${day.short.toLowerCase()} ${day.number} nov` : `${day.label} ${day.number} de noviembre`;
}

function renderDays() {
  $('#days').innerHTML = data.days.map(d => `<button class="day-button" data-day="${d.date}" ${d.date === state.date ? 'aria-current="date"' : ''} aria-label="${d.label} ${d.number} de noviembre. ${data.events.filter(e=>e.date===d.date).length} funciones"><span><span class="day-name">${d.short}</span><span class="day-number">${String(d.number).padStart(2,'0')}</span></span><span class="day-count"><b>${data.events.filter(e=>e.date===d.date).length}</b>funciones</span></button>`).join('');
}

function resizeTimeline() {
  const container = $('#timeline'), scroll = $('#timeline-scroll');
  const labelWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--label-width'));
  const fit = Math.max(850, scroll.clientWidth-labelWidth);
  const width = Math.round(fit*state.zoom);
  container.style.setProperty('--plot-width',`${width}px`);
  container.style.setProperty('--hour-width',`${width/((RANGE.end-RANGE.start)/60)}px`);
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
  resizeTimeline();
  $('#legend').innerHTML = Object.entries(data.sections).map(([id,s]) => `<button class="legend-button" data-section="${id}" aria-pressed="${state.section===id}" style="${sectionStyle(s)}"><span class="legend-dot" aria-hidden="true"></span>${esc(s.label)}</button>`).join('');
}

function renderDetail() {
  if(!detailEvent) return;
  const event=data.events.find(e=>e.id===detailEvent);
  const film=data.films[event.filmId], room=roomFor(event), section=data.sections[film.section];
  const alternatives=data.events.filter(e=>e.filmId===event.filmId).sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start);
  $('#film-detail').innerHTML=`<p class="eyebrow" style="color:${section.ink}">${esc(section.label)}</p><h2 id="film-title">${esc(film.title)}</h2><p class="detail-when">${dateLabel(event.date)} · ${clock(event.start)}–${clock(endOf(event,data.films),true)}<span>${esc(room.venue)} · Sala ${room.number}</span></p><dl class="film-facts"><dt>Dirección</dt><dd>${esc(film.director)}</dd><dt>Duración</dt><dd>${film.duration} minutos${film.durationKind==='sum'?' · suma del metraje de siete cortos':''}</dd><dt>Países</dt><dd>${esc(film.countries)}</dd><dt>Idioma</dt><dd>${esc(film.language)}</dd>${film.alias?`<dt>Otro título</dt><dd>${esc(film.alias)}</dd>`:''}</dl>${film.note?`<p>${esc(film.note)}</p>`:''}<div class="detail-actions"><a class="detail-source" href="${esc(film.source)}" target="_blank" rel="noopener">${film.components?'Fuente del bloque':'Ficha oficial'} ↗</a></div>${film.components?`<details><summary>Los siete cortometrajes</summary><ul class="short-list">${film.components.map(c=>`<li><a href="${esc(c.source)}" target="_blank" rel="noopener">${esc(c.title)}</a> · ${c.duration} min<br>${esc(c.director)}</li>`).join('')}</ul></details>`:''}<p style="font-size:10px">Término calculado por metraje. No incluye presentación ni conversatorio. ${film.aliasSources?film.aliasSources.map((url,i)=>`<a href="${esc(url)}" target="_blank" rel="noopener">${i?'Festival de San Sebastián':'Distribuidora'}</a>`).join(' · '):''}</p><div class="alternatives"><h3>${alternatives.length===1?'Única función en esta grilla':'Otras oportunidades para verla'}</h3>${alternatives.map(e=>{
    const r=roomFor(e), current=e.id===event.id;
    return `<div class="alternative${current?' is-current':''}"><span>${dateLabel(e.date,true)} · ${clock(e.start)}<br>${esc(r.venue)} · Sala ${r.number}</span><button data-detail="${e.id}">${current?'Esta función':'Ver función'}</button></div>`;
  }).join('')}</div>`;
}

function render() { renderDays(); renderSchedule(); if($('#film-dialog').open) renderDetail(); }

function changeDay(date, focus=false) {
  if(!data.days.some(d=>d.date===date)) return;
  state.date=date;
  const url=new URL(location.href);url.searchParams.set('dia',date);history.replaceState(null,'',url);
  renderDays();renderSchedule();
  if(focus) $(`[data-day="${date}"]`).focus();
}

document.addEventListener('click',event=>{
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
$('#reset-filters').addEventListener('click',()=>{state.search='';state.venue='';state.section='';$('#search').value='';$('#venue').value='';$('#section').value='';renderSchedule();});
$('#zoom-in').addEventListener('click',()=>{state.zoom=Math.min(1.8,Math.round((state.zoom+.2)*10)/10);renderSchedule();});
$('#zoom-out').addEventListener('click',()=>{state.zoom=Math.max(.8,Math.round((state.zoom-.2)*10)/10);renderSchedule();});
$('#zoom-fit').addEventListener('click',()=>{state.zoom=1;renderSchedule();$('#timeline-scroll').scrollLeft=0;});
$('#about-button').addEventListener('click',()=>$('#about-dialog').showModal());
for(const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
}
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderSchedule,120);});
$('#venue').insertAdjacentHTML('beforeend',[...new Map(data.rooms.map(r=>[r.venueId,r.venue])).entries()].map(([id,title])=>`<option value="${id}">${esc(title)}</option>`).join(''));
$('#section').insertAdjacentHTML('beforeend',Object.entries(data.sections).map(([id,s])=>`<option value="${id}">${esc(s.label)}</option>`).join(''));
render();
