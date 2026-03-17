const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extraHeaders },
  });
}

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
  return `login=${process.env.JUMPSELLER_LOGIN}&authtoken=${process.env.JUMPSELLER_TOKEN}`;
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
  if (!sku) throw new Error('Se requiere el parametro sku');

  // Get Bsale stock
  const bsaleProds = await getBsaleProductsBySku(sku);
  if (!bsaleProds.length) throw new Error(`No se encontro producto en Bsale con SKU: ${sku}`);

  const bp = bsaleProds[0];
  const variants = await getBsaleVariants(bp.id);
  const variant = variants.find((v) => v.code === sku || v.barCode === sku);
  if (!variant) throw new Error(`No se encontro variante en Bsale con SKU: ${sku}`);

  const stockBsale = await getBsaleStock(variant.id);

  // Find and update in Jumpseller
  const jsProd = await findJumpsellerBySku(sku);
  if (!jsProd) throw new Error(`No se encontro producto en Jumpseller con SKU: ${sku}`);

  await updateJumpsellerStock(jsProd.id, stockBsale);

  return { success: true, sku, nuevo_stock: stockBsale };
}

// --- Handler ---

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS_HEADERS).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  const { action, sku } = req.query;

  try {
    if (action === 'compare') {
      const data = await compare();
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(200).json(data);
    }

    if (action === 'fix') {
      const data = await fix(sku);
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Accion no valida. Usa action=compare o action=fix&sku=XXX' });
  } catch (err) {
    console.error('Error en sync:', err);
    return res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
}
