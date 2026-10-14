// Panel de visitas: periodo, carga de datos (o ejemplo), render y ajustes del token.
import { getConfig, saveConfig, rangeFor, loadStats, clearCache } from './api.js';
import { buildModel, PROJECTS, eventLabel } from './model.js';
import { sampleStats } from './sample.js';
import { stackedBars, sparkline, barList, funnel } from './charts.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('es-ES');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const PERIODS = [[1, 'Hoy'], [7, '7 días'], [30, '30 días'], [90, '90 días'], [365, '1 año']];
const PREFS_KEY = 'visitas:prefs';

const prefs = (() => { try { return { days: 7, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }; } catch { return { days: 7 }; } })();
let model = null;

// ---------------------------------------------------------------------------
// Tema
// ---------------------------------------------------------------------------
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
if (prefs.theme) document.documentElement.dataset.theme = prefs.theme;
$('theme-toggle').addEventListener('click', () => {
  const dark = (document.documentElement.dataset.theme || (systemDark.matches ? 'dark' : 'light')) === 'dark';
  prefs.theme = dark ? 'light' : 'dark';
  document.documentElement.dataset.theme = prefs.theme;
  savePrefs();
  if (model) render(model); // los colores del gráfico se leen de los tokens
});
function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* sin almacenamiento */ } }

// ---------------------------------------------------------------------------
// Periodo
// ---------------------------------------------------------------------------
function renderPeriods() {
  $('periods').innerHTML = PERIODS.map(([d, label]) =>
    `<button type="button" data-days="${d}" aria-pressed="${d === prefs.days}">${label}</button>`).join('');
}
$('periods').addEventListener('click', (e) => {
  const d = e.target.closest('button')?.dataset.days;
  if (!d) return;
  prefs.days = Number(d);
  savePrefs();
  renderPeriods();
  refresh();
});
$('refresh').addEventListener('click', () => refresh({ fresh: true }));

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------
// Solo se pinta la última carga pedida: si cambias de periodo mientras otro carga, el
// anterior se cancela y nunca pisa al que estás viendo.
let current = null;
async function refresh({ fresh = false } = {}) {
  current?.abort();
  const controller = new AbortController();
  current = controller;
  const config = getConfig();
  const range = rangeFor(prefs.days);
  const demo = !config.token;
  $('demo-banner').hidden = !demo;
  $('error').hidden = true;
  $('refresh').disabled = true;
  $('status').textContent = 'Cargando…';
  try {
    const raw = demo ? sampleStats(range) : await loadStats(config, range, { signal: controller.signal, fresh });
    if (controller !== current) return;
    model = buildModel(raw);
    render(model);
    const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    $('status').textContent = demo ? 'Datos de ejemplo' : `Actualizado a las ${time}`;
  } catch (err) {
    if (controller !== current) return; // carga cancelada al cambiar de periodo
    console.error(err);
    $('error').textContent = err.message || 'No se pudieron cargar las estadísticas.';
    $('error').hidden = false;
    $('status').textContent = '';
  } finally {
    if (controller === current) $('refresh').disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render(m) {
  const periodLabel = PERIODS.find(([d]) => d === prefs.days)?.[1].toLowerCase() ?? '';

  $('kpis').innerHTML = [
    ['Visitantes', m.kpis.visitors, `en ${periodLabel === 'hoy' ? 'el día de hoy' : `los últimos ${periodLabel}`}`],
    ['Generaron una ruta', m.kpis.generated, 'en Rutas Noviciado o Rutas A→B'],
    ['Clics en una app', m.kpis.appClicks, 'desde el portfolio'],
    ['Países', m.kpis.countries, 'de donde llegan visitas'],
  ].map(([label, value, note], i) => `
    <div class="kpi ${i === 0 ? 'kpi-main' : ''}">
      <span class="kpi-label">${label}</span>
      <span class="kpi-value">${fmt(value)}</span>
      <span class="kpi-note">${note}</span>
    </div>`).join('');

  $('chart-title').textContent = m.singleDay ? 'Visitas por hora' : 'Visitas por día';
  $('legend').innerHTML = m.series.map((s) =>
    `<li><i style="background:var(${s.color})"></i>${esc(s.name)} <b>${fmt(s.total)}</b></li>`).join('');
  stackedBars($('chart'), m);

  $('projects').innerHTML = m.series.filter((s) => s.key !== 'otros').map((s) => `
    <article class="project">
      <header><i style="background:var(${s.color})"></i><h3>${esc(s.name)}</h3>
        ${s.url ? `<a href="${s.url}" target="_blank" rel="noopener">Abrir ↗</a>` : ''}</header>
      <div class="project-row">
        <span class="project-value">${fmt(s.total)}<small> visitantes</small></span>
        ${sparkline(s.values, s.color)}
      </div>
    </article>`).join('');

  $('funnel').innerHTML = funnel(m.funnel);

  $('list-locations').innerHTML = barList(m.lists.locations, { flag: true });
  $('list-sizes').innerHTML = barList(m.lists.sizes);
  $('list-refs').innerHTML = barList(m.lists.toprefs);
  $('list-browsers').innerHTML = barList(m.lists.browsers);
  $('list-systems').innerHTML = barList(m.lists.systems);
  $('list-languages').innerHTML = barList(m.lists.languages, {
    empty: 'Sin datos. Activa la recogida de idiomas en la configuración de GoatCounter.' });

  $('list-intensities').innerHTML = barList(m.intensities, { empty: 'Aún nadie ha generado una ruta en este periodo.' });
  $('list-distances').innerHTML = barList(m.distances, { empty: 'Aún nadie ha generado una ruta en este periodo.' });

  const projectColor = Object.fromEntries(PROJECTS.map((p) => [p.key, p.color]));
  $('events').innerHTML = m.events.length
    ? `<table><thead><tr><th>Evento</th><th>Proyecto</th><th class="num">Visitantes</th></tr></thead><tbody>${m.events.map((e) => `
        <tr><td>${esc(eventLabel(e.path))}</td>
          <td><i class="dot" style="background:var(${projectColor[e.project]})"></i>${esc(PROJECTS.find((p) => p.key === e.project)?.name ?? '')}</td>
          <td class="num">${fmt(e.count)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="empty">Sin eventos en este periodo.</p>';

  $('errors-card').hidden = !m.errors.length;
  $('errors').innerHTML = m.errors.map((e) => `<li><b>${fmt(e.count)}</b> ${esc(e.title || e.path)}</li>`).join('');
}

// Redibuja el gráfico al cambiar el ancho
new ResizeObserver(() => { if (model) stackedBars($('chart'), model); }).observe($('chart'));

// ---------------------------------------------------------------------------
// Ajustes: sitio y token de GoatCounter (solo en este dispositivo)
// ---------------------------------------------------------------------------
const settings = $('settings');
function openSettings() {
  const c = getConfig();
  $('site').value = c.site;
  $('token').value = c.token;
  $('token-link').href = `https://${c.site || 'danielcs'}.goatcounter.com/user/api`;
  settings.showModal();
}
$('settings-open').addEventListener('click', openSettings);
$('demo-connect').addEventListener('click', openSettings);
$('site').addEventListener('input', () => { $('token-link').href = `https://${$('site').value.trim() || 'danielcs'}.goatcounter.com/user/api`; });
$('token-remove').addEventListener('click', () => {
  saveConfig({ ...getConfig(), token: '' });
  clearCache();
  settings.close();
  refresh();
});
settings.addEventListener('close', () => {
  if (settings.returnValue !== 'save') return;
  saveConfig({ site: $('site').value.trim() || 'danielcs', token: $('token').value.trim() });
  clearCache();
  refresh();
});

renderPeriods();
refresh();
