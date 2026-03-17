// Infopet — Sincronización de stock Bsale ↔ Jumpseller
// Con backup automático antes de cualquier escritura
// WRITE_MODE protege contra escrituras accidentales

import { requireWriteAccess } from './config.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// --- Bsale helpers ---

async function bsaleFetch(path) {
  const res = await fetch(`https://api.bsale.cl/v1${path}`, {
    headers: { access_token: process.env.BSALE_TOKEN },
  });
  if (!res.ok) throw new Error(`Bsale error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getBsaleProducts() {
  const all = [];
  let offset = 0;
  const limit = 50;
  while (true) {
    const data = await bsaleFetch(`/products.json?limit=${limit}&offset=${offset}&state=0`);
    if (!data.items || data.items.length === 0) break;
    all.push(...data.items);
    if (data.items.length < limit) break;
    offset += limit;
  }
  return all;
}

async function getBsaleVariants(productId) {
  const data = await bsaleFetch(`/products/${productId}/variants.json`);
  return data.items || [];
}

async function getBsaleStock(variantId) {
  const data = await bsaleFetch(`/stocks.json?variant=${variantId}`);
  const items = data.items || [];
  return items.reduce((sum, s) => sum + (s.quantity || 0), 0);
}

async function getBsaleProductsBySku(sku) {
  const data = await bsaleFetch(`/products.json?code=${encodeURIComponent(sku)}&state=0`);
  return data.items || [];
}

// --- Jumpseller helpers ---

function jsQuery() {
  return `login=${process.env.JUMPSELLER_LOGIN}&authtoken=${process.env.JUMPSELLER_AUTH_TOKEN}`;
}

async function jumpsellerFetch(path, options = {}) {
  const url = `https://api.jumpseller.com/v1${path}${path.includes('?') ? '&' : '?'}${jsQuery()}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) throw new Error(`Jumpseller error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getJumpsellerProducts() {
  const all = [];
  let page = 1;
  const limit = 50;
  while (true) {
    const data = await jumpsellerFetch(`/products.json?limit=${limit}&page=${page}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < limit) break;
    page++;
  }
  return all;
}

async function findJumpsellerBySku(sku) {
  const data = await jumpsellerFetch(`/products.json?limit=50&query=${encodeURIComponent(sku)}`);
  if (!data) return null;
  const found = data.find((p) => {
    const prod = p.product || p;
    return prod.sku === sku;
  });
  return found ? found.product || found : null;
}

async function updateJumpsellerStock(productId, stock) {
  return jumpsellerFetch(`/products/${productId}.json`, {
    method: 'PUT',
    body: JSON.stringify({ product: { stock } }),
  });
}

// --- Backup antes de sincronizar ---

async function backupBeforeSync() {
  const productos = await getJumpsellerProducts();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupData = productos.map(p => {
    const prod = p.product || p;
    return {
      id: prod.id,
      name: prod.name,
      sku: prod.sku,
      stock: prod.stock,
      price: prod.price,
      timestamp: new Date().toISOString()
    };
  });

  // Intentar guardar backup en Google Sheets si está configurado
  try {
    const creds = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const sheetId = process.env.GOOGLE_SHEETS_ID;
    if (creds && sheetId) {
      const { google } = await import('googleapis');
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(creds),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });
      const sheetName = `BACKUP_${timestamp}`;

      // Crear pestaña de backup
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{
            addSheet: { properties: { title: sheetName } }
          }]
        }
      });

      // Escribir encabezados + datos
      const header = ['ID', 'Nombre', 'SKU', 'Stock', 'Precio', 'Timestamp'];
      const rows = backupData.map(p => [p.id, p.name, p.sku, p.stock, p.price, p.timestamp]);

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [header, ...rows] }
      });

      return { backupSheet: sheetName, count: backupData.length, saved: true };
    }
  } catch (err) {
    console.error('Error guardando backup en Sheets:', err.message);
  }

  // Si no hay Sheets, retornar backup en memoria
  return { backupSheet: `BACKUP_${timestamp}`, count: backupData.length, saved: false, data: backupData };
}

// --- Actions ---

async function compare() {
  const [bsaleProducts, jsProducts] = await Promise.all([
    getBsaleProducts(),
    getJumpsellerProducts(),
  ]);

  // Build Jumpseller map by SKU
  const jsMap = {};
  for (const item of jsProducts) {
    const prod = item.product || item;
    if (prod.sku) jsMap[prod.sku] = prod;
  }

  const results = [];

  for (const bp of bsaleProducts) {
    const variants = await getBsaleVariants(bp.id);
    for (const v of variants) {
      const sku = v.code || v.barCode;
      if (!sku) continue;

      const stockBsale = await getBsaleStock(v.id);
      const jsProd = jsMap[sku];
      const stockJs = jsProd ? (jsProd.stock || 0) : null;

      results.push({
        sku,
        nombre: bp.name || v.description || sku,
        stock_bsale: stockBsale,
        stock_jumpseller: stockJs,
        diferencia: stockJs !== null ? stockBsale - stockJs : null,
      });
    }
  }

  return results;
}

async function fix(sku) {
  if (!sku) throw new Error('Se requiere el parámetro sku');

  // Get Bsale stock
  const bsaleProds = await getBsaleProductsBySku(sku);
  if (!bsaleProds.length) throw new Error(`No se encontró producto en Bsale con SKU: ${sku}`);

  const bp = bsaleProds[0];
  const variants = await getBsaleVariants(bp.id);
  const variant = variants.find((v) => v.code === sku || v.barCode === sku);
  if (!variant) throw new Error(`No se encontró variante en Bsale con SKU: ${sku}`);

  const stockBsale = await getBsaleStock(variant.id);

  // Find and update in Jumpseller
  const jsProd = await findJumpsellerBySku(sku);
  if (!jsProd) throw new Error(`No se encontró producto en Jumpseller con SKU: ${sku}`);

  await updateJumpsellerStock(jsProd.id, stockBsale);

  return { success: true, sku, nuevo_stock: stockBsale };
}

async function fixAll() {
  // 1. BACKUP AUTOMÁTICO
  const backup = await backupBeforeSync();
  console.log(`Backup creado: ${backup.backupSheet} (${backup.count} productos)`);

  // 2. Comparar
  const diferencias = await compare();
  const conDiferencia = diferencias.filter(d => d.diferencia !== null && d.diferencia !== 0);

  if (conDiferencia.length === 0) {
    return { success: true, message: 'Todo sincronizado, sin diferencias', backup: backup.backupSheet };
  }

  // 3. Sincronizar cada diferencia
  const resultados = [];
  for (const item of conDiferencia) {
    try {
      const r = await fix(item.sku);
      resultados.push({ ...r, status: 'ok' });
    } catch (err) {
      resultados.push({ sku: item.sku, status: 'error', error: err.message });
    }
  }

  return {
    success: true,
    backup: backup.backupSheet,
    total: conDiferencia.length,
    sincronizados: resultados.filter(r => r.status === 'ok').length,
    errores: resultados.filter(r => r.status === 'error').length,
    detalle: resultados
  };
}

// --- Handler ---

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { action, sku } = req.query;

  try {
    // compare es solo lectura → siempre permitido
    if (action === 'compare') {
      const data = await compare();
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(200).json(data);
    }

    // fix y fix_all modifican datos → requieren WRITE_MODE
    if (action === 'fix') {
      if (!requireWriteAccess(res)) return;

      // Backup antes de fix individual
      const backup = await backupBeforeSync();
      console.log(`Backup pre-fix: ${backup.backupSheet}`);

      const data = await fix(sku);
      data.backup = backup.backupSheet;
      return res.status(200).json(data);
    }

    if (action === 'fix_all') {
      if (!requireWriteAccess(res)) return;

      const data = await fixAll();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Acción no válida. Usa action=compare, action=fix&sku=XXX, o action=fix_all' });
  } catch (err) {
    console.error('Error en sync:', err);
    return res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
}
