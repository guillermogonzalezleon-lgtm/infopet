/* ═══════════════════════════════════════
   Infopet — Funciones compartidas
   ═══════════════════════════════════════ */

/** Formatea número como $X.XXX CLP */
function fmt(n) {
  if (n == null || isNaN(n)) return '$0';
  return '$' + Math.round(Number(n)).toLocaleString('es-CL');
}

/** Promise que espera ms milisegundos */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Muestra alerta en un elemento
 * @param {HTMLElement} el - Contenedor de la alerta
 * @param {'ok'|'err'|'warn'|'info'} type - Tipo de alerta
 * @param {string} msg - Mensaje a mostrar
 */
function showAlert(el, type, msg) {
  el.className = 'alert visible alert-' + type;
  el.textContent = msg;
  if (type === 'ok' || type === 'info') {
    setTimeout(() => { el.classList.remove('visible'); }, 5000);
  }
}

/** Genera SKU automático desde nombre de producto
 * "BARF CAJA DIETA DE PAVO 4kg" → "BARF-CAJ-DIE-PAV"
 */
function autoSKU(name) {
  if (!name) return '';
  const words = name.trim().toUpperCase()
    .replace(/[^A-ZÁÉÍÓÚÑ0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1 && !['DE', 'EL', 'LA', 'LOS', 'LAS', 'EN', 'CON', 'POR', 'PARA', 'UN', 'UNA'].includes(w));
  return words.slice(0, 4).map(w => w.substring(0, 3)).join('-');
}

/** Caché en memoria — guarda respuestas por 5 min para no saturar Bsale */
var _cache = {};
var CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/** Fetch wrapper con caché + retry en rate limit */
async function apiFetch(url, opts = {}) {
  // Solo cachear GETs
  var isGet = !opts.method || opts.method === 'GET';
  if (isGet && _cache[url] && (Date.now() - _cache[url].ts < CACHE_TTL)) {
    return _cache[url].data;
  }

  var attempts = 0;
  var maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      var res = await fetch(url, opts);

      // Rate limit — esperar y reintentar
      if (res.status === 429) {
        attempts++;
        if (attempts < maxAttempts) {
          await sleep(10000); // esperar 10 segundos
          continue;
        }
      }

      if (!res.ok) {
        var body = await res.text();
        throw new Error('Error ' + res.status + ': ' + (body || res.statusText));
      }

      var data = await res.json();

      // Guardar en caché si es GET
      if (isGet) {
        _cache[url] = { data: data, ts: Date.now() };
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError') {
        throw new Error('Sin conexión al servidor. Verifica tu internet.');
      }
      if (attempts >= maxAttempts - 1) throw err;
      attempts++;
      await sleep(5000);
    }
  }
}

/** Ejecuta múltiples promesas en paralelo y reporta progreso
 * @param {Array<{name: string, fn: () => Promise}>} tasks
 * @param {function} onProgress - callback({name, status, result, error, done, total})
 */
async function parallelTasks(tasks, onProgress) {
  let done = 0;
  const total = tasks.length;
  const results = {};

  await Promise.allSettled(tasks.map(async (task) => {
    try {
      const result = await task.fn();
      done++;
      results[task.name] = { status: 'ok', result };
      if (onProgress) onProgress({ name: task.name, status: 'ok', result, done, total });
    } catch (error) {
      done++;
      results[task.name] = { status: 'err', error: error.message };
      if (onProgress) onProgress({ name: task.name, status: 'err', error: error.message, done, total });
    }
  }));

  return results;
}

/** Muestra banner de ambiente si no es producción.
 *  Llama a /api/env y si hay banner, lo muestra arriba de todo.
 */
async function checkEnvironment() {
  try {
    const res = await fetch('/api/env');
    const info = await res.json();
    if (info.banner) {
      const banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#D4A843;color:#1A1A18;text-align:center;padding:8px 16px;font-size:13px;font-weight:600;font-family:DM Sans,sans-serif;';
      banner.textContent = info.banner;
      document.body.prepend(banner);
      // Ajustar padding del body para que no tape el contenido
      document.body.style.paddingTop = '36px';
    }
    return info;
  } catch (e) {
    return { environment: 'unknown', writeEnabled: false };
  }
}

// Auto-ejecutar al cargar
document.addEventListener('DOMContentLoaded', checkEnvironment);
