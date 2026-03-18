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
    // Fetch everything in parallel — only 4 API calls total
    const [bsaleProducts, bsaleStocks, jsCount, stocksPage1] = await Promise.all([
      bsaleFetch('/products.json?limit=1&state=0'),
      bsaleFetch('/stocks.json?limit=1&quantity=0'),
      jumpsellerFetch('/products/count.json'),
      bsaleFetch('/stocks.json?limit=50&offset=0'),
    ]);

    // Process stocks into summary
    const allStocks = stocksPage1.items || [];
    let urgent = 0, possible = 0, full = 0;
    const stockList = [];

    for (const s of allStocks) {
      const qty = s.quantity || 0;
      const variantId = s.variant ? s.variant.id : null;
      const status = qty === 0 ? 'red' : qty <= 5 ? 'amber' : 'green';
      if (qty === 0) urgent++;
      else if (qty <= 5) possible++;
      else full++;
      stockList.push({ variantId, quantity: qty, status });
    }

    // Fetch more stock pages if available (with delay to respect rate limit)
    let offset = 50;
    const totalStocks = stocksPage1.count || 0;
    while (offset < totalStocks && offset < 200) {
      await new Promise(r => setTimeout(r, 500)); // 500ms delay between pages
      try {
        const page = await bsaleFetch('/stocks.json?limit=50&offset=' + offset);
        const items = page.items || [];
        for (const s of items) {
          const qty = s.quantity || 0;
          const variantId = s.variant ? s.variant.id : null;
          const status = qty === 0 ? 'red' : qty <= 5 ? 'amber' : 'green';
          if (qty === 0) urgent++;
          else if (qty <= 5) possible++;
          else full++;
          stockList.push({ variantId, quantity: qty, status });
        }
        if (items.length < 50) break;
        offset += 50;
      } catch (e) { break; }
    }

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      cached_for: '10 minutos',
      metrics: {
        bsale_products: bsaleProducts.count || 0,
        jumpseller_products: jsCount.count || 0,
        stock_critico: bsaleStocks.count || 0,
        total_stocks: totalStocks,
      },
      stock_summary: { urgent, possible, full },
      stock_list: stockList,
    });
  } catch (err) {
    // Don't cache errors
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(500).json({ error: err.message });
  }
}
