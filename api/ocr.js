// Infopet — OCR de facturas físicas con Claude Vision

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido, usa POST' });
  }

  const { image, mediaType } = req.body || {};

  if (!image || !mediaType) {
    return res.status(400).json({ error: 'Faltan campos requeridos: image (base64) y mediaType' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en el servidor' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: image
              }
            },
            {
              type: 'text',
              text: 'Analiza esta factura chilena y extrae los datos en JSON exacto con esta estructura: {rut_proveedor, numero_factura, fecha (YYYY-MM-DD), proveedor_nombre, proveedor_giro, productos: [{nombre, variante, cantidad, precio_unitario, codigo_barra, sku}], subtotal, iva, total}. Responde SOLO con el JSON válido, sin texto adicional.'
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: 'Error de Anthropic API: ' + err });
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';

    // Parsear JSON de la respuesta
    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Error procesando OCR: ' + err.message });
  }
}
