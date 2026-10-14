// Convierte la respuesta de GoatCounter en lo que pinta el panel: proyectos, cifras clave,
// serie diaria por proyecto, embudo y elecciones de los corredores.

// Cada página o evento pertenece a un proyecto según su ruta.
export const PROJECTS = [
  { key: 'portfolio', name: 'Portfolio', color: '--series-1', url: 'https://danielcs94.github.io/' },
  { key: 'noviciado', name: 'Rutas Noviciado', color: '--series-2', url: 'https://danielcs94.github.io/rutas-noviciado/' },
  { key: 'ab', name: 'Rutas A→B', color: '--series-3', url: 'https://danielcs94.github.io/rutas-ab/' },
  { key: 'otros', name: 'Otros', color: '--series-4', url: null },
];

const NOVICIADO_EVENTS = /^(ruta-generada|distancia-|intensidad-|preferencia-|carrera-|abrir-google-maps|descargar-gpx|copiar-enlace|error-al-generar)/;

export function projectOf(hit) {
  const p = hit.path ?? '';
  if (hit.event) {
    if (p.startsWith('portfolio-')) return 'portfolio';
    if (p.startsWith('ab-')) return 'ab';
    if (NOVICIADO_EVENTS.test(p)) return 'noviciado';
    return 'otros';
  }
  if (p === '/' || p === '/index.html') return 'portfolio';
  if (p.startsWith('/rutas-noviciado')) return 'noviciado';
  if (p.startsWith('/rutas-ab')) return 'ab';
  return 'otros';
}

// Nombre legible de un evento
const EVENT_LABELS = {
  'ruta-generada': 'Ruta generada',
  'abrir-google-maps': 'Abrir en Google Maps',
  'descargar-gpx': 'Descargar GPX',
  'copiar-enlace': 'Copiar enlace',
  'error-al-generar': 'Error al generar',
  'tipo-bucle': 'Ruta en bucle',
  'tipo-a-b': 'Ruta de A a B',
  'portfolio-contactar': 'Contactar',
  'preferencia-parques': 'Eligió «Parques»',
  'preferencia-mezcla': 'Eligió «Mezcla»',
  'preferencia-ciudad': 'Eligió «Ciudad»',
  'carrera-iniciada': 'Empezó una carrera',
  'carrera-terminada': 'Terminó una carrera',
  'carrera-gpx': 'Descargó el GPX de su carrera',
  'carrera-compartir': 'Compartió su carrera',
  'carrera-consejos': 'Vio los consejos de Acceso guiado',
};
const PROJECT_NAMES = {
  'rutas-ab': 'Rutas A→B', 'rutas-noviciado': 'Rutas Noviciado', styleshop: 'StyleShop',
  juegoderol: 'JuegoDeRol', tracker_ig: 'Tracker IG', 'madrid-no-descansa': 'Madrid No Descansa',
};
export function eventLabel(path) {
  const p = path.replace(/^ab-/, '');
  if (EVENT_LABELS[p]) return EVENT_LABELS[p];
  const m = p.match(/^portfolio-(probar|codigo|captura)-(.+)$/);
  if (m) return `${{ probar: 'Probar', codigo: 'Ver código', captura: 'Captura' }[m[1]]} · ${PROJECT_NAMES[m[2]] ?? m[2].replace(/-/g, ' ')}`;
  return p.replace(/-/g, ' ');
}

const sumBy = (list, fn) => list.reduce((s, x) => s + fn(x), 0);
const countOf = (hits, path) => hits.find((h) => h.path === path)?.count ?? 0;
const countPrefix = (hits, re) => sumBy(hits.filter((h) => h.event && re.test(h.path)), (h) => h.count);

// Las dos apps registran la distancia distinto (Noviciado: "distancia-8km"; A→B: por tramos).
// Se agrupan en los mismos tres tramos para poder sumarlas.
const BUCKETS = ['Hasta 10 km', 'De 10 a 21 km', 'Más de 21 km'];
function distanceBucket(p) {
  if (p === 'distancia-hasta-10km') return BUCKETS[0];
  if (p === 'distancia-10-a-21km') return BUCKETS[1];
  if (p === 'distancia-mas-de-21km') return BUCKETS[2];
  const km = Number(p.match(/(\d+)km/)?.[1]);
  return km > 21 ? BUCKETS[2] : km > 10 ? BUCKETS[1] : BUCKETS[0];
}

// Nombres legibles para las listas: GoatCounter da los tamaños solo como id y los países en inglés
const SIZE_NAMES = { phone: 'Teléfono', tablet: 'Tablet', desktop: 'Ordenador', desktophd: 'Ordenador grande', unknown: 'Desconocido' };
const regionNames = (() => { try { return new Intl.DisplayNames(['es'], { type: 'region' }); } catch { return null; } })();
function tidyLists(lists) {
  const clean = (items, nameOf) => (items ?? [])
    .filter((x) => x.count > 0)
    .map((x) => ({ ...x, name: nameOf(x) || x.name || '(desconocido)' }));
  return {
    ...lists,
    sizes: clean(lists.sizes, (x) => SIZE_NAMES[x.id]),
    locations: clean(lists.locations, (x) => {
      try { return /^[A-Z]{2}$/.test(x.id) ? regionNames?.of(x.id) : null; } catch { return null; }
    }),
    browsers: clean(lists.browsers, () => null),
    systems: clean(lists.systems, () => null),
    toprefs: clean(lists.toprefs, () => null),
    languages: clean(lists.languages, () => null),
  };
}

export function buildModel(raw) {
  const hits = raw.hits.map((h) => ({ ...h, project: projectOf(h) }));
  const pages = hits.filter((h) => !h.event);
  const events = hits.filter((h) => h.event);

  // Días del periodo (los de la serie total, que vienen completos aunque haya ceros)
  const days = (raw.total.stats ?? []).map((s) => s.day);
  const singleDay = days.length <= 1;
  const series = PROJECTS.map((p) => {
    const values = singleDay ? new Array(24).fill(0) : new Array(days.length).fill(0);
    for (const h of pages.filter((x) => x.project === p.key)) {
      for (const st of h.stats ?? []) {
        if (singleDay) (st.hourly ?? []).forEach((v, i) => { values[i] += v; });
        else {
          const i = days.indexOf(st.day);
          if (i >= 0) values[i] += st.daily ?? 0;
        }
      }
    }
    return { ...p, values, total: sumBy(pages.filter((x) => x.project === p.key), (h) => h.count) };
  }).filter((s) => s.key !== 'otros' || s.total > 0);

  const generated = countOf(hits, 'ruta-generada') + countOf(hits, 'ab-ruta-generada');
  const appClicks = countPrefix(hits, /^portfolio-(probar|captura)-/);
  const opened = countOf(hits, 'abrir-google-maps') + countOf(hits, 'ab-abrir-google-maps')
    + countOf(hits, 'descargar-gpx') + countOf(hits, 'ab-descargar-gpx');
  const visitors = Math.max(0, (raw.total.total ?? 0) - (raw.total.total_events ?? 0));
  const portfolio = series.find((s) => s.key === 'portfolio')?.total ?? 0;
  const apps = sumBy(series.filter((s) => s.key === 'noviciado' || s.key === 'ab'), (s) => s.total);

  // Elecciones en las apps: intensidad y distancia (sumando las dos apps)
  const choice = (re, label) => {
    const map = new Map();
    for (const h of events.filter((e) => re.test(e.path))) {
      const k = label(h.path.replace(/^ab-/, ''));
      map.set(k, (map.get(k) ?? 0) + h.count);
    }
    return [...map].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  };

  return {
    range: raw.range,
    days,
    singleDay,
    series,
    kpis: {
      visitors,
      generated,
      appClicks,
      countries: (raw.lists.locations ?? []).filter((x) => x.count > 0).length,
    },
    funnel: [
      { label: 'Visitas al portfolio', value: portfolio },
      { label: 'Clics en una app desde el portfolio', value: appClicks },
      { label: 'Visitas a las apps', value: apps },
      { label: 'Generaron una ruta', value: generated },
      { label: 'La abrieron en Maps o bajaron el GPX', value: opened },
    ],
    pages: pages.sort((a, b) => b.count - a.count),
    events: events.filter((e) => e.count > 0 && !/^(ab-)?(distancia|intensidad)-/.test(e.path)).sort((a, b) => b.count - a.count),
    intensities: choice(/^(ab-)?intensidad-/, (p) => ({ 'intensidad-suave': 'Suave', 'intensidad-medio': 'Medio', 'intensidad-avanzado': 'Avanzado' })[p] ?? p),
    distances: choice(/^(ab-)?distancia-/, distanceBucket).sort((a, b) => BUCKETS.indexOf(a.name) - BUCKETS.indexOf(b.name)),
    errors: events.filter((e) => /error-al-generar/.test(e.path) && e.count > 0),
    lists: tidyLists(raw.lists),
  };
}
