// Gráficos en SVG sin librerías: barras apiladas por proyecto (con cursor y tooltip),
// minigráficos de tendencia, listas de barras horizontales y embudo.

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const fmt = (n) => n.toLocaleString('es-ES');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function niceMax(v) {
  if (v <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

// Etiqueta del eje X para un índice
function xLabel(model, i) {
  if (model.singleDay) return `${String(i).padStart(2, '0')}:00`;
  const d = new Date(`${model.days[i]}T12:00:00Z`);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function stackedBars(container, model) {
  container.innerHTML = '';
  const series = model.series;
  const n = series[0]?.values.length ?? 0;
  if (!n) return;
  const W = Math.max(300, container.clientWidth);
  const H = 240;
  const m = { t: 12, r: 8, b: 26, l: 34 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const totals = Array.from({ length: n }, (_, i) => series.reduce((s, x) => s + x.values[i], 0));
  const max = niceMax(Math.max(1, ...totals));
  const slot = iw / n;
  const bw = Math.max(2, Math.min(28, slot * 0.68));
  const y = (v) => m.t + ih - (v / max) * ih;

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img',
    'aria-label': `Visitas por ${model.singleDay ? 'hora' : 'día'}: ${fmt(totals.reduce((a, b) => a + b, 0))} en total` });
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k;
    svg.append(svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: k ? 'gridline' : 'base' }));
    const t = svgEl('text', { x: m.l - 6, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' });
    t.textContent = fmt(Math.round(v));
    svg.append(t);
  }
  const every = Math.ceil(n / Math.max(2, Math.floor(iw / 64)));
  for (let i = 0; i < n; i += every) {
    const t = svgEl('text', { x: m.l + slot * (i + 0.5), y: H - 8, class: 'tick', 'text-anchor': 'middle' });
    t.textContent = xLabel(model, i);
    svg.append(t);
  }

  // Barras: un rectángulo por proyecto, apilados con 2 px de separación
  const css = getComputedStyle(document.documentElement);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    const x = m.l + slot * i + (slot - bw) / 2;
    series.forEach((s, k) => {
      const v = s.values[i];
      if (!v) return;
      const y0 = y(acc), y1 = y(acc + v);
      const top = series.slice(k + 1).every((t) => !t.values[i]);
      const h = Math.max(1, y0 - y1 - 2);
      svg.append(svgEl('rect', { x, y: y1 + (top ? 0 : 2), width: bw, height: top ? y0 - y1 : h, rx: top ? Math.min(4, bw / 2) : 0,
        fill: css.getPropertyValue(s.color).trim() }));
      acc += v;
    });
  }

  // Cursor y tooltip
  const cursor = svgEl('rect', { y: m.t, height: ih, width: slot, class: 'hover-band', visibility: 'hidden' });
  svg.insertBefore(cursor, svg.firstChild);
  const hit = svgEl('rect', { x: m.l, y: 0, width: iw, height: H, fill: 'transparent' });
  svg.append(hit);
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.floor((px - m.l) / slot)));
    cursor.setAttribute('x', m.l + slot * i);
    cursor.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.innerHTML = `<b>${xLabel(model, i)}</b>${series.map((s) =>
      `<span><i style="background:var(${s.color})"></i>${esc(s.name)}<em>${fmt(s.values[i])}</em></span>`).join('')}
      <span class="tip-total">Total<em>${fmt(totals[i])}</em></span>`;
    const left = ((m.l + slot * (i + 0.5)) / W) * r.width;
    tip.style.left = `${Math.min(r.width - 180, Math.max(0, left - 90))}px`;
  };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', () => { cursor.setAttribute('visibility', 'hidden'); tip.hidden = true; });
  container.append(svg, tip);
}

// Minigráfico de tendencia (área + línea) para las tarjetas de proyecto
export function sparkline(values, color) {
  const W = 120, H = 34, n = values.length;
  if (n < 2) return '';
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (n - 1)) * W, H - 2 - (v / max) * (H - 6)]);
  const line = pts.map(([x, yv], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${yv.toFixed(1)}`).join('');
  const [lx, ly] = pts.at(-1);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${line}L${W},${H}L0,${H}Z" fill="var(${color})" opacity=".15"/>
    <path d="${line}" fill="none" stroke="var(${color})" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    <circle cx="${lx}" cy="${ly}" r="3" fill="var(${color})"/>
  </svg>`;
}

// Lista de barras horizontales (países, dispositivos...)
export function barList(items, { flag = false, empty = 'Sin datos en este periodo.' } = {}) {
  if (!items?.length) return `<p class="empty">${empty}</p>`;
  const max = Math.max(...items.map((x) => x.count));
  const total = items.reduce((s, x) => s + x.count, 0);
  const flagOf = (id) => (id && /^[A-Z]{2}$/.test(id)
    ? String.fromCodePoint(...[...id].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) + ' ' : '');
  return `<ul class="bars">${items.map((x) => `
    <li>
      <span class="bar-label">${flag ? flagOf(x.id) : ''}${esc(x.name || '(desconocido)')}</span>
      <span class="bar-value">${fmt(x.count)} <small>${Math.round((100 * x.count) / total)} %</small></span>
      <span class="bar-track"><span style="width:${(100 * x.count) / max}%"></span></span>
    </li>`).join('')}</ul>`;
}

// Embudo: cada paso con su barra y el % respecto al primero
export function funnel(steps) {
  const first = Math.max(1, steps[0]?.value ?? 1);
  const max = Math.max(1, ...steps.map((s) => s.value));
  return `<ol class="funnel">${steps.map((s, i) => `
    <li>
      <span class="f-label">${esc(s.label)}</span>
      <span class="f-bar"><span style="width:${(100 * s.value) / max}%"></span></span>
      <span class="f-value">${fmt(s.value)}${i ? ` <small>${Math.round((100 * s.value) / first)} %</small>` : ''}</span>
    </li>`).join('')}</ol>`;
}
