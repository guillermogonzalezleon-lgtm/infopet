// Infopet — Proxy seguro para Jumpseller API
// Nunca expone credenciales al cliente

const ALLOWED_ENDPOINTS = [
  'products', 'orders', 'categories', 'stock'
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

  const login = process.env.JUMPSELLER_LOGIN;
  const authtoken = process.env.JUMPSELLER_AUTH_TOKEN;

  if (!login || !authtoken) {
    return res.status(500).json({ error: 'Credenciales de Jumpseller no configuradas en el servidor' });
  }

  try {
    // Construir query params: auth + extras
    const qs = new URLSearchParams({ login, authtoken, ...params }).toString();
    const url = `https://api.jumpseller.com/v1/${endpoint}?${qs}`;

    const fetchOpts = {
      method: req.method,
      headers: {
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
    return res.status(500).json({ error: 'Error conectando con Jumpseller: ' + err.message });
  }
}
