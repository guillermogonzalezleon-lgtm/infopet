// Infopet — Proxy seguro para Bsale API
// Nunca expone el token al cliente

const ALLOWED_ENDPOINTS = [
  'products', 'variants', 'stocks', 'documents', 'clients',
  'product_types', 'brands', 'price_lists', 'offices', 'payments'
];

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint, ...params } = req.query;

  if (!endpoint) {
    return res.status(400).json({ error: 'Falta el parámetro endpoint' });
  }

  // Validar endpoint contra lista blanca
  const base = endpoint.split('/')[0].split('.')[0];
  if (!ALLOWED_ENDPOINTS.includes(base)) {
    return res.status(403).json({ error: `Endpoint "${base}" no permitido` });
  }

  const token = process.env.BSALE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BSALE_TOKEN no configurado en el servidor' });
  }

  try {
    const query = new URLSearchParams(params).toString();
    const url = `https://api.bsale.cl/v1/${endpoint}${query ? '?' + query : ''}`;

    const fetchOpts = {
      method: req.method,
      headers: {
        'access_token': token,
        'Content-Type': 'application/json'
      }
    };

    if (['POST', 'PUT'].includes(req.method) && req.body) {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, fetchOpts);
    const data = await response.json();

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Error conectando con Bsale: ' + err.message });
  }
}
