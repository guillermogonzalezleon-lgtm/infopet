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

/** Fetch wrapper con manejo de errores en español */
async function apiFetch(url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Error ${res.status}: ${body || res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'TypeError') {
      throw new Error('Sin conexión al servidor. Verifica tu internet.');
    }
    throw err;
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
