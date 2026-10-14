// Datos de ejemplo con el mismo formato que la API de GoatCounter, para ver el panel antes de
// conectar el token. Son inventados y el panel lo indica claramente.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleStats(range) {
  const rand = rng(7);
  const days = [];
  const start = new Date(range.start);
  for (let i = 0; i < range.days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i + 1);
    days.push(d.toISOString().slice(0, 10));
  }
  const page = (path, title, base, event = false) => {
    const stats = days.map((day, i) => {
      const weekend = [0, 6].includes(new Date(day).getUTCDay());
      const daily = Math.max(0, Math.round(base * (0.5 + rand()) * (weekend ? 1.4 : 1) * (0.7 + i / days.length * 0.6)));
      const hourly = new Array(24).fill(0);
      for (let k = 0; k < daily; k++) hourly[Math.min(23, Math.floor(8 + rand() * 15))]++;
      return { day, daily, hourly };
    });
    return { path, title, event, count: stats.reduce((s, x) => s + x.daily, 0), stats };
  };
  const hits = [
    page('/', 'Daniel Clavero Sánchez — Desarrollador Full-Stack', 6),
    page('/rutas-ab/', 'Rutas A→B', 4),
    page('/rutas-noviciado/', 'Rutas Noviciado', 2),
    page('portfolio-probar-rutas-ab', 'Probar la app', 2, true),
    page('portfolio-codigo-rutas-ab', 'Ver código', 0.8, true),
    page('portfolio-captura-rutas-ab', 'Captura', 0.6, true),
    page('portfolio-codigo-styleshop', 'Ver código', 0.4, true),
    page('portfolio-contactar', 'Contactar', 0.2, true),
    page('ab-ruta-generada', 'Ruta generada', 3, true),
    page('ab-tipo-a-b', 'A→B', 1.8, true),
    page('ab-tipo-bucle', 'Bucle', 1.2, true),
    page('ab-distancia-hasta-10km', '', 1.6, true),
    page('ab-distancia-10-a-21km', '', 1, true),
    page('ab-distancia-mas-de-21km', '', 0.4, true),
    page('ab-intensidad-medio', '', 1.5, true),
    page('ab-intensidad-suave', '', 0.9, true),
    page('ab-intensidad-avanzado', '', 0.6, true),
    page('ab-abrir-google-maps', '', 1.4, true),
    page('ab-descargar-gpx', '', 0.6, true),
    page('ruta-generada', 'Ruta generada', 1.2, true),
    page('intensidad-medio', '', 0.7, true),
    page('distancia-8km', '', 0.5, true),
    page('distancia-10km', '', 0.4, true),
    page('abrir-google-maps', '', 0.5, true),
    page('ab-error-al-generar', 'HTTP 429 en valhalla1.openstreetmap.de', 0.15, true),
  ];
  const totalStats = days.map((day, i) => ({ day, daily: hits.filter((h) => !h.event).reduce((s, h) => s + h.stats[i].daily, 0), hourly: new Array(24).fill(0) }));
  const pv = totalStats.reduce((s, x) => s + x.daily, 0);
  const ev = hits.filter((h) => h.event).reduce((s, h) => s + h.count, 0);
  const list = (pairs) => pairs.map(([id, name, f]) => ({ id, name, count: Math.max(1, Math.round(pv * f)) }));
  return {
    total: { total: pv + ev, total_events: ev, stats: totalStats },
    hits: hits.sort((a, b) => b.count - a.count),
    lists: {
      locations: list([['ES', 'Spain', 0.62], ['AR', 'Argentina', 0.14], ['MX', 'Mexico', 0.07], ['US', 'United States', 0.06], ['GB', 'United Kingdom', 0.04], ['JP', 'Japan', 0.02]]),
      sizes: list([['phone', 'Teléfono', 0.64], ['larger', 'Ordenador', 0.31], ['tablet', 'Tablet', 0.05]]),
      browsers: list([['safari', 'Safari', 0.48], ['chrome', 'Chrome', 0.41], ['firefox', 'Firefox', 0.07], ['edge', 'Edge', 0.04]]),
      systems: list([['ios', 'iOS', 0.46], ['android', 'Android', 0.18], ['macos', 'macOS', 0.22], ['windows', 'Windows', 0.14]]),
      toprefs: list([['', '(desconocido)', 0.55], ['danielcs94.github.io', 'danielcs94.github.io', 0.24], ['linkedin.com', 'LinkedIn', 0.12], ['github.com', 'GitHub', 0.09]]),
      languages: list([['es', 'Español', 0.84], ['en', 'Inglés', 0.12], ['ja', 'Japonés', 0.04]]),
    },
    range,
  };
}
