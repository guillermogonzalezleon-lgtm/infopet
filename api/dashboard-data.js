// Infopet — Endpoint agregado con caché CDN
// Una sola llamada → todos los datos del dashboard
// Vercel CDN cachea por 10 min (s-maxage=600)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Solo GET' });

  // CDN cache 10 min, stale-while-revalidate 20 min
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');

  const bsaleToken = process.env.BSALE_TOKEN;
  const jsLogin = process.env.JUMPSELLER_LOGIN;
  const jsAuth = process.env.JUMPSELLER_AUTH_TOKEN;

  async function bsaleFetch(path) {
    const r = await fetch('https://api.bsale.cl/v1' + path, {
      headers: { 'access_token': bsaleToken }
    });
    if (!r.ok) throw new Error('Bsale ' + r.status);
    return r.json();
  }

  async function jumpsellerFetch(path) {
    const r = await fetch('https://api.jumpseller.com/v1' + path +
      (path.includes('?') ? '&' : '?') + 'login=' + jsLogin + '&authtoken=' + jsAuth);
    if (!r.ok) throw new Error('Jumpseller ' + r.status);
    return r.json();
  }

  try {
    // Solo 3 llamadas iniciales en paralelo
    const [bsaleProducts, jsCount, stocksPage1] = await Promise.all([
      bsaleFetch('/products.json?limit=1&state=0'),
      jumpsellerFetch('/products/count.json'),
      bsaleFetch('/stocks.json?limit=50&offset=0'),
    ]);

    // Procesar stocks — paginar todo para tener el conteo real
    const allStocks = [...(stocksPage1.items || [])];
    const totalStocks = stocksPage1.count || 0;

    // Paginar el resto con delays para respetar rate limit
    let offset = 50;
    while (offset < totalStocks && offset < 2500) {
      await new Promise(r => setTimeout(r, 800));
      try {
        const page = await bsaleFetch('/stocks.json?limit=50&offset=' + offset);
        const items = page.items || [];
        allStocks.push(...items);
        if (items.length < 50) break;
        offset += 50;
      } catch (e) { break; }
    }

    // Calcular resumen como Bsale: con stock vs sin stock
    let conStock = 0;      // Productos CON stock (>0) — el 1.015 de Bsale
    let sinStock = 0;      // Productos SIN stock (=0)
    let stockBajo = 0;     // Stock entre 1-5
    let stockFull = 0;     // Stock > 5
    let totalUnidades = 0;
    const stockList = [];

    for (const s of allStocks) {
      const qty = s.quantity || 0;
      const available = s.quantityAvailable || 0;
      const variantId = s.variant ? s.variant.id : null;

      totalUnidades += qty;

      if (qty === 0) {
        sinStock++;
        stockList.push({ variantId, quantity: qty, status: 'red' });
      } else if (qty <= 5) {
        conStock++;
        stockBajo++;
        stockList.push({ variantId, quantity: qty, status: 'amber' });
      } else {
        conStock++;
        stockFull++;
        stockList.push({ variantId, quantity: qty, status: 'green' });
      }
    }

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      cached_for: '10 minutos',
      metrics: {
        // Número principal: productos CON stock (como muestra Bsale)
        bsale_products: conStock,
        bsale_total_catalogo: bsaleProducts.count || 0,
        jumpseller_products: jsCount.count || 0,
        stock_critico: sinStock,
        total_unidades: totalUnidades,
        total_stocks: totalStocks,
      },
      stock_summary: {
        urgent: sinStock,
        possible: stockBajo,
        full: stockFull,
      },
      stock_list: stockList,
    });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(500).json({ error: err.message });
  }
}
