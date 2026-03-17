const { google } = require('googleapis');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function makeOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return client;
}

const FROM = () => process.env.GMAIL_FROM || 'infopetrenaca@gmail.com';

// --- HTML templates ---

function baseTemplate(title, bodyContent) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
    <tr>
      <td style="background:#2e7d32;padding:20px;text-align:center;">
        <h1 style="color:#ffffff;margin:0;font-size:24px;">Infopet</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <h2 style="color:#2e7d32;margin-top:0;">${title}</h2>
        ${bodyContent}
      </td>
    </tr>
    <tr>
      <td style="background:#e8f5e9;padding:16px;text-align:center;font-size:12px;color:#666;">
        Infopet - Sistema de gestion automatizado
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function stockAlertHtml(productos) {
  const rows = productos
    .map(
      (p) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;">${p.nombre}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;text-align:center;color:${p.stock <= 0 ? '#c62828' : '#ef6c00'};font-weight:bold;">${p.stock}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;text-align:center;">${p.minimo}</td>
      </tr>`
    )
    .join('');

  const table = `
    <p style="color:#333;">Los siguientes productos tienen stock critico:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c8e6c9;border-radius:4px;border-collapse:collapse;">
      <tr style="background:#2e7d32;color:#fff;">
        <th style="padding:10px 12px;text-align:left;">Producto</th>
        <th style="padding:10px 12px;text-align:center;">Stock actual</th>
        <th style="padding:10px 12px;text-align:center;">Minimo</th>
      </tr>
      ${rows}
    </table>
    <p style="color:#666;font-size:13px;margin-top:16px;">Se recomienda reabastecer estos productos a la brevedad.</p>`;

  return baseTemplate('Alerta de Stock', table);
}

function ordenCompraHtml(proveedor, productos) {
  const rows = productos
    .map((p) => {
      const subtotal = p.cantidad * p.precio_unitario;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;">${p.nombre}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;text-align:center;">${p.cantidad}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;text-align:right;">$${p.precio_unitario.toLocaleString('es-CL')}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;text-align:right;">$${subtotal.toLocaleString('es-CL')}</td>
      </tr>`;
    })
    .join('');

  const total = productos.reduce((s, p) => s + p.cantidad * p.precio_unitario, 0);

  const table = `
    <p style="color:#333;"><strong>Proveedor:</strong> ${proveedor}</p>
    <p style="color:#333;"><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-CL')}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #c8e6c9;border-radius:4px;border-collapse:collapse;margin-top:12px;">
      <tr style="background:#2e7d32;color:#fff;">
        <th style="padding:10px 12px;text-align:left;">Producto</th>
        <th style="padding:10px 12px;text-align:center;">Cantidad</th>
        <th style="padding:10px 12px;text-align:right;">Precio unit.</th>
        <th style="padding:10px 12px;text-align:right;">Subtotal</th>
      </tr>
      ${rows}
      <tr style="background:#e8f5e9;font-weight:bold;">
        <td colspan="3" style="padding:10px 12px;text-align:right;">Total:</td>
        <td style="padding:10px 12px;text-align:right;">$${total.toLocaleString('es-CL')}</td>
      </tr>
    </table>`;

  return baseTemplate('Orden de Compra', table);
}

// --- Email sending ---

async function sendEmail(to, subject, html) {
  const auth = makeOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth });

  const raw = Buffer.from(
    [
      `From: Infopet <${FROM()}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      html,
    ].join('\r\n')
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return res.data.id;
}

// --- Handler ---

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }

  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido' });
  }

  try {
    const body = req.body;

    let to, subject, html;

    if (body.type === 'stock_alert') {
      if (!body.productos || !body.productos.length) {
        return res.status(400).json({ error: 'Se requiere un array de productos' });
      }
      to = body.to || FROM();
      subject = body.subject || 'Alerta de Stock - Infopet';
      html = stockAlertHtml(body.productos);
    } else if (body.type === 'orden_compra') {
      if (!body.proveedor) {
        return res.status(400).json({ error: 'Se requiere el campo proveedor' });
      }
      if (!body.productos || !body.productos.length) {
        return res.status(400).json({ error: 'Se requiere un array de productos' });
      }
      to = body.to || FROM();
      subject = body.subject || `Orden de Compra - ${body.proveedor} - Infopet`;
      html = ordenCompraHtml(body.proveedor, body.productos);
    } else {
      // Envio directo
      if (!body.to) return res.status(400).json({ error: 'Se requiere el campo to' });
      if (!body.subject) return res.status(400).json({ error: 'Se requiere el campo subject' });
      if (!body.html) return res.status(400).json({ error: 'Se requiere el campo html' });
      to = body.to;
      subject = body.subject;
      html = body.html;
    }

    const messageId = await sendEmail(to, subject, html);
    return res.status(200).json({ success: true, messageId });
  } catch (err) {
    console.error('Error en gmail:', err);
    return res.status(500).json({ error: err.message || 'Error al enviar el correo' });
  }
};
