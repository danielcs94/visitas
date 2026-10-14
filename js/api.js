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

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
});

// La API admite 4 peticiones por segundo: se dejan 300 ms entre una y otra, aunque se
// solapen dos cargas, para no recibir rechazos (429) que dejarían listas vacías.
const GAP_MS = 300;
let nextSlot = 0;
async function waitTurn(signal) {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + GAP_MS;
  if (at > now) await sleep(at - now, signal);
}

async function get(config, path, params = {}, signal) {
  const url = new URL(`https://${config.site}.goatcounter.com/api/v0/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 6; attempt++) {
    await waitTurn(signal);
    const r = await fetch(url, { signal, headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' } });
    if (r.ok) return r.json();
    if (r.status === 401 || r.status === 403) {
      throw new Error(`GoatCounter no acepta el token (HTTP ${r.status}). Comprueba que esté copiado entero y con el permiso «Read statistics». Si lo acabas de crear, espera un minuto y pulsa ↻.`);
    }
    if (r.status === 404) {
      throw new Error(`GoatCounter no encuentra los datos (HTTP 404). Revisa el código del sitio («${config.site}»). Si el token es nuevo, espera un minuto y pulsa ↻.`);
    }
    if (r.status === 429) { // límite de peticiones: esperar lo que diga GoatCounter (o un poco más cada vez)
      const reset = Number(r.headers.get('X-Rate-Limit-Reset'));
      await sleep(reset > 0 ? reset * 1000 + 100 : 1000 * (attempt + 1), signal);
      continue;
    }
    if (r.status >= 500 && attempt < 2) { await sleep(800 * (attempt + 1), signal); continue; }
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

// Lo ya descargado se guarda unos minutos por periodo: volver a un filtro es instantáneo y no
// gasta peticiones. El botón ↻ fuerza la descarga.
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

// Todo lo que pinta el panel, en una tanda de peticiones (en serie: la API limita las ráfagas).
// Si una lista falla, falla la carga entera: mejor un aviso que una lista vacía que parece real.
export async function loadStats(config, range, { signal, fresh = false } = {}) {
  const key = `${config.site}|${range.days}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const q = { start: range.start, end: range.end };
  const total = await get(config, 'stats/total', q, signal);
  const hits = await get(config, 'stats/hits', { ...q, limit: 200 }, signal);
  const lists = {};
  for (const page of ['locations', 'sizes', 'browsers', 'systems', 'toprefs', 'languages']) {
    lists[page] = (await get(config, `stats/${page}`, { ...q, limit: 10 }, signal)).stats ?? [];
  }
  const data = { total, hits: hits.hits ?? [], lists, range };
  cache.set(key, { at: Date.now(), data });
  return data;
}

export function clearCache() { cache.clear(); }
