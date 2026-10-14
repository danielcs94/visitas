// Lectura de estadísticas de la API de GoatCounter (v0). El token se guarda solo en este
// dispositivo (localStorage): nunca está en el código ni en GitHub.

const CONFIG_KEY = 'visitas:config';

export function getConfig() {
  try {
    return { site: 'danielcs', token: '', ...JSON.parse(localStorage.getItem(CONFIG_KEY) ?? '{}') };
  } catch {
    return { site: 'danielcs', token: '' };
  }
}

export function saveConfig(config) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch { /* sin almacenamiento */ }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(config, path, params = {}) {
  const url = new URL(`https://${config.site}.goatcounter.com/api/v0/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' } });
    if (r.ok) return r.json();
    if (r.status === 401 || r.status === 403) {
      throw new Error(`GoatCounter no acepta el token (HTTP ${r.status}). Comprueba que esté copiado entero y con el permiso «Read statistics». Si lo acabas de crear, espera un minuto y pulsa ↻.`);
    }
    if (r.status === 404) {
      throw new Error(`GoatCounter no encuentra los datos (HTTP 404). Revisa el código del sitio («${config.site}»). Si el token es nuevo, espera un minuto y pulsa ↻.`);
    }
    if (r.status === 429) { await sleep(1000 * (attempt + 1)); continue; } // límite de peticiones
    throw new Error(`GoatCounter respondió con un error (HTTP ${r.status}).`);
  }
  throw new Error('GoatCounter está limitando las peticiones. Prueba otra vez en un minuto.');
}

// Fechas en el formato que pide la API (redondeadas a la hora, en UTC)
const iso = (d) => `${d.toISOString().slice(0, 13)}:00:00Z`;

export function rangeFor(days) {
  const end = new Date();
  end.setUTCHours(end.getUTCHours() + 1, 0, 0, 0);       // hasta el final de la hora actual
  // Desde el inicio del día de hace (days - 1) días: "Hoy" es solo hoy y "7 días" son 7 días
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);
  return { start: iso(start), end: iso(end), days };
}

// Todo lo que pinta el panel, en una tanda de peticiones (en serie: la API limita las ráfagas)
export async function loadStats(config, range) {
  const q = { start: range.start, end: range.end };
  const total = await get(config, 'stats/total', q);
  const hits = await get(config, 'stats/hits', { ...q, limit: 200 });
  const lists = {};
  for (const page of ['locations', 'sizes', 'browsers', 'systems', 'toprefs', 'languages']) {
    try {
      lists[page] = (await get(config, `stats/${page}`, { ...q, limit: 10 })).stats ?? [];
    } catch (e) {
      if (/token|sitio/.test(e.message)) throw e;
      lists[page] = [];
    }
  }
  return { total, hits: hits.hits ?? [], lists, range };
}
